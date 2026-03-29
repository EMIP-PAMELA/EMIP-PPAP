'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  getCurrentUser, 
  getAllUsers,
  canApprove,
  getRoleDisplayName,
  type PPAPUser 
} from '@/src/features/auth/userService';
import {
  getAllSessionsWithStats,
  getDashboardStats,
  filterSessionsByUser,
  filterSessionsByStatus,
  getBottleneckSessions,
  type DashboardSession,
  type DashboardStats
} from '@/src/features/dashboard/dashboardService';
import { DocumentStatus } from '@/src/features/documentEngine/persistence/sessionService';
import { TemplateId } from '@/src/features/documentEngine/templates/types';

const TEMPLATE_LABELS: Record<TemplateId, string> = {
  PROCESS_FLOW: 'Process Flow',
  PFMEA: 'PFMEA',
  CONTROL_PLAN: 'Control Plan',
  PSW: 'PSW',
};

export default function DashboardPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<PPAPUser | null>(null);
  const [allUsers, setAllUsers] = useState<PPAPUser[]>([]);
  const [sessions, setSessions] = useState<DashboardSession[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<DashboardSession[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Filters
  const [userFilter, setUserFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'has-approved' | 'has-pending' | 'has-errors'>('all');
  const [showBottlenecksOnly, setShowBottlenecksOnly] = useState(false);

  useEffect(() => {
    async function init() {
      const user = await getCurrentUser();
      
      if (!user) {
        router.push('/');
        return;
      }

      // Dashboard accessible to QA, Manager, Admin
      if (!canApprove(user.role) && user.role !== 'admin') {
        setErrorMessage('Access Denied: Dashboard requires QA, Manager, or Admin role');
        setIsLoading(false);
        return;
      }

      setCurrentUser(user);
      
      // Load data
      const [sessionsData, statsData, usersData] = await Promise.all([
        getAllSessionsWithStats(),
        getDashboardStats(),
        getAllUsers(),
      ]);

      setSessions(sessionsData);
      setFilteredSessions(sessionsData);
      setStats(statsData);
      setAllUsers(usersData);
      setIsLoading(false);
    }

    init();
  }, [router]);

  // Apply filters
  useEffect(() => {
    let filtered = sessions;

    // User filter
    if (userFilter !== 'all') {
      filtered = filterSessionsByUser(filtered, userFilter);
    }

    // Status filter
    filtered = filterSessionsByStatus(filtered, statusFilter);

    // Bottleneck filter
    if (showBottlenecksOnly) {
      filtered = getBottleneckSessions(filtered);
    }

    setFilteredSessions(filtered);
  }, [sessions, userFilter, statusFilter, showBottlenecksOnly]);

  const getStatusColor = (status: DocumentStatus | null): string => {
    if (!status) return 'bg-gray-100 text-gray-600';
    if (status === 'approved') return 'bg-green-100 text-green-800';
    if (status === 'in_review') return 'bg-yellow-100 text-yellow-800';
    return 'bg-blue-100 text-blue-800'; // draft
  };

  const getStatusLabel = (status: DocumentStatus | null): string => {
    if (!status) return 'Not Started';
    if (status === 'approved') return 'Approved';
    if (status === 'in_review') return 'In Review';
    return 'Draft';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-lg text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!currentUser || (!canApprove(currentUser.role) && currentUser.role !== 'admin')) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md">
          <div className="text-center">
            <div className="text-6xl mb-4">🚫</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
            <p className="text-gray-600 mb-6">
              {errorMessage || 'Dashboard requires QA, Manager, or Admin role.'}
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
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">PPAP Dashboard</h1>
              <p className="text-gray-600 mt-2">System-wide visibility and tracking</p>
            </div>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
            >
              ← Back to App
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-600 mb-1">Total Sessions</div>
              <div className="text-3xl font-bold text-gray-900">{stats.totalSessions}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-600 mb-1">Total Documents</div>
              <div className="text-3xl font-bold text-blue-600">{stats.totalDocuments}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-600 mb-1">Approved</div>
              <div className="text-3xl font-bold text-green-600">{stats.approvedDocuments}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-600 mb-1">Pending Approval</div>
              <div className="text-3xl font-bold text-yellow-600">{stats.pendingApprovals}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-600 mb-1">With Errors</div>
              <div className="text-3xl font-bold text-red-600">{stats.documentsWithErrors}</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Filter by User:</label>
              <select
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Users</option>
                {allUsers.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({getRoleDisplayName(user.role)})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Filter by Status:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Sessions</option>
                <option value="has-approved">Has Approved Docs</option>
                <option value="has-pending">Has Pending Docs</option>
                <option value="has-errors">Has Errors</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="bottlenecks"
                checked={showBottlenecksOnly}
                onChange={(e) => setShowBottlenecksOnly(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="bottlenecks" className="text-sm font-medium text-gray-700">
                Show Bottlenecks Only
              </label>
            </div>

            <div className="ml-auto text-sm text-gray-600">
              Showing {filteredSessions.length} of {sessions.length} sessions
            </div>
          </div>
        </div>

        {/* Sessions Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Session Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Owner
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Process Flow
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    PFMEA
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Control Plan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    PSW
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Summary
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Last Updated
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredSessions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                      <div className="text-4xl mb-2">📊</div>
                      <p>No sessions found</p>
                    </td>
                  </tr>
                ) : (
                  filteredSessions.map((session) => {
                    const hasBottleneck = session.inReviewDocuments > 0 || session.documentsWithErrors > 0;
                    
                    return (
                      <tr key={session.id} className={hasBottleneck ? 'bg-yellow-50' : 'hover:bg-gray-50'}>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{session.name}</div>
                          {session.ppapId && (
                            <div className="text-xs text-gray-500">PPAP ID: {session.ppapId}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {session.createdByName || 'Unknown'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(session.documentStatuses.PROCESS_FLOW)}`}>
                            {getStatusLabel(session.documentStatuses.PROCESS_FLOW)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(session.documentStatuses.PFMEA)}`}>
                            {getStatusLabel(session.documentStatuses.PFMEA)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(session.documentStatuses.CONTROL_PLAN)}`}>
                            {getStatusLabel(session.documentStatuses.CONTROL_PLAN)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(session.documentStatuses.PSW)}`}>
                            {getStatusLabel(session.documentStatuses.PSW)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-xs space-y-1">
                            <div className="flex items-center gap-1">
                              <span className="text-green-600 font-semibold">{session.approvedDocuments}</span>
                              <span className="text-gray-500">approved</span>
                            </div>
                            {session.inReviewDocuments > 0 && (
                              <div className="flex items-center gap-1">
                                <span className="text-yellow-600 font-semibold">{session.inReviewDocuments}</span>
                                <span className="text-gray-500">pending</span>
                              </div>
                            )}
                            {session.documentsWithErrors > 0 && (
                              <div className="flex items-center gap-1">
                                <span className="text-red-600 font-semibold">{session.documentsWithErrors}</span>
                                <span className="text-gray-500">errors</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {new Date(session.updatedAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => router.push(`/document-workspace?sessionId=${session.id}`)}
                            className="px-3 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                          >
                            Open →
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
