/**
 * Visual Master Parser Output Validator
 * Phase W1.4 - Parser Stabilization Layer
 * 
 * Purpose: Validate parser output to surface issues instead of silent failures.
 * This does NOT block the wizard - it only provides visible diagnostics.
 * 
 * Future Phase: AI verification hook can evaluate parser output here.
 */

import { VisualMasterData } from './visualMasterParser';

export interface ParserValidationResult {
  isValid: boolean;
  warnings: string[];
  summary: {
    operationCount: number;
    componentCount: number;
    masterPartNumber: string;
    hasRawText: boolean;
    operationsWithComponents: number;
    operationsWithoutComponents: number;
    ocrWarnings: number;
  };
  // Future Phase: AI verification hook
  // confidence?: number;
  // issues?: string[];
  // source?: 'future_ai_verifier' | 'rule_based';
}

/**
 * Type placeholder for future AI verification result
 * Phase W1.4: Definition only, no implementation
 */
export type ParserVerificationResult = {
  confidence?: number;
  issues?: string[];
  source?: 'future_ai_verifier' | 'rule_based';
};

/**
 * Validate parsed Visual Master data
 * 
 * Checks:
 * - Operations count
 * - Components count
 * - Master part number detected
 * - Operations have components
 * - Raw text exists
 * - Page logs indicate OCR/occlusion risk
 * 
 * @param parsedData Parsed Visual Master data from parseVisualMaster()
 * @returns Validation result with warnings and summary
 */
export function validateParsedVisualMaster(
  parsedData: VisualMasterData
): ParserValidationResult {
  const warnings: string[] = [];
  
  // Check 1: Operations count
  if (parsedData.operationCount === 0 || parsedData.operations.length === 0) {
    warnings.push('⚠️ No operations detected after parsing');
  }
  
  // Check 2: Components count
  if (parsedData.componentCount === 0 || parsedData.parts.length === 0) {
    warnings.push('⚠️ No components detected after parsing');
  }
  
  // Check 3: Master part number
  if (!parsedData.masterPartNumber || parsedData.masterPartNumber === 'UNKNOWN') {
    warnings.push('⚠️ Master part number not detected');
  }
  
  // Check 4: Operations without components
  const operationsWithComponents = parsedData.operations.filter(
    op => op.components && op.components.length > 0
  ).length;
  const operationsWithoutComponents = parsedData.operations.length - operationsWithComponents;
  
  if (parsedData.operations.length > 0 && operationsWithComponents === 0) {
    warnings.push('⚠️ All operations have zero components');
  } else if (operationsWithoutComponents > 0) {
    warnings.push(`⚠️ ${operationsWithoutComponents} operation(s) have no components`);
  }
  
  // Check 5: Raw text exists
  if (!parsedData.rawText || parsedData.rawText.trim().length === 0) {
    warnings.push('⚠️ No raw text found in parsed data');
  }
  
  // Check 6: Page logs indicate OCR/occlusion issues
  let ocrWarnings = 0;
  if (parsedData.pageLogs && parsedData.pageLogs.length > 0) {
    for (const pageLog of parsedData.pageLogs) {
      if (pageLog.warning) {
        warnings.push(`⚠️ ${pageLog.warning}`);
        ocrWarnings++;
      }
    }
  }
  
  // Determine overall validity
  // Valid if we have at least operations OR components
  const isValid = parsedData.operationCount > 0 || parsedData.componentCount > 0;
  
  return {
    isValid,
    warnings,
    summary: {
      operationCount: parsedData.operationCount,
      componentCount: parsedData.componentCount,
      masterPartNumber: parsedData.masterPartNumber,
      hasRawText: !!parsedData.rawText && parsedData.rawText.trim().length > 0,
      operationsWithComponents,
      operationsWithoutComponents,
      ocrWarnings
    }
  };
}

/**
 * Check if parsed data is critically empty (should show hard warning)
 * 
 * @param parsedData Parsed Visual Master data
 * @returns True if parsing resulted in effectively empty structure
 */
export function isCriticallyEmpty(parsedData: VisualMasterData): boolean {
  return (
    parsedData.operationCount === 0 &&
    parsedData.componentCount === 0
  );
}

/**
 * Get human-readable validation status message
 * 
 * @param validation Validation result
 * @returns Status message for UI display
 */
export function getValidationStatusMessage(validation: ParserValidationResult): string {
  if (validation.isValid && validation.warnings.length === 0) {
    return `✅ Parsing successful: ${validation.summary.operationCount} operations, ${validation.summary.componentCount} components`;
  }
  
  if (!validation.isValid) {
    return '❌ Parsing failed: No operations or components detected';
  }
  
  return `⚠️ Parsing completed with ${validation.warnings.length} warning(s)`;
}
