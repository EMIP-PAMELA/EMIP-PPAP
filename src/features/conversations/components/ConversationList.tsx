'use client';

import { PPAPConversation } from '@/src/types/database.types';
import { formatDateTime } from '@/src/lib/utils';
import { AddConversationForm } from './AddConversationForm';
import { useRouter } from 'next/navigation';

interface ConversationListProps {
  ppapId: string;
  conversations: PPAPConversation[];
}

export function ConversationList({ ppapId, conversations }: ConversationListProps) {
  const router = useRouter();

  const handleSuccess = () => {
    router.refresh();
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Conversation Log</h2>

      {conversations.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 mb-4">No conversation history yet.</p>
          <p className="text-sm text-gray-400">Add the first note to start tracking communication.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {conversations.map((conv) => (
            <div key={conv.id} className="border-l-4 border-blue-500 pl-4 py-2">
              <div className="flex items-start justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{conv.author}</span>
                  {conv.site && (
                    <span className="text-xs text-gray-500">@ {conv.site}</span>
                  )}
                </div>
                <span className="text-xs text-gray-500">{formatDateTime(conv.created_at)}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${getMessageTypeColor(conv.message_type)}`}>
                  {conv.message_type}
                </span>
                <p className="text-gray-700 flex-1">{conv.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddConversationForm ppapId={ppapId} onSuccess={handleSuccess} />
    </div>
  );
}

function getMessageTypeColor(type: string): string {
  const colors: Record<string, string> = {
    NOTE: 'bg-gray-100 text-gray-700',
    QUESTION: 'bg-blue-100 text-blue-700',
    ANSWER: 'bg-green-100 text-green-700',
    BLOCKER: 'bg-red-100 text-red-700',
    RESOLUTION: 'bg-green-100 text-green-700',
    HANDOFF: 'bg-purple-100 text-purple-700',
    STATUS_UPDATE: 'bg-yellow-100 text-yellow-700',
  };
  
  return colors[type] || 'bg-gray-100 text-gray-700';
}
