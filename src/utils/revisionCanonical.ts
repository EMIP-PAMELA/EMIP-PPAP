/**
 * Canonical Revision Contract — Phase 3H.25
 *
 * `canonical_revision` is the ONLY approved revision value for UI rendering and
 * workflow logic (document presence, pipeline, revision validation comparisons).
 *
 * `revision` (raw) and `normalized_revision` (parsed signal) are DIAGNOSTIC FIELDS ONLY.
 * They must never be used directly by UI components for display or by validators for
 * comparison without going through selectCanonicalRevision().
 *
 * Priority order for canonical selection:
 *   1. normalized_revision  — output of revisionParser; always a clean token (e.g. '00', 'A') or null
 *   2. rawRevision          — original manual/extracted string, accepted only when not a sentinel
 *   3. null                 — no authoritative revision available; UI must render '—'
 */

/** Strings that must NEVER be stored or displayed as a canonical revision value. */
export const CANONICAL_REVISION_SENTINELS = new Set([
  'UNSPECIFIED',
  'UNKNOWN',
  'N/A',
  'NA',
  'TBD',
  'NONE',
  'MISSING',
]);

/**
 * Returns true when `value` is null, empty, or a known sentinel placeholder.
 */
export function isRevisionSentinel(value: string | null | undefined): boolean {
  if (!value || value.trim().length === 0) return true;
  return CANONICAL_REVISION_SENTINELS.has(value.trim().toUpperCase());
}

/**
 * Selects the single authoritative revision for a document.
 *
 * NEVER returns a sentinel string. Returns null when no valid revision exists.
 *
 * Use this function:
 *   - at ingestion time to determine what to store as normalized_revision
 *   - at API response time to populate the canonical_revision response field
 *   - in revision validators/evaluators when a single truth is required
 */
export function selectCanonicalRevision(input: {
  normalizedRevision?: string | null | undefined;
  rawRevision?: string | null | undefined;
}): string | null {
  const norm = input.normalizedRevision?.trim() ?? null;
  if (norm && !isRevisionSentinel(norm)) {
    return norm;
  }
  const raw = input.rawRevision?.trim() ?? null;
  if (raw && !isRevisionSentinel(raw)) {
    return raw;
  }
  return null;
}
