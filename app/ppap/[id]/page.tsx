import { getPPAPById } from '@/src/features/ppap/queries';
import { getConversationsByPPAPId } from '@/src/features/conversations/mutations';
import { getDocumentsByPPAPId } from '@/src/features/documents/mutations';
import { getEventsByPPAPId } from '@/src/features/events/mutations';
import { PPAPHeader } from '@/src/features/ppap/components/PPAPHeader';
import { ConversationList } from '@/src/features/conversations/components/ConversationList';
import { DocumentList } from '@/src/features/documents/components/DocumentList';
import { EventHistory } from '@/src/features/events/components/EventHistory';
import { DeletePPAPButton } from '@/src/features/ppap/components/DeletePPAPButton';
import { PPAPWorkflowWrapper } from '@/src/features/ppap/components/PPAPWorkflowWrapper';
import PPAPValidationPanel from '@/src/features/ppap/components/PPAPValidationPanel';
import PPAPActionBar from '@/src/features/ppap/components/PPAPActionBar';
import PPAPActivityFeed from '@/src/features/ppap/components/PPAPActivityFeed';
import PPAPIntakeSnapshot from '@/src/features/ppap/components/PPAPIntakeSnapshot';
import PPAPSubmissionPanel from '@/src/features/ppap/components/PPAPSubmissionPanel';
import { TRANE_VALIDATIONS } from '@/src/features/ppap/utils/traneValidationTemplate';

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
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-start justify-between">
          <PPAPHeader ppap={ppap} />
          <DeletePPAPButton ppapId={ppap.id} ppapNumber={ppap.ppap_number} />
        </div>

        <PPAPWorkflowWrapper ppap={ppap} />

        <PPAPActionBar ppapState={ppap.status} validations={TRANE_VALIDATIONS} />

        <PPAPValidationPanel validations={TRANE_VALIDATIONS} currentPhase="pre-ack" />

        <PPAPSubmissionPanel validations={TRANE_VALIDATIONS} />

        <PPAPIntakeSnapshot />

        <PPAPActivityFeed />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <ConversationList ppapId={id} conversations={conversations || []} />
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
