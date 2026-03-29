/**
 * Phase 28: PPAP Package Export and Submission Layer
 * 
 * Assembles complete PPAP submission packages with validation gating.
 */

import jsPDF from 'jspdf';
import { DocumentDraft, TemplateId } from '../templates/types';
import { getTemplate } from '../templates/registry';
import { DocumentMetadata, DocumentStatus } from '../persistence/sessionService';
import { getVersions, type DocumentVersion } from '../persistence/versionService';
import { generateDocumentId } from '../persistence/versionService';

// Required documents for complete PPAP package
const REQUIRED_DOCUMENTS: TemplateId[] = [
  'PSW',
  'PROCESS_FLOW',
  'PFMEA',
  'CONTROL_PLAN'
];

// Export order (PSW first, then process flow, PFMEA, control plan)
const EXPORT_ORDER: TemplateId[] = [
  'PSW',
  'PROCESS_FLOW',
  'PFMEA',
  'CONTROL_PLAN'
];

export type ExportEligibility = {
  isEligible: boolean;
  missingDocuments: TemplateId[];
  unapprovedDocuments: TemplateId[];
  invalidDocuments: TemplateId[];
  message: string;
};

export type ExportableDocument = {
  templateId: TemplateId;
  draft: DocumentDraft;
  metadata: DocumentMetadata;
  versionNumber: number;
};

/**
 * Check if session is eligible for PPAP package export
 */
export async function checkExportEligibility(
  sessionId: string,
  documents: Record<string, DocumentDraft>,
  documentMeta: Record<string, DocumentMetadata>,
  validationResults: Record<string, { isValid: boolean; errors: any[] }>
): Promise<ExportEligibility> {
  const missing: TemplateId[] = [];
  const unapproved: TemplateId[] = [];
  const invalid: TemplateId[] = [];

  for (const templateId of REQUIRED_DOCUMENTS) {
    // Check if document exists
    if (!documents[templateId]) {
      missing.push(templateId);
      continue;
    }

    // Check if document is approved
    const meta = documentMeta[templateId];
    if (!meta || meta.status !== 'approved') {
      unapproved.push(templateId);
    }

    // Check if document is valid
    const validation = validationResults[templateId];
    if (!validation || !validation.isValid) {
      invalid.push(templateId);
    }
  }

  const isEligible = missing.length === 0 && unapproved.length === 0 && invalid.length === 0;

  let message = '';
  if (!isEligible) {
    const issues: string[] = [];
    if (missing.length > 0) {
      issues.push(`Missing documents: ${missing.join(', ')}`);
    }
    if (unapproved.length > 0) {
      issues.push(`Unapproved documents: ${unapproved.join(', ')}`);
    }
    if (invalid.length > 0) {
      issues.push(`Invalid documents: ${invalid.join(', ')}`);
    }
    message = `PPAP package incomplete:\n${issues.join('\n')}`;
  } else {
    message = 'All documents ready for export';
  }

  return {
    isEligible,
    missingDocuments: missing,
    unapprovedDocuments: unapproved,
    invalidDocuments: invalid,
    message,
  };
}

/**
 * Get latest approved versions of all documents
 */
export async function getApprovedDocuments(
  sessionId: string,
  documents: Record<string, DocumentDraft>,
  documentMeta: Record<string, DocumentMetadata>
): Promise<ExportableDocument[]> {
  const exportableDocuments: ExportableDocument[] = [];

  for (const templateId of EXPORT_ORDER) {
    if (!documents[templateId]) continue;

    const meta = documentMeta[templateId];
    if (!meta || meta.status !== 'approved') continue;

    // Get latest approved version
    const docId = generateDocumentId(sessionId, templateId as TemplateId);
    const versions = await getVersions(docId);
    
    // Find latest approved version
    const approvedVersion = versions.find(v => v.isApproved);
    
    if (approvedVersion) {
      exportableDocuments.push({
        templateId: templateId as TemplateId,
        draft: approvedVersion.documentData,
        metadata: approvedVersion.metadata,
        versionNumber: approvedVersion.versionNumber,
      });
    }
  }

  return exportableDocuments;
}

/**
 * Generate combined PPAP package PDF
 */
