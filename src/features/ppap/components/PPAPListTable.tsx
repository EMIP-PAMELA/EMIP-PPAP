'use client';

import { PPAPRecord } from '@/src/types/database.types';
import Link from 'next/link';
import { formatDate } from '@/src/lib/utils';

interface PPAPListTableProps {
  ppaps: PPAPRecord[];
}

export function PPAPListTable({ ppaps }: PPAPListTableProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                PPAP Number
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Part Number
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Customer
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Plant
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Request Date
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {ppaps.map((ppap) => {
              return (
                <tr key={ppap.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link
                      href={`/ppap/${ppap.id}`}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {ppap.ppap_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {ppap.part_number}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {ppap.customer_name}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {ppap.plant}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(ppap.status)}`}>
                      {ppap.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(ppap.request_date)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
