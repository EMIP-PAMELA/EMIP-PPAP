import { getAllPPAPs } from '@/src/features/ppap/queries';
import { PPAPOperationsDashboard } from '@/src/features/ppap/components/PPAPOperationsDashboard';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function PPAPOperationsPage() {
  let ppaps;
  let error;

  try {
    ppaps = await getAllPPAPs();
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load PPAPs';
  }

  // Ensure safe initialization before use
  const ppapsSafe = ppaps || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">PPAP Operations Dashboard</h1>
            <p className="text-gray-600 mt-2">
              Track, prioritize, and resume PPAP work across the organization
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

        {!error && (
          <PPAPOperationsDashboard ppaps={ppapsSafe} />
        )}
      </div>
    </div>
  );
}
