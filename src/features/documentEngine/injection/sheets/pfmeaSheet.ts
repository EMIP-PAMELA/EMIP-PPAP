/**
 * PFMEA Sheet Handler
 * V3.2F — Primary sheet implementation
 *
 * Responsibility:
 *   Write PFMEA row data into the PFMEA worksheet.
 *   Header row is detected dynamically; data rows are written sequentially
 *   from the row immediately below the header.
 *
 * Governance rules (V3.2E / V3.2G-1):
 *   - ONLY cell values are set. Formatting, merges, borders, and column
 *     widths MUST NOT be modified.
 *   - Column mapping is static (A–H). Do not infer column positions from
 *     the workbook.
 *   - If the sheet or header row cannot be found, throw immediately.
 */

import ExcelJS from 'exceljs';

// ============================================================================
// Constants
// ============================================================================

const SHEET_NAME = 'PFMEA';

/** At least 2 of these keywords must appear in a row to qualify as header */
const HEADER_KEYWORDS = ['Failure Mode', 'Effect', 'Severity'];
const HEADER_MATCH_THRESHOLD = 2;

/**
 * Fixed column mapping — schema fields → 1-based column numbers.
 * A=1 B=2 C=3 D=4 E=5 F=6 G=7 H=8
 *
 * This mapping is authoritative. Changes here require a ledger entry.
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
  const sheet = workbook.getWorksheet(SHEET_NAME);
  if (!sheet) {
    throw new Error(
      `[PFMEA] Sheet "${SHEET_NAME}" not found in workbook. ` +
      `Available sheets: ${workbook.worksheets.map(ws => ws.name).join(', ')}`
    );
  }

  const headerRowNumber = detectHeaderRow(sheet);
  if (headerRowNumber === null) {
    throw new Error(
      `[PFMEA] Header row not found. Expected a row containing at least ` +
      `${HEADER_MATCH_THRESHOLD} of: ${HEADER_KEYWORDS.join(', ')}`
    );
  }

  const pfmeaData = validateData(data);
  const dataStartRow = headerRowNumber + 1;

  pfmeaData.rows.forEach((entry, index) => {
    const rowNumber = dataStartRow + index;
    for (const [field, colNumber] of Object.entries(COLUMN_MAP)) {
      const value = (entry as unknown as Record<string, unknown>)[field];
      sheet.getCell(rowNumber, colNumber).value =
        value !== undefined ? (value as ExcelJS.CellValue) : null;
    }
  });
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Scan rows top-to-bottom and return the first row number that contains
 * at least HEADER_MATCH_THRESHOLD of the HEADER_KEYWORDS.
 */
function detectHeaderRow(sheet: ExcelJS.Worksheet): number | null {
  for (let i = 1; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i);
    const values = row.values as (ExcelJS.CellValue | null | undefined)[];
    const matchCount = HEADER_KEYWORDS.filter(keyword =>
      values.some(v => getCellText(v).includes(keyword))
    ).length;
    if (matchCount >= HEADER_MATCH_THRESHOLD) {
      return i;
    }
  }
  return null;
}

/**
 * Extract a plain string from any ExcelJS cell value type.
 * Returns '' for non-text values.
 */
function getCellText(v: ExcelJS.CellValue | null | undefined): string {
  if (typeof v === 'string') return v;
  if (v !== null && v !== undefined && typeof v === 'object') {
    // Rich text: { richText: Array<{ text: string }> }
    if ('richText' in v) {
      return (v as ExcelJS.CellRichTextValue).richText.map(r => r.text).join('');
    }
  }
  return '';
}

/**
 * Validate that data conforms to the expected PFMEAData structure.
 * Throws on schema mismatch.
 */
function validateData(data: unknown): PFMEAData {
  if (
    data === null ||
    typeof data !== 'object' ||
    !('rows' in data) ||
    !Array.isArray((data as PFMEAData).rows)
  ) {
    throw new Error(
      '[PFMEA] Schema mismatch: expected { rows: PFMEARow[] }. ' +
      `Received: ${JSON.stringify(data)?.slice(0, 200)}`
    );
  }
  return data as PFMEAData;
}
