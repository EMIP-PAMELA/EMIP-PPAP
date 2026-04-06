/**
 * V3.4 Deterministic Derived State Machine
 * 
 * CRITICAL ARCHITECTURE:
 * - State is NEVER stored in database
 * - State is ALWAYS derived from PPAP data
 * - No manual state setting allowed
 * - Deterministic logic only (no heuristics)
 * 
 * State is derived from:
 * - Validation completion counts
 * - acknowledged_at timestamp
 * - submitted_at timestamp
 * - Document completion status
 * - final_status field
 */

import { PPAPRecord } from '@/src/types/database.types';
import { DBValidation } from './validationDatabase';

/**
 * Derived PPAP State (computed from data, never stored)
 */
export type DerivedPPAPState =
  | 'INTAKE'
  | 'PRE_ACK_VALIDATION'
  | 'READY_FOR_ACK'
  | 'DOCUMENTATION'
  | 'SUBMISSION_READY'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED';

export interface PPAPStateContext {
  state: DerivedPPAPState;
  reason: string;
  nextAction: string;
  canProgress: boolean;
}

interface DocumentItem {
  id: string;
  status: 'missing' | 'ready';
  requirement_level: 'REQUIRED' | 'CONDITIONAL';
}

/**
 * V3.4: Derive PPAP state from data (deterministic)
 * 
 * Logic:
 * 1. IF intake confirmations < 3 → INTAKE
 * 2. ELSE IF preAckCompleteCount < 6 → PRE_ACK_VALIDATION
 * 3. ELSE IF acknowledged_at is null → READY_FOR_ACK
 * 4. ELSE IF acknowledged_at exists AND documents incomplete → DOCUMENTATION
 * 5. ELSE IF documents complete AND submitted_at is null → SUBMISSION_READY
 * 6. ELSE IF submitted_at exists AND no final_status → SUBMITTED
 * 7. ELSE IF final_status === 'APPROVED' → APPROVED
 * 8. ELSE IF final_status === 'REJECTED' → REJECTED
 */
export function derivePPAPState(
  ppap: PPAPRecord,
  validations: DBValidation[],
  documents: DocumentItem[]
): PPAPStateContext {
  // Extract data points from database fields
  const acknowledgedDate = (ppap as any).acknowledged_date;
  const submittedDate = (ppap as any).submitted_date;
  const approvedDate = (ppap as any).approved_date;
  
  // Determine final status from status field
  const isApproved = ppap.status === 'APPROVED';
  const isRejected = ppap.status === 'CLOSED' || ppap.status === 'BLOCKED';

  // Count validations
  const preAckValidations = validations.filter(v => v.category === 'pre-ack' && v.required);
  const preAckCompleteCount = preAckValidations.filter(
    v => v.status === 'complete' || v.status === 'approved'
  ).length;

  // Count intake confirmations (first 3 pre-ack validations)
  const intakeValidations = preAckValidations.slice(0, 3);
  
  // V3.4 Phase 7.1B: Debug actual validation state
  console.log('🔍 PHASE 7.1B INTAKE VALIDATION DEBUG', {
    intakeValidations: intakeValidations.map(v => ({
      key: v.validation_key,
      status: v.status,
      completed_at: v.completed_at,
      completed_by: v.completed_by,
    })),
  });
  
  // V3.4 Phase 7.1B: Use completed_at presence as primary completion indicator
  // This is more reliable than status string matching
  const intakeConfirmations = intakeValidations.filter(
    v => v.completed_at != null || v.status === 'complete' || v.status === 'approved'
  ).length;

  // Check document completion
  const requiredDocs = documents.filter(d => d.requirement_level === 'REQUIRED');
  const completedDocs = requiredDocs.filter(d => d.status === 'ready');
  const documentsComplete = requiredDocs.length > 0 && completedDocs.length === requiredDocs.length;

  // RULE 1: Intake phase (< 3 confirmations)
  if (intakeConfirmations < 3) {
    return {
      state: 'INTAKE',
      reason: `Intake confirmations: ${intakeConfirmations}/3`,
      nextAction: 'Complete intake confirmations',
      canProgress: false,
    };
  }

  // RULE 2: Pre-Ack Validation phase (< 6 validations complete)
  if (preAckCompleteCount < 6) {
    return {
      state: 'PRE_ACK_VALIDATION',
      reason: `Pre-ack validations: ${preAckCompleteCount}/6`,
      nextAction: 'Complete remaining pre-ack validations',
      canProgress: false,
    };
  }

  // RULE 3: Ready for Acknowledgement (no acknowledged_date)
  if (!acknowledgedDate) {
    return {
      state: 'READY_FOR_ACK',
      reason: 'All pre-ack validations complete, awaiting acknowledgement',
      nextAction: 'Coordinator must acknowledge',
      canProgress: true,
    };
  }

  // RULE 4: Documentation phase (acknowledged but documents incomplete)
  if (acknowledgedDate && !documentsComplete) {
    return {
      state: 'DOCUMENTATION',
      reason: `Documents: ${completedDocs.length}/${requiredDocs.length} complete`,
      nextAction: 'Upload required documents',
      canProgress: false,
    };
  }

  // RULE 5: Submission Ready (documents complete but not submitted)
  if (documentsComplete && !submittedDate) {
    return {
      state: 'SUBMISSION_READY',
      reason: 'All documents complete, ready for submission',
      nextAction: 'Submit PPAP package',
      canProgress: true,
    };
  }

  // RULE 6: Submitted (submitted but no final decision)
  if (submittedDate && !isApproved && !isRejected) {
    return {
      state: 'SUBMITTED',
      reason: 'Submitted, awaiting review decision',
      nextAction: 'Await customer approval',
      canProgress: false,
    };
  }

  // RULE 7: Approved
  if (isApproved) {
    return {
      state: 'APPROVED',
      reason: 'PPAP approved by customer',
      nextAction: 'Process complete',
      canProgress: false,
    };
  }

  // RULE 8: Rejected
  if (isRejected) {
    return {
      state: 'REJECTED',
      reason: 'PPAP rejected, requires rework',
      nextAction: 'Address rejection comments and resubmit',
      canProgress: false,
    };
  }

  // Fallback (should never reach here with proper data)
  console.warn('V3.4: Derived state fallback triggered', {
    ppapId: ppap.id,
    acknowledgedDate,
    submittedDate,
    isApproved,
    isRejected,
    preAckCompleteCount,
    documentsComplete,
  });

  return {
    state: 'INTAKE',
    reason: 'State could not be determined, defaulting to INTAKE',
    nextAction: 'Review PPAP data',
    canProgress: false,
  };
}

