/**
 * Excel Template Injector
 * Phase V2.6 - Workbook-based exact template export
 * 
 * Responsibility: Inject generated wizard drafts into real PPAP workbook template
 * 
 * Architecture:
 * - Load workbook template from file system
 * - Clone workbook in memory
 * - Use template-specific cell mappings to inject data
 * - Preserve workbook formatting, merged cells, and structure
 * - Export as downloadable XLSX blob
 * 
 * Technology: ExcelJS
 */

import ExcelJS from 'exceljs';
import { DocumentDraft } from '../templates/types';

/**
 * Workbook template paths
 * V2.6B.1: Workbook served from public/ directory for browser accessibility
 */
const WORKBOOK_TEMPLATE_PATH = '/QUAL TM 0027 - 01 PPAP Package.xlsx';

/**
 * Cell mapping interface for template-specific injection
 */
export interface WorkbookCellMap {
  sheetName: string;
  headerMappings: Array<{
    fieldKey: string;
    cellAddress: string;
    label?: string;
  }>;
  rowMappings?: {
    dataFieldKey: string;
    startRow: number;
    columnMappings: Array<{
      fieldKey: string;
      column: string;
      label?: string;
    }>;
  };
}

/**
 * Export draft to Excel workbook template
 * 
 * @param draft - Generated document draft
 * @param cellMap - Template-specific cell mapping
 * @returns XLSX file as Blob
 */
