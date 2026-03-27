/**
 * Document Validation Engine - Document Engine
 *
 * Template-driven validation for document drafts.
 * Validates scalar fields and table rows based on field definitions.
 *
 * Validation rules:
 * - Required fields must be non-null and non-empty
 * - Numeric fields must respect min/max constraints
 * - Table rows validated per column using rowFields definitions
 * - Derived fields (with derivedProduct) are skipped
 *
 * Architecture layer: Validation
 */

import { DocumentDraft, TemplateDefinition, FieldDefinition } from '../templates/types';
import { ValidationResult, ValidationError } from './types';

/**
 * Validate a document draft against its template definition.
 * Returns structured validation result with all errors.
 */
export function validateDocument(
  draft: DocumentDraft,
  template: TemplateDefinition
): ValidationResult {
  const errors: ValidationError[] = [];

  for (const fieldDef of template.fieldDefinitions) {
    const value = draft.fields[fieldDef.key];

    // Skip derived fields (e.g., RPN computed in UI)
    if (fieldDef.derivedProduct) {
      continue;
    }

    // Validate scalar fields
    if (fieldDef.type !== 'table') {
      validateScalarField(fieldDef, value, errors);
    } else {
      // Validate table fields (array of rows)
      validateTableField(fieldDef, value, errors);
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate a scalar field (text, number, select)
 */
function validateScalarField(
  fieldDef: FieldDefinition,
  value: any,
  errors: ValidationError[]
): void {
  // Required field validation
  if (fieldDef.required) {
    if (value == null || value === '') {
      errors.push({
        field: fieldDef.key,
        message: `${fieldDef.label} is required`
      });
      return; // Skip further validation if missing
    }
  }

  // Numeric validation
  if (fieldDef.type === 'number' && value != null && value !== '') {
    const numValue = Number(value);

    if (isNaN(numValue)) {
      errors.push({
        field: fieldDef.key,
        message: `${fieldDef.label} must be a number`
      });
      return;
    }

    if (fieldDef.validation?.min != null && numValue < fieldDef.validation.min) {
      errors.push({
        field: fieldDef.key,
        message: `${fieldDef.label} must be at least ${fieldDef.validation.min}`
      });
    }

    if (fieldDef.validation?.max != null && numValue > fieldDef.validation.max) {
      errors.push({
        field: fieldDef.key,
        message: `${fieldDef.label} must be at most ${fieldDef.validation.max}`
      });
    }
  }
}

/**
 * Validate a table field (array of rows with rowFields schema)
 */
function validateTableField(
  fieldDef: FieldDefinition,
  value: any,
  errors: ValidationError[]
): void {
  // Table must be an array
  if (!Array.isArray(value)) {
    if (fieldDef.required) {
      errors.push({
        field: fieldDef.key,
        message: `${fieldDef.label} is required`
      });
    }
    return;
  }

  // If no rowFields defined, skip row-level validation
  if (!fieldDef.rowFields) {
    return;
  }

  // Validate each row
  value.forEach((row: Record<string, any>, rowIndex: number) => {
    for (const colDef of fieldDef.rowFields!) {
      const cellValue = row[colDef.key];

      // Skip derived fields
      if (colDef.derivedProduct) {
        continue;
      }

      // Required field validation
      if (colDef.required) {
        if (cellValue == null || cellValue === '') {
          errors.push({
            field: colDef.key,
            message: `${colDef.label} is required`,
            rowIndex
          });
          continue; // Skip further validation for this cell
        }
      }

      // Numeric validation
      if (colDef.type === 'number' && cellValue != null && cellValue !== '') {
        const numValue = Number(cellValue);

        if (isNaN(numValue)) {
          errors.push({
            field: colDef.key,
            message: `${colDef.label} must be a number`,
            rowIndex
          });
          continue;
        }

        if (colDef.validation?.min != null && numValue < colDef.validation.min) {
          errors.push({
            field: colDef.key,
            message: `${colDef.label} must be at least ${colDef.validation.min}`,
            rowIndex
          });
        }

        if (colDef.validation?.max != null && numValue > colDef.validation.max) {
          errors.push({
            field: colDef.key,
            message: `${colDef.label} must be at most ${colDef.validation.max}`,
            rowIndex
          });
        }
      }
    }
  });
}
