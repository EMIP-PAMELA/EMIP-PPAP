/**
 * Sheet Alias System
 * V3.2F.1 — Injection Engine Hardening
 *
 * Responsibility:
 *   Define known sheet name aliases per document type and provide a lookup
 *   helper that normalizes names before comparing, allowing the injection
 *   engine to function across customer templates that use different sheet
 *   naming conventions.
 *
 * Governance rules (V3.2E / V3.2G-1):
 *   - Aliases describe known variations in customer templates.
 *   - Matching is case-insensitive and whitespace-normalized.
 *   - If no alias matches, throw immediately with a descriptive error.
 *   - Do NOT attempt to infer sheet purpose from content. Only name-matching
 *     is performed here.
 */

import ExcelJS from 'exceljs';

// ============================================================================
// Alias Map
// ============================================================================

/**
 * Known sheet name aliases per document type.
 * All entries are lowercase — comparison is performed after normalization.
 *
 * Add aliases here when a new customer template uses a different sheet name.
 * Each addition requires a BUILD_LEDGER entry.
 */
export const SHEET_ALIASES: Record<string, string[]> = {
  pfmea: [
    'pfmea',
    'pfmea summary',
    'failure mode',
    'fmea',
  ],
  psw: [
    'psw',
    'part submission warrant',
    'warrant',
  ],
};

// ============================================================================
// Lookup Helper
// ============================================================================

/**
 * Find a worksheet in the given workbook by trying each alias in order.
 * Sheet names are normalized (lowercase + trimmed) before comparison.
 *
 * @param workbook  - The loaded ExcelJS workbook.
 * @param aliases   - List of alias strings (from SHEET_ALIASES[docType]).
 * @param docType   - Human-readable document type label for error messages.
 * @returns The first matching worksheet.
 * @throws  If no alias matches any sheet in the workbook.
 */
export function findSheetByAlias(
  workbook: ExcelJS.Workbook,
  aliases: string[],
  docType: string
): ExcelJS.Worksheet {
  const normalizedAliases = aliases.map(a => normalize(a));
  const availableSheets = workbook.worksheets.map(ws => ws.name);

  for (const ws of workbook.worksheets) {
    const normalizedName = normalize(ws.name);
    if (normalizedAliases.includes(normalizedName)) {
      return ws;
    }
  }

  throw new Error(
    `[SheetAliases] ${docType} sheet not found. ` +
    `Checked aliases: ${aliases.join(', ')}. ` +
    `Available sheets: ${availableSheets.join(', ')}`
  );
}

// ============================================================================
// Helpers
// ============================================================================

function normalize(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}
