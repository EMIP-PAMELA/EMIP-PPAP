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
