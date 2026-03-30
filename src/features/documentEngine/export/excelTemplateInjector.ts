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
      
      for (let i = 0; i < rowData.length; i++) {
        const dataRow = rowData[i];
        const excelRowIndex = cellMap.rowMappings.startRow + i;
        
        for (const colMapping of cellMap.rowMappings.columnMappings) {
          const value = dataRow[colMapping.fieldKey];
          
          if (value !== null && value !== undefined && value !== '') {
            const cellAddress = `${colMapping.column}${excelRowIndex}`;
            const cell = worksheet.getCell(cellAddress);
            cell.value = value;
          }
        }
        
        rowsWritten++;
      }
      
      console.log('[V2.6 EXPORT] Data rows written:', rowsWritten);
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
  
  // Generate XLSX blob
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
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
