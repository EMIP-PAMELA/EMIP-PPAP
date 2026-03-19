import { supabase } from '@/src/lib/supabaseClient';
import type {
  CreatePPAPInput,
  UpdatePPAPInput,
  PPAPRecord,
  PPAPStatus,
} from '@/src/types/database.types';
import { logEvent } from '@/src/features/events/mutations';

export async function createPPAP(input: CreatePPAPInput): Promise<PPAPRecord> {
  const ppapNumber = await generatePPAPNumber();

  const { data, error } = await supabase
    .from('ppap_records')
    .insert({
      ppap_number: ppapNumber,
      part_number: input.part_number,
      part_name: input.part_name || null,
      revision: input.revision || null,
      customer_name: input.customer_name,
      customer_code: input.customer_code || null,
      plant: input.plant,
      request_date: input.request_date,
      due_date: input.due_date || null,
      submission_level: input.submission_level || null,
      mold_required: input.mold_required || false,
      mold_supplier: input.mold_supplier || null,
      mold_lead_time_days: input.mold_lead_time_days || null,
      process_type: input.process_type || null,
      notes: input.notes || null,
      status: 'NEW',
      created_by: input.created_by,
      updated_by: input.created_by,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create PPAP: ${error.message}`);
  }

  await logEvent({
    ppap_id: data.id,
    event_type: 'PPAP_CREATED',
    actor: input.created_by,
    event_data: {
      ppap_number: ppapNumber,
      part_number: input.part_number,
      customer_name: input.customer_name,
    },
  });

  return data as PPAPRecord;
}

export async function updatePPAP(
  id: string,
  input: UpdatePPAPInput
): Promise<PPAPRecord> {
  const currentPPAP = await supabase
    .from('ppap_records')
    .select('*')
    .eq('id', id)
    .single();

  if (currentPPAP.error) {
    throw new Error(`Failed to fetch current PPAP: ${currentPPAP.error.message}`);
  }

  const { data, error } = await supabase
    .from('ppap_records')
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update PPAP: ${error.message}`);
  }

  if (input.status && input.status !== currentPPAP.data.status) {
    await logEvent({
      ppap_id: id,
      event_type: 'STATUS_CHANGED',
      actor: input.updated_by,
      event_data: {
        previous_status: currentPPAP.data.status,
        new_status: input.status,
      },
    });
  }

  if (input.assigned_to && input.assigned_to !== currentPPAP.data.assigned_to) {
    await logEvent({
      ppap_id: id,
      event_type: 'ASSIGNED',
      actor: input.updated_by,
      event_data: {
        previous_assignee: currentPPAP.data.assigned_to,
        new_assignee: input.assigned_to,
      },
    });
  }

  if (input.mold_status && input.mold_status !== currentPPAP.data.mold_status) {
    await logEvent({
      ppap_id: id,
      event_type: 'MOLD_STATUS_CHANGED',
      actor: input.updated_by,
      event_data: {
        previous_status: currentPPAP.data.mold_status,
        new_status: input.mold_status,
      },
    });
  }

  return data as PPAPRecord;
}

export async function updatePPAPStatus(
  id: string,
  newStatus: PPAPStatus,
  actor: string,
  note?: string
): Promise<PPAPRecord> {
  const result = await updatePPAP(id, {
    status: newStatus,
    updated_by: actor,
  });

  if (note) {
    const { createConversation } = await import('@/src/features/conversations/mutations');
    await createConversation({
      ppap_id: id,
      message: note,
      message_type: 'STATUS_UPDATE',
      author: actor,
    });
  }

  return result;
}

export async function assignPPAP(
  id: string,
  assignedTo: string,
  assignedRole: string,
  actor: string
): Promise<PPAPRecord> {
  return updatePPAP(id, {
    assigned_to: assignedTo,
    assigned_role: assignedRole,
    updated_by: actor,
  });
}

export async function softDeletePPAP(id: string, actor: string): Promise<void> {
  const { error } = await supabase
    .from('ppap_records')
    .update({
      deleted_at: new Date().toISOString(),
      updated_by: actor,
    })
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete PPAP: ${error.message}`);
  }
}

async function generatePPAPNumber(): Promise<string> {
  const { data, error } = await supabase.rpc('generate_ppap_number');

  if (error) {
    const yearSuffix = new Date().getFullYear().toString().slice(-2);
    const randomNum = Math.floor(Math.random() * 9000) + 1000;
    return `PPAP-${randomNum}-${yearSuffix}`;
  }

  return data as string;
}
