/**
 * Wizard Validation Engine
 * Phase W2E - Live Validation & Autofill Feedback Loop
 *
 * Runtime validation for user-edited fields against autofill suggestions.
 * Provides contextual warnings and guidance without blocking user changes.
 *
 * NO AI. DETERMINISTIC RULES. NON-BLOCKING VALIDATION.
 */

export type ValidationSeverity = 'low' | 'medium' | 'high';

export interface ValidationResult {
  isValid: boolean;
  warning?: string;
  severity?: ValidationSeverity;
}

export interface FieldContext {
  fieldName: string;
  userValue: any;
  originalAutofill?: any;
  operationDescription?: string;
  operationCategory?: string;
}

/**
 * Validate a field change against autofill rules and best practices
 */
export function validateFieldChange(context: FieldContext): ValidationResult {
  const { fieldName, userValue, originalAutofill, operationDescription, operationCategory } = context;

  // Empty value warnings
  if (userValue === null || userValue === undefined || userValue === '') {
    return validateEmptyField(fieldName, operationCategory);
  }

  // Field-specific validation
  switch (fieldName) {
    case 'severity':
      return validateSeverity(userValue, originalAutofill, operationDescription, operationCategory);
    
    case 'occurrence':
    case 'detection':
      return validateRiskRating(fieldName, userValue, originalAutofill);
    
    case 'method':
      return validateMethod(userValue, originalAutofill, operationCategory);
    
    case 'failureMode':
      return validateFailureMode(userValue, originalAutofill, operationCategory);
    
    case 'effect':
      return validateEffect(userValue, originalAutofill);
    
    default:
      return { isValid: true };
  }
}

/**
 * Validate empty/missing fields
 */
function validateEmptyField(fieldName: string, category?: string): ValidationResult {
  const criticalFields = ['severity', 'method', 'failureMode', 'effect'];
  
  if (criticalFields.includes(fieldName)) {
    return {
      isValid: false,
      warning: `${fieldName} should not be empty - this is a critical field for ${category || 'this operation'}`,
      severity: 'medium'
    };
  }
  
  return { isValid: true };
}

/**
 * Validate severity rating changes
 */
function validateSeverity(
  userValue: number,
  originalAutofill: number | undefined,
  operationDescription?: string,
  operationCategory?: string
): ValidationResult {
  const normalized = operationDescription?.toLowerCase() || '';
  
  // Crimp operations - high severity expected
  if (normalized.includes('crimp') && userValue < 6) {
    return {
      isValid: true, // User can override
      warning: 'Crimp operations typically require severity ≥ 6 due to electrical failure risk. Recommended: 7',
      severity: 'high'
    };
  }
  
  // Solder operations - high severity expected
  if (normalized.includes('solder') && userValue < 7) {
    return {
      isValid: true,
      warning: 'Solder operations typically require severity ≥ 7 due to safety/reliability risk. Recommended: 8',
      severity: 'high'
    };
  }
  
  // Test operations - critical
  if (normalized.includes('test') && userValue < 8) {
    return {
      isValid: true,
      warning: 'Test failures typically indicate complete loss of function. Recommended severity: 9',
      severity: 'high'
    };
  }
  
  // Seal operations - environmental protection
  if (normalized.includes('seal') && userValue < 6) {
    return {
      isValid: true,
      warning: 'Seal failures can lead to moisture ingress and corrosion. Recommended severity: 7',
      severity: 'medium'
    };
  }
  
  // Assembly/installation operations
  if ((normalized.includes('assemble') || normalized.includes('assembly')) && userValue < 6) {
    return {
      isValid: true,
      warning: 'Assembly failures can cause product malfunction. Recommended severity: 7',
      severity: 'medium'
    };
  }
  
  // General deviation warning
  if (originalAutofill && Math.abs(userValue - originalAutofill) >= 3) {
    return {
      isValid: true,
      warning: `Severity changed from recommended value of ${originalAutofill}. Ensure justification is documented.`,
      severity: 'low'
    };
  }
  
  // Valid range check
  if (userValue < 1 || userValue > 10) {
    return {
      isValid: false,
      warning: 'Severity must be between 1 and 10 per FMEA standards',
      severity: 'high'
    };
  }
  
  return { isValid: true };
}

/**
 * Validate occurrence/detection ratings
 */
