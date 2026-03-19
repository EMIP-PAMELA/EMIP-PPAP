'use client';

import { PPAPRecord } from '@/src/types/database.types';

interface MoldSectionProps {
  ppap: PPAPRecord;
}

export function MoldSection({ ppap }: MoldSectionProps) {
  if (!ppap.mold_required) {
    return null;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Mold Information</h2>

      <div className="space-y-4">
        {ppap.process_type && (
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Process Type</h3>
            <p className="text-gray-900">{ppap.process_type.replace(/_/g, ' ')}</p>
          </div>
        )}

        {ppap.mold_supplier && (
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Mold Supplier</h3>
            <p className="text-gray-900">{ppap.mold_supplier}</p>
          </div>
        )}

        {ppap.mold_status && (
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Mold Status</h3>
            <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getMoldStatusColor(ppap.mold_status)}`}>
              {ppap.mold_status.replace(/_/g, ' ')}
            </span>
          </div>
        )}

        {ppap.mold_lead_time_days !== null && (
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Lead Time</h3>
            <p className="text-gray-900">{ppap.mold_lead_time_days} days</p>
          </div>
        )}

        {ppap.mold_status === 'BLOCKED' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm font-semibold text-red-800">⚠️ Mold is blocked</p>
            <p className="text-xs text-red-600 mt-1">This may impact the overall PPAP timeline.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function getMoldStatusColor(status: string): string {
  const colors: Record<string, string> = {
    NOT_STARTED: 'bg-gray-100 text-gray-800',
    DESIGN_IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
    DESIGN_APPROVED: 'bg-green-100 text-green-800',
    FABRICATION_IN_PROGRESS: 'bg-blue-100 text-blue-800',
    FIRST_ARTICLE_COMPLETE: 'bg-indigo-100 text-indigo-800',
    VALIDATION_IN_PROGRESS: 'bg-purple-100 text-purple-800',
    VALIDATED: 'bg-green-100 text-green-800',
    BLOCKED: 'bg-red-100 text-red-800',
  };
  
  return colors[status] || 'bg-gray-100 text-gray-800';
}
