import { getPPAPById } from '@/src/features/ppap/queries';
import { getConversationsByPPAPId } from '@/src/features/conversations/mutations';
import { getTasksByPPAPId } from '@/src/features/tasks/mutations';
import { getDocumentsByPPAPId } from '@/src/features/documents/mutations';
import { getEventsByPPAPId } from '@/src/features/events/mutations';
import { PPAPHeader } from '@/src/features/ppap/components/PPAPHeader';
import { ConversationList } from '@/src/features/conversations/components/ConversationList';
import { TaskList } from '@/src/features/tasks/components/TaskList';
import { DocumentList } from '@/src/features/documents/components/DocumentList';
import { EventHistory } from '@/src/features/events/components/EventHistory';

interface PPAPDashboardPageProps {
  params: {
    id: string;
  };
}

export default async function PPAPDashboardPage({ params }: PPAPDashboardPageProps) {
  const { id } = params;
  
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
  let tasks;
  let documents;
  let events;
  let error;

  try {
    ppap = await getPPAPById(id);
    [conversations, tasks, documents, events] = await Promise.all([
      getConversationsByPPAPId(id),
      getTasksByPPAPId(id),
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
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <PPAPHeader ppap={ppap} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <ConversationList ppapId={id} conversations={conversations || []} />
            <TaskList ppapId={id} tasks={tasks || []} />
            <DocumentList ppapId={id} documents={documents || []} />
          </div>

          <div className="space-y-6">
            <EventHistory events={events || []} />
          </div>
        </div>
      </div>
    </div>
  );
}
