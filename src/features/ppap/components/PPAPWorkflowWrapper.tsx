'use client';

import { useState } from 'react';
import { PPAPRecord, PPAPTask } from '@/src/types/database.types';
import { PhaseIndicator } from './PhaseIndicator';
import { InitiationForm } from './InitiationForm';

type WorkflowPhase = 'INITIATION' | 'DOCUMENTATION' | 'SAMPLE' | 'REVIEW' | 'COMPLETE';

interface PPAPWorkflowWrapperProps {
  ppap: PPAPRecord;
  tasks: PPAPTask[];
}

export function PPAPWorkflowWrapper({ ppap, tasks }: PPAPWorkflowWrapperProps) {
  const [currentPhase, setCurrentPhase] = useState<WorkflowPhase>('INITIATION');

  const handlePhaseAdvance = () => {
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      <PhaseIndicator currentPhase={currentPhase} />
      
      {currentPhase === 'INITIATION' && (
        <InitiationForm
          ppapId={ppap.id}
          partNumber={ppap.part_number}
          onPhaseAdvance={handlePhaseAdvance}
        />
      )}

      {currentPhase === 'DOCUMENTATION' && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">DOCUMENTATION Phase</h2>
          <p className="text-gray-600">Documentation phase not yet implemented.</p>
        </div>
      )}

      {currentPhase === 'SAMPLE' && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">SAMPLE Phase</h2>
          <p className="text-gray-600">Sample phase not yet implemented.</p>
        </div>
      )}

      {currentPhase === 'REVIEW' && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">REVIEW Phase</h2>
          <p className="text-gray-600">Review phase not yet implemented.</p>
        </div>
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
