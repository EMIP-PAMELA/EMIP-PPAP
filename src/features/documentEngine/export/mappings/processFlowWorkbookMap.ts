/**
 * Process Flow Workbook Cell Mapping
 * Phase V2.6B - Process Flow template-specific cell map for workbook injection
 * 
 * Target Workbook: QUAL TM 0027 - 01 PPAP Package.xlsx
 * Target Sheet: "5-Proces Flow Diagram" (note spelling)
 * 
 * Sheet Structure:
 * - Header row at R1 (assumed)
 * - Data rows starting at R2 (assumed - may need adjustment after workbook inspection)
 * - Columns (estimated based on typical Process Flow structure):
 *   - Column A: Step Number
 *   - Column B: Operation/Process Description
 *   - Column C: Machine/Equipment/Tool
 *   - Remaining columns: Additional process details (notes, inputs, outputs, etc.)
 * 
 * The wizard template generates row-based process flow data with fields:
 * - stepNumber (maps to Step Number column)
 * - operation (maps to Operation/Description column)
 * - machine (maps to Machine/Tool column)
 * - notes (maps to Notes column or similar)
 * 
 * Current mapping: Header + row-level injection
 * 
 * NOTE: Column mappings are estimated based on typical PPAP Process Flow structure.
 * These may require adjustment after workbook inspection or initial export testing.
 */

import { WorkbookCellMap } from '../excelTemplateInjector';

export const PROCESS_FLOW_WORKBOOK_MAP: WorkbookCellMap = {
  sheetName: '5-Proces Flow Diagram', // Note: exact spelling from workbook
  
  // Header fields (part number typically in upper area of form)
  // Exact cell location TBD - may need adjustment after testing
  headerMappings: [
    {
      fieldKey: 'partNumber',
      cellAddress: 'B2', // Estimated - adjust after workbook inspection
      label: 'Part Number'
    }
  ],
  
  // Row-based data injection for process steps
  rowMappings: {
    dataFieldKey: 'processSteps', // Array field from wizard template
    startRow: 5, // Estimated starting row - adjust after workbook inspection
    columnMappings: [
      {
        fieldKey: 'stepNumber',
        column: 'A',
        label: 'Step Number'
      },
      {
        fieldKey: 'operation',
        column: 'B',
        label: 'Operation/Process Description'
      },
      {
        fieldKey: 'machine',
        column: 'C',
        label: 'Machine/Equipment/Tool'
      },
      {
        fieldKey: 'notes',
        column: 'D',
        label: 'Notes'
      }
    ]
  }
};
