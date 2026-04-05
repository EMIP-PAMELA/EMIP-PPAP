'use client';

/**
 * PPAPDetailLayout — Tab-based PPAP detail page layout
 * V3.3A
 *
 * Replaces the flat component dump on /ppap/[id].
 * Tabs: Overview | Validations | Documents | Activity
 *
 * Copilot entry is gated: only visible in post-ack states.
 * Document generation is gated: only accessible after ACKNOWLEDGED.
 */

import { useState } from 'react';
import Link from 'next/link';
import { PPAPRecord, PPAPStatus } from '@/src/types/database.types';
import { Validation } from '../types/validation';
import { TRANE_VALIDATIONS } from '../utils/traneValidationTemplate';
import { PPAPWorkflowWrapper } from './PPAPWorkflowWrapper';
import PPAPActionBar from './PPAPActionBar';
import PPAPSummaryHeader from './PPAPSummaryHeader';
import PPAPAcknowledgementBanner from './PPAPAcknowledgementBanner';
import PPAPValidationPanel from './PPAPValidationPanel';
import PPAPSubmissionPanel from './PPAPSubmissionPanel';
import { DocumentationForm } from './DocumentationForm';
import { DeletePPAPButton } from './DeletePPAPButton';
import { PPAPHeader } from './PPAPHeader';
import { currentUser } from '@/src/lib/mockUser';

// Post-ack states: Copilot and document generation are available
const POST_ACK_STATUSES: PPAPStatus[] = [
  'ACKNOWLEDGED',
  'POST_ACK_ASSIGNED',
  'POST_ACK_IN_PROGRESS',
  'AWAITING_SUBMISSION',
  'SUBMITTED',
  'APPROVED',
  'CLOSED',
];

function isPostAckStatus(status: PPAPStatus): boolean {
  return POST_ACK_STATUSES.includes(status);
}

type Tab = 'overview' | 'validations' | 'documents' | 'activity';

interface PPAPDetailLayoutProps {
  ppap: PPAPRecord;
  events: any[];
  conversations: any[];
  documents: any[];
}

export function PPAPDetailLayout({ ppap, events, conversations, documents }: PPAPDetailLayoutProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const role = currentUser.role;
  const isCoordinator = role === 'coordinator' || role === 'admin';
  const isEngineer = role === 'engineer';
  const postAck = isPostAckStatus(ppap.status);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'validations', label: 'Validations' },
    { id: 'documents', label: 'Documents' },
    { id: 'activity', label: 'Activity' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-4">

        {/* Header row */}
        <div className="flex items-start justify-between">
          <PPAPHeader ppap={ppap} />
          <DeletePPAPButton ppapId={ppap.id} ppapNumber={ppap.ppap_number} />
        </div>

        {/* Role badge */}
        <div className="bg-blue-50 border-l-4 border-blue-500 px-4 py-2 rounded text-sm font-semibold text-blue-800">
          {isCoordinator ? 'Coordinator View — Assignment, Acknowledgement, Submission' : isEngineer ? 'Engineer View — Validations, Documents, Execution' : 'Viewer'}
        </div>

        {/* Tab navigation */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <nav className="flex border-b border-gray-200">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 text-sm font-semibold transition-colors border-b-2 -mb-px ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-700 bg-blue-50'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="p-6">

            {/* ── OVERVIEW TAB ── */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <PPAPWorkflowWrapper ppap={ppap} />

                {isCoordinator && (
                  <>
                    <PPAPSummaryHeader ppapStatus={ppap.status} validations={TRANE_VALIDATIONS} />
                    <PPAPActionBar ppapId={ppap.id} ppapState={ppap.status} validations={TRANE_VALIDATIONS} />
                    <PPAPAcknowledgementBanner ppapStatus={ppap.status} validations={TRANE_VALIDATIONS} />
                  </>
                )}
              </div>
            )}

            {/* ── VALIDATIONS TAB ── */}
            {activeTab === 'validations' && (
              <div className="space-y-6">
                <PPAPValidationPanel
                  validations={TRANE_VALIDATIONS}
                  currentPhase={postAck ? 'post-ack' : 'pre-ack'}
                  ppapStatus={ppap.status}
                />
                {isEngineer && postAck && (
                  <PPAPSubmissionPanel validations={TRANE_VALIDATIONS} />
                )}
              </div>
            )}

            {/* ── DOCUMENTS TAB ── */}
            {activeTab === 'documents' && (
              <div className="space-y-6">
                {postAck ? (
                  <>
                    {/* Copilot entry — GATED to post-ack */}
                    <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg p-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">🤖</span>
                          <div>
                            <h3 className="text-base font-bold text-gray-900">AI Document Generation</h3>
                            <p className="text-sm text-gray-600 mt-0.5">
                              Generate PPAP documents with Claude. PPAP context loaded automatically.
                            </p>
                          </div>
                        </div>
                        <Link
                          href={`/ppap/${ppap.id}/copilot`}
                          className="px-5 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold text-sm shadow"
                        >
                          Open Copilot →
                        </Link>
                      </div>
                    </div>

                    <DocumentationForm
                      ppapId={ppap.id}
                      partNumber={ppap.part_number || ''}
                      isReadOnly={false}
                      currentPhase="post-ack"
                    />
                  </>
                ) : (
                  <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-6 text-center">
                    <p className="text-2xl mb-2">🔒</p>
                    <p className="text-base font-semibold text-yellow-900">Document generation locked</p>
                    <p className="text-sm text-yellow-700 mt-1">
                      Complete pre-ack validations and obtain coordinator acknowledgement to unlock document generation.
                    </p>
                    <p className="text-xs text-yellow-600 mt-2">
                      Current status: <span className="font-mono font-semibold">{ppap.status}</span>
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── ACTIVITY TAB ── */}
            {activeTab === 'activity' && (
              <div className="space-y-6">
                {/* Events */}
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-3">Event Log</h3>
                  {events && events.length > 0 ? (
                    <div className="space-y-2">
                      {events.map((event: any, i: number) => (
                        <div key={event.id || i} className="flex items-start gap-3 p-3 bg-white border border-gray-200 rounded-lg text-sm">
                          <span className="text-gray-400 text-xs whitespace-nowrap mt-0.5">
                            {new Date(event.created_at || event.timestamp).toLocaleString()}
                          </span>
                          <span className="font-medium text-gray-900">{event.event_type}</span>
                          {event.actor && (
                            <span className="text-gray-500 text-xs">by {event.actor}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No events recorded yet.</p>
                  )}
                </div>

                {/* Conversations */}
                {conversations && conversations.length > 0 && (
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 mb-3">Conversations</h3>
                    <div className="space-y-2">
                      {conversations.map((conv: any, i: number) => (
                        <div key={conv.id || i} className="p-3 bg-white border border-gray-200 rounded-lg text-sm">
                          <p className="font-medium text-gray-900">{conv.subject || conv.message_type || 'Message'}</p>
                          {conv.content && <p className="text-gray-600 text-xs mt-1">{conv.content}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}
