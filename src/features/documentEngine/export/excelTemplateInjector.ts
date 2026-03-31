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
  
  // V2.8B.5: Pre-write aggressive protection stripping
  // Root cause: ExcelJS crashes during writeBuffer() when encountering null/malformed protection
  // metadata at any level (worksheet, column, row, cell). Previous normalization attempts failed.
  // Now using aggressive deletion of ALL protection metadata to ensure serialization stability.
  console.log('[V2.8B.5 EXPORT] Sanitizing workbook for ExcelJS serialization compatibility');
  const stripResults = sanitizeWorkbookForExport(workbook);
  
  // Generate XLSX blob
  try {
    const buffer = await workbook.xlsx.writeBuffer();
    console.log('[V2.8B.5 EXPORT] Workbook serialization successful');
    return new Blob([buffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
  } catch (error) {
    // V2.8B.5: Enhanced error reporting with diagnostic information
    console.error(`[V2.8B.5 EXPORT] writeBuffer failed after aggressive protection stripping`);
    console.error(`[V2.8B.5 EXPORT] Sheet: "${cellMap.sheetName}"`);
    console.error(`[V2.8B.5 EXPORT] Strip results:`, stripResults);
    console.error(`[V2.8B.5 EXPORT] Error:`, error);
    throw new Error(`Excel export failed during workbook serialization for "${cellMap.sheetName}": ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Sanitize workbook for ExcelJS export compatibility
 * Phase V2.8B.5 - Aggressive Protection Metadata Stripping Fallback
 * 
 * ExcelJS Issue: PPAP workbook templates contain protection metadata that ExcelJS
 * cannot safely serialize. Previous normalization attempts (V2.8B.1, V2.8B.3, V2.8B.4)
 * were insufficient. During serialization (writeBuffer), ExcelJS still encounters
 * null/malformed protection objects, causing:
 * "TypeError: Cannot read properties of null (reading 'locked')"
 * 
 * Solution: AGGRESSIVE DELETION - Remove ALL protection metadata at ALL levels:
 * 1. Worksheet-level protection (delete completely)
 * 2. Column-level protection (delete from column styles)
 * 3. Row-level protection (delete completely)
 * 4. Cell-level protection (delete from cell styles)
 * 
 * This prioritizes serialization stability over protection fidelity.
 * Values, formulas, formatting (non-protection), and layout are preserved.
 * 
 * @param workbook - ExcelJS workbook to sanitize
 */
function sanitizeWorkbookForExport(workbook: ExcelJS.Workbook): { worksheets: number; columns: number; rows: number; cells: number } {
  let worksheetsStripped = 0;
  let columnsStripped = 0;
  let rowsStripped = 0;
  let cellsStripped = 0;
  
  console.log('[V2.8B.5 EXPORT] Aggressive protection stripping fallback applied');
  
  workbook.eachSheet((worksheet) => {
    const worksheetAny = worksheet as any;
    
    // V2.8B.5: AGGRESSIVE - Remove worksheet-level protection entirely
    try {
      if (worksheetAny.protection !== undefined) {
        delete worksheetAny.protection;
        worksheetsStripped++;
      }
      // Also try unprotect() as fallback
      if (typeof worksheetAny.unprotect === 'function') {
        worksheetAny.unprotect();
      }
    } catch (e) {
      // Continue if protection removal fails
    }
    
    // V2.8B.5: AGGRESSIVE - Strip column-level protection
    if (worksheetAny.columns && Array.isArray(worksheetAny.columns)) {
      worksheetAny.columns.forEach((column: any) => {
        if (column) {
          // Delete protection from column style
          if (column.style && column.style.protection !== undefined) {
            delete column.style.protection;
            columnsStripped++;
          }
          // Normalize null/malformed style containers
          if (column.style === null || column.style === undefined) {
            column.style = {};
          }
        }
      });
    }
    
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const rowAny = row as any;
      
      // V2.8B.5: AGGRESSIVE - Delete row-level protection entirely
      if (rowAny.protection !== undefined) {
        delete rowAny.protection;
        rowsStripped++;
      }
      
      // V2.8B.5: AGGRESSIVE - Delete protection from row style
      if (rowAny.style) {
        if (rowAny.style.protection !== undefined) {
          delete rowAny.style.protection;
          rowsStripped++;
        }
      } else {
        // Normalize null/malformed style container
        rowAny.style = {};
      }
      
      row.eachCell({ includeEmpty: false }, (cell) => {
        // V2.8B.5: AGGRESSIVE - Delete cell-level protection entirely
        // Normalize style container if null/malformed
        if (!cell.style || typeof cell.style !== 'object') {
          cell.style = {};
        }
        
        // DELETE protection metadata instead of normalizing
        if (cell.style.protection !== undefined) {
          delete cell.style.protection;
          cellsStripped++;
        }
      });
    });
  });
  
  // Comprehensive logging
  if (worksheetsStripped > 0) {
    console.log(`[V2.8B.5 EXPORT] Worksheet protection stripped: ${worksheetsStripped}`);
  }
  if (columnsStripped > 0) {
    console.log(`[V2.8B.5 EXPORT] Column protection stripped: ${columnsStripped}`);
  }
  if (rowsStripped > 0) {
    console.log(`[V2.8B.5 EXPORT] Row protection stripped: ${rowsStripped}`);
  }
  if (cellsStripped > 0) {
    console.log(`[V2.8B.5 EXPORT] Cell protection stripped: ${cellsStripped}`);
  }
  
  return {
    worksheets: worksheetsStripped,
    columns: columnsStripped,
    rows: rowsStripped,
    cells: cellsStripped
  };
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
