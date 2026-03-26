'use client';

/**
 * Phase 3H.4: Current Task Banner - Command Center Upgrade
 * 
 * Displays prominent "You Are Here" indicator with primary CTA button.
 * Shows current phase, current step, clear instruction, and next step.
 */

interface CurrentTaskBannerProps {
  phase: string;
  currentStep?: string;
  instruction?: string;
  icon?: string;
  nextStep?: string;
  onActionClick?: () => void;
  actionLabel?: string;
}

export function CurrentTaskBanner({ 
  phase, 
  currentStep, 
  instruction,
  icon = '🎯',
  nextStep,
  onActionClick,
  actionLabel
}: CurrentTaskBannerProps) {
  return (
    <div className="mb-6 p-6 bg-gradient-to-r from-blue-600 to-blue-700 border-2 border-blue-800 rounded-xl shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-start space-x-4 flex-1">
          <span className="text-4xl">{icon}</span>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-blue-100 uppercase tracking-wider mb-2">
              🎯 CURRENT TASK
            </h3>
            {currentStep && (
              <p className="text-2xl font-bold text-white mb-2">
                {currentStep}
              </p>
            )}
            {instruction && (
              <p className="text-base text-blue-100 mb-2">
                {instruction}
              </p>
            )}
            {nextStep && (
              <p className="text-sm text-blue-200 mt-1">
                Next: {nextStep}
              </p>
            )}
          </div>
        </div>
        
        {/* Phase 3H.4: Primary CTA Button */}
        {onActionClick && actionLabel && (
          <button
            onClick={onActionClick}
            className="ml-6 px-8 py-4 bg-white text-blue-700 font-bold text-lg rounded-lg hover:bg-blue-50 transition-all shadow-md hover:shadow-xl hover:scale-105 whitespace-nowrap"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
