/**
 * Header Matcher
 * V3.2F.1 — Injection Engine Hardening
 *
 * Responsibility:
 *   Normalize cell text and match against known header synonym sets,
 *   allowing dynamic header detection to work across template variations
 *   that use different column heading labels.
 *
 * Governance rules (V3.2E / V3.2G-1):
 *   - Normalization is lowercase + trim + collapse internal whitespace.
 *   - Synonyms describe known label variations. Do NOT add synonyms that
 *     are so broad they could match non-header cells.
 *   - This module has no knowledge of Excel structure. It operates only on
 *     plain strings extracted by the caller.
 */

// ============================================================================
// Normalization
// ============================================================================

/**
 * Normalize a string for comparison: lowercase, trim, collapse whitespace.
 */
export function normalize(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

// ============================================================================
// Synonym Map
// ============================================================================

/**
 * Known header label synonyms per PFMEA schema field key.
 * All entries MUST be in normalized form (lowercase, trimmed).
 *
 * When a new customer template uses a different column heading, add the
 * normalized alias here. Each addition requires a BUILD_LEDGER entry.
 */
export const HEADER_SYNONYMS: Record<string, string[]> = {
  failure_mode: [
    'failure mode',
    'failure mode description',
    'potential failure mode',
    'failure',
  ],
  effect: [
    'effect',
    'effect of failure',
    'potential effect',
    'effects',
  ],
  severity: [
    'severity',
    'sev',
    'severity (s)',
    's',
  ],
  process_step: [
    'process step',
    'process function',
    'process',
    'step',
    'operation',
  ],
  cause: [
    'cause',
    'cause of failure',
    'potential cause',
    'cause / mechanism',
  ],
  occurrence: [
    'occurrence',
    'occ',
    'occurrence (o)',
    'o',
  ],
  detection: [
    'detection',
    'det',
    'detection (d)',
    'd',
  ],
  rpn: [
    'rpn',
    'risk priority number',
    'risk priority',
  ],
};

// ============================================================================
// Matching
// ============================================================================

/**
 * Returns true if the normalized cell text matches any synonym for
 * the given schema field key.
 *
 * @param normalizedCellText - Cell text that has already been normalized.
 * @param fieldKey           - Schema field key (e.g. 'failure_mode').
 */
export function matchesHeaderSynonym(
  normalizedCellText: string,
  fieldKey: string
): boolean {
  const synonyms = HEADER_SYNONYMS[fieldKey] ?? [];
  return synonyms.some(synonym => normalizedCellText.includes(synonym));
}

/**
 * Count how many of the target field keys have at least one match
 * among the provided cell texts.
 *
 * Used by sheet handlers to determine whether a row qualifies as a header.
 *
 * @param cellTexts  - Raw cell text values from a worksheet row.
 * @param fieldKeys  - Schema field keys to test for presence.
 * @returns Count of distinct field keys with at least one matching cell.
 */
export function countHeaderFieldMatches(
  cellTexts: string[],
  fieldKeys: string[]
): number {
  const normalizedCells = cellTexts.map(normalize);
  return fieldKeys.filter(key =>
    normalizedCells.some(cellText => matchesHeaderSynonym(cellText, key))
  ).length;
}
