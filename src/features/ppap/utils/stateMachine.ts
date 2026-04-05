/**
 * PPAP State Machine
 * V3.3A: Aligned with PPAPStatus from database.types.ts.
 * IN_REVIEW removed per V3.3A design — not a valid workflow state.
 *
 * NOTE: Authoritative transition logic lives in updatePPAPState.ts (isValidTransition).
 * This file re-exports types and provides a canTransition guard used by ppapTransitionGuard.ts.
 */

import { PPAPStatus } from '@/src/types/database.types';

// Re-export PPAPStatus as PPAPState for backward compatibility with ppapTransitionGuard.ts
export type PPAPState = PPAPStatus;

const VALID_TRANSITIONS: Record<PPAPStatus, PPAPStatus[]> = {
  NEW:                  ['INTAKE_COMPLETE', 'PRE_ACK_ASSIGNED', 'ON_HOLD', 'BLOCKED'],
  INTAKE_COMPLETE:      ['PRE_ACK_ASSIGNED', 'BLOCKED'],
  PRE_ACK_ASSIGNED:     ['PRE_ACK_IN_PROGRESS', 'BLOCKED'],
  PRE_ACK_IN_PROGRESS:  ['READY_TO_ACKNOWLEDGE', 'ON_HOLD', 'BLOCKED'],
  READY_TO_ACKNOWLEDGE: ['ACKNOWLEDGED'],
  ACKNOWLEDGED:         ['POST_ACK_ASSIGNED'],
  POST_ACK_ASSIGNED:    ['POST_ACK_IN_PROGRESS', 'BLOCKED'],
  POST_ACK_IN_PROGRESS: ['AWAITING_SUBMISSION', 'ON_HOLD', 'BLOCKED'],
  AWAITING_SUBMISSION:  ['SUBMITTED', 'ON_HOLD', 'BLOCKED'],
  SUBMITTED:            ['APPROVED', 'ON_HOLD', 'BLOCKED'],
  APPROVED:             ['CLOSED'],
  ON_HOLD:              ['PRE_ACK_IN_PROGRESS', 'POST_ACK_IN_PROGRESS', 'AWAITING_SUBMISSION'],
  BLOCKED:              ['PRE_ACK_IN_PROGRESS', 'POST_ACK_IN_PROGRESS', 'AWAITING_SUBMISSION'],
  CLOSED:               [],
};

export function canTransition(current: PPAPState, next: PPAPState): boolean {
  return VALID_TRANSITIONS[current]?.includes(next) ?? false;
}

export function transitionPPAPState(currentState: PPAPState, nextState: PPAPState): PPAPState {
  if (!canTransition(currentState, nextState)) {
    throw new Error(`Invalid transition: ${currentState} → ${nextState}`);
  }
  return nextState;
}

export function getValidNextStates(currentState: PPAPState): PPAPState[] {
  return VALID_TRANSITIONS[currentState] ?? [];
}
