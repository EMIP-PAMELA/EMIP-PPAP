'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/src/lib/supabaseClient';

interface AssignmentControlProps {
  ppapId: string;
  currentAssignee: string | null;
}

export function AssignmentControl({ ppapId, currentAssignee }: AssignmentControlProps) {
  const router = useRouter();
  const [assignee, setAssignee] = useState(currentAssignee || '');
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    if (assignee === currentAssignee || loading) return;

    setLoading(true);

    try {
      await supabase
        .from('ppap_records')
        .update({ 
          assigned_to: assignee || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ppapId);

      await supabase
        .from('ppap_events')
        .insert({
          ppap_id: ppapId,
          event_type: 'ASSIGNED_ENGINEER_CHANGED',
          event_data: {
            field: 'assigned_to',
            old_value: currentAssignee,
            new_value: assignee || null,
          },
          actor: 'Matt',
        });

      router.refresh();
    } catch (err) {
      console.error('Failed to update assignment:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={assignee}
        onChange={(e) => setAssignee(e.target.value)}
        onBlur={handleUpdate}
        className="px-3 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
        placeholder="Unassigned"
        disabled={loading}
      />
    </div>
  );
}
