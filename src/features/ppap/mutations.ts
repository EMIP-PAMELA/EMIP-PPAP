// ⚠️ CRITICAL RULE: NEVER update status directly.
// ALL status updates MUST go through updatePPAPState().
// This file contains LEGACY code that bypasses the state machine.
// @deprecated Use updatePPAPState() for status transitions.

import { supabase } from '@/src/lib/supabaseClient';
import type {
  CreatePPAPInput,
  UpdatePPAPInput,
  PPAPRecord,
  PPAPStatus,
} from '@/src/types/database.types';
import { logEvent } from '@/src/features/events/mutations';
import { sanitizePlant } from './utils/plantValidation';

export async function createPPAP(input: CreatePPAPInput): Promise<PPAPRecord> {
  // Phase 3H.9: Sanitize plant value before write (blocks invalid plants)
  const sanitizedPlant = sanitizePlant(input.plant);
  
  // Phase 3H.12: Explicit error if plant validation fails
  if (sanitizedPlant === null && input.plant) {
    throw new Error('Invalid plant value. Must be one of: Ft. Smith, Ball Ground, Warner Robins');
  }
  
  // V3.3A.16A: Build payload and log for debugging
  const payload = {
    ppap_number: input.ppap_number.trim(),
    part_number: input.part_number,
    customer_name: input.customer_name,
    plant: sanitizedPlant,
    request_date: input.request_date,
    ppap_type: input.ppap_type,
    department: input.department,
    assigned_to: null,
    status: 'NEW' as const,
  };
  
  console.log('CREATE PPAP INPUT', JSON.stringify(payload, null, 2));
  
  // V3.3A.16B: Final payload verification before insert
  console.log('FINAL INSERT PAYLOAD', payload);
  
  // V3.3A.5: Department queue model - assign to department, leave owner null
  const { data, error } = await supabase
    .from('ppap_records')
    .insert(payload)
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to create PPAP: ${error.message}`);
  }

  if (!data) {
    throw new Error('Failed to create PPAP: No record returned from database');
  }

  if (!data.id) {
    throw new Error('Failed to create PPAP: No ID returned from database');
  }

  await logEvent({
    ppap_id: data.id,
    event_type: 'PPAP_CREATED',
    actor: 'Matt',
    event_data: {
      ppap_number: input.ppap_number,
      part_number: input.part_number,
      customer_name: input.customer_name,
      ppap_type: input.ppap_type,
    },
  });

  return data as PPAPRecord;
}

export async function updatePPAP(
  id: string,
  input: UpdatePPAPInput,
  actor: string = 'Matt'
): Promise<PPAPRecord> {
  if (!id) {
    throw new Error('PPAP ID is required for update');
  }

  const currentPPAP = await supabase
    .from('ppap_records')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (currentPPAP.error) {
    throw new Error(`Failed to fetch current PPAP: ${currentPPAP.error.message}`);
  }

  if (!currentPPAP.data) {
    throw new Error(`PPAP not found with ID: ${id}`);
  }

  // Phase 3F.8: HARD ENFORCEMENT - Block status updates
  if (input.status) {
    throw new Error(
      'DEPRECATED: Status updates must use updatePPAPState(). ' +
      'Direct status writes are not allowed.'
    );
  }

  // Phase 3F.8: Remove status from input to prevent bypass
  const { status, ...updateData } = input;

  const { data, error } = await supabase
    .from('ppap_records')
    .update({
      ...updateData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update PPAP: ${error.message}`);
  }

  if (!data) {
    throw new Error(`PPAP not found with ID: ${id}`);
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

export async function deletePPAP(
  id: string,
  actor: string = 'Matt'
): Promise<void> {
  const { data: ppap, error: fetchError } = await supabase
    .from('ppap_records')
    .select('ppap_number, part_number')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Failed to fetch PPAP for deletion: ${fetchError.message}`);
  }

  if (!ppap) {
    throw new Error(`PPAP not found with ID: ${id}`);
  }

  const { error: eventError } = await supabase
    .from('ppap_events')
    .insert({
      ppap_id: id,
      event_type: 'PPAP_DELETED',
      event_data: {
        ppap_number: ppap.ppap_number,
        part_number: ppap.part_number,
      },
      actor: actor,
      actor_role: 'Engineer',
    });

  if (eventError) {
    console.error('Failed to log PPAP deletion event:', eventError);
  }

  const { error: deleteError } = await supabase
    .from('ppap_records')
    .delete()
    .eq('id', id);

  if (deleteError) {
    throw new Error(`Failed to delete PPAP: ${deleteError.message}`);
  }
}

