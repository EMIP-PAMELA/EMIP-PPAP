/**
 * Wizard Validation Hook
 * Phase W2E - Live Validation & Autofill Feedback Loop
 *
 * React hook for integrating wizard validation into DocumentEditor.
 * Provides real-time validation feedback for user edits.
 */

import { useCallback, useRef } from 'react';
import { validateFieldChange, ValidationResult, FieldContext } from './wizardValidationEngine';

export interface ValidationState {
  warnings: Map<string, ValidationResult>;
}

export interface WizardValidationHook {
  validateField: (context: FieldContext) => ValidationResult;
  getFieldWarning: (fieldPath: string) => ValidationResult | undefined;
  clearValidation: () => void;
}

/**
 * Hook for wizard validation in DocumentEditor
 * 
 * Usage:
 * const validation = useWizardValidation();
 * 
 * // On field change:
 * const result = validation.validateField({
 *   fieldName: 'severity',
 *   userValue: 5,
 *   originalAutofill: 7,
 *   operationDescription: 'Crimp terminal',
 *   operationCategory: 'crimping'
 * });
 */
export function useWizardValidation(): WizardValidationHook {
  const warningsRef = useRef<Map<string, ValidationResult>>(new Map());

  const validateField = useCallback((context: FieldContext): ValidationResult => {
    const result = validateFieldChange(context);

    // Log validation result
    console.log('[W2E VALIDATION] Field changed:', context.fieldName);
    console.log('[W2E VALIDATION] User value:', context.userValue);
    console.log('[W2E VALIDATION] Original autofill:', context.originalAutofill);

    if (result.warning) {
      console.log('[W2E VALIDATION] Warning:', result.warning);
      console.log('[W2E VALIDATION] Severity:', result.severity);
      warningsRef.current.set(context.fieldName, result);
    } else if (result.isValid) {
      console.log('[W2E VALIDATION] Valid - no warnings');
      warningsRef.current.delete(context.fieldName);
    } else {
      console.log('[W2E VALIDATION] Invalid:', result.warning);
      warningsRef.current.set(context.fieldName, result);
    }

    return result;
  }, []);

  const getFieldWarning = useCallback((fieldPath: string): ValidationResult | undefined => {
    return warningsRef.current.get(fieldPath);
  }, []);

  const clearValidation = useCallback(() => {
    warningsRef.current.clear();
    console.log('[W2E VALIDATION] Cleared all validation warnings');
  }, []);

  return {
    validateField,
    getFieldWarning,
    clearValidation
  };
}

/**
 * Helper function for standalone validation (non-React contexts)
 */
export function validateFieldStandalone(context: FieldContext): ValidationResult {
  const result = validateFieldChange(context);

  console.log('[W2E VALIDATION] Field changed:', context.fieldName);
  console.log('[W2E VALIDATION] User value:', context.userValue);
  console.log('[W2E VALIDATION] Original autofill:', context.originalAutofill);

  if (result.warning) {
    console.log('[W2E VALIDATION] Warning:', result.warning);
    console.log('[W2E VALIDATION] Severity:', result.severity);
  } else if (result.isValid) {
    console.log('[W2E VALIDATION] Valid - no warnings');
  } else {
    console.log('[W2E VALIDATION] Invalid:', result.warning);
  }

  return result;
}
