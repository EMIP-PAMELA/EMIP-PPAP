/**
 * Wire utility functions for gauge extraction and wire-related calculations
 * Phase 3H.21: Gauge extraction from part numbers
 */

/**
 * Extract AWG gauge from wire part number
 * Matches patterns like W18, W20, W22 in part numbers (e.g., W18RD1015-BC)
 * 
 * @param partNumber - Wire part number
 * @returns Gauge as number (e.g., 18, 20, 22) or null if not found
 */
export function extractGaugeFromPart(partNumber: string | null | undefined): number | null {
  if (!partNumber) return null;

  // Match W followed by 2 digits (e.g., W18, W20, W22)
  const match = partNumber.match(/W(\d{2})/i);

  return match ? parseInt(match[1], 10) : null;
}

/**
 * Format gauge for display
 * @param gauge - Gauge number
 * @returns Formatted gauge string (e.g., "18 AWG")
 */
export function formatGauge(gauge: number | null): string {
  if (gauge === null) return 'Unknown';
  return `${gauge} AWG`;
}

/**
 * Validate if gauge is a standard AWG size
 * @param gauge - Gauge number
 * @returns true if standard AWG (typically 4-40)
 */
export function isValidAWG(gauge: number | null): boolean {
  if (gauge === null) return false;
  return gauge >= 4 && gauge <= 40;
}
