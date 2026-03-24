'use client';

// Phase 3D future:
// Replace mock events with real event log from backend
// Events will be generated on state transitions and actions

interface PPAPEvent {
  id: string;
  timestamp: string;
  actor: string;
  role: 'admin' | 'coordinator' | 'engineer' | 'viewer';
  action: string;
  details?: string;
}

const MOCK_EVENTS: PPAPEvent[] = [
  {
    id: '1',
    timestamp: '2026-03-24T17:30:00',
    actor: 'Matt Robinson',
    role: 'coordinator',
    action: 'Acknowledged PPAP',
    details: 'Pre-acknowledgement validations complete',
  },
  {
    id: '2',
    timestamp: '2026-03-24T16:45:00',
    actor: 'Sarah Chen',
    role: 'engineer',
    action: 'Completed PFMEA',
    details: 'Uploaded document and marked validation complete',
  },
  {
    id: '3',
    timestamp: '2026-03-24T15:20:00',
    actor: 'Sarah Chen',
    role: 'engineer',
    action: 'Completed DFMEA',
    details: 'Uploaded document and marked validation complete',
  },
  {
    id: '4',
    timestamp: '2026-03-24T14:10:00',
    actor: 'Sarah Chen',
    role: 'engineer',
    action: 'Completed Process Flow Diagram',
    details: 'Uploaded document and marked validation complete',
  },
  {
    id: '5',
    timestamp: '2026-03-24T13:05:00',
    actor: 'Matt Robinson',
    role: 'coordinator',
    action: 'Assigned PPAP to Sarah Chen',
    details: 'Engineer assigned for technical work',
  },
  {
    id: '6',
    timestamp: '2026-03-24T12:30:00',
    actor: 'Matt Robinson',
    role: 'coordinator',
    action: 'Created PPAP',
    details: 'Initial PPAP record created from customer request',
  },
];

const ROLE_COLORS = {
  admin: 'text-purple-700 bg-purple-50',
  coordinator: 'text-blue-700 bg-blue-50',
  engineer: 'text-green-700 bg-green-50',
  viewer: 'text-gray-700 bg-gray-50',
};

const EVENT_ICONS = {
  Created: '📝',
  Assigned: '👤',
  Completed: '✓',
  Acknowledged: '✅',
  Submitted: '📤',
  Updated: '🔄',
};

function getEventIcon(action: string): string {
  for (const [key, icon] of Object.entries(EVENT_ICONS)) {
    if (action.includes(key)) return icon;
  }
  return '•';
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function PPAPActivityFeed() {
  return (
    <div className="bg-white rounded-lg p-6 border border-gray-200">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Activity</h2>

      <div className="space-y-4">
        {MOCK_EVENTS.map((event, index) => (
          <div key={event.id}>
            <div className="flex items-start gap-3">
              <span className="text-xl flex-shrink-0 mt-0.5">
                {getEventIcon(event.action)}
              </span>
              <div className="flex-1">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-sm text-gray-500">
                    {formatTimestamp(event.timestamp)}
                  </span>
                  <span className="text-sm text-gray-400">—</span>
                  <span className="text-sm font-medium text-gray-900">
                    {event.actor}
                  </span>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded ${
                      ROLE_COLORS[event.role]
                    }`}
                  >
                    {event.role}
                  </span>
                </div>
                <p className="text-sm font-medium text-gray-900">{event.action}</p>
                {event.details && (
                  <p className="text-sm text-gray-600 mt-1">{event.details}</p>
                )}
              </div>
            </div>
            {index < MOCK_EVENTS.length - 1 && (
              <div className="border-t border-gray-100 mt-4"></div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <span className="font-medium">Demo Mode:</span> Activity feed shows mock events.
          Future: Events will be generated from actual workflow actions.
        </p>
      </div>
    </div>
  );
}