export async function generatePackagePDF(
  documents: ExportableDocument[],
  sessionName: string
): Promise<Uint8Array> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

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

  // Cover page
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('PPAP Submission Package', pageWidth / 2, pageHeight / 3, { align: 'center' });
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text(sessionName, pageWidth / 2, pageHeight / 3 + 15, { align: 'center' });
  
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, pageHeight / 3 + 25, { align: 'center' });
  doc.text(`${documents.length} Documents Included`, pageWidth / 2, pageHeight / 3 + 35, { align: 'center' });

  // Document each included document
  for (const exportDoc of documents) {
    doc.addPage();
    yPosition = margin;

    const template = getTemplate(exportDoc.templateId);

    // Document title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(template.name, margin, yPosition);
    yPosition += lineHeight + sectionSpacing;

    // Approval information
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Approval Information', margin, yPosition);
    yPosition += lineHeight;

    doc.setFont('helvetica', 'normal');
    doc.text(`Version: ${exportDoc.versionNumber}`, margin + 5, yPosition);
    yPosition += fieldSpacing;
    doc.text(`Status: Approved`, margin + 5, yPosition);
    yPosition += fieldSpacing;
    if (exportDoc.metadata.approvedByName) {
      doc.text(`Approved By: ${exportDoc.metadata.approvedByName}`, margin + 5, yPosition);
      yPosition += fieldSpacing;
    }
    if (exportDoc.metadata.approvedAt) {
      const approvedDate = new Date(exportDoc.metadata.approvedAt).toLocaleString();
      doc.text(`Approved At: ${approvedDate}`, margin + 5, yPosition);
      yPosition += fieldSpacing;
    }
    if (exportDoc.metadata.ownerName) {
      doc.text(`Document Owner: ${exportDoc.metadata.ownerName}`, margin + 5, yPosition);
      yPosition += fieldSpacing;
    }
    yPosition += sectionSpacing;

    // Metadata section
    doc.setFont('helvetica', 'bold');
    checkPageBreak(lineHeight);
    doc.text('Document Metadata', margin, yPosition);
    yPosition += lineHeight;

    doc.setFont('helvetica', 'normal');
    Object.entries(exportDoc.draft.metadata).forEach(([key, value]) => {
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
        if (!(fieldKey in exportDoc.draft.fields)) continue;

        checkPageBreak(lineHeight);

        const value = exportDoc.draft.fields[fieldKey];
        const fieldDef = fieldDefinitions.find(def => def.key === fieldKey);
        const label = fieldDef?.label || fieldKey.replace(/([A-Z])/g, ' $1').trim();

        // Handle arrays (tables)
        if (Array.isArray(value)) {
          doc.setFont('helvetica', 'bold');
          doc.text(`${label}:`, margin + 5, yPosition);
          yPosition += fieldSpacing;
          doc.setFont('helvetica', 'normal');

          if (value.length === 0) {
            doc.text('(No entries)', margin + 10, yPosition);
            yPosition += fieldSpacing;
          } else {
            value.forEach((row: any, idx: number) => {
              checkPageBreak(lineHeight);
              doc.text(`  Row ${idx + 1}: ${JSON.stringify(row)}`, margin + 10, yPosition, { maxWidth: maxWidth - 15 });
              yPosition += fieldSpacing;
            });
          }
        } else {
          // Simple field
          const text = `${label}: ${String(value)}`;
          const lines = doc.splitTextToSize(text, maxWidth - 5);
          lines.forEach((line: string) => {
            checkPageBreak(lineHeight);
            doc.text(line, margin + 5, yPosition);
            yPosition += fieldSpacing;
          });
        }
      }

      yPosition += sectionSpacing;
    }
  }

  // Convert to Uint8Array
  const pdfOutput = doc.output('arraybuffer');
  return new Uint8Array(pdfOutput);
}

/**
 * Trigger package download
 */
export function downloadPackage(pdfData: Uint8Array, sessionName: string): void {
  const arrayBuffer = pdfData.buffer.slice(pdfData.byteOffset, pdfData.byteOffset + pdfData.byteLength) as ArrayBuffer;
  const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `PPAP-Package-${sessionName.replace(/\s+/g, '-')}-${timestamp}.pdf`;
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  
  URL.revokeObjectURL(url);
}
