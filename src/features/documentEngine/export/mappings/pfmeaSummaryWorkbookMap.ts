/**
 * PFMEA Summary Workbook Cell Mapping
 * Phase V2.6 - Template-specific cell map for workbook injection
 * Phase V2.7D - Limited export with honest field mapping
 * 
 * Target Workbook: QUAL TM 0027 - 01 PPAP Package.xlsx
 * Target Sheet: " 6b_PFMEA summary - Form" (note leading space)
 * 
 * SHEET STRUCTURE (Matrix-Based):
 * The workbook sheet "6b_PFMEA summary - Form" is designed as an RPN distribution
 * matrix/heatmap, NOT a row-by-row PFMEA table. The sheet structure is:
 * 
 * - R4: Supplier Name (A4), Part No. & Rev (Y4)
 * - R6: Table Prepared by / Date (A6), Table Approved by / Date (Y6)
 * - R11-R20: Severity scale (rows, vertical axis)
 * - R21-R22: Detection x Occurrence values (columns, horizontal axis)
 * - R8-R17 grid area: RPN count values for matrix visualization
 * 
 * WIZARD DATA STRUCTURE (Row-Based):
 * The wizard template generates row-based PFMEA data:
 * - stepNumber (system-owned from BOM)
 * - processFunction (system-owned from BOM operations)
 * - failureMode (suggested by autofill rules)
 * - effect (suggested by autofill rules)
 * - severity (suggested by autofill rules)
 * - occurrence (suggested by autofill rules)
 * - detection (suggested by autofill rules)
 * - rpn (calculated, not authoritative)
 * 
 * EXPORT APPROACH (V2.7D - Limited + Honest):
 * This mapping intentionally exports ONLY header fields (Part No.) because:
 * 
 * 1. **Structural Incompatibility**: Wizard generates row-based data; workbook expects matrix
 * 2. **Engineering Judgment Required**: Risk ratings (S/O/D) are suggestions, not authoritative
 * 3. **No Forced Data**: We do not fabricate or force RPN distribution counts
 * 4. **Operator Completion**: Matrix should be filled by engineer based on actual risk analysis
 * 
 * Row mappings are intentionally undefined. To populate the matrix would require:
 * - Grouping rows by (severity, occurrence, detection) combination
 * - Calculating RPN for each entry (S × O × D)
 * - Counting occurrences of each RPN value
 * - Mapping counts into matrix cells (R8-R17, columns C-AR)
 * - Validating that suggested risk ratings are engineering-approved
 * 
 * This transformation is intentionally NOT implemented to maintain data integrity.
 */

import { WorkbookCellMap } from '../excelTemplateInjector';

export const PFMEA_SUMMARY_WORKBOOK_MAP: WorkbookCellMap = {
  sheetName: ' 6b_PFMEA summary - Form', // Note: sheet name has leading space
  
  headerMappings: [
    {
      fieldKey: 'partNumber',
      cellAddress: 'Y4',
      label: 'Part No. & Rev'
    }
  ],
  
  // V2.7D: Row mappings intentionally undefined (limited export)
  // 
  // REASONING:
  // - Workbook sheet is matrix-based (RPN distribution heatmap)
  // - Wizard generates row-based PFMEA data
  // - Risk ratings (severity, occurrence, detection) are SUGGESTED, not authoritative
  // - RPN calculations require engineering validation
  // - Forcing row data into matrix would fabricate risk distribution
  // 
  // EXPORT BEHAVIOR:
  // - Only header fields (Part No.) are exported
  // - Matrix remains blank for operator/engineer completion
  // - Preserves data integrity and engineering judgment requirement
  // 
  // This is an intentional design decision, not a limitation to be "fixed."
  rowMappings: undefined
};
