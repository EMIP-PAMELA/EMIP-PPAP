export type UserRole = 'admin' | 'coordinator' | 'engineer' | 'viewer';

export const currentUser = {
  id: 'test-user',
  name: 'Test User',
  role: 'engineer' as UserRole,
};
