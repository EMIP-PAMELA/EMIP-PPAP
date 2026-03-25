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
import PPAPSummaryHeader from '@/src/features/ppap/components/PPAPSummaryHeader';
import PPAPAcknowledgementBanner from '@/src/features/ppap/components/PPAPAcknowledgementBanner';
import { TRANE_VALIDATIONS } from '@/src/features/ppap/utils/traneValidationTemplate';
import { currentUser } from '@/src/lib/mockUser';

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

  // Phase 3F.3: Role-based view logic
  const role = currentUser.role;
  const isCoordinator = role === 'coordinator' || role === 'admin';
  const isEngineer = role === 'engineer';
  const viewLabel = isCoordinator ? 'Coordinator View' : isEngineer ? 'Engineer View' : 'Viewer';

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Phase 3F.3: View Label Banner */}
        <div className="bg-blue-50 border-l-4 border-blue-500 px-4 py-3 rounded">
          <div className="flex items-center">
            <span className="text-blue-800 font-semibold text-sm">{viewLabel}</span>
            <span className="ml-2 text-blue-600 text-xs">
              {isCoordinator && '(Assignment, Acknowledgement, Overview)'}
              {isEngineer && '(Validations, Documents, Execution)'}
            </span>
          </div>
        </div>

        {/* Shared: Always show header */}
        <div className="flex items-start justify-between">
          <PPAPHeader ppap={ppap} />
          <DeletePPAPButton ppapId={ppap.id} ppapNumber={ppap.ppap_number} />
        </div>

        {/* Shared: Always show workflow progress */}
        <PPAPWorkflowWrapper ppap={ppap} />

        {/* Coordinator View: Summary and Assignment Controls */}
        {isCoordinator && (
          <>
            <PPAPSummaryHeader ppapStatus={ppap.status} validations={TRANE_VALIDATIONS} />
            <PPAPActionBar ppapId={ppap.id} ppapState={ppap.status} validations={TRANE_VALIDATIONS} />
            <PPAPAcknowledgementBanner ppapStatus={ppap.status} validations={TRANE_VALIDATIONS} />
            <PPAPIntakeSnapshot />
          </>
        )}

        {/* Engineer View: Validation Details and Documents */}
        {isEngineer && (
          <>
            <PPAPValidationPanel validations={TRANE_VALIDATIONS} currentPhase="pre-ack" ppapStatus={ppap.status} />
            <PPAPSubmissionPanel validations={TRANE_VALIDATIONS} />
          </>
        )}

        {/* Shared: Always show activity feed */}
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
