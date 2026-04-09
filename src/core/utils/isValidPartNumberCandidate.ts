/**
 * Part Number Validity Guard
 * 
 * V6.9.5: Strict Pattern Enforcement
 * 
 * Prevents invalid parser fragments from poisoning ingestion pipeline
 * ONLY accepts full part number format with strict regex validation
 * 
 * Validation Rules:
 * - MUST match pattern: NH##-######-## or ##-######-##
 * - NO partial matches allowed
 * - NO substring extraction allowed
 * 
 * Examples:
 * - "NH45-425227-214" → true ✅
 * - "45-425227-214" → true ✅
 * - "45" → false ❌ (doesn't match pattern)
 * - "NH45" → false ❌ (doesn't match pattern)
 * - "45-42522" → false ❌ (doesn't match pattern)
 */

/**
 * V6.9.5: Strict part number pattern (canonical or legacy format)
 * ONLY these formats are valid:
 * - NH##-######-## (canonical)
 * - ##-######-## (legacy, normalized to canonical)
 */
const STRICT_PART_NUMBER_PATTERN = /^(NH)?\d{2}-\d{5,6}-\d{2,3}$/i;

/**
 * Check if a value is a valid part number candidate
 * 
 * V6.9.5: STRICT PATTERN ENFORCEMENT
 * Only accepts full part number format - NO partial matches
 * 
 * @param value Raw part number value from any source
 * @returns true ONLY if value matches strict part number pattern
 */
export function isValidPartNumberCandidate(value: string | null | undefined): boolean {
  if (!value) return false;

  const trimmed = value.trim().toUpperCase();

  // V6.9.5: STRICT REGEX TEST - only full part number format allowed
  if (!STRICT_PART_NUMBER_PATTERN.test(trimmed)) {
    console.warn('⚠️ V6.9.5 INVALID CANDIDATE: Does not match strict pattern', {
      value: trimmed,
      requiredPattern: 'NH##-######-## or ##-######-##',
      reason: 'strict_pattern_enforcement'
    });
    return false;
  }

  return true;
}
