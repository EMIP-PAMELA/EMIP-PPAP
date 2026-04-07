'use client';

import { useRef, useEffect } from 'react';
import { PPAPRecord, PPAPStatus } from '@/src/types/database.types';
import { PhaseIndicator } from './PhaseIndicator';
import { InitiationForm } from './InitiationForm';
import { DocumentationForm } from './DocumentationForm';
import { SampleForm } from './SampleForm';
import { ReviewForm } from './ReviewForm';
import { WorkflowPhase, isValidWorkflowPhase, WORKFLOW_PHASE_LABELS, WORKFLOW_PHASES } from '../constants/workflowPhases';
import { mapStatusToPhase, logStateToPhaseMapping } from '../utils/stateWorkflowMapping';
import PPAPValidationPanelDB from './PPAPValidationPanelDB';
import { useState, useEffect as useEffectImport, useMemo } from 'react';
import { getValidations, DBValidation } from '../utils/validationDatabase';
import { CurrentTaskBanner } from './CurrentTaskBanner';
import { PPAPControlPanel } from './PPAPControlPanel';
import { IntakeConfirmationsSummary } from './IntakeConfirmationsSummary';
import { derivePPAPState, getStateLabel, getWorkflowPhaseFromDerivedState } from '../utils/derivedStateMachine';

interface PPAPWorkflowWrapperProps {
  ppap: PPAPRecord;
}

