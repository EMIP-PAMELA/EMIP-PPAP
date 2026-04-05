'use client';

/**
 * V3.3A.8: Recent Activity Strip
 * 
 * Shows latest 1-2 activities at top of PPAP page.
 * Click to open full activity feed.
 */

import { useState, useEffect } from 'react';
import { Activity, getActivityIcon } from '../types/activity';
import { getActivities, getIssueCount } from '../utils/activityService';

interface RecentActivityStripProps {
  ppapId: string;
  onViewAll?: () => void;
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function RecentActivityStrip({ ppapId, onViewAll }: RecentActivityStripProps) {
  const [recentActivities, setRecentActivities] = useState<Activity[]>([]);
  const [issueCount, setIssueCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecentActivity();
  }, [ppapId]);

  const loadRecentActivity = async () => {
    try {
      const [activities, issues] = await Promise.all([
        getActivities(ppapId),
        getIssueCount(ppapId),
      ]);
      setRecentActivities(activities.slice(0, 2)); // Latest 2
      setIssueCount(issues);
    } catch (error) {
      console.error('Failed to load recent activity:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || recentActivities.length === 0) {
    return null;
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-blue-900">Recent Activity</h3>
          {issueCount > 0 && (
            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full">
              ⚠️ {issueCount}
            </span>
          )}
        </div>
        <button
          onClick={onViewAll}
          className="text-xs font-medium text-blue-700 hover:text-blue-900 hover:underline"
        >
          View All →
        </button>
      </div>

      <div className="space-y-2">
        {recentActivities.map((activity) => (
          <div
            key={activity.id}
            className="flex items-start gap-2 text-sm bg-white rounded px-3 py-2"
          >
            <span className="text-base flex-shrink-0">
              {getActivityIcon(activity)}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-xs text-gray-500">
                  {formatTimestamp(activity.createdAt)}
                </span>
                {activity.userName && (
                  <>
                    <span className="text-xs text-gray-400">·</span>
                    <span className="text-xs font-medium text-gray-700">
                      {activity.userName}
                    </span>
                  </>
                )}
              </div>
              <p className="text-xs text-gray-900 truncate">{activity.message}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
