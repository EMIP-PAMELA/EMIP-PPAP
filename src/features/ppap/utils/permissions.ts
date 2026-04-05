import { UserRole } from '@/src/lib/mockUser';

/**
 * Edit Permission Model:
 * 
 * Admin:
 * - Full system access (override authority)
 * 
 * Coordinator:
 * - Primary workflow operator
 * - Can edit PPAP data, assignment, documents, and workflow fields
 * 
 * Engineer:
 * - Can edit technical work only
 * - Blocked in final states (SUBMITTED, ACCEPTED, COMPLETE)
 * 
 * Viewer:
 * - Read-only
 */
export function canEditPPAP(role: UserRole, state: string): boolean {
  // Admin: always allowed
  if (role === 'admin') return true;

  // Coordinator: full workflow edit authority
  if (role === 'coordinator') return true;

  // Engineer: limited edit (blocked in final states)
  if (role === 'engineer') {
    const restrictedStates = ['SUBMITTED', 'ACCEPTED', 'COMPLETE'];
    return !restrictedStates.includes(state);
  }

  // Viewer: no edit
  return false;
}

export function canAssignPPAP(role: UserRole): boolean {
  return role === 'admin' || role === 'coordinator';
}

export function canAcknowledgePPAP(role: UserRole, state: string): boolean {
  // V3.3A: compare against PPAPStatus value, not derived label
  if (state !== 'READY_TO_ACKNOWLEDGE') return false;
  return role === 'admin' || role === 'coordinator';
}

export function canSubmitPPAP(role: UserRole, state: string): boolean {
  // V3.3A: compare against PPAPStatus value, not derived label
  if (state !== 'AWAITING_SUBMISSION') return false;
  return role === 'admin' || role === 'engineer';
}

export function isReadOnly(role: UserRole): boolean {
  return role === 'viewer';
}

export function canViewPPAP(role: UserRole): boolean {
  return true;
}

export function canCreatePPAP(role: UserRole): boolean {
  return role === 'admin' || role === 'engineer' || role === 'coordinator';
}
