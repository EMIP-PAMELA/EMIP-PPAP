/**
 * SINGLE SOURCE OF TRUTH
 *
 * ALL status updates MUST go through this function.
 * ANY direct database update to `status` is a critical bug.
 * 
 * Phase 3F.8: Hard enforcement - legacy functions disabled.
 * This is the ONLY way to update PPAP status.
 */

import { supabase } from '@/src/lib/supabaseClient';
import { PPAPStatus } from '@/src/types/database.types';
import { logEvent } from '@/src/features/events/mutations';

/**
 * Phase 3G - Persistent State Transitions
 * 
 * Updates PPAP state in database with event logging.
 * This is the SINGLE ENTRY POINT for all state transitions.
 * Phase 3F.7: Enforces state machine rules, prevents direct writes.
 * Phase 3F.8: Hard enforcement - updateWorkflowPhase() and updatePPAP(status) disabled.
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
  let oldState: PPAPStatus | undefined;
  try {
    // Phase 3F.10: GLOBAL TRACE - Log authorized state write with stack trace
    console.log('🔥 STATE WRITE (AUTHORIZED)', {
      ppapId,
      newState,
      userId,
      userRole,
      timestamp: new Date().toISOString(),
      caller: new Error().stack,
    });

    // Phase 3F.5: Log before update
    console.log('Phase 3F.5 - UPDATE START', {
      ppapId,
      newState,
      userId,
      userRole,
      timestamp: new Date().toISOString(),
    });

    // Phase 3F.5: Verify PPAP ID
    console.log('Phase 3F.5 - PPAP ID CHECK (updatePPAPState)', ppapId);

    // Fetch current PPAP state
    const { data: currentPPAP, error: fetchError } = await supabase
      .from('ppap_records')
      .select('status')
      .eq('id', ppapId)
      .single();

    // Phase 3F.5: Log fetch result
    console.log('Phase 3F.5 - FETCH CURRENT STATE RESULT', currentPPAP);

    if (fetchError || !currentPPAP) {
      // Phase 3F.5: Critical error - PPAP not found
      console.error('Phase 3F.5 - CRITICAL: PPAP NOT FOUND', {
        ppapId,
        fetchError: fetchError?.message,
        currentPPAP,
      });
      throw new Error(`Failed to fetch current PPAP state: ${fetchError?.message || 'PPAP not found'}`);
    }

    oldState = currentPPAP.status;

    // Phase 3F.6: Backward transition guard
    const invalidBackwardTransitions: Array<[PPAPStatus, PPAPStatus]> = [
      ['READY_TO_ACKNOWLEDGE', 'PRE_ACK_IN_PROGRESS'],
      ['READY_TO_ACKNOWLEDGE', 'PRE_ACK_ASSIGNED'],
      ['READY_TO_ACKNOWLEDGE', 'INTAKE_COMPLETE'],
      ['READY_TO_ACKNOWLEDGE', 'NEW'],
      ['ACKNOWLEDGED', 'READY_TO_ACKNOWLEDGE'],
      ['ACKNOWLEDGED', 'PRE_ACK_IN_PROGRESS'],
      ['ACKNOWLEDGED', 'PRE_ACK_ASSIGNED'],
      ['POST_ACK_IN_PROGRESS', 'ACKNOWLEDGED'],
      ['POST_ACK_IN_PROGRESS', 'PRE_ACK_IN_PROGRESS'],
      ['AWAITING_SUBMISSION', 'POST_ACK_IN_PROGRESS'],
      ['AWAITING_SUBMISSION', 'ACKNOWLEDGED'],
      ['SUBMITTED', 'AWAITING_SUBMISSION'],
      ['SUBMITTED', 'POST_ACK_IN_PROGRESS'],
      ['APPROVED', 'SUBMITTED'],
      ['APPROVED', 'AWAITING_SUBMISSION'],
      ['CLOSED', 'APPROVED'],
    ];

    if (invalidBackwardTransitions.some(([from, to]) => 
      oldState === from && newState === to
    )) {
      console.error('Phase 3F.6 - BLOCKED INVALID BACKWARD TRANSITION', {
        from: oldState,
        to: newState,
        ppapId,
      });
      return {
        success: false,
        ppapId,
        oldState: oldState as PPAPStatus,
        newState,
        error: `Invalid backward transition: Cannot move from ${oldState} to ${newState}`,
      };
    }

    // Update PPAP state in database
    const { error: updateError } = await supabase
      .from('ppap_records')
      .update({ 
        status: newState,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ppapId);

    // Phase 3F.5: Log update result
    console.log('Phase 3F.5 - UPDATE RESULT', {
      newState,
      error: updateError,
      success: !updateError,
    });

    if (updateError) {
      console.error('Phase 3F.5 - UPDATE FAILED', updateError);
      throw new Error(`Failed to update PPAP state: ${updateError.message}`);
    }

    // Phase 3F.5: Force post-update verification
    const { data: verifyPPAP, error: verifyError } = await supabase
      .from('ppap_records')
      .select('id, status')
      .eq('id', ppapId)
      .single();

    console.log('Phase 3F.5 - POST-UPDATE VERIFY', {
      verifyPPAP,
      verifyError,
      expectedStatus: newState,
      actualStatus: verifyPPAP?.status,
      statusMatch: verifyPPAP?.status === newState,
    });

    if (verifyError || !verifyPPAP) {
      console.error('Phase 3F.5 - CRITICAL: POST-UPDATE VERIFICATION FAILED', {
        ppapId,
        verifyError: verifyError?.message,
        verifyPPAP,
      });
    }

    if (verifyPPAP && verifyPPAP.status !== newState) {
      console.error('Phase 3F.5 - CRITICAL: STATUS MISMATCH AFTER UPDATE', {
        expected: newState,
        actual: verifyPPAP.status,
        ppapId,
      });
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
      oldState: oldState as PPAPStatus,
      newState,
    };
  } catch (error) {
    console.error('State transition failed:', error);
    
    // V3.6: No fallback to 'NEW' - use fetched state or 'CLOSED' for errors
    return {
      success: false,
      ppapId,
      oldState: (oldState || 'CLOSED') as PPAPStatus, // Use fetched state or error fallback
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
