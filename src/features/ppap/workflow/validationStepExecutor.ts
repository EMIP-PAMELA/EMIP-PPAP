/**
 * V4.0: Validation Step Execution Handler
 * 
 * Single execution handler for all validation step actions.
 * Coordinates opening the correct workspace/modal/route for each step.
 */

import { DerivedPPAPState } from '../utils/derivedStateMachine';
import { DBValidation } from '../utils/validationDatabase';
import { 
  getValidationStepAction, 
  hasValidationStepAction,
  isValidationStepActionEnabled 
} from './validationStepActions';

export interface ValidationStepExecutionContext {
  validation: DBValidation;
  derivedState: DerivedPPAPState;
  ppapId: string;
  isActive: boolean;
  isLocked: boolean;
  isComplete: boolean;
}

/**
 * V4.0: Execute a validation step action.
 * Opens the appropriate workspace/modal/route for the validation step.
 * 
 * @returns true if action was executed, false if blocked or no action
 */
export function executeValidationStep(
  context: ValidationStepExecutionContext,
  onOpenWorkspace: (validationKey: string, validation: DBValidation) => void
): boolean {
  const { validation, derivedState, ppapId, isActive, isLocked, isComplete } = context;
  
  // V4.0: Debug logging
  console.log('🧭 V4.0 VALIDATION STEP CLICK', {
    validationKey: validation.validation_key,
    status: validation.status,
    isActive,
    isLocked,
    isComplete,
    derivedState,
    ppapId,
  });
  
  // Block execution if step is locked
  if (isLocked) {
    console.warn('⚠️ V4.0 VALIDATION STEP LOCKED', {
      validationKey: validation.validation_key,
      reason: 'Complete previous steps first',
    });
    return false;
  }
  
  // Get action configuration
  const actionConfig = getValidationStepAction(validation.validation_key);
  
  // Check if action is configured
  if (!actionConfig) {
    console.warn('⚠️ V4.0 VALIDATION STEP UNWIRED', {
      validationKey: validation.validation_key,
      ppapId,
      message: 'No action configuration found for this validation step',
    });
    return false;
  }
  
  // Check if action is enabled in current state
  if (!isValidationStepActionEnabled(validation.validation_key, derivedState)) {
    console.warn('⚠️ V4.0 VALIDATION STEP ACTION DISABLED', {
      validationKey: validation.validation_key,
      derivedState,
      enabledInStates: actionConfig.enabledInStates,
    });
    return false;
  }
  
  // Check if action type is noop (not yet wired)
  if (actionConfig.actionType === 'noop') {
    console.warn('⚠️ V4.0 VALIDATION STEP NOT YET WIRED', {
      validationKey: validation.validation_key,
      label: actionConfig.label,
      message: 'This validation step will be wired in a future phase',
    });
    return false;
  }
  
  // V4.0: Log action resolution
  console.log('🧩 V4.0 VALIDATION ACTION RESOLVED', {
    validationKey: validation.validation_key,
    actionType: actionConfig.actionType,
    actionTarget: actionConfig.actionTarget,
    label: actionConfig.label,
  });
  
  // Execute action based on type
  switch (actionConfig.actionType) {
    case 'workspace':
      onOpenWorkspace(validation.validation_key, validation);
      return true;
      
    case 'modal':
      // Future: Modal implementation
      console.warn('Modal action type not yet implemented');
      return false;
      
    case 'route':
      // Future: Route navigation
      console.warn('Route action type not yet implemented');
      return false;
      
    default:
      console.warn('Unknown action type:', actionConfig.actionType);
      return false;
  }
}

/**
 * Check if a validation step should show as clickable.
 */
export function isValidationStepClickable(
  validation: DBValidation,
  derivedState: DerivedPPAPState,
  isActive: boolean,
  isLocked: boolean,
  isComplete: boolean
): boolean {
  // Locked steps are never clickable
  if (isLocked) return false;
  
  // Check if step has a configured action
  if (!hasValidationStepAction(validation.validation_key)) {
    return false;
  }
  
  // Check if action is enabled in current state
  if (!isValidationStepActionEnabled(validation.validation_key, derivedState)) {
    return false;
  }
  
  // Active or complete steps with actions are clickable
  return isActive || isComplete;
}
