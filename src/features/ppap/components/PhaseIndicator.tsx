'use client';

type WorkflowPhase = 'INITIATION' | 'DOCUMENTATION' | 'SAMPLE' | 'REVIEW' | 'COMPLETE';

interface PhaseIndicatorProps {
  currentPhase: WorkflowPhase;
}

const PHASES: { key: WorkflowPhase; label: string }[] = [
  { key: 'INITIATION', label: 'Initiation' },
  { key: 'DOCUMENTATION', label: 'Documentation' },
  { key: 'SAMPLE', label: 'Sample' },
  { key: 'REVIEW', label: 'Review' },
  { key: 'COMPLETE', label: 'Complete' },
];

export function PhaseIndicator({ currentPhase }: PhaseIndicatorProps) {
  const currentIndex = PHASES.findIndex(p => p.key === currentPhase);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">PPAP Workflow Progress</h3>
      <div className="flex items-center justify-between">
        {PHASES.map((phase, index) => {
          const isActive = index === currentIndex;
          const isCompleted = index < currentIndex;
          const isUpcoming = index > currentIndex;

          return (
            <div key={phase.key} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : isCompleted
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {isCompleted ? '✓' : index + 1}
                </div>
                <span
                  className={`mt-2 text-xs font-medium ${
                    isActive
                      ? 'text-blue-700'
                      : isCompleted
                      ? 'text-green-700'
                      : 'text-gray-500'
                  }`}
                >
                  {phase.label}
                </span>
              </div>
              {index < PHASES.length - 1 && (
                <div
                  className={`h-1 flex-1 mx-2 transition-colors ${
                    isCompleted ? 'bg-green-600' : 'bg-gray-200'
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
