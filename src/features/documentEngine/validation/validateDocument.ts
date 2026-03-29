/**
 * Document Validation Engine - Document Engine
 * Phase 34: Mapping Validation Layer
 *
 * Template-driven validation for document drafts.
 * Validates scalar fields and table rows based on field definitions.
 *
 * Validation rules:
 * - Required fields must be non-null and non-empty
 * - Numeric fields must respect min/max constraints
 * - Table rows validated per column using rowFields definitions
 * - Derived fields (with derivedProduct) are skipped
 * - Phase 34: Failed mappings on required fields trigger validation errors
 *
 * Architecture layer: Validation
 */

import { DocumentDraft, TemplateDefinition, FieldDefinition } from '../templates/types';
import { ValidationResult, ValidationError } from './types';
import { MappingMetadata } from '../templates/templateMappingService';

/**
 * Validate a document draft against its template definition.
 * Phase 34: Optionally checks mapping metadata for required field failures.
 * Returns structured validation result with all errors.
 */
export function validateDocument(
  draft: DocumentDraft,
  template: TemplateDefinition,
  mappingMeta?: MappingMetadata
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
      validateScalarField(fieldDef, value, errors, mappingMeta);
    } else {
      // Validate table fields (array of rows)
      validateTableField(fieldDef, value, errors, mappingMeta);
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate a scalar field (text, number, select)
 * Phase 34: Checks mapping metadata for failed mappings on required fields
 */
function validateScalarField(
  fieldDef: FieldDefinition,
  value: any,
  errors: ValidationError[],
  mappingMeta?: MappingMetadata
): void {
  // Phase 34: Check for mapping failures on required fields
  if (fieldDef.required && mappingMeta && mappingMeta[fieldDef.key]) {
    const meta = mappingMeta[fieldDef.key];
    
    // If mapping failed AND field is empty, report mapping failure
    if (!meta.success && (value == null || value === '')) {
      errors.push({
        field: fieldDef.key,
        message: `${fieldDef.label} mapping failed: ${meta.error || 'source field not found'}`
      });
      return; // Skip further validation - mapping failure is the root issue
    }
  }

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
 * Phase 34: Checks mapping metadata for table mapping failures
 */
function validateTableField(
  fieldDef: FieldDefinition,
  value: any,
  errors: ValidationError[],
  mappingMeta?: MappingMetadata
): void {
  // Phase 34: Check for table mapping failures
  if (fieldDef.required && mappingMeta && mappingMeta[fieldDef.key]) {
    const meta = mappingMeta[fieldDef.key];
    
    // If table mapping failed completely
    if (!meta.success && meta.isTableMapping) {
      errors.push({
        field: fieldDef.key,
        message: `${fieldDef.label} table mapping failed: ${meta.error || 'source table not found'}`
      });
      // Don't return - still validate any data that exists
    }
  }

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
