'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/src/lib/supabaseClient';
import type { PPAPStatus } from '@/src/types/database.types';

interface StatusUpdateControlProps {
  ppapId: string;
  currentStatus: PPAPStatus;
}

const STATUS_OPTIONS: PPAPStatus[] = [
  'NEW',
  'PRE_ACK_IN_PROGRESS',
  'READY_TO_ACKNOWLEDGE',
  'ACKNOWLEDGED',
  'POST_ACK_IN_PROGRESS',
  'BLOCKED',
  'ON_HOLD',
  'CLOSED',
];

export function StatusUpdateControl({ ppapId, currentStatus }: StatusUpdateControlProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleStatusChange = async (newStatus: PPAPStatus) => {
    if (newStatus === currentStatus || loading) return;

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
            field: 'status',
            old_value: currentStatus,
            new_value: newStatus,
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

  return (
    <select
      value={currentStatus}
      onChange={(e) => handleStatusChange(e.target.value as PPAPStatus)}
      disabled={loading}
      className="px-3 py-1 text-sm font-semibold border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
    >
      {STATUS_OPTIONS.map((status) => (
        <option key={status} value={status}>
          {status.replace(/_/g, ' ')}
        </option>
      ))}
    </select>
  );
}
