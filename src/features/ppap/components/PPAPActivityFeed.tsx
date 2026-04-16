'use client';

/**
 * V3.3A.8: PPAP Activity Feed
 * 
 * Unified activity feed combining:
 * - System events (from ppap_events)
 * - User posts (notes, issues, updates from ppap_activities)
 * 
 * Features:
 * - Real-time activity timeline
 * - User posting (notes/issues/updates)
 * - Issue flagging and counting
 * - Clean, non-cluttered UI
 */

import { useState, useEffect } from 'react';
import { Activity, ActivityType, getActivityIcon, getActivityColorClasses } from '../types/activity';
import { getActivities, createActivity, getIssueCount } from '../utils/activityService';
import { currentUser } from '@/src/lib/mockUser';

interface PPAPActivityFeedProps {
  ppapId: string;
}

const ROLE_COLORS: Record<string, string> = {
  admin: 'text-purple-700 bg-purple-50',
  coordinator: 'text-blue-700 bg-blue-50',
  engineer: 'text-green-700 bg-green-50',
  viewer: 'text-gray-700 bg-gray-50',
};

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

export default function PPAPActivityFeed({ ppapId }: PPAPActivityFeedProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [issueCount, setIssueCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [showPostForm, setShowPostForm] = useState(false);
  const [postType, setPostType] = useState<ActivityType>('note');
  const [postMessage, setPostMessage] = useState('');
  const [postPriority, setPostPriority] = useState<'normal' | 'issue' | 'risk'>('normal');

  // Load activities
  useEffect(() => {
    loadActivities();
  }, [ppapId]);

  const loadActivities = async () => {
    try {
      setLoading(true);
      const [activityList, issues] = await Promise.all([
        getActivities(ppapId),
        getIssueCount(ppapId),
      ]);
      setActivities(activityList);
      setIssueCount(issues);
    } catch (error) {
      console.error('Failed to load activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePost = async () => {
    if (!postMessage.trim()) return;

    setPosting(true);
    try {
      await createActivity({
        ppapId,
        type: postType,
        priority: postPriority,
        message: postMessage.trim(),
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
      });

      // Reload activities
      await loadActivities();

      // Reset form
      setPostMessage('');
      setPostType('note');
      setPostPriority('normal');
      setShowPostForm(false);
    } catch (error) {
      console.error('Failed to post activity:', error);
      alert('Failed to post activity. Please try again.');
    } finally {
      setPosting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-[color:var(--surface-elevated)] rounded-lg p-6 border border-[color:var(--panel-border)]">
        <div className="flex items-center justify-center py-8">
          <svg className="animate-spin h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="ml-2 text-gray-600">Loading activity...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[color:var(--surface-elevated)] rounded-lg p-6 border border-[color:var(--panel-border)]">
      {/* Header with issue count */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-[color:var(--text-primary)]">Activity Feed</h2>
          {issueCount > 0 && (
            <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full">
              ⚠️ {issueCount} Open Issue{issueCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowPostForm(!showPostForm)}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
        >
          {showPostForm ? 'Cancel' : '+ Add Update'}
        </button>
      </div>

      {/* Post form */}
      {showPostForm && (
        <div className="mb-6 p-4 bg-[color:var(--surface-elevated)] border border-[color:var(--panel-border)] rounded-lg">
          <div className="space-y-3">
            {/* Type selection */}
            <div className="flex gap-2">
              <button
                onClick={() => setPostType('note')}
                className={`px-3 py-1 text-sm font-medium rounded ${
                  postType === 'note'
                    ? 'bg-blue-600 text-white'
                    : 'bg-[color:var(--surface-elevated)] text-[color:var(--text-secondary)] border border-[color:var(--panel-border)] hover:bg-[color:var(--table-row-hover)]'
                }`}
              >
                💬 Note
              </button>
              <button
                onClick={() => setPostType('update')}
                className={`px-3 py-1 text-sm font-medium rounded ${
                  postType === 'update'
                    ? 'bg-blue-600 text-white'
                    : 'bg-[color:var(--surface-elevated)] text-[color:var(--text-secondary)] border border-[color:var(--panel-border)] hover:bg-[color:var(--table-row-hover)]'
                }`}
              >
                📢 Update
              </button>
              <button
                onClick={() => setPostType('issue')}
                className={`px-3 py-1 text-sm font-medium rounded ${
                  postType === 'issue'
                    ? 'bg-blue-600 text-white'
                    : 'bg-[color:var(--surface-elevated)] text-[color:var(--text-secondary)] border border-[color:var(--panel-border)] hover:bg-[color:var(--table-row-hover)]'
                }`}
              >
                ⚠️ Issue
              </button>
            </div>

            {/* Priority selection (for issues) */}
            {postType === 'issue' && (
              <div className="flex gap-2">
                <label className="text-sm font-medium text-gray-700">Priority:</label>
                <button
                  onClick={() => setPostPriority('issue')}
                  className={`px-2 py-1 text-xs font-medium rounded ${
                    postPriority === 'issue'
                      ? 'bg-yellow-600 text-white'
                      : 'bg-[color:var(--surface-elevated)] text-[color:var(--text-secondary)] border border-[color:var(--panel-border)]'
                  }`}
                >
                  ⚠️ Issue
                </button>
                <button
                  onClick={() => setPostPriority('risk')}
                  className={`px-2 py-1 text-xs font-medium rounded ${
                    postPriority === 'risk'
                      ? 'bg-red-600 text-white'
                      : 'bg-[color:var(--surface-elevated)] text-[color:var(--text-secondary)] border border-[color:var(--panel-border)]'
                  }`}
                >
                  🚨 Risk
                </button>
              </div>
            )}

            {/* Message input */}
            <textarea
              value={postMessage}
              onChange={(e) => setPostMessage(e.target.value)}
              placeholder={`Write your ${postType}...`}
              rows={3}
              className="w-full px-3 py-2 border border-[color:var(--panel-border)] bg-[color:var(--input-bg)] text-[color:var(--text-primary)] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />

            {/* Submit button */}
            <div className="flex justify-end">
              <button
                onClick={handlePost}
                disabled={posting || !postMessage.trim()}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {posting ? 'Posting...' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activity list */}
      <div className="space-y-3">
        {activities.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">No activity yet</p>
        ) : (
          activities.map((activity, index) => (
            <div
              key={activity.id}
              className={`p-3 border rounded-lg ${getActivityColorClasses(activity)}`}
            >
              <div className="flex items-start gap-3">
                <span className="text-lg flex-shrink-0 mt-0.5">
                  {getActivityIcon(activity)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1 flex-wrap">
                    <span className="text-xs text-gray-500">
                      {formatTimestamp(activity.createdAt)}
                    </span>
                    {activity.userName && (
                      <>
                        <span className="text-xs text-gray-400">—</span>
                        <span className="text-xs font-medium text-[color:var(--text-primary)]">
                          {activity.userName}
                        </span>
                      </>
                    )}
                    {activity.userRole && (
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded ${
                          ROLE_COLORS[activity.userRole] || 'text-gray-700 bg-gray-50'
                        }`}
                      >
                        {activity.userRole}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[color:var(--text-primary)]">{activity.message}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