function validateRiskRating(
  fieldName: string,
  userValue: number,
  originalAutofill: number | undefined
): ValidationResult {
  // Valid range check
  if (userValue < 1 || userValue > 10) {
    return {
      isValid: false,
      warning: `${fieldName} must be between 1 and 10 per FMEA standards`,
      severity: 'high'
    };
  }
  
  // Large deviation warning
  if (originalAutofill && Math.abs(userValue - originalAutofill) >= 4) {
    return {
      isValid: true,
      warning: `${fieldName} changed significantly from recommended value of ${originalAutofill}. Consider reviewing.`,
      severity: 'low'
    };
  }
  
  return { isValid: true };
}

/**
 * Validate method field
 */
function validateMethod(
  userValue: string,
  originalAutofill: string | undefined,
  operationCategory?: string
): ValidationResult {
  const normalized = userValue.toLowerCase();
  
  // Critical operations should have specific methods
  if (operationCategory === 'crimping' && !normalized.includes('crimp') && !normalized.includes('height')) {
    return {
      isValid: true,
      warning: 'Crimp operations typically require crimp height measurement. Recommended: "Crimp height measurement"',
      severity: 'medium'
    };
  }
  
  if (operationCategory === 'soldering' && !normalized.includes('pull') && !normalized.includes('visual')) {
    return {
      isValid: true,
      warning: 'Solder operations typically require visual inspection + pull test for validation',
      severity: 'medium'
    };
  }
  
  if (operationCategory === 'testing' && !normalized.includes('test') && !normalized.includes('functional')) {
    return {
      isValid: true,
      warning: 'Test operations should specify functional test method',
      severity: 'low'
    };
  }
  
  // Generic validation checks
  if (normalized === 'n/a' || normalized === 'na' || normalized === 'none') {
    return {
      isValid: true,
      warning: 'Method should specify an actual inspection/measurement technique',
      severity: 'low'
    };
  }
  
  return { isValid: true };
}

/**
 * Validate failure mode field
 */
function validateFailureMode(
  userValue: string,
  originalAutofill: string | undefined,
  operationCategory?: string
): ValidationResult {
  const normalized = userValue.toLowerCase();
  
  // Check for generic/vague failure modes
  const vaguePhrases = ['defect', 'error', 'problem', 'issue', 'failure'];
  const isVague = vaguePhrases.some(phrase => normalized === phrase);
  
  if (isVague) {
    return {
      isValid: true,
      warning: 'Failure mode should be specific (e.g., "Improper crimp" not just "Defect")',
      severity: 'low'
    };
  }
  
  // Category-specific checks
  if (operationCategory === 'crimping' && !normalized.includes('crimp')) {
    return {
      isValid: true,
      warning: 'Crimp operations typically fail due to improper crimp compression. Consider using "Improper crimp"',
      severity: 'low'
    };
  }
  
  if (operationCategory === 'soldering' && !normalized.includes('solder')) {
    return {
      isValid: true,
      warning: 'Solder operations typically fail due to cold solder joints. Consider "Cold solder joint"',
      severity: 'low'
    };
  }
  
  return { isValid: true };
}

/**
 * Validate effect field
 */
function validateEffect(
  userValue: string,
  originalAutofill: string | undefined
): ValidationResult {
  const normalized = userValue.toLowerCase();
  
  // Check for generic/vague effects
  const vaguePhrases = ['bad', 'broken', 'wrong', 'problem'];
  const isVague = vaguePhrases.some(phrase => normalized === phrase);
  
  if (isVague) {
    return {
      isValid: true,
      warning: 'Effect should describe customer impact (e.g., "Electrical failure" not "Bad")',
      severity: 'low'
    };
  }
  
  // Effect should describe customer/system impact
  const hasImpact = normalized.includes('failure') || 
                    normalized.includes('degradation') ||
                    normalized.includes('loss') ||
                    normalized.includes('damage') ||
                    normalized.includes('malfunction');
  
  if (!hasImpact) {
    return {
      isValid: true,
      warning: 'Effect should clearly state customer or system impact',
      severity: 'low'
    };
  }
  
  return { isValid: true };
}

/**
 * Get validation summary for a row of data
 */
export function validateRow(
  rowData: Record<string, any>,
  autofillData: Record<string, any>,
  operationDescription?: string,
  operationCategory?: string
): ValidationResult[] {
  const results: ValidationResult[] = [];
  
  for (const fieldName of Object.keys(rowData)) {
    const result = validateFieldChange({
      fieldName,
      userValue: rowData[fieldName],
      originalAutofill: autofillData[fieldName],
      operationDescription,
      operationCategory
    });
    
    if (!result.isValid || result.warning) {
      results.push({ ...result, warning: `${fieldName}: ${result.warning}` });
    }
  }
  
  return results;
}
