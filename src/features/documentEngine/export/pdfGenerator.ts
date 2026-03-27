/**
 * PDF Generator - Document Engine Export Layer
 * 
 * Generates PDF documents from structured document drafts using layout definitions.
 * 
 * Key principles:
 * - Uses template layout definitions (NOT hardcoded structure)
 * - Uses editableDraft (reflects user edits)
 * - Maintains separation of data, layout, and export
 * 
 * Architecture layer: Export
 * 
 * IMPORTANT:
 * This module must only be loaded dynamically on the client.
 * Do NOT import this file at the top level of any Next.js component.
 */

import jsPDF from 'jspdf';
import { DocumentDraft, TemplateDefinition } from '../templates/types';

/**
 * Generate PDF from document draft using template layout
 * @param draft - The editable document draft to export
 * @param template - Template definition containing layout and field definitions
 * @returns PDF as Uint8Array for download
 */
export async function generatePDF(
  draft: DocumentDraft,
  template: TemplateDefinition
): Promise<Uint8Array> {
  // Initialize PDF (A4 portrait)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Page dimensions
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const maxWidth = pageWidth - (margin * 2);
  
  let yPosition = margin;
  const lineHeight = 7;
  const sectionSpacing = 10;
  const fieldSpacing = 5;

  // Helper to add new page if needed
  const checkPageBreak = (neededSpace: number) => {
    if (yPosition + neededSpace > pageHeight - margin) {
      doc.addPage();
      yPosition = margin;
    }
  };

  // Title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(template.name, margin, yPosition);
  yPosition += lineHeight + sectionSpacing;

  // Metadata section
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  checkPageBreak(lineHeight);
  doc.text('Metadata', margin, yPosition);
  yPosition += lineHeight;

  doc.setFont('helvetica', 'normal');
  Object.entries(draft.metadata).forEach(([key, value]) => {
    checkPageBreak(lineHeight);
    const label = key.replace(/([A-Z])/g, ' $1').trim();
    doc.text(`${label}: ${String(value)}`, margin + 5, yPosition);
    yPosition += fieldSpacing;
  });
  yPosition += sectionSpacing;

  // Render sections from layout
  const layout = template.layout;
  const fieldDefinitions = template.fieldDefinitions;

  for (const section of layout.sections) {
    checkPageBreak(lineHeight + sectionSpacing);

    // Section title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(section.title, margin, yPosition);
    yPosition += lineHeight;

    // Section fields
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    for (const fieldKey of section.fields) {
      // Skip if field doesn't exist in draft
      if (!(fieldKey in draft.fields)) continue;

      checkPageBreak(lineHeight);

      const value = draft.fields[fieldKey];
      
      // Find field definition for proper label
      const fieldDef = fieldDefinitions.find(def => def.key === fieldKey);
      const label = fieldDef?.label || fieldKey.replace(/([A-Z])/g, ' $1').trim();

      // Render field
      doc.text(`${label}: ${String(value)}`, margin + 5, yPosition);
      yPosition += fieldSpacing;
    }

    yPosition += sectionSpacing;
  }

  // Convert to Uint8Array
  const pdfOutput = doc.output('arraybuffer');
  return new Uint8Array(pdfOutput);
}

/**
 * Trigger PDF download in browser
 * @param pdfData - PDF data as Uint8Array
 * @param filename - Desired filename for download
 */
export function downloadPDF(pdfData: Uint8Array, filename: string): void {
  // Convert Uint8Array to ArrayBuffer for Blob compatibility
  const arrayBuffer = pdfData.buffer.slice(pdfData.byteOffset, pdfData.byteOffset + pdfData.byteLength) as ArrayBuffer;
  const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  
  // Cleanup
  URL.revokeObjectURL(url);
}

/**
 * Generate filename for PDF export
 * @param draft - Document draft
 * @returns Formatted filename
 */
export function generatePDFFilename(draft: DocumentDraft): string {
  const templateId = draft.templateId;
  const partNumber = draft.fields.partNumber || 'document';
  const timestamp = new Date().toISOString().split('T')[0];
  
  return `${templateId}-${partNumber}-${timestamp}.pdf`;
}
