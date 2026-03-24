export type PPAPState =
  | 'INITIATED'
  | 'INTAKE_COMPLETE'
  | 'IN_PROGRESS'
  | 'IN_REVIEW'
  | 'READY_FOR_ACKNOWLEDGEMENT'
  | 'ACKNOWLEDGED'
  | 'POST_ACK_ASSIGNED'
  | 'IN_VALIDATION'
  | 'READY_FOR_SUBMISSION'
  | 'SUBMITTED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'COMPLETE'
  | 'BLOCKED'
  | 'ON_HOLD';

const VALID_TRANSITIONS: Record<PPAPState, PPAPState[]> = {
  INITIATED: ['INTAKE_COMPLETE', 'IN_PROGRESS', 'BLOCKED', 'ON_HOLD'],
  INTAKE_COMPLETE: ['IN_PROGRESS', 'READY_FOR_ACKNOWLEDGEMENT', 'BLOCKED'],
  IN_PROGRESS: ['IN_REVIEW', 'READY_FOR_ACKNOWLEDGEMENT', 'BLOCKED'],
  IN_REVIEW: ['READY_FOR_ACKNOWLEDGEMENT', 'IN_PROGRESS', 'BLOCKED'],
  READY_FOR_ACKNOWLEDGEMENT: ['ACKNOWLEDGED'],
  ACKNOWLEDGED: ['POST_ACK_ASSIGNED', 'IN_VALIDATION'],
  POST_ACK_ASSIGNED: ['IN_VALIDATION'],
  IN_VALIDATION: ['READY_FOR_SUBMISSION', 'BLOCKED'],
  READY_FOR_SUBMISSION: ['SUBMITTED'],
  SUBMITTED: ['ACCEPTED', 'REJECTED'],
  REJECTED: ['IN_VALIDATION'],
  ACCEPTED: ['COMPLETE'],
  COMPLETE: [],
  BLOCKED: ['IN_PROGRESS', 'IN_VALIDATION'],
  ON_HOLD: ['IN_PROGRESS'],
};

export function canTransition(
  current: PPAPState,
  next: PPAPState
): boolean {
  return VALID_TRANSITIONS[current]?.includes(next) ?? false;
}

export function transitionPPAPState(
  currentState: PPAPState,
  nextState: PPAPState
): PPAPState {
  if (!canTransition(currentState, nextState)) {
    throw new Error(`Invalid transition: ${currentState} → ${nextState}`);
  }

  // TODO Phase 3C: log state transition event

  return nextState;
}

export function getValidNextStates(currentState: PPAPState): PPAPState[] {
  return VALID_TRANSITIONS[currentState] ?? [];
}
