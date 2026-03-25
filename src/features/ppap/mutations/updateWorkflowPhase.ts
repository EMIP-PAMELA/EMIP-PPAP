// ⚠️ CRITICAL RULE: NEVER update status directly.
// ALL status updates MUST go through updatePPAPState().
// This file contains LEGACY code that bypasses the state machine.
// @deprecated Use updatePPAPState() instead for all status transitions.

import { supabase } from '@/src/lib/supabaseClient';
import { logEvent } from '@/src/features/events/mutations';
import { WorkflowPhase } from '../constants/workflowPhases';
import { PPAPStatus } from '@/src/types/database.types';

export interface UpdateWorkflowPhaseParams {
  ppapId: string;
  fromPhase: WorkflowPhase;
  toPhase: WorkflowPhase;
  actor?: string;
  additionalData?: Record<string, unknown>;
  overrideStatus?: PPAPStatus; // Allow manual override (e.g., APPROVED/REJECTED from review)
}

/**
 * Map workflow phase to corresponding status
 * 
 * INITIATION → NEW
 * DOCUMENTATION → PRE_ACK_IN_PROGRESS
 * SAMPLE → PRE_ACK_IN_PROGRESS
 * REVIEW → SUBMITTED
 * COMPLETE → APPROVED (default, can be overridden by review decision)
 */
function getStatusForPhase(phase: WorkflowPhase): PPAPStatus {
  const mapping: Record<WorkflowPhase, PPAPStatus> = {
    INITIATION: 'NEW',
    DOCUMENTATION: 'PRE_ACK_IN_PROGRESS',
    SAMPLE: 'PRE_ACK_IN_PROGRESS',
    REVIEW: 'SUBMITTED',
    COMPLETE: 'APPROVED',
  };
  
  return mapping[phase];
}

/**
 * Update workflow phase for a PPAP record
 * 
 * This function:
 * 1. Updates ppap_records.workflow_phase in database
 * 2. Auto-syncs ppap_records.status based on phase mapping
 * 3. Sets updated_at timestamp
 * 4. Logs PHASE_ADVANCED event to audit trail
 * 5. Logs STATUS_CHANGED event if status changed
 * 
 * @throws Error if database update fails
 * @returns Updated PPAP record on success
 */
export async function updateWorkflowPhase({
  ppapId,
  fromPhase,
  toPhase,
  actor = 'System',
  additionalData,
  overrideStatus,
}: UpdateWorkflowPhaseParams) {
  // Validate ID
  if (!ppapId) {
    throw new Error('PPAP ID is required');
  }

  // Get current record to track old status
  const { data: currentRecord, error: fetchError } = await supabase
    .from('ppap_records')
    .select('status')
    .eq('id', ppapId)
    .maybeSingle();

  if (fetchError) {
    console.error('Failed to fetch current record:', fetchError);
    throw new Error(`Failed to fetch current record: ${fetchError.message}`);
  }

  if (!currentRecord) {
    throw new Error(`PPAP not found with ID: ${ppapId}`);
  }

  const oldStatus = currentRecord?.status || 'NEW';
  const newStatus = overrideStatus || getStatusForPhase(toPhase);

  // Phase 3F.7: 🚨 DIRECT STATUS WRITE DETECTED
  console.warn('🚨 DIRECT STATUS WRITE DETECTED', {
    status: newStatus,
    file: 'updateWorkflowPhase.ts',
    warning: 'This bypasses updatePPAPState() - DEPRECATED',
  });

  // TODO Phase 3D: Replace direct status updates with executeTransition()
  // This will enforce both state machine validation and role permissions
  // Example: const newStatus = executeTransition(role, oldStatus, targetStatus);

  // ⚠️ LEGACY: Direct status write - bypasses state machine
  // Update workflow_phase AND status in database
  const { data, error } = await supabase
    .from('ppap_records')
    .update({
      workflow_phase: toPhase,
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', ppapId)
    .select()
    .maybeSingle();

  if (error) {
    console.error('Failed to update workflow phase:', error);
    throw new Error(`Failed to update workflow phase: ${error.message}`);
  }

  if (!data) {
    throw new Error(`PPAP not found with ID: ${ppapId}`);
  }

  // Log PHASE_ADVANCED event
  try {
    await logEvent({
      ppap_id: ppapId,
      event_type: 'PHASE_ADVANCED',
      event_data: {
        from_phase: fromPhase,
        to_phase: toPhase,
        ...additionalData,
      },
      actor,
    });
  } catch (eventError) {
    console.error('Failed to log PHASE_ADVANCED event:', eventError);
    // Don't fail the entire operation if event logging fails
    // Phase update already succeeded
  }

  // Log STATUS_CHANGED event if status changed
  if (oldStatus !== newStatus) {
    try {
      await logEvent({
        ppap_id: ppapId,
        event_type: 'STATUS_CHANGED',
        event_data: {
          from: oldStatus,
          to: newStatus,
          source: 'workflow_sync',
          phase: toPhase,
        },
        actor,
      });
    } catch (eventError) {
      console.error('Failed to log STATUS_CHANGED event:', eventError);
      // Don't fail the entire operation if event logging fails
    }
  }

  return data;
}
