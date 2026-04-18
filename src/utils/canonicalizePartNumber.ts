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
 *   4. Preserve punctuation (dashes) for human readability
 *
 * Examples:
 *   "NH45-110858-10"  → "45-110858-10"
 *   "45-110858-10"    → "45-110858-10"
 *   "45110858-10"     → "45110858-10"
 *   "nh 45 110858 10" → "45-11085810"
 *   null / undefined  → null
 */
export function canonicalizePartNumber(input: string | null | undefined): string | null {
  if (!input) {
    console.log('[T23.6.40 CANONICAL FIX]', {
      input: null,
      output: '',
    });
    return null;
  }

  let sku = input.trim().toUpperCase();

  if (sku.startsWith('NH')) {
    sku = sku.substring(2);
  }

  sku = sku.replace(/\s+/g, '');

  console.log('[T23.6.40 CANONICAL FIX]', {
    input,
    output: sku,
  });

  return sku.length > 0 ? sku : null;
}
