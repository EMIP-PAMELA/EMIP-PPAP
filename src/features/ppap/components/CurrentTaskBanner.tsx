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
  derivedState?: string; // V4.1: For phase-aware messaging
}

export function CurrentTaskBanner({ 
  phase, 
  currentStep, 
  instruction,
  icon = '🎯',
  nextStep,
  onActionClick,
  actionLabel,
  derivedState
}: CurrentTaskBannerProps) {
  // V4.1: Phase-aware messaging override
  let displayStep = currentStep;
  let displayInstruction = instruction;
  
  if (derivedState === 'PRE_ACK_VALIDATION') {
    displayStep = 'Complete Pre-Acknowledgement Engineering Validations';
    displayInstruction = 'Finish the required engineering validation steps to unlock full documentation execution. These are formal validations, separate from the intake confirmations you already completed.';
  }
  return (
    <div className="mb-3 p-4 bg-gradient-to-r from-blue-600 to-blue-700 border-2 border-blue-800 rounded-xl shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-start space-x-4 flex-1">
          <span className="text-4xl">{icon}</span>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-blue-100 uppercase tracking-wider mb-1">
              🎯 CURRENT TASK
            </h3>
            {displayStep && (
              <p className="text-2xl font-bold text-white mb-1">
                {displayStep}
              </p>
            )}
            {displayInstruction && (
              <p className="text-base text-blue-100 mb-2">
                {displayInstruction}
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
