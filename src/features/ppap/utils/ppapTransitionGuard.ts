import { canTransition, PPAPState } from './stateMachine';
import { UserRole } from '@/src/lib/mockUser';

/**
 * State + Permission Enforcement Layer
 * 
 * Combines state machine validation with role-based permissions.
 * All state transitions must pass BOTH checks:
 * 1. State transition is valid (state machine)
 * 2. User role is authorized for the transition (permissions)
 */

export function canUserTransition(
  role: UserRole,
  currentState: string,
  nextState: string
): boolean {
  // 1. Check state validity first
  if (!canTransition(currentState as PPAPState, nextState as PPAPState)) {
    return false;
  }

  // 2. Role-based restrictions

  // Acknowledgement gate: Coordinator/Admin only
  if (nextState === 'ACKNOWLEDGED') {
    return role === 'admin' || role === 'coordinator';
  }

  // Submission gate: Engineer/Admin only
  if (nextState === 'SUBMITTED') {
    return role === 'admin' || role === 'engineer';
  }

  // Viewer: No state transitions allowed
  if (role === 'viewer') return false;

  // All other valid transitions allowed for admin, coordinator, engineer
  return true;
}

export function executeTransition(
  role: UserRole,
  currentState: string,
  nextState: string
): string {
  if (!canUserTransition(role, currentState, nextState)) {
    throw new Error(
      `Unauthorized or invalid transition: ${currentState} → ${nextState} for role ${role}`
    );
  }

  // TODO Phase 3D: Log state transition event to database

  return nextState;
}
