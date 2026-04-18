/**
 * T23.6.35 — Canonical Part Number Normalization
 *
 * Produces a deterministic, format-agnostic key suitable for cross-source
 * comparison between BOM and drawing identifiers.
 *
 * Rules applied in order:
 *   1. Uppercase
 *   2. Strip whitespace
 *   3. Strip leading "NH" prefix (customer-level prefix absent on raw drawings)
 *   4. Remove all non-alphanumeric characters (hyphens, dots, spaces)
 *
 * Examples:
 *   "NH45-110858-10"  → "4511085810"
 *   "45-110858-10"    → "4511085810"
 *   "45110858-10"     → "4511085810"
 *   "nh 45 110858 10" → "4511085810"
 *   null / undefined  → null
 */
export function canonicalizePartNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const result = raw
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/^NH/, '')
    .replace(/[^A-Z0-9]/g, '');
  return result.length > 0 ? result : null;
}
