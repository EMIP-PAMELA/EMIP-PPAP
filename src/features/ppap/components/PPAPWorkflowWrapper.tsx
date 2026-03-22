'use client';

import { useState, useRef, useEffect } from 'react';
import { PPAPRecord, PPAPTask } from '@/src/types/database.types';
import { PhaseIndicator } from './PhaseIndicator';
import { InitiationForm } from './InitiationForm';
import { DocumentationForm } from './DocumentationForm';
import { SampleForm } from './SampleForm';
import { ReviewForm } from './ReviewForm';
import { WorkflowPhase, isValidWorkflowPhase, WORKFLOW_PHASE_LABELS } from '../constants/workflowPhases';
import { getNextAction } from '../utils/getNextAction';

interface PPAPWorkflowWrapperProps {
  ppap: PPAPRecord;
  tasks: PPAPTask[];
}

export function PPAPWorkflowWrapper({ ppap, tasks }: PPAPWorkflowWrapperProps) {
  // Initialize phase from database, fallback to INITIATION if invalid
  const initialPhase = isValidWorkflowPhase(ppap.workflow_phase) 
    ? ppap.workflow_phase 
    : 'INITIATION';
  
  const [currentPhase, setCurrentPhase] = useState<WorkflowPhase>(initialPhase);
  const activePhaseRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="space-y-6">
      {/* Next Action Panel */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-2">Next Action</h3>
            <p className="text-2xl font-bold text-gray-900">{nextActionData.nextAction || ''}</p>
            <p className="text-sm text-gray-600 mt-1">
              Current Phase: <span className="font-semibold">{WORKFLOW_PHASE_LABELS[currentPhase] || ''}</span>
            </p>
          </div>
          <button
            onClick={scrollToActivePhase}
            className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-md"
          >
            Go to Section →
          </button>
        </div>
      </div>

      <PhaseIndicator currentPhase={currentPhase} />
      
      {currentPhase === 'INITIATION' && (
        <div ref={activePhaseRef}>
          <InitiationForm
            ppapId={ppap.id}
            partNumber={ppap.part_number || ''}
            ppapType={ppap.ppap_type}
            currentPhase={currentPhase}
            setPhase={setCurrentPhase}
          />
        </div>
      )}

      {currentPhase === 'DOCUMENTATION' && (
        <div ref={activePhaseRef}>
          <DocumentationForm
            ppapId={ppap.id}
            partNumber={ppap.part_number || ''}
            currentPhase={currentPhase}
            setPhase={setCurrentPhase}
          />
        </div>
      )}

      {currentPhase === 'SAMPLE' && (
        <div ref={activePhaseRef}>
          <SampleForm
            ppapId={ppap.id}
            partNumber={ppap.part_number || ''}
            currentPhase={currentPhase}
            setPhase={setCurrentPhase}
          />
        </div>
      )}

      {currentPhase === 'REVIEW' && (
        <div ref={activePhaseRef}>
          <ReviewForm
            ppapId={ppap.id}
            partNumber={ppap.part_number || ''}
            currentPhase={currentPhase}
            setPhase={setCurrentPhase}
          />
        </div>
      )}

      {currentPhase === 'COMPLETE' && (
        <div ref={activePhaseRef} className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">COMPLETE Phase</h2>
          <p className="text-green-700 font-medium">✓ PPAP workflow complete!</p>
        </div>
      )}
    </div>
  );
}
