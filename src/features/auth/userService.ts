/**
 * Phase 23: User System and Role-Based Approval Authority
 * 
 * Utilities for user management and role-based permissions.
 */

import { supabase } from '@/src/lib/supabaseClient';

export type UserRole = 'engineer' | 'qa' | 'manager' | 'admin';

export type PPAPUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
};

/**
 * Get current authenticated user
 */
export async function getCurrentUser(): Promise<PPAPUser | null> {
  try {
    // Get auth session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('[UserService] Failed to get authenticated user:', authError);
      return null;
    }

    // Get ppap_users record
    const { data: ppapUser, error: userError } = await supabase
      .from('ppap_users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (userError) {
      console.error('[UserService] Failed to get ppap_users record:', userError);
      return null;
    }

    if (!ppapUser) {
      console.error('[UserService] No ppap_users record found for authenticated user');
      return null;
    }

    return {
      id: ppapUser.id,
      email: ppapUser.email,
      name: ppapUser.name,
      role: ppapUser.role as UserRole,
      createdAt: ppapUser.created_at,
      updatedAt: ppapUser.updated_at,
    };
  } catch (err) {
    console.error('[UserService] Unexpected error getting current user:', err);
    return null;
  }
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string): Promise<PPAPUser | null> {
  try {
    const { data, error } = await supabase
      .from('ppap_users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('[UserService] Failed to get user by ID:', error);
      return null;
    }

    return {
      id: data.id,
      email: data.email,
      name: data.name,
      role: data.role as UserRole,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (err) {
    console.error('[UserService] Unexpected error getting user by ID:', err);
    return null;
  }
}

/**
 * Get all users (for assignment dropdowns, etc.)
 */
export async function getAllUsers(): Promise<PPAPUser[]> {
  try {
    const { data, error } = await supabase
      .from('ppap_users')
      .select('*')
      .order('name');

    if (error) {
      console.error('[UserService] Failed to get all users:', error);
      return [];
    }

    return data.map(user => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as UserRole,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    }));
  } catch (err) {
    console.error('[UserService] Unexpected error getting all users:', err);
    return [];
  }
}

/**
 * Check if user has approval authority
 * Only QA, Manager, and Admin can approve documents
 */
export function canApprove(role: UserRole): boolean {
  return role === 'qa' || role === 'manager' || role === 'admin';
}

/**
 * Check if user has admin privileges
 */
export function isAdmin(role: UserRole): boolean {
  return role === 'admin';
}

/**
 * Check if user has manager privileges
 */
export function isManager(role: UserRole): boolean {
  return role === 'manager' || role === 'admin';
}

/**
 * Get role display name
 */
export function getRoleDisplayName(role: UserRole): string {
  const roleNames: Record<UserRole, string> = {
    engineer: 'Engineer',
    qa: 'QA',
    manager: 'Manager',
    admin: 'Admin',
  };
  return roleNames[role];
}

/**
 * Get role color for badges
 */
export function getRoleColor(role: UserRole): string {
  const roleColors: Record<UserRole, string> = {
    engineer: 'bg-blue-100 text-blue-800',
    qa: 'bg-green-100 text-green-800',
    manager: 'bg-purple-100 text-purple-800',
    admin: 'bg-red-100 text-red-800',
  };
  return roleColors[role];
}
