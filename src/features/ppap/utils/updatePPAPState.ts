import { supabase } from '@/src/lib/supabaseClient';
import { PPAPStatus } from '@/src/types/database.types';
import { logEvent } from '@/src/features/events/mutations';

/**
 * Phase 3G - Persistent State Transitions
 * 
 * Updates PPAP state in database with event logging.
 * This is the single entry point for all state transitions.
 */

export interface StateTransitionResult {
  success: boolean;
  ppapId: string;
  oldState: PPAPStatus;
  newState: PPAPStatus;
  error?: string;
}

/**
 * Updates PPAP state in database and logs the transition event.
 * 
 * @param ppapId - The PPAP record ID
 * @param newState - The new state to transition to
 * @param userId - The user performing the transition
 * @param userRole - The role of the user performing the transition
 * @returns Result object with success status and state information
 */
export async function updatePPAPState(
  ppapId: string,
  newState: PPAPStatus,
  userId: string,
  userRole: string
): Promise<StateTransitionResult> {
  try {
    // Fetch current PPAP state
    const { data: currentPPAP, error: fetchError } = await supabase
      .from('ppaps')
      .select('status')
      .eq('id', ppapId)
      .single();

    if (fetchError || !currentPPAP) {
      throw new Error(`Failed to fetch current PPAP state: ${fetchError?.message || 'PPAP not found'}`);
    }

    const oldState = currentPPAP.status;

    // Update PPAP state in database
    const { error: updateError } = await supabase
      .from('ppaps')
      .update({ 
        status: newState,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ppapId);

    if (updateError) {
      throw new Error(`Failed to update PPAP state: ${updateError.message}`);
    }

    // Log state transition event
    await logEvent({
      ppap_id: ppapId,
      event_type: 'STATUS_CHANGED',
      event_data: {
        from: oldState,
        to: newState,
        actor: userId,
        role: userRole,
        timestamp: new Date().toISOString(),
      },
      actor: userId,
      actor_role: userRole,
    });

    return {
      success: true,
      ppapId,
      oldState,
      newState,
    };
  } catch (error) {
    console.error('State transition failed:', error);
    
    return {
      success: false,
      ppapId,
      oldState: 'NEW', // Fallback
      newState,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Helper function to validate state transition before execution.
 * Returns true if transition is valid, false otherwise.
 */
export function isValidTransition(
  currentState: PPAPStatus,
  nextState: PPAPStatus
): boolean {
  // Define valid state transitions
  const validTransitions: Record<PPAPStatus, PPAPStatus[]> = {
    'NEW': ['INTAKE_COMPLETE', 'PRE_ACK_ASSIGNED'],
    'INTAKE_COMPLETE': ['PRE_ACK_ASSIGNED'],
    'PRE_ACK_ASSIGNED': ['PRE_ACK_IN_PROGRESS'],
    'PRE_ACK_IN_PROGRESS': ['READY_TO_ACKNOWLEDGE', 'ON_HOLD', 'BLOCKED'],
    'READY_TO_ACKNOWLEDGE': ['ACKNOWLEDGED', 'ON_HOLD', 'BLOCKED'],
    'ACKNOWLEDGED': ['POST_ACK_ASSIGNED'],
    'POST_ACK_ASSIGNED': ['POST_ACK_IN_PROGRESS'],
    'POST_ACK_IN_PROGRESS': ['AWAITING_SUBMISSION', 'ON_HOLD', 'BLOCKED'],
    'AWAITING_SUBMISSION': ['SUBMITTED', 'ON_HOLD', 'BLOCKED'],
    'SUBMITTED': ['APPROVED', 'ON_HOLD', 'BLOCKED'],
    'APPROVED': ['CLOSED'],
    'ON_HOLD': ['PRE_ACK_IN_PROGRESS', 'POST_ACK_IN_PROGRESS', 'AWAITING_SUBMISSION'],
    'BLOCKED': ['PRE_ACK_IN_PROGRESS', 'POST_ACK_IN_PROGRESS', 'AWAITING_SUBMISSION'],
    'CLOSED': [],
  };

  const allowedNextStates = validTransitions[currentState] || [];
  return allowedNextStates.includes(nextState);
}
