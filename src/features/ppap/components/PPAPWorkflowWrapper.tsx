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
import { derivePPAPState, mapDerivedStateToPhase, getStateLabel } from '../utils/derivedStateMachine';

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
  useEffectImport(() => {
    async function fetchValidations() {
      try {
        setValidationsLoaded(false);
        const data = await getValidations(ppap.id);
        setValidations(data);
        setValidationsLoaded(true);
        console.log('✅ V3.4 VALIDATIONS LOADED', { count: data.length });
      } catch (err) {
        console.error('Failed to fetch validations:', err);
        setValidationsLoaded(true); // Set to true even on error to prevent infinite loading
      }
    }
    fetchValidations();
  }, [ppap.id]);

  // Phase 3F.5: Log PPAP received in wrapper
  console.log('Phase 3F.5 - PPAP RECEIVED IN WRAPPER', {
    id: ppap.id,
    status: ppap.status,
    ppap_number: ppap.ppap_number,
    updated_at: ppap.updated_at,
  });

  // Phase 3F.6: Log state after refresh
  console.log('Phase 3F.6 - STATE AFTER REFRESH', ppap.status);

  // Phase 3F.4: SINGLE SOURCE OF TRUTH - ppap.status
  // DIRECT MAPPING: PPAPStatus → WorkflowPhase (explicit switch statement)
  const selectedPhase = mapStatusToPhase(ppap.status);
  const activePhaseRef = useRef<HTMLDivElement>(null);

  // Phase 3F.4: Critical error guard
  if (!selectedPhase) {
    console.error('Phase 3F.4 - CRITICAL: Unmapped PPAP status', ppap.status);
  }

  // Phase 3F.4: Debug logging
  useEffect(() => {
    logStateToPhaseMapping(ppap.status, selectedPhase);
  }, [ppap.status, selectedPhase]);

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
    
    return context;
  }, [ppap, validations, documents, validationsLoaded]);
  
  const derivedPhase = mapDerivedStateToPhase(derivedStateContext.state);
  
  // V3.4 Phase 6.5: Normalize viewModel to render-safe primitives (prevent React #418)
  const viewModel = {
    state: String(derivedStateContext?.state ?? ''),
    task: String(derivedStateContext?.nextAction ?? ''),
    reason: String(derivedStateContext?.reason ?? ''),
    canProgress: Boolean(derivedStateContext?.canProgress),
    phase: String(derivedPhase ?? ''),
  };
  
  console.log('🔒 PHASE 6.5 VIEW MODEL', viewModel);
  console.log('🔒 PHASE 6.5 TASK CONSISTENCY', {
    bannerTask: viewModel.task,
    bannerReason: viewModel.reason,
  });
  
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
  const currentPhase = viewModel.state === 'INTAKE' || 
                       viewModel.state === 'PRE_ACK_VALIDATION' || 
                       viewModel.state === 'READY_FOR_ACK' 
                       ? 'pre-ack' 
                       : 'post-ack';
  
  // Phase 3H.11: GLOBAL STATE SNAPSHOT
  console.log('� SYSTEM STATE SNAPSHOT', {
    status: ppap.status,
    phase: selectedPhase,
    currentPhase,
    validations: validations?.length || 0,
    documents: documents?.length || 0,
    viewMode,
    ppapId: ppap.id,
  });
  
  // Phase 3H.11: PHASE DERIVATION CHECK
  console.log('🧭 PHASE DERIVATION CHECK', {
    status: ppap.status,
    derivedPhase: selectedPhase,
  });
  
  return (
    <div className="space-y-3">
      {/* Phase 3H.6: View Mode Toggle */}
      <div className="bg-white border border-gray-300 rounded-lg p-2 shadow-sm mb-3">
        <div className="flex gap-2">
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
      </div>

      {/* Phase 3H.6: Conditional Rendering Based on View Mode */}
      {viewMode === 'workflow' ? (
        <>
          {/* V3.4 Phase 6: Current Task Banner - Driven by viewModel (single source of truth) */}
          <CurrentTaskBanner
            phase={WORKFLOW_PHASE_LABELS[viewModel.phase as WorkflowPhase] || ''}
            currentStep={viewModel.task}
            instruction={viewModel.reason}
            icon="🎯"
          />

          <PhaseIndicator currentPhase={selectedPhase} onPhaseClick={handlePhaseClick} />
      
      {/* Phase 3F UI Fix: State-based rendering with safety fallback */}
      {selectedPhase === 'INITIATION' && (
        <div ref={activePhaseRef}>
          <InitiationForm
            ppapId={ppap.id}
            partNumber={ppap.part_number || ''}
            ppapType={ppap.ppap_type}
            isReadOnly={false}
          />
        </div>
      )}

      {selectedPhase === 'DOCUMENTATION' && (
        <div ref={activePhaseRef}>
          {/* Phase 3H.13: Document Execution FIRST (action before context) */}
          <DocumentationForm
            ppapId={ppap.id}
            partNumber={ppap.part_number || ''}
            isReadOnly={false}
            currentPhase={currentPhase}
          />
          
          {/* Phase 3H.13: Validation Status SECOND (context after action) */}
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-500 mb-2">
              Validation Status
            </h3>
            <PPAPValidationPanelDB
              ppapId={ppap.id}
              currentPhase={currentPhase}
              ppapStatus={ppap.status}
              derivedPhase={viewModel.phase}
            />
          </div>
        </div>
      )}

      {selectedPhase === 'SAMPLE' && (
        <div ref={activePhaseRef}>
          <SampleForm
            ppapId={ppap.id}
            partNumber={ppap.part_number || ''}
            isReadOnly={false}
          />
        </div>
      )}

      {selectedPhase === 'REVIEW' && (
        <div ref={activePhaseRef}>
          <ReviewForm
            ppapId={ppap.id}
            partNumber={ppap.part_number || ''}
            isReadOnly={false}
          />
        </div>
      )}

      {selectedPhase === 'COMPLETE' && (
        <div ref={activePhaseRef} className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="text-xl font-bold text-gray-900 mb-4">COMPLETE Phase</h2>
          <p className="text-green-700 font-medium">✓ PPAP workflow complete!</p>
        </div>
      )}

      {/* Safety fallback: Render initiation form if no phase matches */}
      {!['INITIATION', 'DOCUMENTATION', 'SAMPLE', 'REVIEW', 'COMPLETE'].includes(selectedPhase) && (
        <div ref={activePhaseRef}>
          <InitiationForm
            ppapId={ppap.id}
            partNumber={ppap.part_number || ''}
            ppapType={ppap.ppap_type}
            isReadOnly={false}
          />
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
