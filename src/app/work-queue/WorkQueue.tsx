'use client';

/**
 * V6.0 EMIP System Shell - Work Queue Component
 * 
 * UI LAYER - Actionable Task List
 * 
 * Responsibilities:
 * - Display items requiring action
 * - Show items in progress
 * - Show recently updated items
 * - Enable quick navigation to modules
 * 
 * Architecture:
 * - Pure UI component
 * - Receives data from parent
 * - Handles routing only
 */

import React from 'react';
import { useRouter } from 'next/navigation';

export interface WorkQueueItem {
  id: string;
  type: 'PPAP' | 'BOM' | 'COPPER';
  title: string;
  status: string;
  nextAction?: string;
  link: string;
  priority?: 'high' | 'medium' | 'low';
  updatedAt?: string;
}

interface WorkQueueProps {
  items: WorkQueueItem[];
  title?: string;
  emptyMessage?: string;
}

export default function WorkQueue({ 
  items, 
  title = 'Work Queue',
  emptyMessage = 'No items in queue'
}: WorkQueueProps) {
  const router = useRouter();

  const getTypeColor = (type: WorkQueueItem['type']) => {
    switch (type) {
      case 'PPAP':
        return 'bg-blue-100 text-blue-700';
      case 'BOM':
        return 'bg-green-100 text-green-700';
      case 'COPPER':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getPriorityColor = (priority?: WorkQueueItem['priority']) => {
    switch (priority) {
      case 'high':
        return 'border-l-4 border-red-500';
      case 'medium':
        return 'border-l-4 border-yellow-500';
      case 'low':
        return 'border-l-4 border-green-500';
      default:
        return '';
    }
  };

  const handleItemClick = (item: WorkQueueItem) => {
    console.log('🧭 V6.0 [Work Queue] Navigating to item', {
      type: item.type,
      link: item.link,
      timestamp: new Date().toISOString()
    });
    router.push(item.link);
  };

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4 text-[color:var(--text-primary)]">{title}</h2>
        <div className="text-center py-8 text-gray-500">
          {emptyMessage}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-[color:var(--text-primary)]">{title}</h2>
      </div>

      <div className="divide-y divide-gray-200">
        {items.map((item) => (
          <div
            key={item.id}
            onClick={() => handleItemClick(item)}
            className={`
              p-4 hover:bg-gray-50 cursor-pointer transition-colors
              ${getPriorityColor(item.priority)}
            `}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`
                    px-2 py-1 rounded text-xs font-medium
                    ${getTypeColor(item.type)}
                  `}>
                    {item.type}
                  </span>
                  <h3 className="font-medium text-[color:var(--text-primary)]">{item.title}</h3>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <span className="font-medium">Status:</span>
                    <span>{item.status}</span>
                  </span>

                  {item.nextAction && (
                    <span className="flex items-center gap-1">
                      <span className="font-medium">Next:</span>
                      <span>{item.nextAction}</span>
                    </span>
                  )}

                  {item.updatedAt && (
                    <span className="text-gray-400">
                      {new Date(item.updatedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>

              <div className="text-gray-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
