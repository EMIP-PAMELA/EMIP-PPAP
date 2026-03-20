import { supabase } from '@/src/lib/supabaseClient';
import type {
  CreatePPAPInput,
  UpdatePPAPInput,
  PPAPRecord,
  PPAPStatus,
} from '@/src/types/database.types';
import { logEvent } from '@/src/features/events/mutations';

export async function createPPAP(input: CreatePPAPInput): Promise<PPAPRecord> {
  const ppapNumber = generatePPAPNumber();

  const { data, error } = await supabase
    .from('ppap_records')
    .insert({
      ppap_number: ppapNumber,
      part_number: input.part_number,
      customer_name: input.customer_name,
      plant: input.plant,
      request_date: input.request_date,
      status: 'NEW',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create PPAP: ${error.message}`);
  }

  await logEvent({
    ppap_id: data.id,
    event_type: 'PPAP_CREATED',
    actor: 'Matt',
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
  input: UpdatePPAPInput,
  actor: string = 'Matt'
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
      actor: actor,
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
      actor: actor,
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
      actor: actor,
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
  }, actor);

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
  }, actor);
}

export async function softDeletePPAP(id: string, actor: string): Promise<void> {
  const { error } = await supabase
    .from('ppap_records')
    .update({
      deleted_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete PPAP: ${error.message}`);
  }
}

function generatePPAPNumber(): string {
  const yearSuffix = new Date().getFullYear().toString().slice(-2);
  const timestamp = Date.now().toString().slice(-6);
  return `PPAP-${timestamp}-${yearSuffix}`;
}
