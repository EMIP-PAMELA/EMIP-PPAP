/**
 * PFMEA Sheet Handler
 * V3.2F / V3.2F.1 — Primary sheet implementation (hardened)
 *
 * Responsibility:
 *   Write PFMEA row data into the PFMEA worksheet.
 *   Sheet is located by alias. Header row is detected by synonym matching.
 *   Data rows are written sequentially from the row immediately below
 *   the detected header.
 *
 * Governance rules (V3.2E / V3.2G-1):
 *   - ONLY cell values are set. Formatting, merges, borders, and column
 *     widths MUST NOT be modified.
 *   - Column mapping is static (A–H). Do not infer column positions from
 *     the workbook.
 *   - Schema is validated before any write attempt. Throws on mismatch.
 *   - If the sheet or header row cannot be found, throw immediately.
 */

import ExcelJS from 'exceljs';
import { findSheetByAlias, SHEET_ALIASES } from '../utils/sheetAliases';
import { countHeaderFieldMatches, normalize } from '../utils/headerMatcher';
import { validatePFMEA } from '../utils/schemaValidator';
import { logEvent } from '../utils/injectionLogger';

// ============================================================================
// Constants
// ============================================================================

/**
 * Header detection: the row must contain matches for at least this many
 * distinct field keys from HEADER_DETECT_FIELDS.
 */
const HEADER_MATCH_THRESHOLD = 2;

/**
 * Field keys used for header row detection.
 * These are the most reliably labeled columns across template variations.
 */
const HEADER_DETECT_FIELDS = ['failure_mode', 'effect', 'severity'];

/**
 * Fixed column mapping — schema fields → 1-based column numbers.
 * A=1 B=2 C=3 D=4 E=5 F=6 G=7 H=8
 *
 * This mapping is authoritative. Changes require a BUILD_LEDGER entry.
 */
const COLUMN_MAP: Record<string, number> = {
  process_step: 1,  // A
  failure_mode: 2,  // B
  effect:       3,  // C
  severity:     4,  // D
  cause:        5,  // E
  occurrence:   6,  // F
  detection:    7,  // G
  rpn:          8,  // H
};

// ============================================================================
// Types
// ============================================================================

interface PFMEARow {
  process_step: string;
  failure_mode: string;
  effect:       string;
  severity:     number;
  cause:        string;
  occurrence:   number;
  detection:    number;
  rpn:          number;
}

interface PFMEAData {
  rows: PFMEARow[];
}

// ============================================================================
// Handler
// ============================================================================

export function handlePFMEA(workbook: ExcelJS.Workbook, data: unknown): void {
  // 1. Locate sheet by alias (throws if not found)
  const sheet = findSheetByAlias(workbook, SHEET_ALIASES.pfmea, 'PFMEA');
  logEvent('info', 'PFMEA sheet matched', { sheetName: sheet.name });

  // 2. Validate schema before any write (throws on mismatch)
  validatePFMEA(data);
  const pfmeaData = data as PFMEAData;

  // 3. Detect header row using synonym matching (throws if not found)
  const headerRowNumber = detectHeaderRow(sheet);
  logEvent('info', 'PFMEA header row detected', { headerRow: headerRowNumber });

  // 4. Write data rows
  const dataStartRow = headerRowNumber + 1;

  pfmeaData.rows.forEach((entry, index) => {
    const rowNumber = dataStartRow + index;
    const entryMap = entry as unknown as Record<string, unknown>;

    for (const [field, colNumber] of Object.entries(COLUMN_MAP)) {
      // Safe guard: column index must be valid
      if (colNumber < 1) {
        logEvent('warn', 'Skipping invalid column index', { field, colNumber });
        continue;
      }

      // ExcelJS auto-creates the row if it does not exist
      const value = entryMap[field];
      sheet.getCell(rowNumber, colNumber).value =
        value !== undefined ? (value as ExcelJS.CellValue) : null;
    }
  });

  logEvent('info', 'PFMEA rows injected', {
    rowsWritten: pfmeaData.rows.length,
    dataStartRow,
  });
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Scan rows top-to-bottom and return the first row number where at least
 * HEADER_MATCH_THRESHOLD of the HEADER_DETECT_FIELDS are present
 * (using synonym matching via headerMatcher).
 */
function detectHeaderRow(sheet: ExcelJS.Worksheet): number {
  for (let i = 1; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i);
    const values = row.values as (ExcelJS.CellValue | null | undefined)[];
    const cellTexts = values.map(getCellText);
    const matchCount = countHeaderFieldMatches(cellTexts, HEADER_DETECT_FIELDS);

    if (matchCount >= HEADER_MATCH_THRESHOLD) {
      return i;
    }
  }

  throw new Error(
    `[PFMEA] Header row not found in sheet "${sheet.name}". ` +
    `Expected a row with at least ${HEADER_MATCH_THRESHOLD} of: ` +
    `${HEADER_DETECT_FIELDS.map(f => `"${f}"`).join(', ')}. ` +
    `Scanned ${sheet.rowCount} rows.`
  );
}

/**
 * Extract a plain string from any ExcelJS cell value type.
 * Returns '' for non-text values.
 */
function getCellText(v: ExcelJS.CellValue | null | undefined): string {
  if (typeof v === 'string') return normalize(v);
  if (v !== null && v !== undefined && typeof v === 'object') {
    // Rich text: { richText: Array<{ text: string }> }
    if ('richText' in v) {
      const joined = (v as ExcelJS.CellRichTextValue).richText
        .map(r => r.text)
        .join('');
      return normalize(joined);
    }
  }
  return '';
}
