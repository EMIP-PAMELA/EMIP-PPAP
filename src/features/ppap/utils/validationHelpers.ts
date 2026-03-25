import { Validation, ValidationStatus, RequirementLevel, ValidationCategory } from '../types/validation';
import { determineNextState } from './stateWorkflowMapping';

/**
 * Phase 3F: Auto state progression based on validation completion
 */
export function getAutoProgressedState(
  currentState: string,
  validations: Validation[]
): string {
  const preAckComplete = isPreAckReady(validations);
  const postAckComplete = isPostAckReady(validations);
  
  return determineNextState(currentState, preAckComplete, postAckComplete);
}

export function getValidationSummary(
  validations: Validation[],
  category: ValidationCategory
): string {
  const relevant = validations.filter(
    (v) => v.category === category && v.required
  );
  const completed = relevant.filter(
    (v) => v.status === 'complete' || v.status === 'approved'
  );

  return `${completed.length}/${relevant.length}`;
}

export function isPreAckReady(validations: Validation[]): boolean {
  const preAckRequired = validations.filter(
    (v) => v.category === 'pre-ack' && v.required
  );
  return preAckRequired.every((v) => v.status === 'complete');
}

export function isPostAckReady(validations: Validation[]): boolean {
  const postAckRequired = validations.filter(
    (v) => v.category === 'post-ack' && v.required
  );
  return postAckRequired.every((v) => v.status === 'approved');
}

export function getNextAction(
  validations: Validation[],
  phase: 'pre-ack' | 'post-ack'
): string {
  const relevantValidations = validations.filter(
    (v) => v.category === phase && v.required
  );

  const incompleteValidation = relevantValidations.find((v) => {
    if (phase === 'pre-ack') {
      return v.status !== 'complete';
    } else {
      return v.status !== 'approved';
    }
  });

  if (incompleteValidation) {
    if (incompleteValidation.status === 'complete' && incompleteValidation.requires_approval) {
      return 'Await Approval';
    }
    return `Complete ${incompleteValidation.name}`;
  }

  return phase === 'pre-ack' ? 'Ready for Acknowledgement' : 'Ready for Submission';
}

/**
 * Phase 3E.8 - Get badge style for requirement level
 */
export function getRequirementBadgeStyle(level: RequirementLevel): string {
  switch (level) {
    case 'REQUIRED':
      return 'bg-red-100 text-red-800 ring-1 ring-red-600';
    case 'CONDITIONAL':
      return 'bg-yellow-100 text-yellow-800 ring-1 ring-yellow-600';
    case 'OPTIONAL':
      return 'bg-gray-100 text-gray-600';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

/**
 * Phase 3E.8 - Check if submission is enabled (all REQUIRED documents complete)
 */
export function isSubmissionEnabled(validations: Validation[]): boolean {
  const requiredPostAck = validations.filter(
    (v) => v.category === 'post-ack' && v.requirement_level === 'REQUIRED'
  );
  return requiredPostAck.every((v) => v.status === 'approved');
}

/**
 * Phase 3E.8 - Get count of completed REQUIRED documents
 */
export function getRequiredDocumentsSummary(validations: Validation[]): string {
  const required = validations.filter(
    (v) => v.category === 'post-ack' && v.requirement_level === 'REQUIRED'
  );
  const completed = required.filter((v) => v.status === 'approved');
  return `${completed.length}/${required.length}`;
}
