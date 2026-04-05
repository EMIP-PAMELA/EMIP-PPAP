import { getPPAPById } from '@/src/features/ppap/queries';
import { getConversationsByPPAPId } from '@/src/features/conversations/mutations';
import { getDocumentsByPPAPId } from '@/src/features/documents/mutations';
import { getEventsByPPAPId } from '@/src/features/events/mutations';
import { PPAPDetailLayout } from '@/src/features/ppap/components/PPAPDetailLayout';

interface PPAPDashboardPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function PPAPDashboardPage({ params }: PPAPDashboardPageProps) {
  const { id } = await params;

  if (!id) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <p className="font-semibold">Invalid PPAP ID</p>
            <p className="text-sm">No PPAP ID provided in the URL</p>
          </div>
        </div>
      </div>
    );
  }

  let ppap;
  let conversations;
  let documents;
  let events;
  let error;

  try {
    ppap = await getPPAPById(id);
    [conversations, documents, events] = await Promise.all([
      getConversationsByPPAPId(id),
      getDocumentsByPPAPId(id),
      getEventsByPPAPId(id),
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load PPAP';
  }

  if (error || !ppap) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <p className="font-semibold">Error loading PPAP</p>
            <p className="text-sm">{error || 'PPAP not found'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <PPAPDetailLayout
      ppap={ppap}
      events={events || []}
      conversations={conversations || []}
      documents={documents || []}
    />
  );
}