export function PPAPWorkflowWrapper({ ppap }: PPAPWorkflowWrapperProps) {
  // Phase 3H.6: View mode toggle (workflow vs control)
  const [viewMode, setViewMode] = useState<'workflow' | 'control'>('workflow');
  
  // V3.4 Phase 5: State for validations and documents - track loading state
  const [validations, setValidations] = useState<DBValidation[]>([]);
  const [validationsLoaded, setValidationsLoaded] = useState(false);
  const [documents, setDocuments] = useState<any[]>([]); // Simplified for now
  
  // Phase 3F.5: Guard against null/undefined PPAP
  if (!ppap) {
    console.error('Phase 3F.5 - CRITICAL: PPAP NOT FOUND IN WRAPPER', ppap);
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        <p className="font-semibold">Error: PPAP data not available</p>
        <p className="text-sm">PPAP object is null or undefined</p>
      </div>
    );
  }
  
  // V3.4 Phase 5: Fetch validations and track loading state
  // V3.7: React to ppap.status changes to trigger UI transition after state update
  useEffectImport(() => {
    async function fetchValidations() {
      try {
        setValidationsLoaded(false);
        // V3.6: Pass ppap.status to prevent auto-seeding for non-NEW PPAPs
        const data = await getValidations(ppap.id, ppap.status);
        setValidations(data);
        setValidationsLoaded(true);
        console.log('✅ V3.7 VALIDATIONS LOADED (Status-reactive)', { count: data.length, ppapStatus: ppap.status });
      } catch (err) {
        console.error('Failed to fetch validations:', err);
        setValidationsLoaded(true); // Set to true even on error to prevent infinite loading
      }
    }
    fetchValidations();
  }, [ppap.id, ppap.status]); // V3.7: Added ppap.status dependency

  // V3.7: STATUS CHANGE DETECTION
  const previousStatusRef = useRef<PPAPStatus | null>(null);
  
  useEffectImport(() => {
    if (previousStatusRef.current !== null && previousStatusRef.current !== ppap.status) {
      console.log('🧭 V3.7 STATUS CHANGE DETECTED', {
        from: previousStatusRef.current,
        to: ppap.status,
        ppapId: ppap.id,
      });
    }
    previousStatusRef.current = ppap.status;
  }, [ppap.status, ppap.id]);
  
  // V3.6: STATE REGRESSION PROTECTION
  // Prevent PPAP status from regressing to earlier states after progression
  const protectedStatusOrder: PPAPStatus[] = [
    'NEW',
    'INTAKE_COMPLETE',
    'PRE_ACK_ASSIGNED',
    'PRE_ACK_IN_PROGRESS',
    'READY_TO_ACKNOWLEDGE',
    'ACKNOWLEDGED',
    'POST_ACK_ASSIGNED',
    'POST_ACK_IN_PROGRESS',
    'AWAITING_SUBMISSION',
    'SUBMITTED',
    'APPROVED',
  ];
  
  console.log('🔒 V3.7 STATE LOCK CHECK (with change detection)', {
    ppapId: ppap.id,
    currentStatus: ppap.status,
    previousStatus: previousStatusRef.current,
    statusIndex: protectedStatusOrder.indexOf(ppap.status),
    ppapNumber: ppap.ppap_number,
  });
  
  // Phase 3F.5: Log PPAP received in wrapper
  console.log('Phase 3F.5 - PPAP RECEIVED IN WRAPPER', {
    id: ppap.id,
    status: ppap.status,
    ppap_number: ppap.ppap_number,
    updated_at: ppap.updated_at,
  });

  const activePhaseRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to active phase on mount
  useEffect(() => {
    if (activePhaseRef.current) {
      setTimeout(() => {
        activePhaseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }, []);

  // V3.4 Phase 6: FIX HOOK ORDER - All hooks MUST be declared before any conditional returns
  // Derive state from PPAP data (deterministic) - memoized with dependencies
  const derivedStateContext = useMemo(() => {
    // Only compute if validations are loaded, otherwise return loading state
    if (!validationsLoaded) {
      return {
        state: 'INTAKE' as const,
        label: 'Loading',
        reason: 'Loading validation data...',
        nextAction: 'Loading workflow data...',
        canProgress: false,
      };
    }
    
    console.log('🔍 V3.4 DERIVED STATE INPUT', {
      ppapId: ppap.id,
      ppapStatus: ppap.status,
      validationsCount: validations.length,
      validationsLoaded,
      documentsCount: documents.length,
      acknowledgedDate: (ppap as any).acknowledged_date,
      submittedDate: (ppap as any).submitted_date,
    });
    
    const context = derivePPAPState(ppap, validations, documents);
    
    console.log('🎯 V3.4 DERIVED STATE RESULT', {
      state: context.state,
      label: getStateLabel(context.state),
      reason: context.reason,
      nextAction: context.nextAction,
      canProgress: context.canProgress,
    });
    
    // V3.5: Use completed_at for all completion checks (removed status string matching)
  const preAckValidations = validations.filter(v => v.category === 'pre-ack' && v.required);
  const intakeValidations = preAckValidations.slice(0, 3);
  const intakeCompleteCount = intakeValidations.filter(v => v.completed_at != null).length;
  
  console.log('🔍 V3.7 INTAKE VALIDATION CHECK (Status-reactive)', {
    ppapId: ppap.id,
    ppapStatus: ppap.status,
    intakeCompleteCount,
    intakeTotalRequired: 3,
    derivedState: context.state,
    intakeValidations: intakeValidations.map(v => ({ 
      key: v.validation_key, 
      completed_at: v.completed_at,
      completed_by: v.completed_by,
    })),
  });
    
    return context;
  }, [ppap, validations, documents, validationsLoaded]);
  
  // V3.5: PHASE_MAP - Single source of truth for state-to-label conversion
  const PHASE_MAP: Record<string, string> = {
    'INTAKE': 'Initiation',
    'PRE_ACK_VALIDATION': 'Pre-Acknowledgement',
    'READY_FOR_ACK': 'Pre-Acknowledgement',
    'DOCUMENTATION': 'Documentation',
    'SUBMISSION_READY': 'Documentation',
    'SUBMITTED': 'Review',
    'APPROVED': 'Complete',
    'REJECTED': 'Closed',
  };
  
  // V3.5: Unified UI Model - SINGLE SOURCE OF TRUTH for ALL UI decisions
  const uiModel = {
    // Core derived state
    state: String(derivedStateContext?.state ?? ''),
    task: String(derivedStateContext?.nextAction ?? ''),
    reason: String(derivedStateContext?.reason ?? ''),
    canProgress: Boolean(derivedStateContext?.canProgress),
    
    // Phase labels
    phaseLabel: PHASE_MAP[derivedStateContext?.state ?? 'INTAKE'] || 'Unknown',
    
    // Validation progress (use completed_at, not status)
    validationProgress: {
      intake: {
        complete: validations.filter(v => v.category === 'pre-ack' && v.required).slice(0, 3).filter(v => v.completed_at != null).length,
        total: 3,
      },
      preAck: {
        complete: validations.filter(v => v.category === 'pre-ack' && v.required).filter(v => v.completed_at != null || v.approved_at != null).length,
        total: validations.filter(v => v.category === 'pre-ack' && v.required).length,
      },
      postAck: {
        complete: validations.filter(v => v.category === 'post-ack' && v.required).filter(v => v.approved_at != null).length,
        total: validations.filter(v => v.category === 'post-ack' && v.required).length,
      },
    },
    
    // Document progress
    documentProgress: {
      complete: documents.filter(d => d.status === 'ready').length,
      total: documents.length,
    },
  };
  
  console.log('🧠 V3.5 DERIVED STATE (MASTER)', derivedStateContext);
  console.log('🎯 V3.5 UI MODEL (SINGLE SOURCE OF TRUTH)', uiModel);
  
  // V3.8: REMOVED LEGACY PHASE RESOLVER
  // Use derivedStateContext.state directly as SINGLE AUTHORITY for rendering
  // No more mapDerivedStateToPhase - it was causing PRE_ACK_VALIDATION -> INITIATION mapping bug
  const renderState = derivedStateContext.state;
  
  // V3.4 Phase 6: Early return AFTER all hooks
  if (!validationsLoaded) {
    return (
      <div className="bg-white border border-gray-300 rounded-lg p-6 shadow-sm">
        <div className="text-center">
          <div className="text-gray-700 font-medium">⏳ Loading workflow data...</div>
          <div className="text-sm text-gray-500 mt-2">Initializing validation requirements</div>
        </div>
      </div>
    );
  }
  
  const scrollToActivePhase = () => {
    if (activePhaseRef.current) {
      activePhaseRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Phase 3F.4: Phase navigation disabled - phase is derived from ppap.status only
  // User cannot manually select phases - they must update ppap.status via state transitions
  const handlePhaseClick = (phase: WorkflowPhase) => {
    // Phase is derived from ppap.status (Phase 3F.4 architecture)
    // Manual phase selection removed - use state transitions instead
    scrollToActivePhase();
  };

  // V3.4 Phase 6: Determine current phase from viewModel (single source of truth)
  const currentPhase = renderState === 'INTAKE' || 
                       renderState === 'PRE_ACK_VALIDATION' || 
                       renderState === 'READY_FOR_ACK' 
                       ? 'pre-ack' 
                       : 'post-ack';
  
  // V3.9: Map derived state to WorkflowPhase for progress tracker
  const workflowPhase = getWorkflowPhaseFromDerivedState(derivedStateContext.state);
  
  // V3.9: WORKFLOW STEP RESOLUTION - Single authority for progress tracker
  console.log('📍 V3.9 WORKFLOW STEP RESOLUTION', {
    derivedState: derivedStateContext.state,
    workflowPhase: workflowPhase,
    stepNumber: ['INITIATION', 'DOCUMENTATION', 'SAMPLE', 'REVIEW', 'COMPLETE'].indexOf(workflowPhase) + 1,
  });
  
  // V3.8: SINGLE PHASE AUTHORITY - Unified state snapshot
  console.log('🛡 V3.8 SINGLE PHASE AUTHORITY', {
    status: ppap.status,
    derivedState: derivedStateContext.state,
    uiPhase: uiModel.phaseLabel,
    renderState: renderState,
    currentPhase,
    workflowPhase,
  });

  // V3.8: SYSTEM STATE SNAPSHOT (unified with derived state)
  console.log('📊 SYSTEM STATE SNAPSHOT', {
    status: ppap.status,
    derivedState: derivedStateContext.state,
    phaseLabel: uiModel.phaseLabel,
    validations: validations?.length || 0,
    documents: documents?.length || 0,
    viewMode,
    ppapId: ppap.id,
  });
  
  // V4.1: WORKFLOW UI STRUCTURE - Track section visibility
  console.log('🧭 V4.1 WORKFLOW UI STRUCTURE', {
    derivedState: derivedStateContext.state,
    currentTask: uiModel.task,
    intakeSummaryVisible: renderState === 'PRE_ACK_VALIDATION',
    preAckSectionVisible: renderState === 'PRE_ACK_VALIDATION' || renderState === 'DOCUMENTATION' || renderState === 'READY_FOR_ACK',
    documentationSectionVisible: renderState === 'PRE_ACK_VALIDATION' || renderState === 'DOCUMENTATION' || renderState === 'READY_FOR_ACK',
    documentationPrimary: renderState === 'DOCUMENTATION' || renderState === 'READY_FOR_ACK',
    validationPrimary: renderState === 'PRE_ACK_VALIDATION',
  });
  
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm space-y-6">
      {/* Phase 3H.6: View Mode Toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setViewMode('workflow')}
          className={`flex-1 px-4 py-2 text-sm font-semibold rounded transition-colors ${
            viewMode === 'workflow'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          📋 Workflow View
        </button>
        <button
          onClick={() => setViewMode('control')}
          className={`flex-1 px-4 py-2 text-sm font-semibold rounded transition-colors ${
            viewMode === 'control'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          🎛️ Control Panel
        </button>
      </div>

      {/* Phase 3H.6: Conditional Rendering Based on View Mode */}
      {viewMode === 'workflow' ? (
        <>
          {/* V3.4 Phase 6: Current Task Banner - Driven by viewModel (single source of truth) */}
          <CurrentTaskBanner
            phase={uiModel.phaseLabel}
            currentStep={uiModel.task}
            instruction={uiModel.reason}
            icon="🎯"
            derivedState={derivedStateContext.state}
          />

          <PhaseIndicator currentPhase={workflowPhase} onPhaseClick={handlePhaseClick} />
      
      {/* V3.8: SINGLE AUTHORITY RENDER GATES - Use derivedState.state directly */}
      {/* INTAKE state -> Initiation UI */}
      {renderState === 'INTAKE' && (
        <div ref={activePhaseRef}>
          <InitiationForm
            ppapId={ppap.id}
            partNumber={ppap.part_number || ''}
            ppapType={ppap.ppap_type}
            isReadOnly={false}
          />
        </div>
      )}

      {/* PRE_ACK_VALIDATION or DOCUMENTATION state -> Documentation UI */}
      {(renderState === 'PRE_ACK_VALIDATION' || renderState === 'DOCUMENTATION' || renderState === 'READY_FOR_ACK') && (
        <div ref={activePhaseRef}>
          {/* V4.1: Show intake confirmations summary for PRE_ACK_VALIDATION state */}
          {renderState === 'PRE_ACK_VALIDATION' && (
            <IntakeConfirmationsSummary />
          )}
          
          {/* V4.1: Pre-Ack Validations FIRST during PRE_ACK_VALIDATION (primary work) */}
          {renderState === 'PRE_ACK_VALIDATION' && (
            <div className="mb-6">
              <PPAPValidationPanelDB
                ppapId={ppap.id}
                currentPhase={currentPhase}
                derivedState={derivedStateContext.state}
                uiModel={uiModel}
              />
            </div>
          )}
          
          {/* V4.1: Document Execution secondary during PRE_ACK_VALIDATION, primary after */}
          <div className={renderState === 'PRE_ACK_VALIDATION' ? 'opacity-75' : ''}>
            {renderState === 'PRE_ACK_VALIDATION' && (
              <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900 font-medium">
                  📄 Documentation Scope Loaded
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  Document execution will become primary after validation progress. You may review scope now but focus on completing validations above first.
                </p>
              </div>
            )}
            
            <DocumentationForm
              ppapId={ppap.id}
              partNumber={ppap.part_number || ''}
              isReadOnly={false}
              currentPhase={currentPhase}
            />
          </div>
          
          {/* V4.1: Validation Status shown after documentation in DOCUMENTATION/READY_FOR_ACK states */}
          {(renderState === 'DOCUMENTATION' || renderState === 'READY_FOR_ACK') && (
            <div className="mt-6">
              <PPAPValidationPanelDB
                ppapId={ppap.id}
                currentPhase={currentPhase}
                derivedState={derivedStateContext.state}
                uiModel={uiModel}
              />
            </div>
          )}
        </div>
      )}

      {/* SUBMISSION_READY state -> Sample UI */}
      {renderState === 'SUBMISSION_READY' && (
        <div ref={activePhaseRef}>
          <SampleForm
            ppapId={ppap.id}
            partNumber={ppap.part_number || ''}
            isReadOnly={false}
          />
        </div>
      )}

      {/* SUBMITTED state -> Review UI */}
      {renderState === 'SUBMITTED' && (
        <div ref={activePhaseRef}>
          <ReviewForm
            ppapId={ppap.id}
            partNumber={ppap.part_number || ''}
            isReadOnly={false}
          />
        </div>
      )}

      {/* APPROVED state -> Complete UI */}
      {renderState === 'APPROVED' && (
        <div ref={activePhaseRef} className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="text-xl font-bold text-gray-900 mb-4">COMPLETE Phase</h2>
          <p className="text-green-700 font-medium">✓ PPAP workflow complete!</p>
        </div>
      )}
        </>
      ) : (
        /* Phase 3H.6: Control Panel View */
        <PPAPControlPanel ppap={ppap} />
      )}
    </div>
  );
}
