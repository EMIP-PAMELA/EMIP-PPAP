'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/src/lib/supabaseClient';
import type { PPAPStatus } from '@/src/types/database.types';
import { STATUS_TRANSITIONS, STATUS_LABELS } from '@/src/features/ppap/constants/statusFlow';
import { getStatusColor } from '@/src/features/ppap/utils/statusStyles';

interface StatusUpdateControlProps {
  ppapId: string;
  currentStatus: PPAPStatus;
}

export function StatusUpdateControl({ ppapId, currentStatus }: StatusUpdateControlProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const allowedStatuses = STATUS_TRANSITIONS[currentStatus] || [];
  const isLocked = currentStatus === 'APPROVED';

  const handleStatusChange = async (newStatus: PPAPStatus) => {
    if (newStatus === currentStatus || loading) return;

    if (!allowedStatuses.includes(newStatus)) {
      alert('Invalid status transition');
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase
        .from('ppap_records')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ppapId);

      if (updateError) {
        console.error('Failed to update PPAP status:', updateError);
        alert(`Failed to update status: ${updateError.message}`);
        return;
      }

      const { error: eventError } = await supabase
        .from('ppap_events')
        .insert({
          ppap_id: ppapId,
          event_type: 'STATUS_CHANGED',
          event_data: {
            from: currentStatus,
            to: newStatus,
          },
          actor: 'Matt',
        });

      if (eventError) {
        console.error('Failed to log status change event:', eventError);
      }

      router.refresh();
    } catch (err) {
      console.error('Failed to update status:', err);
      alert('Failed to update status. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (isLocked) {
    return (
      <div className={`px-3 py-1 text-sm font-semibold rounded ${getStatusColor(currentStatus)}`}>
        {STATUS_LABELS[currentStatus] || currentStatus} (Finalized)
      </div>
    );
  }

  if (allowedStatuses.length === 0) {
    return (
      <div className={`px-3 py-1 text-sm font-semibold rounded ${getStatusColor(currentStatus)}`}>
        {STATUS_LABELS[currentStatus] || currentStatus}
      </div>
    );
  }

  return (
    <select
      value={currentStatus}
      onChange={(e) => handleStatusChange(e.target.value as PPAPStatus)}
      disabled={loading}
      className={`px-3 py-1 text-sm font-semibold border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed ${getStatusColor(currentStatus)}`}
    >
      <option value={currentStatus}>
        {STATUS_LABELS[currentStatus] || currentStatus}
      </option>
      {allowedStatuses.map((status) => (
        <option key={status} value={status}>
          → {STATUS_LABELS[status] || status}
        </option>
      ))}
    </select>
  );
}
