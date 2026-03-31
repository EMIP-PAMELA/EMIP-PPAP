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
  
  // V2.8B.6 + V2.8C.1 + V2.9A: Single-Sheet Workbook Rehydration
  // V2.8B.6: Clean workbook rebuild eliminates ExcelJS template corruption
  // V2.8C.1: Selectively reintroduce safe formatting for readability
  // V2.9A: Export only the selected sheet (user intent alignment)
  // Architecture: Template as data source → Clean workbook (single sheet) → Safe formatting → Serialize
  console.log('[V2.8B.6 EXPORT] Rehydrating workbook into clean ExcelJS-safe structure');
  console.log('[V2.8C.1 EXPORT] Applying controlled formatting reconstruction');
  console.log(`[V2.9A EXPORT] Single sheet export: ${cellMap.sheetName}`);
  
  const sourceWorkbook = workbook;
  const cleanWorkbook = new ExcelJS.Workbook();
  
  let valuesCopied = 0;
  let stylesCopied = 0;
  let columnsPreserved = 0;
  
  // V2.9A: Get ONLY the target sheet from source workbook
  const targetSheetName = cellMap.sheetName;
  const sourceSheet = sourceWorkbook.getWorksheet(targetSheetName);
  
  if (!sourceSheet) {
    throw new Error(`Target worksheet "${targetSheetName}" not found in workbook template`);
  }
  
  console.log(`[V2.9A EXPORT] Copying single worksheet: ${sourceSheet.name}`);
  const cleanSheet = cleanWorkbook.addWorksheet(sourceSheet.name);
    
    // Copy column widths (safe metadata - V2.8B.6)
    if (sourceSheet.columns) {
      sourceSheet.columns.forEach((col, i) => {
        if (col && col.width) {
          cleanSheet.getColumn(i + 1).width = col.width;
          columnsPreserved++;
        }
      });
    }
    
    // Copy row values AND safe formatting (V2.8B.6 + V2.8C.1)
    sourceSheet.eachRow((row, rowNumber) => {
      const cleanRow = cleanSheet.getRow(rowNumber);
      
      row.eachCell((cell, colNumber) => {
        const cleanCell = cleanRow.getCell(colNumber);
        
        // Always copy value (V2.8B.6)
        cleanCell.value = cell.value;
        valuesCopied++;
        
        // V2.8C.1: Selectively copy ONLY safe formatting properties
        // Guard all nested accesses to prevent corruption propagation
        if (cell.style && typeof cell.style === 'object') {
          const safeStyle: any = {};
          let hasStyle = false;
          
          // Copy alignment (safe)
          if (cell.style.alignment && typeof cell.style.alignment === 'object') {
            safeStyle.alignment = {};
            if (cell.style.alignment.horizontal) {
              safeStyle.alignment.horizontal = cell.style.alignment.horizontal;
              hasStyle = true;
            }
            if (cell.style.alignment.vertical) {
              safeStyle.alignment.vertical = cell.style.alignment.vertical;
              hasStyle = true;
            }
            if (cell.style.alignment.wrapText !== undefined) {
              safeStyle.alignment.wrapText = cell.style.alignment.wrapText;
              hasStyle = true;
            }
          }
          
          // Copy font (safe)
          if (cell.style.font && typeof cell.style.font === 'object') {
            safeStyle.font = {};
            if (cell.style.font.bold !== undefined) {
              safeStyle.font.bold = cell.style.font.bold;
              hasStyle = true;
            }
            if (cell.style.font.italic !== undefined) {
              safeStyle.font.italic = cell.style.font.italic;
              hasStyle = true;
            }
            if (cell.style.font.size) {
              safeStyle.font.size = cell.style.font.size;
              hasStyle = true;
            }
            if (cell.style.font.name) {
              safeStyle.font.name = cell.style.font.name;
              hasStyle = true;
            }
          }
          
          // Copy simple fill (safe - only simple patterns)
          if (cell.style.fill && typeof cell.style.fill === 'object') {
            if (cell.style.fill.type === 'pattern' && cell.style.fill.pattern) {
              safeStyle.fill = {
                type: 'pattern',
                pattern: cell.style.fill.pattern
              };
              if (cell.style.fill.fgColor) {
                safeStyle.fill.fgColor = cell.style.fill.fgColor;
              }
              if (cell.style.fill.bgColor) {
                safeStyle.fill.bgColor = cell.style.fill.bgColor;
              }
              hasStyle = true;
            }
          }
          
          // Copy simple border (safe)
          if (cell.style.border && typeof cell.style.border === 'object') {
            safeStyle.border = {};
            ['top', 'left', 'bottom', 'right'].forEach((side) => {
              if ((cell.style.border as any)[side] && typeof (cell.style.border as any)[side] === 'object') {
                (safeStyle.border as any)[side] = {
                  style: (cell.style.border as any)[side].style
                };
                if ((cell.style.border as any)[side].color) {
                  (safeStyle.border as any)[side].color = (cell.style.border as any)[side].color;
                }
                hasStyle = true;
              }
            });
          }
          
          // Apply safe styles to clean cell
          if (hasStyle) {
            cleanCell.style = safeStyle;
            stylesCopied++;
          }
        }
      });
    });
  
  // V2.9A: Single-sheet export summary
  console.log(`[V2.9A EXPORT] Single sheet rehydrated: ${targetSheetName}`);
  console.log(`[V2.8B.6 EXPORT] Values copied: ${valuesCopied}`);
  console.log(`[V2.8C.1 EXPORT] Safe styles copied for ${stylesCopied} cells`);
  console.log(`[V2.8C.1 EXPORT] Column widths preserved for ${columnsPreserved} columns`);
  
  // Generate XLSX blob from CLEAN workbook (single sheet)
  try {
    const buffer = await cleanWorkbook.xlsx.writeBuffer();
    console.log('[V2.9A EXPORT] Single-sheet workbook serialization successful');
    return new Blob([buffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
  } catch (error) {
    // V2.9A: Error reporting for single-sheet export failures
    console.error(`[V2.9A EXPORT] writeBuffer failed for single-sheet export`);
    console.error(`[V2.9A EXPORT] Target sheet: "${targetSheetName}"`);
    console.error(`[V2.9A EXPORT] Values copied: ${valuesCopied}`);
    console.error(`[V2.9A EXPORT] Error:`, error);
    throw new Error(`Excel export failed during single-sheet serialization for "${targetSheetName}": ${error instanceof Error ? error.message : 'Unknown error'}`);
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