/**
 * Map derived state to workflow phase for UI compatibility
 */
export function mapDerivedStateToPhase(state: DerivedPPAPState): string {
  const mapping: Record<DerivedPPAPState, string> = {
    INTAKE: 'INITIATION',
    PRE_ACK_VALIDATION: 'INITIATION',
    READY_FOR_ACK: 'INITIATION',
    DOCUMENTATION: 'DOCUMENTATION',
    SUBMISSION_READY: 'SAMPLE',
    SUBMITTED: 'REVIEW',
    APPROVED: 'COMPLETE',
    REJECTED: 'SAMPLE',
  };

  return mapping[state] || 'INITIATION';
}

/**
 * Get human-readable state label
 */
export function getStateLabel(state: DerivedPPAPState): string {
  const labels: Record<DerivedPPAPState, string> = {
    INTAKE: 'Intake',
    PRE_ACK_VALIDATION: 'Pre-Ack Validation',
    READY_FOR_ACK: 'Ready for Acknowledgement',
    DOCUMENTATION: 'Documentation',
    SUBMISSION_READY: 'Submission Ready',
    SUBMITTED: 'Submitted',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
  };

  return labels[state] || 'Unknown';
}

/**
 * Check if state transition is valid (for validation purposes)
 */
export function isValidStateTransition(
  from: DerivedPPAPState,
  to: DerivedPPAPState
): boolean {
  const validTransitions: Record<DerivedPPAPState, DerivedPPAPState[]> = {
    INTAKE: ['PRE_ACK_VALIDATION'],
    PRE_ACK_VALIDATION: ['READY_FOR_ACK'],
    READY_FOR_ACK: ['DOCUMENTATION'],
    DOCUMENTATION: ['SUBMISSION_READY'],
    SUBMISSION_READY: ['SUBMITTED'],
    SUBMITTED: ['APPROVED', 'REJECTED'],
    APPROVED: [],
    REJECTED: ['DOCUMENTATION'], // Can rework and resubmit
  };

  return validTransitions[from]?.includes(to) ?? false;
}
