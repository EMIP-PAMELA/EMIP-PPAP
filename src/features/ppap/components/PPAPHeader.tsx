'use client';

import { PPAPRecord } from '@/src/types/database.types';
import { formatDate } from '@/src/lib/utils';
import Link from 'next/link';
import { StatusUpdateControl } from './StatusUpdateControl';

interface PPAPHeaderProps {
  ppap: PPAPRecord;
}

export function PPAPHeader({ ppap }: PPAPHeaderProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-gray-900">{ppap.ppap_number}</h1>
            <StatusUpdateControl ppapId={ppap.id} currentStatus={ppap.status} />
          </div>
          <p className="text-gray-600">{ppap.part_number}</p>
        </div>
        <Link
          href="/ppap"
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          ← Back to List
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-1">Customer</h3>
          <p className="text-lg font-semibold text-gray-900">{ppap.customer_name}</p>
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-1">Plant</h3>
          <p className="text-lg font-semibold text-gray-900">{ppap.plant}</p>
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-1">Request Date</h3>
          <p className="text-lg font-semibold text-gray-900">
            {formatDate(ppap.request_date)}
          </p>
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-1">Created</h3>
          <p className="text-lg font-semibold text-gray-900">
            {formatDate(ppap.created_at)}
          </p>
        </div>
      </div>
    </div>
  );
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    NEW: 'bg-gray-100 text-gray-800',
    INTAKE_COMPLETE: 'bg-blue-100 text-blue-800',
    PRE_ACK_ASSIGNED: 'bg-yellow-100 text-yellow-800',
    PRE_ACK_IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
    READY_TO_ACKNOWLEDGE: 'bg-green-100 text-green-800',
    ACKNOWLEDGED: 'bg-green-100 text-green-800',
    POST_ACK_ASSIGNED: 'bg-orange-100 text-orange-800',
    POST_ACK_IN_PROGRESS: 'bg-orange-100 text-orange-800',
    AWAITING_SUBMISSION: 'bg-indigo-100 text-indigo-800',
    SUBMITTED: 'bg-indigo-100 text-indigo-800',
    APPROVED: 'bg-green-100 text-green-800',
    ON_HOLD: 'bg-yellow-100 text-yellow-800',
    BLOCKED: 'bg-red-100 text-red-800',
    CLOSED: 'bg-gray-100 text-gray-800',
  };
  
  return colors[status] || 'bg-gray-100 text-gray-800';
}
