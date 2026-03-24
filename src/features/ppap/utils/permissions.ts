import { UserRole } from '@/src/lib/mockUser';

export function canEditPPAP(role: UserRole, state: string): boolean {
  // Admin can always edit
  if (role === 'admin') return true;
  
  // Engineer can edit unless in final states
  if (role === 'engineer') {
    return state !== 'SUBMITTED' && state !== 'ACCEPTED' && state !== 'COMPLETE';
  }
  
  // Coordinator and viewer cannot edit
  return false;
}

export function canAssignPPAP(role: UserRole): boolean {
  return role === 'admin' || role === 'coordinator';
}

export function canAcknowledgePPAP(role: UserRole, state: string): boolean {
  if (state !== 'READY_FOR_ACKNOWLEDGEMENT') return false;
  return role === 'admin' || role === 'coordinator';
}

export function canSubmitPPAP(role: UserRole, state: string): boolean {
  if (state !== 'READY_FOR_SUBMISSION') return false;
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
