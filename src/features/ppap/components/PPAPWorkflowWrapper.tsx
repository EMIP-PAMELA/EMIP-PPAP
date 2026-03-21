'use client';

import { useState } from 'react';
import { PPAPRecord, PPAPTask } from '@/src/types/database.types';
import { PhaseIndicator } from './PhaseIndicator';
import { InitiationForm } from './InitiationForm';
import { DocumentationForm } from './DocumentationForm';
import { SampleForm } from './SampleForm';
import { ReviewForm } from './ReviewForm';
import { WorkflowPhase, isValidWorkflowPhase } from '../constants/workflowPhases';

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

  return (
    <div className="space-y-6">
      <PhaseIndicator currentPhase={currentPhase} />
      
      {currentPhase === 'INITIATION' && (
        <InitiationForm
          ppapId={ppap.id}
          partNumber={ppap.part_number || ''}
          currentPhase={currentPhase}
          setPhase={setCurrentPhase}
        />
      )}

      {currentPhase === 'DOCUMENTATION' && (
        <DocumentationForm
          ppapId={ppap.id}
          partNumber={ppap.part_number || ''}
          currentPhase={currentPhase}
          setPhase={setCurrentPhase}
        />
      )}

      {currentPhase === 'SAMPLE' && (
        <SampleForm
          ppapId={ppap.id}
          partNumber={ppap.part_number || ''}
          currentPhase={currentPhase}
          setPhase={setCurrentPhase}
        />
      )}

      {currentPhase === 'REVIEW' && (
        <ReviewForm
          ppapId={ppap.id}
          partNumber={ppap.part_number || ''}
          currentPhase={currentPhase}
          setPhase={setCurrentPhase}
        />
      )}

      {currentPhase === 'COMPLETE' && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">COMPLETE Phase</h2>
          <p className="text-green-700 font-medium">✓ PPAP workflow complete!</p>
        </div>
      )}
    </div>
  );
}
