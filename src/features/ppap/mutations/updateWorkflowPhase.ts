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
  // Phase 3F.8: HARD ENFORCEMENT - Function disabled
  throw new Error(
    'DEPRECATED: updateWorkflowPhase() is disabled. Use updatePPAPState() instead. ' +
    'This function bypasses the state machine and is no longer allowed.'
  );
}
