'use client';

/**
 * Client-Only PDF Export Wrapper
 * 
 * This module enforces strict client-side boundary for PDF generation.
 * It prevents pdfGenerator.ts and its dependencies (jspdf, fflate) from
 * being included in the SSR bundle.
 * 
 * Architecture: Export Layer - Client Boundary
 */

import { DocumentDraft, TemplateId } from '../templates/types';

/**
 * Generate and download PDF document
 * 
 * This function dynamically imports PDF generation logic to ensure
 * it only loads on the client side, never during SSR.
 * 
 * @param draft - The editable document draft to export
 * @param templateId - Template identifier for retrieving template definition
 */
export async function generateAndDownloadPDF(
  draft: DocumentDraft,
  templateId: TemplateId
): Promise<void> {
  // Dynamic imports to prevent SSR bundling
  const { generatePDF } = await import('./pdfGenerator');
  const { getTemplate } = await import('../templates/registry');

  const template = getTemplate(templateId);
  const pdfBytes = await generatePDF(draft, template);

  // Create blob and trigger download
  const arrayBuffer = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer;
  const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${templateId}-${draft.fields.partNumber || 'document'}.pdf`;
  a.click();

  // Cleanup
  URL.revokeObjectURL(url);
}
