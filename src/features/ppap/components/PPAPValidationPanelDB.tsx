'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { currentUser } from '@/src/lib/mockUser';
import { 
  DBValidation,
  ValidationCategory,
  ValidationStatus,
  getValidations,
  updateValidationStatus,
  isPreAckReady,
  isPostAckReady,
  getValidationSummary,
  canUpdateValidation,
} from '../utils/validationDatabase';
import { getValidationGuidance } from '../utils/validationGuidance';
import { PPAPStatus } from '@/src/types/database.types';
import { mapStatusToState } from '../utils/ppapTableHelpers';
import { canEditPreAckValidations, canEditPostAckValidations, mapStatusToPhase } from '../utils/stateWorkflowMapping';
import { CurrentTaskBanner } from './CurrentTaskBanner';
import { executeValidationStep, isValidationStepClickable } from '../workflow/validationStepExecutor';
import { ValidationStepWorkspace } from './ValidationStepWorkspace';
import { DerivedPPAPState } from '../utils/derivedStateMachine';

/**
 * Phase 3H - Persistent Validation Engine
 * Phase 3H.1 - Active Work Zone with collapsible sections
 * 
 * Database-backed validation panel with auto state transitions.
 */

interface Props {
  ppapId: string;
  currentPhase: 'pre-ack' | 'post-ack';
  derivedState: string; // V3.5: Derived state from parent
  uiModel: {
    state: string;
    task: string;
    reason: string;
    canProgress: boolean;
    phaseLabel: string;
    validationProgress: {
      intake: { complete: number; total: number };
      preAck: { complete: number; total: number };
      postAck: { complete: number; total: number };
    };
    documentProgress: { complete: number; total: number };
  };
}

const STATUS_ICONS = {
  not_started: '☐',
  in_progress: '⏳',
  complete: '✓',
  approved: '✔',
};

const STATUS_COLORS = {
  not_started: 'text-gray-400 bg-gray-100',
  in_progress: 'text-blue-600 bg-blue-100',
  complete: 'text-green-600 bg-green-100',
  approved: 'text-purple-600 bg-purple-100',
};

