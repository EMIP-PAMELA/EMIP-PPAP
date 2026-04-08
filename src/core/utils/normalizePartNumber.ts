/**
 * Part Number Normalization Utility
 * 
 * V6.0.9: Dual-Format Part Number Normalization
 * 
 * Converts legacy format (45-42522-214) to canonical format (NH45-42522-214)
 * Ensures ONLY canonical format is stored in database
 * 
 * Supported Formats:
 * - Canonical: NH45-42522-214 (already correct)
 * - Legacy: 45-42522-214 → NH45-42522-214
 * 
 * Invalid formats return null and are rejected by downstream validation
 */

/**
 * Normalize part number to canonical format
 * 
 * @param input Raw part number from parser or metadata
 * @returns Normalized canonical part number or null if invalid
 */
export function normalizePartNumber(input: string | null | undefined): string | null {
  if (!input) return null;

  const trimmed = input.trim().toUpperCase();

  // Canonical format (already correct): NH##-#####-## or NH##-######-###
  const canonicalMatch = trimmed.match(/^NH\d{2}-\d{5,6}-\d{2,3}$/);
  if (canonicalMatch) {
    return canonicalMatch[0];
  }

  // Legacy format: ##-#####-## or ##-######-### → NH##-#####-## or NH##-######-###
  const legacyMatch = trimmed.match(/^(\d{2})-(\d{5,6})-(\d{2,3})$/);
  if (legacyMatch) {
    const normalized = `NH${legacyMatch[1]}-${legacyMatch[2]}-${legacyMatch[3]}`;
    console.log('🔄 V6.0.9 LEGACY FORMAT NORMALIZED', {
      input: trimmed,
      output: normalized,
      format: 'legacy_to_canonical'
    });
    return normalized;
  }

  // Invalid format - return null (will be rejected by validation)
  console.warn('⚠️ V6.0.9 INVALID PART NUMBER FORMAT', {
    input: trimmed,
    reason: 'does_not_match_canonical_or_legacy_pattern'
  });
  return null;
}
