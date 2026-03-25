import { PPAPStatus } from '@/src/types/database.types';
import { WorkflowPhase } from '../constants/workflowPhases';

/**
 * Phase 3F.2.2 - Direct State → WorkflowPhase Mapping
 * 
 * CRITICAL FIX: Maps PPAP state directly to WorkflowPhase enum.
 * NO intermediate string labels - direct mapping only.
 * This is the ONLY source of truth for phase derivation.
 */

/**
 * Maps PPAP state directly to WorkflowPhase enum.
 * Phase 3F.2.2: Removed intermediate string-based labels.
 */
export function mapStateToWorkflowPhase(state: string): WorkflowPhase {
  const mapping: Record<string, WorkflowPhase> = {
    'INITIATED': 'INITIATION',
    'INTAKE_COMPLETE': 'INITIATION',
    'IN_PROGRESS': 'INITIATION',
    'IN_REVIEW': 'INITIATION',
    
    'READY_FOR_ACKNOWLEDGEMENT': 'DOCUMENTATION',
    'ACKNOWLEDGED': 'DOCUMENTATION',
    'POST_ACK_ASSIGNED': 'DOCUMENTATION',
    
    'IN_VALIDATION': 'SAMPLE',
    
    'READY_FOR_SUBMISSION': 'REVIEW',
    'SUBMITTED': 'REVIEW',
    
    'ACCEPTED': 'COMPLETE',
    'COMPLETE': 'COMPLETE',
    
    'REJECTED': 'SAMPLE',
    'BLOCKED': 'INITIATION',
    'ON_HOLD': 'INITIATION',
  };

  return mapping[state] || 'INITIATION';
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
 * Phase 3F.2.2: Updated to use WorkflowPhase enum values.
 */
export function getPhaseOrder(phase: WorkflowPhase): number {
  const phaseOrder: Record<WorkflowPhase, number> = {
    'INITIATION': 1,
    'DOCUMENTATION': 2,
    'SAMPLE': 3,
    'REVIEW': 4,
    'COMPLETE': 5,
  };

  return phaseOrder[phase] || 0;
}