export async function exportToExcelTemplate(
  draft: DocumentDraft,
  cellMap: WorkbookCellMap
): Promise<Blob> {
  console.log('[V2.6 EXPORT] Loading workbook template');
  
  // Load workbook template
  const workbook = new ExcelJS.Workbook();
  
  // In browser environment, we need to fetch the file
  const response = await fetch(WORKBOOK_TEMPLATE_PATH);
  const arrayBuffer = await response.arrayBuffer();
  await workbook.xlsx.load(arrayBuffer);
  
  console.log('[V2.6 EXPORT] Using sheet:', cellMap.sheetName);
  
  // Get target worksheet
  const worksheet = workbook.getWorksheet(cellMap.sheetName);
  
  if (!worksheet) {
    throw new Error(`Worksheet "${cellMap.sheetName}" not found in workbook template`);
  }
  
  // Inject header fields
  let headerFieldsInjected = 0;
  for (const mapping of cellMap.headerMappings) {
    const value = draft.fields[mapping.fieldKey];
    
    if (value !== null && value !== undefined && value !== '') {
      const cell = worksheet.getCell(mapping.cellAddress);
      cell.value = value;
      headerFieldsInjected++;
      
      console.log(`[V2.6 EXPORT] Header: ${mapping.fieldKey} → ${mapping.cellAddress} = ${value}`);
    }
  }
  
  console.log('[V2.6 EXPORT] Header fields mapped:', headerFieldsInjected);
  
  // Inject row data (if mapping provided)
  if (cellMap.rowMappings) {
    const rowData = draft.fields[cellMap.rowMappings.dataFieldKey];
    
    if (Array.isArray(rowData)) {
      let rowsWritten = 0;
      
      // V2.8A: Enhanced debug logging for mapping verification
      console.log(`[V2.8A EXPORT] Starting row injection at Excel row ${cellMap.rowMappings.startRow}`);
      console.log(`[V2.8A EXPORT] Column mappings: ${cellMap.rowMappings.columnMappings.map(c => `${c.fieldKey}→${c.column}`).join(', ')}`);
      
      for (let i = 0; i < rowData.length; i++) {
        const dataRow = rowData[i];
        const excelRowIndex = cellMap.rowMappings.startRow + i;
        
        // V2.8A: Log first few rows for verification
        if (i < 3) {
          console.log(`[V2.8A EXPORT] Writing data row ${i} → Excel row ${excelRowIndex}`);
        }
        
        for (const colMapping of cellMap.rowMappings.columnMappings) {
          const value = dataRow[colMapping.fieldKey];
          
          if (value !== null && value !== undefined && value !== '') {
            const cellAddress = `${colMapping.column}${excelRowIndex}`;
            const cell = worksheet.getCell(cellAddress);
            cell.value = value;
            
            // V2.8A: Log first row's cell writes for verification
            if (i === 0) {
              console.log(`[V2.8A EXPORT]   ${colMapping.fieldKey} → ${cellAddress} = ${value}`);
            }
          }
        }
        
        rowsWritten++;
      }
      
      console.log('[V2.6 EXPORT] Data rows written:', rowsWritten);
      console.log(`[V2.8A EXPORT] Row injection complete: rows ${cellMap.rowMappings.startRow}-${cellMap.rowMappings.startRow + rowsWritten - 1}`);
    } else {
      console.warn('[V2.6 EXPORT] Row data field is not an array:', cellMap.rowMappings.dataFieldKey);
    }
  } else {
    // V2.7D: Explicit logging for limited export (e.g., PFMEA matrix-based sheets)
    console.log('[V2.7D EXPORT] Limited export applied - row mappings intentionally undefined');
    console.log('[V2.7D EXPORT] Sheet structure incompatible with row-based data injection');
    console.log('[V2.7D EXPORT] Only header fields exported');
  }
  
  console.log('[V2.6 EXPORT] Workbook export complete');
  
  // V2.8B.1: Pre-write workbook sanitization
  // Root cause: ExcelJS crashes during writeBuffer() when encountering null protection/style metadata
  // in workbook cells. This occurs with certain PPAP template workbooks that have incomplete
  // style/protection objects. We sanitize these before serialization to prevent:
  // "TypeError: Cannot read properties of null (reading 'locked')"
  console.log('[V2.8B.1 EXPORT] Sanitizing workbook for ExcelJS serialization compatibility');
  sanitizeWorkbookForExport(workbook);
  
  // Generate XLSX blob
  try {
    const buffer = await workbook.xlsx.writeBuffer();
    console.log('[V2.8B.1 EXPORT] Workbook serialization successful');
    return new Blob([buffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
  } catch (error) {
    console.error(`[V2.8B.1 EXPORT] writeBuffer failed for sheet "${cellMap.sheetName}"`, error);
    throw new Error(`Excel export failed during workbook serialization: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Sanitize workbook for ExcelJS export compatibility
 * Phase V2.8B.1 - Fix null protection/style metadata that causes writeBuffer() crashes
 * Phase V2.8B.3 - Remove worksheet-level protection to prevent null reference errors
 * 
 * ExcelJS Issue: Some PPAP workbook templates contain cells with null or incomplete
 * protection/style objects. During serialization (writeBuffer), ExcelJS attempts to
 * access properties like 'locked' on these null objects, causing:
 * "TypeError: Cannot read properties of null (reading 'locked')"
 * 
 * Solution: 
 * 1. Remove worksheet-level protection completely (V2.8B.3)
 * 2. Normalize cell-level protection objects to safe defaults (V2.8B.1)
 * This preserves workbook formatting while ensuring ExcelJS can serialize without crashing.
 * 
 * @param workbook - ExcelJS workbook to sanitize
 */
function sanitizeWorkbookForExport(workbook: ExcelJS.Workbook): void {
  let cellsSanitized = 0;
  let worksheetsNeutralized = 0;
  
  workbook.eachSheet((worksheet) => {
    // V2.8B.3: CRITICAL FIX - Remove worksheet-level protection
    // Worksheet protection can contain null objects that cause ExcelJS to crash
    // during serialization. Use unprotect() to remove protection completely.
    try {
      // ExcelJS uses unprotect() method to remove worksheet protection
      // This prevents null reference errors during serialization
      (worksheet as any).unprotect();
      worksheetsNeutralized++;
    } catch (e) {
      // Silently continue if unprotect fails (worksheet may not be protected)
      // This is not a critical error
    }
    
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        // Ensure cell.style exists as an object
        if (!cell.style || typeof cell.style !== 'object') {
          cell.style = {};
          cellsSanitized++;
        }
        
        // Ensure cell.style.protection exists and is not null
        // This is the primary fix for the "Cannot read properties of null (reading 'locked')" error
        if (cell.style.protection === null || cell.style.protection === undefined) {
          cell.style.protection = {
            locked: false,
            hidden: false
          };
          cellsSanitized++;
        } else if (typeof cell.style.protection === 'object') {
          // Ensure protection object has required properties
          if (cell.style.protection.locked === null || cell.style.protection.locked === undefined) {
            cell.style.protection.locked = false;
            cellsSanitized++;
          }
          if (cell.style.protection.hidden === null || cell.style.protection.hidden === undefined) {
            cell.style.protection.hidden = false;
            cellsSanitized++;
          }
        }
      });
    });
  });
  
  if (worksheetsNeutralized > 0) {
    console.log(`[V2.8B.3 EXPORT] Worksheet protection neutralized on ${worksheetsNeutralized} sheet(s)`);
  }
  if (cellsSanitized > 0) {
    console.log(`[V2.8B.1 EXPORT] Sanitized ${cellsSanitized} cell protection/style objects`);
  }
}

/**
 * Trigger download of XLSX blob
 * 
 * @param blob - XLSX file blob
 * @param filename - Download filename
 */
export function downloadExcelFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
  
  console.log('[V2.6 EXPORT] File download triggered:', filename);
}
