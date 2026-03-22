import { getAllPPAPs } from '@/src/features/ppap/queries';
import { PPAPListTable } from '@/src/features/ppap/components/PPAPListTable';
import Link from 'next/link';
import { getNextAction } from '@/src/features/ppap/utils/getNextAction';

export default async function PPAPListPage() {
  let ppaps;
  let error;

  try {
    ppaps = await getAllPPAPs();
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load PPAPs';
  }

  // Calculate summary metrics
  const totalPPAPs = ppaps?.length || 0;
  const activePPAPs = ppaps?.filter(p => p.workflow_phase !== 'COMPLETE').length || 0;
  const completedPPAPs = ppaps?.filter(p => p.workflow_phase === 'COMPLETE').length || 0;
  const needsAttention = ppaps?.filter(p => {
    const action = getNextAction(p.workflow_phase, p.status);
    return action.priority === 'urgent' || action.priority === 'warning';
  }).length || 0;

  // Group PPAPs
  const activePPAPsList = ppaps?.filter(p => p.workflow_phase !== 'COMPLETE') || [];
  const completedPPAPsList = ppaps?.filter(p => p.workflow_phase === 'COMPLETE') || [];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">PPAP Dashboard</h1>
            <p className="text-gray-600 mt-2">
              Manage PPAP submissions across all sites
            </p>
          </div>
          <Link
            href="/ppap/new"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-sm"
          >
            + Create New PPAP
          </Link>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-300 text-red-800 px-6 py-4 rounded-lg mb-8 shadow-sm">
            <p className="font-bold text-base">Error loading PPAPs</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        {!error && ppaps && ppaps.length === 0 && (
          <div className="bg-white border border-gray-300 rounded-xl shadow-sm p-16 text-center">
            <div className="max-w-md mx-auto">
              <div className="text-6xl mb-4">📋</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                No PPAPs yet
              </h2>
              <p className="text-gray-600 mb-8 text-lg">
                Create your first PPAP to begin tracking your production part approval process
              </p>
              <Link
                href="/ppap/new"
                className="inline-block bg-blue-600 text-white px-8 py-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-sm text-lg"
              >
                Create New PPAP
              </Link>
            </div>
          </div>
        )}

        {!error && ppaps && ppaps.length > 0 && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white border border-gray-300 rounded-xl shadow-sm p-6">
                <div className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">
                  Total PPAPs
                </div>
                <div className="text-4xl font-bold text-gray-900">{totalPPAPs}</div>
              </div>

              <div className="bg-white border border-gray-300 rounded-xl shadow-sm p-6">
                <div className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">
                  Active
                </div>
                <div className="text-4xl font-bold text-blue-600">{activePPAPs}</div>
              </div>

              <div className="bg-white border border-gray-300 rounded-xl shadow-sm p-6">
                <div className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">
                  Completed
                </div>
                <div className="text-4xl font-bold text-green-600">{completedPPAPs}</div>
              </div>

              <div className="bg-white border border-gray-300 rounded-xl shadow-sm p-6">
                <div className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">
                  Needs Attention
                </div>
                <div className="text-4xl font-bold text-amber-600">{needsAttention}</div>
              </div>
            </div>

            {/* Active PPAPs Section */}
            {activePPAPsList.length > 0 && (
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Active PPAPs</h2>
                <PPAPListTable ppaps={activePPAPsList} />
              </div>
            )}

            {/* Completed PPAPs Section */}
            {completedPPAPsList.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Completed PPAPs</h2>
                <PPAPListTable ppaps={completedPPAPsList} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
