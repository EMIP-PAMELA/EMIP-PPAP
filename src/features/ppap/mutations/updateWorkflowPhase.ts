import { supabase } from '@/src/lib/supabaseClient';
import { logEvent } from '@/src/features/events/mutations';
import { WorkflowPhase } from '../constants/workflowPhases';

export interface UpdateWorkflowPhaseParams {
  ppapId: string;
  fromPhase: WorkflowPhase;
  toPhase: WorkflowPhase;
  actor?: string;
  additionalData?: Record<string, unknown>;
}

/**
 * Update workflow phase for a PPAP record
 * 
 * This function:
 * 1. Updates ppap_records.workflow_phase in database
 * 2. Sets updated_at timestamp
 * 3. Logs PHASE_ADVANCED event to audit trail
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
}: UpdateWorkflowPhaseParams) {
  // Validate ID
  if (!ppapId) {
    throw new Error('PPAP ID is required');
  }

  // Update workflow_phase in database
  const { data, error } = await supabase
    .from('ppap_records')
    .update({
      workflow_phase: toPhase,
      updated_at: new Date().toISOString(),
    })
    .eq('id', ppapId)
    .select()
    .single();

  if (error) {
    console.error('Failed to update workflow phase:', error);
    throw new Error(`Failed to update workflow phase: ${error.message}`);
  }

  if (!data) {
    throw new Error('No PPAP record returned after update');
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

  return data;
}
