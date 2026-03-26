'use client';

/**
 * Phase 3H.1: Current Task Banner
 * 
 * Displays prominent "You Are Here" indicator at top of active work zone.
 * Shows current phase, current step, and clear instruction text.
 */

interface CurrentTaskBannerProps {
  phase: string;
  currentStep?: string;
  instruction?: string;
  icon?: string;
}

export function CurrentTaskBanner({ 
  phase, 
  currentStep, 
  instruction,
  icon = '🎯' 
}: CurrentTaskBannerProps) {
  return (
    <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-400 rounded-lg shadow-sm">
      <div className="flex items-start space-x-3">
        <span className="text-3xl">{icon}</span>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-blue-900 mb-1">
            Current Task
          </h3>
          {currentStep && (
            <p className="text-base font-semibold text-blue-800 mb-1">
              {currentStep}
            </p>
          )}
          {instruction && (
            <p className="text-sm text-blue-700">
              {instruction}
            </p>
          )}
          <p className="text-xs text-blue-600 mt-1 font-medium">
            Phase: {phase}
          </p>
        </div>
      </div>
    </div>
  );
}
