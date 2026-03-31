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
  
  // V2.9B-PF.1: Process Flow Header + Symbol Reconstruction
  // Rebuild header section with deterministic layout and image-based symbols
  const isProcessFlow = targetSheetName === '5-Proces Flow Diagram';
  
  if (isProcessFlow) {
    console.log('[V2.9B-PF.1 EXPORT] Rebuilding Process Flow header with symbols');
    
    // STEP 1: Define column structure
    cleanSheet.columns = [
      { key: 'A', width: 8 },   // STEP
      { key: 'B', width: 12 },  // Routing Number
      { key: 'C', width: 5 },   // Operation symbol
      { key: 'D', width: 5 },   // Inspection symbol
      { key: 'E', width: 5 },   // Transportation symbol
      { key: 'F', width: 5 },   // Delay symbol
      { key: 'G', width: 5 },   // Storage symbol
      { key: 'H', width: 30 },  // Operation Description
      { key: 'I', width: 20 },  // Additional columns
      { key: 'J', width: 20 },
      { key: 'K', width: 20 }
    ];
    
    // STEP 2: Header Row (Row 1)
    const headerRow = cleanSheet.getRow(1);
    headerRow.height = 40;
    
    headerRow.getCell(1).value = 'STEP';
    headerRow.getCell(2).value = 'Routing Number';
    headerRow.getCell(3).value = 'Operation';
    headerRow.getCell(4).value = 'Inspection';
    headerRow.getCell(5).value = 'Transportation';
    headerRow.getCell(6).value = 'Delay';
    headerRow.getCell(7).value = 'Storage';
    
    // Apply formatting to all header cells
    for (let col = 1; col <= 7; col++) {
      const cell = headerRow.getCell(col);
      cell.font = { bold: true };
      cell.alignment = {
        horizontal: 'center',
        vertical: 'middle',
        wrapText: true
      };
      cell.border = {
        top: { style: 'medium' },
        bottom: { style: 'medium' },
        left: { style: 'thin' },
        right: { style: 'thin' }
      };
    }
    
    // STEP 3: Add rotation to symbol columns (C-G)
    for (let col = 3; col <= 7; col++) {
      const cell = headerRow.getCell(col);
      cell.alignment = {
        ...cell.alignment,
        textRotation: 90
      };
    }
    
    // STEP 4: Symbol Row (Row 2)
    const symbolRow = cleanSheet.getRow(2);
    symbolRow.height = 20;
    
    symbolRow.getCell(1).value = '#';
    symbolRow.getCell(1).font = { bold: true };
    symbolRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    
    // Clear symbol cells (images will be added)
    for (let col = 3; col <= 7; col++) {
      symbolRow.getCell(col).value = '';
      symbolRow.getCell(col).alignment = { horizontal: 'center', vertical: 'middle' };
    }
    
    // STEP 5 & 6: Add image symbols
    // V2.9B-PF.4: Load images as base64 for browser compatibility
    try {
      // Helper function to load image as base64
      const loadImageAsBase64 = async (url: string): Promise<string> => {
        const res = await fetch(url);
        const blob = await res.blob();
        
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      };
      
      // Load all icon images as base64
      const greenCircleBase64 = await loadImageAsBase64('/icons/green_circle.png');
      const yellowDiamondBase64 = await loadImageAsBase64('/icons/yellow_diamond.png');
      const blueArrowBase64 = await loadImageAsBase64('/icons/blue_arrow.png');
      const redDelayBase64 = await loadImageAsBase64('/icons/red_delay.png');
      const graySquareBase64 = await loadImageAsBase64('/icons/gray_square.png');
      
      console.log('[V2.9B-PF.4 EXPORT] Symbol images loaded via base64');
      
      // Register images using base64
      const greenCircleId = cleanWorkbook.addImage({
        base64: greenCircleBase64,
        extension: 'png'
      });
      const yellowDiamondId = cleanWorkbook.addImage({
        base64: yellowDiamondBase64,
        extension: 'png'
      });
      const blueArrowId = cleanWorkbook.addImage({
        base64: blueArrowBase64,
        extension: 'png'
      });
      const redDelayId = cleanWorkbook.addImage({
        base64: redDelayBase64,
        extension: 'png'
      });
      const graySquareId = cleanWorkbook.addImage({
        base64: graySquareBase64,
        extension: 'png'
      });
      
      // Place images in cells (row 2 = index 1, columns C-G = index 2-6)
      cleanSheet.addImage(greenCircleId, {
        tl: { col: 2, row: 1 },
        ext: { width: 16, height: 16 }
      });
      cleanSheet.addImage(yellowDiamondId, {
        tl: { col: 3, row: 1 },
        ext: { width: 16, height: 16 }
      });
      cleanSheet.addImage(blueArrowId, {
        tl: { col: 4, row: 1 },
        ext: { width: 16, height: 16 }
      });
      cleanSheet.addImage(redDelayId, {
        tl: { col: 5, row: 1 },
        ext: { width: 16, height: 16 }
      });
      cleanSheet.addImage(graySquareId, {
        tl: { col: 6, row: 1 },
        ext: { width: 16, height: 16 }
      });
      
      console.log('[V2.9B-PF.4 EXPORT] Symbol images added to row 2');
    } catch (e) {
      console.warn('[V2.9B-PF.4 EXPORT] Failed to add symbol images:', e);
    }
    
    // STEP 8: Apply borders to symbol row
    for (let col = 1; col <= 7; col++) {
      const cell = symbolRow.getCell(col);
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'medium' },
        left: { style: 'thin' },
        right: { style: 'thin' }
      };
    }
    
    console.log('[V2.9B-PF.1 EXPORT] Process Flow header + symbols rebuilt');
  }
    
    // Copy column widths (safe metadata - V2.8B.6) - skip if Process Flow (already set)
    if (!isProcessFlow && sourceSheet.columns) {
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
  
  // V2.8C.3: Controlled Merge Reconstruction
  // Restore merged cells from template to fix layout (applied AFTER data copy)
  let mergesApplied = 0;
  let mergesFailed = 0;
  
  try {
    const sourceSheetAny = sourceSheet as any;
    const merges = sourceSheetAny.model?.merges || [];
    
    console.log(`[V2.8C.3 EXPORT] Reconstructing ${merges.length} merged cell ranges`);
    
    merges.forEach((mergeRange: string) => {
      try {
        cleanSheet.mergeCells(mergeRange);
        mergesApplied++;
      } catch (e) {
        console.warn(`[V2.8C.3 EXPORT] Failed to apply merge: ${mergeRange}`);
        mergesFailed++;
      }
    });
  } catch (e) {
    console.warn('[V2.8C.3 EXPORT] Could not access source sheet merges');
  }
  
  // V2.8C.5: Deterministic Border Reconstruction
  // Apply consistent borders to match Trane template visual grid (applied AFTER merges)
  let bordersApplied = 0;
  
  console.log('[V2.8C.5 EXPORT] Applying deterministic border system');
  
  // Define table region (approximate based on typical PPAP structure)
  const headerRowStart = 8;
  const headerRowEnd = 10;
  const dataRowStart = 11;
  const maxRow = cleanSheet.rowCount || 100;
  const maxCol = 30; // Typical PPAP column span
  
  // Apply borders to all cells in table region
  for (let rowNum = headerRowStart; rowNum <= maxRow; rowNum++) {
    const row = cleanSheet.getRow(rowNum);
    
    for (let colNum = 1; colNum <= maxCol; colNum++) {
      const cell = row.getCell(colNum);
      
      // Skip if cell has no value (don't add borders to empty regions)
      if (!cell.value) continue;
      
      // Determine border style based on position
      const isHeaderRow = rowNum >= headerRowStart && rowNum <= headerRowEnd;
      
      if (isHeaderRow) {
        // Header rows: medium top/bottom, thin left/right
        cell.border = {
          top: { style: 'medium' },
          bottom: { style: 'medium' },
          left: { style: 'thin' },
          right: { style: 'thin' }
        };
      } else {
        // Data rows: thin all sides (standard grid)
        cell.border = {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' }
        };
      }
      
      bordersApplied++;
    }
  }
  
  console.log(`[V2.8C.5 EXPORT] Deterministic borders applied: ${bordersApplied} cells`);
  
  // V2.9A: Single-sheet export summary
  console.log(`[V2.9A EXPORT] Single sheet rehydrated: ${targetSheetName}`);
  console.log(`[V2.8B.6 EXPORT] Values copied: ${valuesCopied}`);
  console.log(`[V2.8C.1 EXPORT] Safe styles copied for ${stylesCopied} cells`);
  console.log(`[V2.8C.1 EXPORT] Column widths preserved for ${columnsPreserved} columns`);
  console.log(`[V2.8C.3 EXPORT] Merged cells applied: ${mergesApplied}${mergesFailed > 0 ? ` (${mergesFailed} failed)` : ''}`);
  
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
