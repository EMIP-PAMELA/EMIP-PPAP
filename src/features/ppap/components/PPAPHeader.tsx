'use client';

import { PPAPRecord, PPAPTask } from '@/src/types/database.types';
import { formatDate } from '@/src/lib/utils';
import Link from 'next/link';
import { StatusUpdateControl } from './StatusUpdateControl';
import { getTaskCounts } from '@/src/features/tasks/utils/taskUtils';

interface PPAPHeaderProps {
  ppap: PPAPRecord;
  tasks?: PPAPTask[];
}

export function PPAPHeader({ ppap, tasks = [] }: PPAPHeaderProps) {
  const taskCounts = getTaskCounts(tasks);

  return (
    <div className="bg-white border border-gray-300 rounded-xl shadow-sm">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-3">
              <h1 className="text-4xl font-bold text-gray-900">{ppap.ppap_number}</h1>
              <StatusUpdateControl ppapId={ppap.id} currentStatus={ppap.status} />
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-sm font-medium text-gray-600">Part Number:</span>
              <p className="text-xl font-semibold text-gray-900">{ppap.part_number}</p>
            </div>
          </div>
          <Link
            href="/ppap"
            className="text-blue-600 hover:text-blue-800 text-sm font-semibold transition-colors"
          >
            ← Back to List
          </Link>
        </div>
        
        {tasks.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-4 text-sm">
            <span className="font-medium text-gray-700">Task Summary:</span>
            <span className="text-gray-700">
              <span className="font-bold">{taskCounts.total}</span> Total
            </span>
            <span className="text-gray-400">•</span>
            <span className="text-blue-700">
              <span className="font-bold">{taskCounts.active}</span> Active
            </span>
            <span className="text-gray-400">•</span>
            <span className="text-green-700">
              <span className="font-bold">{taskCounts.completed}</span> Completed
            </span>
            {taskCounts.overdue > 0 && (
              <>
                <span className="text-gray-400">•</span>
                <span className="text-red-700 font-bold">
                  🔴 {taskCounts.overdue} Overdue
                </span>
              </>
            )}
          </div>
        )}
      </div>

      <div className="p-6 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">PPAP Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <h4 className="text-xs font-medium text-gray-600 mb-2 uppercase tracking-wide">Customer</h4>
            <p className="text-base font-semibold text-gray-900">{ppap.customer_name}</p>
          </div>

          <div>
            <h4 className="text-xs font-medium text-gray-600 mb-2 uppercase tracking-wide">Plant</h4>
            <p className="text-base font-semibold text-gray-900">{ppap.plant}</p>
          </div>

          <div>
            <h4 className="text-xs font-medium text-gray-600 mb-2 uppercase tracking-wide">Request Date</h4>
            <p className="text-base font-semibold text-gray-900">
              {formatDate(ppap.request_date)}
            </p>
          </div>

          <div>
            <h4 className="text-xs font-medium text-gray-600 mb-2 uppercase tracking-wide">Created</h4>
            <p className="text-base font-semibold text-gray-900">
              {formatDate(ppap.created_at)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
