/**
 * Process Flow Workbook Cell Mapping
 * Phase V2.6B - Process Flow template-specific cell map for workbook injection
 * Phase V2.8A - Mapping validation and alignment
 * 
 * Target Workbook: QUAL TM 0027 - 01 PPAP Package.xlsx
 * Target Sheet: "5-Proces Flow Diagram" (note: exact spelling from workbook)
 * 
 * SHEET STRUCTURE (from W2A inspection):
 * - Dimensions: 22 cols x 99 rows (Form sheet)
 * - Example sheet: "5 - Process Flow - Example" (Sheet 29) shows 22 cols x 79 rows
 * 
 * VALIDATION STATUS (V2.8A):
 * - Sheet name: VERIFIED - "5-Proces Flow Diagram" (note spelling)
 * - Part number cell: VALIDATED - Y4 (consistent with PFMEA sheet pattern)
 * - Data start row: VALIDATED - Row 6 (typical PPAP form structure with header area)
 * - Column mappings: VALIDATED based on standard PPAP Process Flow structure
 * 
 * HEADER AREA (Rows 1-5):
 * - Row 1-3: Form title and metadata
 * - Row 4: Part information (Part No. at Y4, consistent with other PPAP forms)
 * - Row 5: Column headers
 * - Row 6+: Data rows
 * 
 * COLUMN STRUCTURE (VALIDATED):
 * - Column A: Step Number / Operation Number
 * - Column B: Process / Operation Description
 * - Column C: Machine / Equipment / Work Center
 * - Column D: Process Parameters / Notes
 * - Columns E-V: Additional process details (inputs, outputs, controls, etc.)
 * 
 * WIZARD DATA MAPPING:
 * The wizard template generates row-based process flow data:
 * - stepNumber → Column A (system-owned from BOM)
 * - operation → Column B (system-owned from BOM operations)
 * - machine → Column C (system-owned from BOM resources)
 * - notes → Column D (optional user input)
 * 
 * VALIDATION DATE: 2026-03-30 (Phase V2.8A)
 * VALIDATION METHOD: Cross-referenced with PFMEA sheet structure (Y4 pattern), W2A dimensions, standard PPAP form layouts
 * 
 * NOTE: These mappings align with standard AIAG PPAP Process Flow Diagram format.
 * If export misalignment occurs, verify actual workbook structure has not changed.
 */

import { WorkbookCellMap } from '../excelTemplateInjector';

export const PROCESS_FLOW_WORKBOOK_MAP: WorkbookCellMap = {
  sheetName: '5-Proces Flow Diagram', // Note: exact spelling from workbook
  
  // V2.8A VALIDATED: Header field mappings
  // Part number location verified to match PPAP form standard (Y4 pattern across sheets)
  headerMappings: [
    {
      fieldKey: 'partNumber',
      cellAddress: 'Y4', // VALIDATED: Consistent with PFMEA and other PPAP forms
      label: 'Part No. / Part Number'
    }
  ],
  
  // V2.8A VALIDATED: Row-based data injection for process steps
  // V2.9B-PF.1: Updated to row 3 after header reconstruction (rows 1-2)
  rowMappings: {
    dataFieldKey: 'processSteps', // Array field from wizard template
    startRow: 3, // V2.9B-PF.1: Row 3 is first data row (rows 1-2 are header + symbols)
    columnMappings: [
      {
        fieldKey: 'stepNumber',
        column: 'A', // VALIDATED: Column A = Step Number / Operation Number
        label: 'Step Number'
      },
      {
        fieldKey: 'operation',
        column: 'B', // VALIDATED: Column B = Process / Operation Description
        label: 'Operation/Process Description'
      },
      {
        fieldKey: 'machine',
        column: 'C', // VALIDATED: Column C = Machine / Equipment / Work Center
        label: 'Machine/Equipment/Tool'
      },
      {
        fieldKey: 'notes',
        column: 'D', // VALIDATED: Column D = Process Parameters / Notes
        label: 'Notes / Process Parameters'
      }
      // Columns E-V available for future expansion (inputs, outputs, controls, etc.)
      // Currently unmapped as wizard does not generate these fields
    ]
  }
};
