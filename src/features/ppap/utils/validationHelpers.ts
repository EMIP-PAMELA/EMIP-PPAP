import { Validation, ValidationCategory } from '../types/validation';

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
