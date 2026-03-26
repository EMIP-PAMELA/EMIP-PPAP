/**
 * Phase 3H.2 - Next Action Engine
 * 
 * Determines the operator's next action based on:
 * - PPAP status (single source of truth)
 * - Validation state
 * - Document state
 * 
 * NO workflow_phase dependency - uses ppap.status only
 */

import { PPAPStatus } from '@/src/types/database.types';
import { DBValidation } from './validationDatabase';

export type NextActionType = 'validation' | 'document' | 'submission' | 'review' | 'complete';

export interface NextAction {
  label: string;
  instruction: string;
  actionType: NextActionType;
  nextStep?: string;
}

interface DocumentItem {
  id: string;
  name: string;
  status: 'missing' | 'ready';
  requirement_level: 'REQUIRED' | 'CONDITIONAL';
}

/**
 * Phase 3H.2: Get next action for operator
 */
export function getNextAction(
  ppapStatus: PPAPStatus,
  validations: DBValidation[],
  documents: DocumentItem[]
): NextAction {
  console.log('🎯 NEXT ACTION CALCULATION', { ppapStatus, validations: validations.length, documents: documents.length });

  // Pre-Ack Phase: Focus on validations
  if (ppapStatus === 'NEW' || ppapStatus === 'PRE_ACK_ASSIGNED' || ppapStatus === 'PRE_ACK_IN_PROGRESS') {
    const preAckValidations = validations.filter(v => v.category === 'pre-ack');
    const activeValidation = preAckValidations.find(
      v => v.required && v.status !== 'complete' && v.status !== 'approved'
    );

    if (activeValidation) {
      const nextValidation = preAckValidations.find(
        v => v.required && 
        v.status !== 'complete' && 
        v.status !== 'approved' &&
        v.id !== activeValidation.id
      );

      return {
        label: activeValidation.name,
        instruction: `Complete ${activeValidation.name}`,
        actionType: 'validation',
        nextStep: nextValidation ? nextValidation.name : 'All validations complete'
      };
    }

    // All pre-ack validations complete
    return {
      label: 'Ready for Acknowledgement',
      instruction: 'All pre-ack validations complete. Ready to proceed.',
      actionType: 'validation',
      nextStep: 'Coordinator Acknowledgement'
    };
  }

  // Acknowledgement Phase
  if (ppapStatus === 'READY_TO_ACKNOWLEDGE') {
    return {
      label: 'Awaiting Acknowledgement',
      instruction: 'Coordinator must acknowledge to proceed to documentation phase',
      actionType: 'review',
      nextStep: 'Documentation Phase'
    };
  }

  // Post-Ack Phase: Focus on document sections (Phase 3H.3)
  if (ppapStatus === 'POST_ACK_IN_PROGRESS') {
    // Phase 3H.3: Section-based guidance
    const DOCUMENT_SECTIONS = [
      {
        id: 'core_engineering',
        title: 'Core Engineering Documents',
        documents: ['ballooned_drawing', 'design_record', 'dimensional_results']
      },
      {
        id: 'process_docs',
        title: 'Process Documentation',
        documents: ['dfmea', 'pfmea', 'control_plan', 'msa']
      },
      {
        id: 'supporting_docs',
        title: 'Supporting Documentation',
        documents: ['material_test_results', 'initial_process_studies', 'packaging', 'tooling']
      }
    ];

    // Find first incomplete section
    for (const section of DOCUMENT_SECTIONS) {
      const sectionDocs = documents.filter(d => section.documents.includes(d.id));
      const completedCount = sectionDocs.filter(d => d.status === 'ready').length;
      const totalCount = sectionDocs.length;

      if (completedCount < totalCount) {
        const remaining = totalCount - completedCount;
        return {
          label: `Complete: ${section.title}`,
          instruction: `Upload or create any required document in ${section.title}`,
          actionType: 'document',
          nextStep: `(${remaining} remaining)`
        };
      }
    }

    // All sections complete
    return {
      label: 'Ready for Submission',
      instruction: 'All required documents uploaded. Ready to generate submission package.',
      actionType: 'submission',
      nextStep: 'Generate Submission Package'
    };
  }

  // Submission Phase
  if (ppapStatus === 'AWAITING_SUBMISSION') {
    return {
      label: 'Generate Submission Package',
      instruction: 'Click Generate Package to create final submission',
      actionType: 'submission',
      nextStep: 'Submit to Customer'
    };
  }

  // Review Phase
  if (ppapStatus === 'SUBMITTED') {
    return {
      label: 'Awaiting Review Decision',
      instruction: 'Coordinator must approve or reject',
      actionType: 'review',
      nextStep: 'Final Approval'
    };
  }

  // Complete
  if (ppapStatus === 'APPROVED') {
    return {
      label: 'PPAP Approved',
      instruction: 'PPAP process complete',
      actionType: 'complete'
    };
  }

  // Closed/Rejected
  if (ppapStatus === 'CLOSED') {
    return {
      label: 'Fix Issues and Resubmit',
      instruction: 'Address rejection comments and resubmit',
      actionType: 'review'
    };
  }

  // Default fallback
  return {
    label: 'Continue Process',
    instruction: 'Follow workflow steps',
    actionType: 'review'
  };
}
