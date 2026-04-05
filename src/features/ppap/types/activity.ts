/**
 * V3.3A.8: PPAP Activity Feed
 * 
 * Unified activity model for system events and user posts.
 * Combines events, user notes, issues, and updates into single feed.
 */

export type ActivityType = 
  | 'system'    // Automated system events (created, status change, etc.)
  | 'note'      // User-posted note/comment
  | 'issue'     // User-flagged issue
  | 'update';   // User-posted status update

export type ActivityPriority = 'normal' | 'issue' | 'risk';

export interface Activity {
  id: string;
  ppapId: string;
  type: ActivityType;
  priority: ActivityPriority;
  message: string;
  userId?: string | null;  // null for system events
  userName?: string | null;
  userRole?: string | null;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface CreateActivityInput {
  ppapId: string;
  type: ActivityType;
  priority?: ActivityPriority;
  message: string;
  userId?: string;
  userName?: string;
  userRole?: string;
  metadata?: Record<string, any>;
}

/**
 * Convert PPAPEvent to Activity format
 */
export function eventToActivity(event: any): Activity {
  return {
    id: event.id,
    ppapId: event.ppap_id,
    type: 'system',
    priority: 'normal',
    message: formatEventMessage(event),
    userId: null,
    userName: event.actor || 'System',
    userRole: event.actor_role,
    metadata: event.event_data,
    createdAt: event.created_at,
  };
}

/**
 * Format event type into human-readable message
 */
function formatEventMessage(event: any): string {
  const type = event.event_type;
  const data = event.event_data || {};
  
  switch (type) {
    case 'PPAP_CREATED':
      return `PPAP created for ${data.customer_name || 'customer'}`;
    case 'ASSIGNED':
      if (data.claimed_from_queue) {
        return `Ownership claimed from ${data.department} queue`;
      }
      return `Assigned to ${data.assigned_to || 'engineer'}`;
    case 'STATUS_CHANGED':
      return `Status changed to ${data.new_status || 'updated'}`;
    case 'DOCUMENT_ADDED':
      return `Document uploaded: ${data.file_name || 'file'}`;
    case 'DOCUMENTATION_SUBMITTED':
      return `Documentation phase completed (${data.documents_complete || 0} documents)`;
    case 'PHASE_ADVANCED':
      return `Advanced to ${data.new_phase || 'next phase'}`;
    default:
      return type.replace(/_/g, ' ').toLowerCase();
  }
}

/**
 * Get icon for activity type
 */
export function getActivityIcon(activity: Activity): string {
  if (activity.priority === 'issue') return '⚠️';
  if (activity.priority === 'risk') return '🚨';
  
  switch (activity.type) {
    case 'system':
      return '🔔';
    case 'note':
      return '💬';
    case 'issue':
      return '⚠️';
    case 'update':
      return '📢';
    default:
      return '•';
  }
}

/**
 * Get color classes for activity type
 */
export function getActivityColorClasses(activity: Activity): string {
  if (activity.priority === 'issue') {
    return 'bg-yellow-50 border-yellow-300';
  }
  if (activity.priority === 'risk') {
    return 'bg-red-50 border-red-300';
  }
  
  switch (activity.type) {
    case 'system':
      return 'bg-blue-50 border-blue-200';
    case 'note':
      return 'bg-gray-50 border-gray-200';
    case 'issue':
      return 'bg-yellow-50 border-yellow-300';
    case 'update':
      return 'bg-green-50 border-green-200';
    default:
      return 'bg-white border-gray-200';
  }
}
