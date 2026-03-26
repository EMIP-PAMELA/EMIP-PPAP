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
import { updatePPAPState } from '../utils/updatePPAPState';
import { CurrentTaskBanner } from './CurrentTaskBanner';

/**
 * Phase 3H - Persistent Validation Engine
 * Phase 3H.1 - Active Work Zone with collapsible sections
 * 
 * Database-backed validation panel with auto state transitions.
 */

interface Props {
  ppapId: string;
  currentPhase: 'pre-ack' | 'post-ack';
  ppapStatus?: PPAPStatus;
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

export default function PPAPValidationPanelDB({ ppapId, currentPhase, ppapStatus }: Props) {
  const router = useRouter();
  const [validations, setValidations] = useState<DBValidation[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Phase 3H.1: Collapsible state for active work zone
  const [isExpanded, setIsExpanded] = useState(true);
  
  // Phase 3F: Determine editability based on state
  const derivedState = ppapStatus ? mapStatusToState(ppapStatus) : 'INITIATED';
  const canEditPreAck = canEditPreAckValidations(derivedState);
  const canEditPostAck = canEditPostAckValidations(derivedState);
  
  // Phase 3H.11: Derive actual phase from status for display logic
  const derivedPhase = ppapStatus ? mapStatusToPhase(ppapStatus) : 'INITIATION';
  const showPreAckActive = derivedPhase === 'INITIATION';
  const showPostAckActive = derivedPhase === 'DOCUMENTATION';

  // Fetch validations from database
  useEffect(() => {
    async function fetchValidations() {
      try {
        setLoading(true);
        const data = await getValidations(ppapId);
        
        // Phase 3H.11: Log validation data for debugging
        console.log('VALIDATION DATA CHECK', { 
          ppapId, 
          validations: data,
          count: data.length 
        });
        
        setValidations(data);
      } catch (err) {
        console.error('Failed to fetch validations:', err);
        setError(err instanceof Error ? err.message : 'Failed to load validations');
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

  const handleValidationClick = async (validation: DBValidation) => {
    // Phase 3F: Check if validation is editable based on state
    if (validation.category === 'pre-ack' && !canEditPreAck) {
      return; // Pre-ack validations locked after acknowledgement
    }
    if (validation.category === 'post-ack' && !canEditPostAck) {
      return; // Post-ack validations locked before acknowledgement
    }

    if (updating) return; // Prevent concurrent updates

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

    setUpdating(validation.id);
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

      // Phase 3H: Check for auto state transitions
      const updatedValidations = validations.map(v => 
        v.id === validation.id ? updated : v
      );

      await checkAutoTransition(updatedValidations);

      // Refresh UI
      router.refresh();
    } catch (err) {
      console.error('Failed to update validation:', err);
      setError(err instanceof Error ? err.message : 'Failed to update validation');
    } finally {
      setUpdating(null);
    }
  };

  /**
   * Phase 3H: Auto state transition integration
   * Check if validation completion triggers state transition
   */
  const checkAutoTransition = async (updatedValidations: DBValidation[]) => {
    if (!ppapStatus) return;

    const preAckReady = isPreAckReady(updatedValidations);
    const postAckReady = isPostAckReady(updatedValidations);

    // Auto-transition: Pre-ack complete → READY_FOR_ACKNOWLEDGEMENT
    if (preAckReady && ppapStatus === 'PRE_ACK_IN_PROGRESS') {
      try {
        // Phase 3F.6: Log state write attempt
        console.log('Phase 3F.6 - STATE WRITE ATTEMPT', {
          from: ppapStatus,
          to: 'READY_TO_ACKNOWLEDGE',
          source: 'PPAPValidationPanelDB.tsx (auto-transition)',
        });
        
        await updatePPAPState(
          ppapId,
          'READY_TO_ACKNOWLEDGE',
          currentUser.id,
          currentUser.role
        );
      } catch (err) {
        console.error('Auto-transition to READY_FOR_ACKNOWLEDGEMENT failed:', err);
      }
    }

    // Auto-transition: Post-ack approved → READY_FOR_SUBMISSION
    if (postAckReady && ppapStatus === 'POST_ACK_IN_PROGRESS') {
      try {
        // Phase 3F.6: Log state write attempt
        console.log('Phase 3F.6 - STATE WRITE ATTEMPT', {
          from: ppapStatus,
          to: 'AWAITING_SUBMISSION',
          source: 'PPAPValidationPanelDB.tsx (auto-transition)',
        });
        
        await updatePPAPState(
          ppapId,
          'AWAITING_SUBMISSION',
          currentUser.id,
          currentUser.role
        );
      } catch (err) {
        console.error('Auto-transition to READY_FOR_SUBMISSION failed:', err);
      }
    }
  };

  const renderValidationSection = (
    title: string,
    category: ValidationCategory,
    validationList: DBValidation[]
  ) => {
    // Phase 3H.11/3H.12: Enhanced validation display - clear messaging, no confusing 0/0
    const isEditable = category === 'pre-ack' ? canEditPreAck : canEditPostAck;
    const hasValidations = validationList.length > 0;

    // Phase 3H.12: Show clear message if not initialized
    if (!hasValidations) {
      return (
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800 font-medium">⚠️ Validation data not initialized</p>
            <p className="text-xs text-yellow-700 mt-1">Refresh the page to initialize validation tracking</p>
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
            const isUpdating = updating === validation.id;
            
            // Phase 3F.13: Determine validation state (ACTIVE, COMPLETE, LOCKED)
            const isComplete = validation.status === 'complete' || validation.status === 'approved';
            const isActive = category === 'pre-ack' && activeStep?.id === validation.id;
            const isLocked = category === 'pre-ack' && !isComplete && !isActive && validation.required;
            
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

                <span
                  className={`px-3 py-1 text-xs font-medium rounded-full ${
                    STATUS_COLORS[validation.status]
                  }`}
                >
                  {validation.status.replace('_', ' ')}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
        <div className="text-center text-gray-500">Loading validations...</div>
      </div>
    );
  }

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

      {/* Phase 3H.1: Current Task Banner (replaces Next Action Panel) */}
      {isActiveSection && activeStep && (
        <CurrentTaskBanner
          phase="Pre-Acknowledgement"
          currentStep={activeStep.name}
          instruction={
            preAckValidations[activeStepIndex + 1]
              ? `Next: ${preAckValidations[activeStepIndex + 1].name}`
              : 'Final step - Complete to enable acknowledgement'
          }
        />
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

      {/* Phase 3H.11: Smart display based on phase */}
      {(isActiveSection || isExpanded) && (
        <>
          {/* Pre-Ack Validations - always show, but with different labels */}
          {renderValidationSection(
            showPreAckActive ? 'Pre-Acknowledgement Validations' : 'Pre-Acknowledgement Validations (Completed)',
            'pre-ack',
            preAckValidations
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

      {/* Phase 3H.11: Removed redundant summary footer */}
    </div>
  );
}
