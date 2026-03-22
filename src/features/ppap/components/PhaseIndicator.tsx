'use client';

import { WorkflowPhase, WORKFLOW_PHASES, WORKFLOW_PHASE_LABELS } from '../constants/workflowPhases';

interface PhaseIndicatorProps {
  currentPhase: WorkflowPhase;
}

const PHASES: { key: WorkflowPhase; label: string }[] = WORKFLOW_PHASES.map(phase => ({
  key: phase,
  label: WORKFLOW_PHASE_LABELS[phase],
}));

export function PhaseIndicator({ currentPhase }: PhaseIndicatorProps) {
  const currentIndex = PHASES.findIndex(p => p.key === currentPhase);

  return (
    <div className="bg-gradient-to-br from-gray-50 to-white border border-gray-300 rounded-xl shadow-sm p-8 mb-8">
      <h3 className="text-base font-semibold text-gray-900 mb-6">Workflow Progress</h3>
      <div className="flex items-center justify-between">
        {PHASES.map((phase, index) => {
          const isActive = index === currentIndex;
          const isCompleted = index < currentIndex;
          const isUpcoming = index > currentIndex;

          return (
            <div key={phase.key} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-base transition-all shadow-md ${
                    isActive
                      ? 'bg-blue-600 text-white ring-4 ring-blue-200'
                      : isCompleted
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-300 text-gray-600'
                  }`}
                >
                  {isCompleted ? '✓' : index + 1}
                </div>
                <span
                  className={`mt-3 text-sm font-semibold text-center ${
                    isActive
                      ? 'text-blue-800'
                      : isCompleted
                      ? 'text-green-800'
                      : 'text-gray-600'
                  }`}
                >
                  {phase.label}
                </span>
              </div>
              {index < PHASES.length - 1 && (
                <div
                  className={`h-2 flex-1 mx-3 rounded-full transition-all ${
                    isCompleted ? 'bg-green-600' : 'bg-gray-300'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
