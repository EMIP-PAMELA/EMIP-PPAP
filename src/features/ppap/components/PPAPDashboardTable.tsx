'use client';

import { PPAPRecord } from '@/src/types/database.types';
import { useRouter } from 'next/navigation';
import { formatDate } from '@/src/lib/utils';
import { useMemo, useState } from 'react';
import { enhancePPAPRecord, sortPPAPs, SortConfig, SortField } from '../utils/ppapTableHelpers';

interface PPAPDashboardTableProps {
  ppaps: PPAPRecord[];
}

export function PPAPDashboardTable({ ppaps }: PPAPDashboardTableProps) {
  const router = useRouter();
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  const sortedPPAPs = useMemo(() => {
    const enhanced = ppaps.map(ppap => enhancePPAPRecord(ppap));
    return sortPPAPs(enhanced, sortConfig);
  }, [ppaps, sortConfig]);

  const handleRowClick = (ppapId: string) => {
    router.push(`/ppap/${ppapId}`);
  };

  const handleSort = (field: SortField) => {
    setSortConfig(current => {
      if (!current || current.field !== field) {
        return { field, direction: 'asc' };
      }
      if (current.direction === 'asc') {
        return { field, direction: 'desc' };
      }
      return null;
    });
  };

  const getSortIndicator = (field: SortField) => {
    if (!sortConfig || sortConfig.field !== field) return null;
    return sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
  };

  if (sortedPPAPs.length === 0) {
    return (
      <div className="bg-white border border-gray-300 rounded-xl shadow-sm p-12 text-center">
        <p className="text-gray-600 text-lg">No PPAPs found</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-300 rounded-xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-100 border-b border-gray-300">
            <tr>
              <th 
                onClick={() => handleSort('ppap_number')}
                className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
              >
                PPAP ID{getSortIndicator('ppap_number')}
              </th>
              <th 
                onClick={() => handleSort('part_number')}
                className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
              >
                Part Number{getSortIndicator('part_number')}
              </th>
              <th 
                onClick={() => handleSort('customer_name')}
                className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
              >
                Customer{getSortIndicator('customer_name')}
              </th>
              <th 
                onClick={() => handleSort('state')}
                className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
              >
                Current State{getSortIndicator('state')}
              </th>
              <th 
                onClick={() => handleSort('phase')}
                className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
              >
                Phase{getSortIndicator('phase')}
              </th>
              <th 
                onClick={() => handleSort('assigned_to')}
                className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
              >
                Assigned Engineer{getSortIndicator('assigned_to')}
              </th>
              <th 
                onClick={() => handleSort('plant')}
                className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
              >
                Production Plant{getSortIndicator('plant')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                Coordinator (TBD)
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                Validation (Phase 3D)
              </th>
              <th 
                onClick={() => handleSort('acknowledgement')}
                className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
              >
                Acknowledgement{getSortIndicator('acknowledgement')}
              </th>
              <th 
                onClick={() => handleSort('submission')}
                className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
              >
                Submission{getSortIndicator('submission')}
              </th>
              <th 
                onClick={() => handleSort('updated_at')}
                className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
              >
                Last Updated{getSortIndicator('updated_at')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sortedPPAPs.map((ppap) => (
              <tr
                key={ppap.id}
                onClick={() => handleRowClick(ppap.id)}
                className="hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-blue-600">
                  {ppap.ppap_number}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                  {ppap.part_number}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                  {ppap.customer_name}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                  {ppap.derivedState}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                  {ppap.derivedPhase}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                  {ppap.assigned_to || '—'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                  {ppap.plant}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                  {ppap.coordinator}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                  {ppap.validationSummary}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                  {ppap.acknowledgementStatus}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                  {ppap.submissionStatus}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                  {formatDate(ppap.updated_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