export default function PPAPValidationPanelDB({ ppapId, currentPhase, derivedState, uiModel }: Props) {
  const router = useRouter();
  const [validations, setValidations] = useState<DBValidation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(false);
  const [currentUser] = useState({ id: 'user-123', name: 'Current User', role: 'engineer' as const });
  
  // V4.0: Validation step workspace state
  const [activeWorkspace, setActiveWorkspace] = useState<{
    validationKey: string;
    validation: DBValidation;
  } | null>(null);

  // Phase 3H.13: Section states
  const [isExpanded, setIsExpanded] = useState(true);
  
  // V3.5: Use uiModel state instead of ppapStatus
  const canEditPreAck = canEditPreAckValidations(derivedState);
  const canEditPostAck = canEditPostAckValidations(derivedState);
  
  // V3.5: Use uiModel.state to determine active sections
  const showPreAckActive = uiModel.state === 'INTAKE' || uiModel.state === 'PRE_ACK_VALIDATION';
  const showPostAckActive = uiModel.state === 'DOCUMENTATION' || uiModel.state === 'SUBMISSION_READY';

  // Phase 3H.13.5: Fetch validations with auto-retry (system handles failure)
  useEffect(() => {
    async function fetchValidations() {
      try {
        setLoading(true);
        setInitializing(true);
        setError(null);
        
        // Phase 3H.13.5: Auto-retry on failure (ONE attempt)
        let data: DBValidation[];
        try {
          // V3.6: Pass undefined for ppapStatus - panel doesn't have access to it
          // If validations are truly missing, this will fail appropriately
          data = await getValidations(ppapId);
        } catch (firstError) {
          console.warn('⚠️ Retrying validation initialization...', firstError);
          // Auto-retry once
          data = await getValidations(ppapId);
        }
        
        // Phase 3H.11: Log validation data for debugging
        console.log('VALIDATION DATA CHECK', { 
          ppapId, 
          validations: data,
          count: data.length 
        });
        
        setValidations(data);
        setInitializing(false);
      } catch (err) {
        console.error('Failed to fetch validations after retry:', err);
        // Phase 3H.13.5: System error (no user recovery needed)
        setError('System error: Unable to initialize validation data. Please contact support.');
        setInitializing(false);
      } finally {
        setLoading(false);
      }
    }

    fetchValidations();
  }, [ppapId]);

  // Phase 3F.13: Define ordered validation sequence for Pre-Ack
  const PRE_ACK_ORDER = [
    'drawing_verification',
    'bom_review',
    'tooling_validation',
    'material_availability',
    'psw_presence',
    'discrepancy_resolution',
  ];

  // Phase 3H.11: Filter validations by category
  const preAckValidations = validations
    .filter((v) => v.category === 'pre-ack')
    .sort((a, b) => {
      const aIndex = PRE_ACK_ORDER.indexOf(a.validation_key);
      const bIndex = PRE_ACK_ORDER.indexOf(b.validation_key);
      return aIndex - bIndex;
    });
  
  const postAckValidations = validations.filter((v) => v.category === 'post-ack');

  // Phase 3F.13: Determine active step (first incomplete required validation)
  const activeStepIndex = preAckValidations.findIndex(
    (v) => v.required && v.status !== 'complete' && v.status !== 'approved'
  );
  const activeStep = activeStepIndex >= 0 ? preAckValidations[activeStepIndex] : null;
  const completedSteps = preAckValidations.filter(
    (v) => v.status === 'complete' || v.status === 'approved'
  ).length;

  // Phase 3F.13: Log validation flow
  console.log('🧭 VALIDATION FLOW', {
    activeStep: activeStep?.name || 'All complete',
    activeStepKey: activeStep?.validation_key || null,
    completedSteps,
    totalSteps: preAckValidations.length,
  });

  // V4.0: New validation click handler - opens workspace for wired steps
  const handleValidationClick = async (validation: DBValidation) => {
    // Phase 3F: Check if validation is editable based on state
    if (validation.category === 'pre-ack' && !canEditPreAck) {
      return; // Pre-ack validations locked after acknowledgement
    }
    if (validation.category === 'post-ack' && !canEditPostAck) {
      return; // Post-ack validations locked before acknowledgement
    }

    if (updatingId) return; // Prevent concurrent updates

    // Determine validation state
    const isComplete = validation.status === 'complete' || validation.status === 'approved';
    const isActive = validation.category === 'pre-ack' && activeStep?.id === validation.id;
    const isLocked = validation.category === 'pre-ack' && !isComplete && !isActive && validation.required;

    // V4.0: Try to execute validation step action (opens workspace if wired)
    const executed = executeValidationStep(
      {
        validation,
        derivedState: derivedState as DerivedPPAPState,
        ppapId,
        isActive,
        isLocked,
        isComplete,
      },
      (validationKey, val) => {
        // Open workspace
        setActiveWorkspace({ validationKey, validation: val });
      }
    );

    // If step was executed (workspace opened), return early
    if (executed) {
      return;
    }

    // V4.0: Fallback to legacy cycle behavior for unwired steps
    // This allows existing functionality to continue working
    
    // Determine next status
    const statusCycle = validation.requires_approval
      ? ['not_started', 'in_progress', 'complete', 'approved']
      : ['not_started', 'in_progress', 'complete'];

    const currentIndex = statusCycle.indexOf(validation.status);
    const nextIndex = (currentIndex + 1) % statusCycle.length;
    const nextStatus = statusCycle[nextIndex] as ValidationStatus;

    // Phase 3H: Check role-based permissions
    const permission = canUpdateValidation(validation, currentUser.role, nextStatus);
    if (!permission.allowed) {
      setError(permission.reason || 'Not allowed');
      setTimeout(() => setError(null), 3000);
      return;
    }

    setUpdatingId(validation.id);
    setError(null);

    try {
      // Update validation in database
      const updated = await updateValidationStatus(
        validation.id,
        nextStatus,
        currentUser.id,
        currentUser.role
      );

      // Update local state
      setValidations(prev =>
        prev.map(v => (v.id === validation.id ? updated : v))
      );

      // V3.4 Phase 2: State derives automatically from data - no manual transitions needed
      // Refresh UI to show new derived state
      router.refresh();
    } catch (err) {
      console.error('Failed to update validation:', err);
      setError(err instanceof Error ? err.message : 'Failed to update validation');
    } finally {
      setUpdatingId(null);
    }
  };

  // V3.4 Phase 2: Auto-transitions removed - state derives automatically from validation data
  // No manual state updates needed - derivePPAPState() handles all state logic

  const renderValidationSection = (
    title: string,
    category: ValidationCategory,
    validationList: DBValidation[]
  ) => {
    // Phase 3H.11/3H.12: Enhanced validation display - clear messaging, no confusing 0/0
    const isEditable = category === 'pre-ack' ? canEditPreAck : canEditPostAck;
    const hasValidations = validationList.length > 0;

    // Phase 3H.13.5: System handles initialization (no user action needed)
    if (!hasValidations) {
      return (
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800 font-medium">🔄 Validation requirements being initialized</p>
            <p className="text-xs text-blue-700 mt-1">System is setting up validation tracking automatically</p>
          </div>
        </div>
      );
    }

    // Phase 3H.12: Smart summary display
    const completedCount = validationList.filter(
      v => v.status === 'complete' || v.status === 'approved'
    ).length;
    const totalCount = validationList.filter(v => v.required).length;
    const summaryText = totalCount === 0 ? 'No required items' : `${completedCount} of ${totalCount} Complete`;

    return (
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <span className="text-sm font-medium text-gray-600">{summaryText}</span>
        </div>

        <div className="space-y-2">
          {validationList.map((validation, index) => {
            const isUpdating = updatingId === validation.id;
            
            // Phase 3F.13: Determine validation state (ACTIVE, COMPLETE, LOCKED)
            const isComplete = validation.status === 'complete' || validation.status === 'approved';
            const isActive = category === 'pre-ack' && activeStep?.id === validation.id;
            const isLocked = category === 'pre-ack' && !isComplete && !isActive && validation.required;
            
            // V4.0: Check if step is clickable (has wired action or legacy cycle)
            const hasWiredAction = isValidationStepClickable(
              validation,
              derivedState as DerivedPPAPState,
              isActive,
              isLocked,
              isComplete
            );
            
            // Phase 3F.13: Override flexibility - allow if already complete
            const canClick = isEditable && !isUpdating && !isLocked;

            return (
              <div
                key={validation.id}
                onClick={() => canClick && handleValidationClick(validation)}
                className={`flex items-center justify-between p-3 bg-white rounded-lg transition-all ${
                  isActive
                    ? 'border-2 border-blue-500 shadow-md'
                    : isComplete
                    ? 'border border-green-300 bg-green-50'
                    : isLocked
                    ? 'border border-gray-200 opacity-50'
                    : 'border border-gray-200'
                } ${
                  canClick ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-not-allowed'
                }`}
                title={
                  isLocked
                    ? 'Complete previous step first'
                    : isActive
                    ? 'Current active step'
                    : isComplete
                    ? 'Completed'
                    : ''
                }
              >
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">
                    {isUpdating ? '⏳' : isActive ? '👉' : STATUS_ICONS[validation.status]}
                  </span>
                  <div className="flex-1">
                    <div className="group relative inline-block">
                      <div className={`font-medium border-b border-dotted cursor-help ${
                        isActive ? 'text-blue-700 border-blue-400' : 'text-gray-900 border-gray-400'
                      }`}>
                        {validation.name}
                        {isActive && <span className="ml-2 text-xs font-semibold text-blue-600">(ACTIVE)</span>}
                        {isLocked && <span className="ml-2 text-xs font-semibold text-gray-400">(LOCKED)</span>}
                      </div>
                      {getValidationGuidance(validation.validation_key) && (
                        <div className="absolute left-0 top-full mt-1 hidden group-hover:block bg-gray-800 text-white text-xs p-3 rounded-lg w-72 z-10 shadow-lg">
                          <div className="font-semibold mb-1">
                            {getValidationGuidance(validation.validation_key)?.title}
                          </div>
                          <div className="text-gray-300">
                            {getValidationGuidance(validation.validation_key)?.description}
                          </div>
                        </div>
                      )}
                    </div>
                    {validation.requires_approval && (
                      <div className="text-xs text-gray-500 mt-1">
                        Requires Coordinator Approval
                      </div>
                    )}
                    {validation.completed_by && (
                      <div className="text-xs text-gray-500 mt-1">
                        Completed by: {validation.completed_by}
                      </div>
                    )}
                    {validation.approved_by && (
                      <div className="text-xs text-gray-500">
                        Approved by: {validation.approved_by}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 text-xs font-medium rounded-full ${
                      STATUS_COLORS[validation.status]
                    }`}
                  >
                    {validation.status.replace('_', ' ')}
                  </span>
                  
                  {/* V4.0: Visual affordance for wired validation steps */}
                  {hasWiredAction && isActive && (
                    <svg 
                      className="w-5 h-5 text-blue-600" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <title>Click to open workspace</title>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Phase 3H.13.5: Loading state with clear messaging
  if (loading) {
    return (
      <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
        <div className="text-center">
          {initializing ? (
            <div className="space-y-2">
              <div className="text-gray-700 font-medium">⏳ Initializing validation requirements...</div>
              <div className="text-sm text-gray-500">Setting up validation tracking for this PPAP</div>
            </div>
          ) : (
            <div className="text-gray-500">Loading validations...</div>
          )}
        </div>
      </div>
    );
  }

  // V3.4 Phase 2.5: Data-driven completion checks (use existing filtered arrays)
  const preAckReady = isPreAckReady(validations);
  const postAckReady = isPostAckReady(validations);

  // Phase 3H.11: Determine if this section is currently active based on derived phase
  const isActiveSection = showPreAckActive;
  
  return (
    <div className={`bg-white rounded-lg border shadow-sm transition-all ${
      isActiveSection 
        ? 'p-4 border-2 border-blue-400' 
        : 'p-3 border border-gray-300'
    }`}>
      {/* Phase 3H.1: Section Header with Collapse Toggle */}
      <div className="flex items-center justify-between mb-3">
        <h2 className={`text-xl font-bold ${
          isActiveSection ? 'text-blue-900' : 'text-gray-600'
        }`}>
          {isActiveSection ? '📋 ' : ''}Validation Checklist
        </h2>
        {!isActiveSection && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
          >
            {isExpanded ? '▼ Collapse' : '▶ Expand'}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* V3.4 Phase 6.5: Section-scoped active step indicator (subordinate to main banner) */}
      {isActiveSection && activeStep && (
        <div className="mb-3 p-3 bg-blue-50 border-l-4 border-blue-500 rounded">
          <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">
            Active Validation Step
          </div>
          <div className="text-base font-semibold text-blue-900">
            {activeStep.name}
          </div>
          <div className="text-sm text-blue-700 mt-1">
            {preAckValidations[activeStepIndex + 1]
              ? `Next: ${preAckValidations[activeStepIndex + 1].name}`
              : 'Final step - Complete to enable acknowledgement'}
          </div>
        </div>
      )}

      {/* Phase 3H.1: All Complete Banner */}
      {isActiveSection && !activeStep && preAckReady && (
        <div className="mb-3 p-3 bg-green-50 border-2 border-green-300 rounded-lg">
          <div className="flex items-start space-x-3">
            <span className="text-2xl">✅</span>
            <div>
              <h3 className="font-semibold text-green-900 mb-1">All Pre-Acknowledgement Steps Complete</h3>
              <p className="text-sm text-green-800">Ready to proceed to acknowledgement phase</p>
            </div>
          </div>
        </div>
      )}

      {/* Phase 3H.13.5: Smart display with action-driven guidance */}
      {(isActiveSection || isExpanded) && (
        <>
          {/* V3.4 Phase 2.5: Data-driven label - only show "Completed" if actually complete */}
          {renderValidationSection(
            preAckReady ? 'Pre-Acknowledgement Validations (Completed)' : 'Pre-Acknowledgement Validations',
            'pre-ack',
            preAckValidations
          )}
          
          {/* Phase 3H.13.5: Context-aware guidance */}
          {showPreAckActive && preAckValidations.length > 0 && (
            <div className="text-sm text-gray-600 mt-2 mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              📌 Complete all validation steps above to enable acknowledgement and proceed to document preparation
            </div>
          )}
          
          {/* Post-Ack Validations - only show if acknowledged */}
          {showPostAckActive && (
            <>
              <div className="border-t border-gray-200 pt-4 mt-4" />
              {renderValidationSection(
                'Post-Acknowledgement Validations (In Progress)',
                'post-ack',
                postAckValidations
              )}
              {/* Phase 3H.13.5: Context for post-ack phase */}
              {postAckValidations.length > 0 && (
                <div className="text-sm text-gray-600 mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  ✅ Pre-acknowledgement complete. Continue with document preparation and post-ack validations.
                </div>
              )}
            </>
          )}
        </>
      )}
      
      {/* Phase 3H.1: Collapsed Summary */}
      {!isActiveSection && !isExpanded && (
        <div className="text-sm text-gray-600">
          <p className="mb-2">Pre-Ack: {preAckReady ? '✓ Complete' : `${completedSteps}/${preAckValidations.length} complete`}</p>
          <p>Post-Ack: {postAckReady ? '✓ Complete' : 'In Progress'}</p>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          ❌ {error}
        </div>
      )}
      
      {/* V4.0: Validation Step Workspace Modal */}
      {activeWorkspace && (
        <ValidationStepWorkspace
          validationKey={activeWorkspace.validationKey}
          validation={activeWorkspace.validation}
          ppapId={ppapId}
          onClose={() => setActiveWorkspace(null)}
          onComplete={() => {
            // Refresh validations after completion
            setActiveWorkspace(null);
            window.location.reload(); // Force full refresh to recalculate derived state
          }}
        />
      )}
    </div>
  );
}
