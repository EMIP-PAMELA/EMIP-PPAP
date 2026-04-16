'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  getCurrentUser, 
  getAllUsers, 
  updateUserRole,
  isAdmin,
  getRoleDisplayName,
  getRoleColor,
  type PPAPUser,
  type UserRole 
} from '@/src/features/auth/userService';

export default function AdminUsersPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<PPAPUser | null>(null);
  const [users, setUsers] = useState<PPAPUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const user = await getCurrentUser();
      
      if (!user) {
        router.push('/');
        return;
      }

      if (!isAdmin(user.role)) {
        setErrorMessage('Access Denied: Admin privileges required');
        setIsLoading(false);
        return;
      }

      setCurrentUser(user);
      await loadUsers();
      setIsLoading(false);
    }

    init();
  }, [router]);

  const loadUsers = async () => {
    const allUsers = await getAllUsers();
    setUsers(allUsers);
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    setUpdatingUserId(userId);
    setSuccessMessage(null);
    setErrorMessage(null);

    const success = await updateUserRole(userId, newRole);

    if (success) {
      setSuccessMessage(`Role updated to ${getRoleDisplayName(newRole)}`);
      await loadUsers();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } else {
      setErrorMessage('Failed to update role. Please try again.');
    }

    setUpdatingUserId(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[color:var(--bg-secondary)] flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-lg text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!currentUser || !isAdmin(currentUser.role)) {
    return (
      <div className="min-h-screen bg-[color:var(--bg-primary)] flex items-center justify-center">
        <div className="bg-[color:var(--surface-elevated)] rounded-lg shadow-md p-8 max-w-md">
          <div className="text-center">
            <div className="text-6xl mb-4">🚫</div>
            <h1 className="text-2xl font-bold text-[color:var(--text-primary)] mb-2">Access Denied</h1>
            <p className="text-gray-600 mb-6">
              {errorMessage || 'You do not have permission to access this page.'}
            </p>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Return to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[color:var(--bg-secondary)] py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-[color:var(--text-primary)]">User Management</h1>
              <p className="text-gray-600 mt-2">Manage user roles and permissions</p>
            </div>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 bg-[color:var(--surface-elevated)] text-[color:var(--text-secondary)] rounded-md border border-[color:var(--panel-border)] hover:bg-[color:var(--table-row-hover)] transition-colors"
            >
              ← Back to App
            </button>
          </div>
        </div>

        {/* Feedback Messages */}
        {successMessage && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <span className="text-green-600 font-semibold">✓</span>
              <span className="text-green-800">{successMessage}</span>
            </div>
          </div>
        )}

        {errorMessage && currentUser && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <span className="text-red-600 font-semibold">✗</span>
              <span className="text-red-800">{errorMessage}</span>
            </div>
          </div>
        )}

        {/* User Info Note */}
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-blue-600 text-xl">ℹ️</span>
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">User Creation</p>
              <p>Users must be created via the authentication system (Supabase). New users are automatically added to the system upon first login.</p>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-[color:var(--surface-elevated)] rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[color:var(--panel-bg)] border-b border-[color:var(--panel-border)]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Created At
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      <div className="text-4xl mb-2">👤</div>
                      <p>No users found</p>
                    </td>
                  </tr>
                ) : (
                  users.map((user) => {
                    const isCurrentUser = user.id === currentUser.id;
                    const isUpdating = updatingUserId === user.id;
                    
                    return (
                      <tr key={user.id} className={isCurrentUser ? 'bg-blue-50' : 'hover:bg-[color:var(--table-row-hover)]'}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-[color:var(--text-primary)]">{user.name}</span>
                            {isCurrentUser && (
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                                You
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-600">{user.email}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getRoleColor(user.role)}`}>
                            {getRoleDisplayName(user.role)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-600">
                            {new Date(user.createdAt).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <select
                            value={user.role}
                            onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
                            disabled={isUpdating || isCurrentUser}
                            className={`px-3 py-1 border border-[color:var(--panel-border)] bg-[color:var(--input-bg)] text-[color:var(--text-primary)] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                              isUpdating ? 'opacity-50 cursor-wait' : isCurrentUser ? 'opacity-50 cursor-not-allowed bg-[color:var(--panel-bg)]' : ''
                            }`}
                            title={isCurrentUser ? 'You cannot change your own role' : 'Change user role'}
                          >
                            <option value="engineer">Engineer</option>
                            <option value="qa">QA</option>
                            <option value="manager">Manager</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-[color:var(--surface-elevated)] rounded-lg shadow p-4 border border-[color:var(--panel-border)]">
            <div className="text-sm text-gray-600">Total Users</div>
            <div className="text-2xl font-bold text-[color:var(--text-primary)]">{users.length}</div>
          </div>
          <div className="bg-[color:var(--surface-elevated)] rounded-lg shadow p-4 border border-[color:var(--panel-border)]">
            <div className="text-sm text-gray-600">Engineers</div>
            <div className="text-2xl font-bold text-blue-600">
              {users.filter(u => u.role === 'engineer').length}
            </div>
          </div>
          <div className="bg-[color:var(--surface-elevated)] rounded-lg shadow p-4 border border-[color:var(--panel-border)]">
            <div className="text-sm text-gray-600">QA / Managers</div>
            <div className="text-2xl font-bold text-green-600">
              {users.filter(u => u.role === 'qa' || u.role === 'manager').length}
            </div>
          </div>
          <div className="bg-[color:var(--surface-elevated)] rounded-lg shadow p-4 border border-[color:var(--panel-border)]">
            <div className="text-sm text-gray-600">Admins</div>
            <div className="text-2xl font-bold text-red-600">
              {users.filter(u => u.role === 'admin').length}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
