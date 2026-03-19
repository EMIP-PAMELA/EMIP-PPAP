import { getAllPPAPs } from '@/src/features/ppap/queries';
import { PPAPListTable } from '@/src/features/ppap/components/PPAPListTable';
import Link from 'next/link';

export default async function PPAPListPage() {
  let ppaps;
  let error;

  try {
    ppaps = await getAllPPAPs();
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load PPAPs';
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">PPAP Records</h1>
            <p className="text-gray-600 mt-1">
              Manage PPAP submissions across all sites
            </p>
          </div>
          <Link
            href="/ppap/new"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create New PPAP
          </Link>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            <p className="font-semibold">Error loading PPAPs</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {!error && ppaps && ppaps.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              No PPAP records yet
            </h2>
            <p className="text-gray-600 mb-6">
              Get started by creating your first PPAP record
            </p>
            <Link
              href="/ppap/new"
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create First PPAP
            </Link>
          </div>
        )}

        {!error && ppaps && ppaps.length > 0 && (
          <PPAPListTable ppaps={ppaps} />
        )}
      </div>
    </div>
  );
}
