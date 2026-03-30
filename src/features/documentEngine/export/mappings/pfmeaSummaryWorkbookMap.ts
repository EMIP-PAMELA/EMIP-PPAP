/**
 * PFMEA Summary Workbook Cell Mapping
 * Phase V2.6 - Template-specific cell map for workbook injection
 * 
 * Target Workbook: QUAL TM 0027 - 01 PPAP Package.xlsx
 * Target Sheet: " 6b_PFMEA summary - Form" (note leading space)
 * 
 * IMPORTANT NOTE:
 * The workbook sheet "6b_PFMEA summary - Form" is designed as an RPN distribution
 * matrix/heatmap, NOT a row-by-row PFMEA table. The sheet structure is:
 * 
 * - R4: Supplier Name (A4), Part No. & Rev (Y4)
 * - R6: Table Prepared by / Date (A6), Table Approved by / Date (Y6)
 * - R11-R20: Severity scale (rows, vertical axis)
 * - R21-R22: Detection x Occurrence values (columns, horizontal axis)
 * - R8-R17 grid area: RPN count values for matrix visualization
 * 
 * The wizard template generates row-based PFMEA data (stepNumber, processFunction,
 * failureMode, effect, severity, occurrence, detection, rpn), but this workbook
 * sheet expects aggregated RPN distribution counts.
 * 
 * Current mapping: Header fields only (Part No.)
 * Future enhancement: Transform row data into RPN distribution matrix
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
  
  // NOTE: Row mappings not implemented for V2.6
  // The workbook sheet uses a matrix format (Severity vs Detection x Occurrence)
  // which is incompatible with the wizard's row-based PFMEA data structure.
  // 
  // To properly populate this sheet, we would need to:
  // 1. Group wizard rows by (severity, occurrence, detection) combination
  // 2. Calculate RPN for each entry
  // 3. Count occurrences of each RPN value
  // 4. Map counts into the appropriate matrix cells (R8-R17, columns C-AR)
  // 
  // This transformation is deferred to a future phase.
  rowMappings: undefined
};
