'use client';

import { useState } from 'react';
import { PPAPEvent } from '@/src/types/database.types';
import { formatDateTime } from '@/src/lib/utils';

interface EventHistoryProps {
  events: PPAPEvent[];
}

export function EventHistory({ events }: EventHistoryProps) {
  const [expanded, setExpanded] = useState(false);
  const displayEvents = expanded ? events : events.slice(0, 5);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Event History</h2>

      {events.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 text-sm">No events recorded yet.</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {displayEvents.map((event) => (
              <div key={event.id} className="border-l-2 border-gray-300 pl-3 py-1">
                <div className="flex items-start justify-between mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${getEventTypeColor(event.event_type)}`}>
                    {event.event_type.replace(/_/g, ' ')}
                  </span>
                  <span className="text-xs text-gray-500">{formatDateTime(event.created_at)}</span>
                </div>
                <p className="text-sm text-gray-700">
                  by <span className="font-medium">{event.actor}</span>
                  {event.actor_role && <span className="text-gray-500"> ({event.actor_role})</span>}
                </p>
                {event.event_data && Object.keys(event.event_data).length > 0 && (
                  <details className="mt-1">
                    <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                      View details
                    </summary>
                    <pre className="text-xs bg-gray-50 p-2 rounded mt-1 overflow-auto">
                      {JSON.stringify(event.event_data, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>

          {events.length > 5 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-4 text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              {expanded ? 'Show less' : `Show all ${events.length} events`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function getEventTypeColor(type: string): string {
  const colors: Record<string, string> = {
    PPAP_CREATED: 'bg-green-100 text-green-700',
    STATUS_CHANGED: 'bg-blue-100 text-blue-700',
    ASSIGNED: 'bg-purple-100 text-purple-700',
    DOCUMENT_ADDED: 'bg-indigo-100 text-indigo-700',
    DOCUMENT_REMOVED: 'bg-red-100 text-red-700',
    TASK_CREATED: 'bg-yellow-100 text-yellow-700',
    TASK_COMPLETED: 'bg-green-100 text-green-700',
    CONVERSATION_ADDED: 'bg-gray-100 text-gray-700',
    MOLD_STATUS_CHANGED: 'bg-purple-100 text-purple-700',
    RISK_FLAGGED: 'bg-red-100 text-red-700',
    RISK_CLEARED: 'bg-green-100 text-green-700',
    SUBMITTED: 'bg-blue-100 text-blue-700',
    APPROVED: 'bg-green-100 text-green-700',
    BLOCKED: 'bg-red-100 text-red-700',
    UNBLOCKED: 'bg-green-100 text-green-700',
  };
  
  return colors[type] || 'bg-gray-100 text-gray-700';
}
