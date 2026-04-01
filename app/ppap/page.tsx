import { getAllPPAPs } from '@/src/features/ppap/queries';
import { PPAPDashboardTable } from '@/src/features/ppap/components/PPAPDashboardTable';
import Link from 'next/link';
import { currentUser } from '@/src/lib/mockUser';
import { canCreatePPAP } from '@/src/features/ppap/utils/permissions';

export const dynamic = 'force-dynamic';

export default async function PPAPOperationsPage() {
  let ppaps;
  let error;

  try {
    ppaps = await getAllPPAPs();
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load PPAPs';
  }

  const ppapsSafe = ppaps || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-4xl font-bold text-gray-900">PPAP Operations Dashboard</h1>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-200 text-gray-700">
                Role: {currentUser.role.toUpperCase()}
              </span>
            </div>
            <p className="text-gray-600 mt-2">
              Track, prioritize, and resume PPAP work across the organization
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/copilot"
              className="bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors shadow-sm"
            >
              🤖 Document Copilot
            </Link>
            <Link
              href="/ppap/intake"
              className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors shadow-sm"
            >
              View Intake Queue
            </Link>
            {canCreatePPAP(currentUser.role) ? (
              <Link
                href="/ppap/new"
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-sm"
              >
                + Create New PPAP
              </Link>
            ) : (
              <div className="text-gray-400 text-sm italic">
                Create PPAP: Not permitted
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-300 text-red-800 px-6 py-4 rounded-lg mb-8 shadow-sm">
            <p className="font-bold text-base">Error loading PPAPs</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        {!error && (
          <PPAPDashboardTable ppaps={ppapsSafe} />
        )}
      </div>
    </div>
  );
}
