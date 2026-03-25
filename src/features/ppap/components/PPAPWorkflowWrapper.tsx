'use client';

import { useState, useRef, useEffect } from 'react';
import { PPAPRecord } from '@/src/types/database.types';
import { PhaseIndicator } from './PhaseIndicator';
import { InitiationForm } from './InitiationForm';
import { DocumentationForm } from './DocumentationForm';
import { SampleForm } from './SampleForm';
import { ReviewForm } from './ReviewForm';
import { WorkflowPhase, isValidWorkflowPhase, WORKFLOW_PHASE_LABELS, WORKFLOW_PHASES } from '../constants/workflowPhases';
import { getNextAction } from '../utils/getNextAction';
import { mapStatusToState } from '../utils/ppapTableHelpers';
import { mapStateToPhase } from '../utils/stateWorkflowMapping';

interface PPAPWorkflowWrapperProps {
  ppap: PPAPRecord;
}

export function PPAPWorkflowWrapper({ ppap }: PPAPWorkflowWrapperProps) {
  // Phase 3F: Derive phase from state only (single source of truth)
  const derivedState = mapStatusToState(ppap.status);
  const derivedPhaseLabel = mapStateToPhase(derivedState);
  
  // Map derived phase label to WorkflowPhase enum
  const phaseMapping: Record<string, WorkflowPhase> = {
    'Initiation': 'INITIATION',
    'Pre-Ack Complete': 'DOCUMENTATION',
    'Acknowledged': 'DOCUMENTATION',
    'Assigned': 'SAMPLE',
    'Validation': 'SAMPLE',
    'Ready for Submission': 'REVIEW',
    'Submitted': 'REVIEW',
    'Complete': 'COMPLETE',
  };
  
  const currentPhase = phaseMapping[derivedPhaseLabel] || 'INITIATION';
  const [selectedPhase, setSelectedPhase] = useState<WorkflowPhase>(currentPhase);
  const [documentationSection, setDocumentationSection] = useState<'checklist' | 'upload' | 'readiness' | 'confirmation' | undefined>(undefined);
  const activePhaseRef = useRef<HTMLDivElement>(null);

  // Sync selected phase when derived phase changes
  useEffect(() => {
    setSelectedPhase(currentPhase);
  }, [currentPhase]);

  // Auto-scroll to active phase on mount
  useEffect(() => {
    if (activePhaseRef.current) {
      setTimeout(() => {
        activePhaseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }, []);

  const nextActionData = getNextAction(ppap.workflow_phase, ppap.status);
  
  const scrollToActivePhase = () => {
    if (activePhaseRef.current) {
      activePhaseRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handlePhaseClick = (phase: WorkflowPhase) => {
    setSelectedPhase(phase);
    setDocumentationSection(undefined);
    scrollToActivePhase();
  };

  // Calculate if selected phase is in the future (read-only)
  const currentPhaseIndex = WORKFLOW_PHASES.indexOf(currentPhase);
  const selectedPhaseIndex = WORKFLOW_PHASES.indexOf(selectedPhase);
  const isFuturePhase = selectedPhaseIndex > currentPhaseIndex;

  return (
    <div className="space-y-5">
      {/* Next Action Panel */}
      <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-50 border-2 border-blue-400 rounded-xl shadow-lg p-7">
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
              <h3 className="text-sm font-bold text-blue-900 uppercase tracking-wide">Your Next Action</h3>
            </div>
            <p className="text-2xl font-bold text-gray-900 leading-tight mb-3">{nextActionData.nextAction || ''}</p>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-600">Current Phase:</span>
              <span className="px-3 py-1 bg-white border border-blue-200 rounded-lg text-sm font-bold text-blue-900">
                {WORKFLOW_PHASE_LABELS[currentPhase] || ''}
              </span>
            </div>
          </div>
          <button
            onClick={scrollToActivePhase}
            className="px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-all shadow-md hover:shadow-lg hover:scale-105 whitespace-nowrap"
          >
            Go to Section →
          </button>
        </div>
      </div>

      <PhaseIndicator currentPhase={currentPhase} onPhaseClick={handlePhaseClick} />
      
      {selectedPhase === 'INITIATION' && (
        <div ref={activePhaseRef}>
          <InitiationForm
            ppapId={ppap.id}
            partNumber={ppap.part_number || ''}
            ppapType={ppap.ppap_type}
            currentPhase={currentPhase}
            isReadOnly={isFuturePhase}
          />
        </div>
      )}

      {selectedPhase === 'DOCUMENTATION' && (
        <div ref={activePhaseRef}>
          <DocumentationForm
            ppapId={ppap.id}
            partNumber={ppap.part_number || ''}
            currentPhase={currentPhase}
            initialSection={documentationSection}
            isReadOnly={isFuturePhase}
          />
        </div>
      )}

      {selectedPhase === 'SAMPLE' && (
        <div ref={activePhaseRef}>
          <SampleForm
            ppapId={ppap.id}
            partNumber={ppap.part_number || ''}
            currentPhase={currentPhase}
            isReadOnly={isFuturePhase}
          />
        </div>
      )}

      {selectedPhase === 'REVIEW' && (
        <div ref={activePhaseRef}>
          <ReviewForm
            ppapId={ppap.id}
            partNumber={ppap.part_number || ''}
            currentPhase={currentPhase}
            isReadOnly={isFuturePhase}
          />
        </div>
      )}

      {selectedPhase === 'COMPLETE' && (
        <div ref={activePhaseRef} className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">COMPLETE Phase</h2>
          <p className="text-green-700 font-medium">✓ PPAP workflow complete!</p>
        </div>
      )}
    </div>
  );
}
