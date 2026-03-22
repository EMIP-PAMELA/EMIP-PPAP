'use client';

import { PPAPRecord } from '@/src/types/database.types';
import { useRouter } from 'next/navigation';
import { formatDate } from '@/src/lib/utils';
import { useMemo } from 'react';
import { getNextAction, getPriorityColor, getPriorityBackground } from '../utils/getNextAction';

interface PPAPListTableProps {
  ppaps: PPAPRecord[];
}

export function PPAPListTable({ ppaps }: PPAPListTableProps) {
  const router = useRouter();

  // Memoize next action calculations
  const ppapsWithActions = useMemo(() => {
    return ppaps.map(ppap => ({
      ...ppap,
      nextActionData: getNextAction(ppap.workflow_phase, ppap.status),
    }));
  }, [ppaps]);

  const handleRowClick = (ppapId: string) => {
    router.push(`/ppap/${ppapId}`);
  };

  return (
    <div className="bg-white border border-gray-300 rounded-xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-100 border-b border-gray-300">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                PPAP Number
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                Part Number
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                Customer
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                Plant
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                Next Action
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                Request Date
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {ppapsWithActions.map((ppap) => {
              const priorityBg = getPriorityBackground(ppap.nextActionData.priority);
              const priorityColor = getPriorityColor(ppap.nextActionData.priority);
              
              return (
                <tr 
                  key={ppap.id} 
                  onClick={() => handleRowClick(ppap.id)}
                  className={`hover:bg-gray-100 cursor-pointer transition-colors ${priorityBg}`}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-blue-600 font-bold text-base">
                      {ppap.ppap_number}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                    {ppap.part_number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {ppap.customer_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {ppap.plant}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(ppap.status)}`}>
                      {ppap.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-sm font-semibold ${priorityColor}`}>
                      {ppap.nextActionData.nextAction}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
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
