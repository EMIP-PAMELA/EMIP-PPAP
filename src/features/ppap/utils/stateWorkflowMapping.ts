import { PPAPStatus } from '@/src/types/database.types';

/**
 * Phase 3F - State-Driven Workflow Alignment
 * 
 * Single source of truth for state → phase mapping.
 * Removes phase independence and aligns workflow bar with state machine.
 */

export type WorkflowPhase = 
  | 'Initiation'
  | 'Pre-Ack Complete'
  | 'Acknowledged'
  | 'Assigned'
  | 'Validation'
  | 'Ready for Submission'
  | 'Submitted'
  | 'Complete';

/**
 * Maps PPAP state to workflow phase display name.
 * This is the ONLY source of truth for phase derivation.
 */
export function mapStateToPhase(state: string): WorkflowPhase {
  const phaseMap: Record<string, WorkflowPhase> = {
    'INITIATED': 'Initiation',
    'IN_REVIEW': 'Initiation',
    'INTAKE_COMPLETE': 'Initiation',
    'IN_PROGRESS': 'Initiation',
    'READY_FOR_ACKNOWLEDGEMENT': 'Pre-Ack Complete',
    'ACKNOWLEDGED': 'Acknowledged',
    'POST_ACK_ASSIGNED': 'Assigned',
    'IN_VALIDATION': 'Validation',
    'READY_FOR_SUBMISSION': 'Ready for Submission',
    'SUBMITTED': 'Submitted',
    'ACCEPTED': 'Complete',
    'COMPLETE': 'Complete',
    'ON_HOLD': 'Initiation',
    'BLOCKED': 'Initiation',
  };

  return phaseMap[state] || 'Initiation';
}

/**
 * Determines if pre-ack validations are editable based on state.
 * Pre-ack validations can only be edited BEFORE acknowledgement.
 */
export function canEditPreAckValidations(state: string): boolean {
  const preAckStates = [
    'INITIATED',
    'IN_REVIEW',
    'INTAKE_COMPLETE',
    'IN_PROGRESS',
    'READY_FOR_ACKNOWLEDGEMENT',
  ];
  
  return preAckStates.includes(state);
}

/**
 * Determines if post-ack validations are editable based on state.
 * Post-ack validations can only be edited AFTER acknowledgement.
 */
export function canEditPostAckValidations(state: string): boolean {
  const postAckStates = [
    'ACKNOWLEDGED',
    'POST_ACK_ASSIGNED',
    'IN_VALIDATION',
    'READY_FOR_SUBMISSION',
  ];
  
  return postAckStates.includes(state);
}

/**
 * Determines the next state based on validation completion.
 * Implements auto state progression logic.
 */
export function determineNextState(
  currentState: string,
  preAckComplete: boolean,
  postAckComplete: boolean
): string {
  // Pre-ack phase: progress to READY_FOR_ACKNOWLEDGEMENT when complete
  if (canEditPreAckValidations(currentState) && preAckComplete) {
    return 'READY_FOR_ACKNOWLEDGEMENT';
  }

  // Post-ack phase: progress to READY_FOR_SUBMISSION when complete
  if (canEditPostAckValidations(currentState) && postAckComplete) {
    return 'READY_FOR_SUBMISSION';
  }

  // No state change
  return currentState;
}

/**
 * Gets workflow phase order for progress calculation.
 */
export function getPhaseOrder(phase: WorkflowPhase): number {
  const phaseOrder: Record<WorkflowPhase, number> = {
    'Initiation': 1,
    'Pre-Ack Complete': 2,
    'Acknowledged': 3,
    'Assigned': 4,
    'Validation': 5,
    'Ready for Submission': 6,
    'Submitted': 7,
    'Complete': 8,
  };

  return phaseOrder[phase] || 0;
}
