/**
 * Validation Types - Document Engine
 *
 * Defines the structure for validation errors and results.
 * Used by the validation engine to report document draft validation status.
 *
 * Architecture layer: Validation
 */

export interface ValidationError {
  field: string;
  message: string;
  rowIndex?: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}
