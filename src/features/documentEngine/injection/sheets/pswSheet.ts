/**
 * PSW Sheet Handler
 * V3.2F — Part Submission Warrant field-mapping implementation
 *
 * Responsibility:
 *   Write PSW field values into the PSW worksheet by locating label cells
 *   and writing the value into the adjacent cell to the right.
 *
 * Governance rules (V3.2E / V3.2G-1):
 *   - ONLY cell values are set. Formatting, merges, borders, and styles
 *     MUST NOT be modified.
 *   - Label text matching is case-insensitive and substring-based.
 *   - If the PSW sheet is not found, throw immediately.
 *   - If a label is not found in the sheet, the field is silently skipped
 *     (PSW layouts vary per customer template; not every label is guaranteed
 *     to exist in every template version).
 */

import ExcelJS from 'exceljs';

// ============================================================================
// Constants
// ============================================================================

/** Known PSW sheet names — searched in order until a match is found */
const SHEET_NAMES = ['PSW', 'Part Submission Warrant', 'Warrant'];

/**
 * Maps schema field keys → label strings to search for in the sheet.
 * Multiple aliases handle variation across customer template versions.
 * Label matching is case-insensitive substring.
 */
const LABEL_MAP: Record<string, string[]> = {
  part_number:      ['Part Number', 'Part No', 'Part #'],
  part_name:        ['Part Name', 'Part Description'],
  supplier_name:    ['Supplier', 'Supplier Name'],
  supplier_code:    ['Supplier Code', 'Supplier #', 'Supplier No'],
  customer_name:    ['Customer', 'Customer Name'],
  revision:         ['Revision', 'Rev Level', 'Rev.'],
  submission_date:  ['Date', 'Submission Date'],
  po_number:        ['PO Number', 'Purchase Order', 'PO#'],
  engineering_change: ['Engineering Change', 'Eng Change', 'ECR'],
  submission_level: ['Submission Level', 'Level'],
};

// ============================================================================
// Handler
// ============================================================================

export function handlePSW(workbook: ExcelJS.Workbook, data: unknown): void {
  const sheet = findPSWSheet(workbook);
  if (!sheet) {
    throw new Error(
      `[PSW] No PSW sheet found in workbook. ` +
      `Searched: ${SHEET_NAMES.join(', ')}. ` +
      `Available sheets: ${workbook.worksheets.map(ws => ws.name).join(', ')}`
    );
  }

  if (data === null || typeof data !== 'object') {
    throw new Error(
      '[PSW] Schema mismatch: expected a key-value object for PSW fields. ' +
      `Received: ${JSON.stringify(data)?.slice(0, 200)}`
    );
  }

  const pswData = data as Record<string, unknown>;

  sheet.eachRow((row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      const labelText = getCellText(cell.value).trim();
      if (!labelText) return;

      for (const [field, aliases] of Object.entries(LABEL_MAP)) {
        if (!(field in pswData)) continue;

        const matched = aliases.some(alias =>
          labelText.toLowerCase().includes(alias.toLowerCase())
        );
        if (!matched) continue;

        // Write value to the cell immediately to the right of the label
        const targetCell = row.getCell(cell.col + 1);
        targetCell.value = pswData[field] as ExcelJS.CellValue;
      }
    });
  });
}

// ============================================================================
// Helpers
// ============================================================================

function findPSWSheet(workbook: ExcelJS.Workbook): ExcelJS.Worksheet | undefined {
  for (const name of SHEET_NAMES) {
    const sheet = workbook.getWorksheet(name);
    if (sheet) return sheet;
  }
  return undefined;
}

function getCellText(v: ExcelJS.CellValue | null | undefined): string {
  if (typeof v === 'string') return v;
  if (v !== null && v !== undefined && typeof v === 'object') {
    if ('richText' in v) {
      return (v as ExcelJS.CellRichTextValue).richText.map(r => r.text).join('');
    }
  }
  return '';
}
