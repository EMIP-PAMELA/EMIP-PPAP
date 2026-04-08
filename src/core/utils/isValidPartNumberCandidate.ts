/**
 * Part Number Validity Guard
 * 
 * V6.0.10: Part Number Source Hardening
 * 
 * Prevents invalid parser fragments from poisoning ingestion pipeline
 * Filters out partial tokens like "45" BEFORE normalization
 * 
 * Validation Rules:
 * - Minimum length: 8 characters
 * - Must contain at least 2 dashes (proper SKU format)
 * 
 * Examples:
 * - "NH45-42522-214" → true ✅
 * - "45-42522-214" → true ✅
 * - "45" → false ❌ (too short, no dashes)
 * - "NH45" → false ❌ (too short, no dashes)
 * - "45-42522" → false ❌ (only 1 dash)
 */

/**
 * Check if a value is a valid part number candidate
 * 
 * @param value Raw part number value from any source
 * @returns true if value meets minimum requirements for part number format
 */
export function isValidPartNumberCandidate(value: string | null | undefined): boolean {
  if (!value) return false;

  const trimmed = value.trim();

  // Reject short fragments like "45", "NH45", etc.
  if (trimmed.length < 8) {
    console.warn('⚠️ V6.0.10 INVALID CANDIDATE: Too short', {
      value: trimmed,
      length: trimmed.length,
      minimumRequired: 8
    });
    return false;
  }

  // Must contain at least 2 dashes (proper SKU format: XX-XXXXX-XX)
  const dashCount = (trimmed.match(/-/g) || []).length;
  if (dashCount < 2) {
    console.warn('⚠️ V6.0.10 INVALID CANDIDATE: Insufficient dashes', {
      value: trimmed,
      dashCount,
      minimumRequired: 2
    });
    return false;
  }

  return true;
}
