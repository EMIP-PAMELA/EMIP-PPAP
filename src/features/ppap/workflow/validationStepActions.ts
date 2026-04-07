/**
 * V4.0: Validation Step Execution Layer
 * 
 * SINGLE SOURCE OF TRUTH for validation step action mapping.
 * Defines how each validation step should be executed when clicked.
 */

import { DerivedPPAPState } from '../utils/derivedStateMachine';

export type ValidationActionType = 'workspace' | 'modal' | 'route' | 'noop';

export interface ValidationStepActionConfig {
  validationKey: string;
  label: string;
  actionType: ValidationActionType;
  actionTarget: string;
  enabledInStates: DerivedPPAPState[];
  description?: string;
}

/**
 * Canonical mapping of validation steps to their execution actions.
 * Each validation step must have a defined action or will show fallback.
 */
export const VALIDATION_STEP_ACTIONS: Record<string, ValidationStepActionConfig> = {
  // Pre-Acknowledgement Validations (6 steps)
  material_availability: {
    validationKey: 'material_availability',
    label: 'Material Availability Check',
    actionType: 'workspace',
    actionTarget: 'material-availability',
    enabledInStates: ['PRE_ACK_VALIDATION', 'READY_FOR_ACK'],
    description: 'Verify all required materials are available for production',
  },
  
  psw_presence: {
    validationKey: 'psw_presence',
    label: 'PSW Presence',
    actionType: 'workspace',
    actionTarget: 'psw-presence',
    enabledInStates: ['PRE_ACK_VALIDATION', 'READY_FOR_ACK'],
    description: 'Confirm Part Submission Warrant (PSW) is present and accessible',
  },
  
  discrepancy_resolution: {
    validationKey: 'discrepancy_resolution',
    label: 'Discrepancy Resolution',
    actionType: 'workspace',
    actionTarget: 'discrepancy-resolution',
    enabledInStates: ['PRE_ACK_VALIDATION', 'READY_FOR_ACK'],
    description: 'Review and resolve any identified discrepancies',
  },
  
  // Additional pre-ack validations (to be wired in future phases)
  drawing_verification: {
    validationKey: 'drawing_verification',
    label: 'Drawing Verification',
    actionType: 'noop',
    actionTarget: '',
    enabledInStates: ['PRE_ACK_VALIDATION', 'READY_FOR_ACK'],
    description: 'Verify drawing accuracy and completeness',
  },
  
  bom_review: {
    validationKey: 'bom_review',
    label: 'BOM Review',
    actionType: 'noop',
    actionTarget: '',
    enabledInStates: ['PRE_ACK_VALIDATION', 'READY_FOR_ACK'],
    description: 'Review Bill of Materials for accuracy',
  },
  
  tooling_validation: {
    validationKey: 'tooling_validation',
    label: 'Tooling Validation',
    actionType: 'noop',
    actionTarget: '',
    enabledInStates: ['PRE_ACK_VALIDATION', 'READY_FOR_ACK'],
    description: 'Validate tooling setup and readiness',
  },
};

/**
 * Get action configuration for a validation step.
 * Returns undefined if no action is configured.
 */
export function getValidationStepAction(validationKey: string): ValidationStepActionConfig | undefined {
  return VALIDATION_STEP_ACTIONS[validationKey];
}

/**
 * Check if a validation step has a configured action.
 */
export function hasValidationStepAction(validationKey: string): boolean {
  const config = VALIDATION_STEP_ACTIONS[validationKey];
  return config !== undefined && config.actionType !== 'noop';
}

/**
 * Check if a validation step action is enabled in the current derived state.
 */
export function isValidationStepActionEnabled(
  validationKey: string,
  currentState: DerivedPPAPState
): boolean {
  const config = VALIDATION_STEP_ACTIONS[validationKey];
  if (!config) return false;
  return config.enabledInStates.includes(currentState);
}
