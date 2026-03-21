'use client';

import type { PPAPStatus } from '@/src/types/database.types';
import { STATUS_LABELS } from '@/src/features/ppap/constants/statusFlow';
import { getStatusColor } from '@/src/features/ppap/utils/statusStyles';

interface StatusUpdateControlProps {
  ppapId: string;
  currentStatus: PPAPStatus;
}

/**
 * StatusUpdateControl - Read-only status display
 * 
 * Status is now automatically synchronized with workflow_phase.
 * Manual status editing has been removed to ensure data integrity.
 * 
 * Status updates occur automatically when:
 * - Workflow phase advances (via updateWorkflowPhase mutation)
 * - Review decisions are made (APPROVE → APPROVED, REJECT → CLOSED)
 */
export function StatusUpdateControl({ ppapId, currentStatus }: StatusUpdateControlProps) {
  const isFinalized = currentStatus === 'APPROVED' || currentStatus === 'CLOSED';

  return (
    <div className="flex items-center gap-2">
      <div className={`px-3 py-1 text-sm font-semibold rounded ${getStatusColor(currentStatus)}`}>
        {STATUS_LABELS[currentStatus] || currentStatus}
      </div>
      {isFinalized && (
        <span className="text-xs text-gray-500 italic">(Auto-synced)</span>
      )}
      {!isFinalized && (
        <span className="text-xs text-gray-500 italic" title="Status automatically follows workflow phase">
          (Auto-synced with workflow)
        </span>
      )}
    </div>
  );
}
