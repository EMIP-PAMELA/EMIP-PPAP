/**
 * Phase 43: System Validation & Confidence Layer
 * 
 * Provides system-level completeness and readiness checks.
 * Enables users to understand overall system state and confidence.
 * 
 * All checks are read-only - no mutations to existing validation/risk logic.
 */

import { TemplateId, DocumentDraft } from '../templates/types';
import { ValidationResult } from '../validation/types';
import { DocumentMetadata } from '../persistence/sessionService';
import { MappingMetadata } from '../templates/templateMappingService';

/**
 * System readiness status
 */
export type ReadinessStatus = 'ready' | 'needs_attention' | 'not_ready';

/**
 * Complete system status assessment
 */
export interface SystemStatus {
  allDocumentsGenerated: boolean;
  allDocumentsValid: boolean;
  allDocumentsApproved: boolean;
  readyForSubmission: boolean;
  readinessStatus: ReadinessStatus;
  missingDocuments: TemplateId[];
  invalidDocuments: TemplateId[];
  unapprovedDocuments: TemplateId[];
}

/**
 * Document trace information
 */
export interface DocumentTrace {
  templateId: TemplateId;
  source: 'BOM' | 'Process Flow' | 'PFMEA' | 'Unknown';
  mappingCoverage: number;  // Percentage (0-100)
  validationErrorCount: number;
  isValid: boolean;
  isApproved: boolean;
}

/**
 * System check result
 */
export interface SystemCheckResult {
  status: SystemStatus;
  traces: DocumentTrace[];
  summary: {
    totalDocuments: number;
    generatedDocuments: number;
    validDocuments: number;
    approvedDocuments: number;
    totalValidationErrors: number;
  };
}

/**
 * Standard workflow template order
 */
const WORKFLOW_ORDER: TemplateId[] = [
  'processFlow',
  'pfmea',
  'controlPlan',
  'workInstructions',
  'inspectionPlan'
];

/**
 * Check overall system completeness and readiness
 */
export function checkSystemCompleteness(
  documents: Record<TemplateId, DocumentDraft>,
  validationResults: Record<TemplateId, ValidationResult>,
  documentMeta: Record<TemplateId, DocumentMetadata>,
  expectedTemplates: TemplateId[] = WORKFLOW_ORDER
): SystemStatus {
  const missingDocuments: TemplateId[] = [];
  const invalidDocuments: TemplateId[] = [];
  const unapprovedDocuments: TemplateId[] = [];

  for (const templateId of expectedTemplates) {
    // Check if document exists
    if (!documents[templateId]) {
      missingDocuments.push(templateId);
      invalidDocuments.push(templateId);
      unapprovedDocuments.push(templateId);
      continue;
    }

    // Check validation
    const validation = validationResults[templateId];
    if (!validation || !validation.isValid) {
      invalidDocuments.push(templateId);
    }

    // Check approval
    const meta = documentMeta[templateId];
    if (!meta || meta.status !== 'approved') {
      unapprovedDocuments.push(templateId);
    }
  }

  const allDocumentsGenerated = missingDocuments.length === 0;
  const allDocumentsValid = invalidDocuments.length === 0;
  const allDocumentsApproved = unapprovedDocuments.length === 0;
  const readyForSubmission = allDocumentsGenerated && allDocumentsValid && allDocumentsApproved;

  // Determine readiness status
  let readinessStatus: ReadinessStatus;
  if (readyForSubmission) {
    readinessStatus = 'ready';
  } else if (allDocumentsGenerated && allDocumentsValid) {
    readinessStatus = 'needs_attention'; // Just needs approval
  } else {
    readinessStatus = 'not_ready';
  }

  return {
    allDocumentsGenerated,
    allDocumentsValid,
    allDocumentsApproved,
    readyForSubmission,
    readinessStatus,
    missingDocuments,
    invalidDocuments,
    unapprovedDocuments
  };
}

/**
 * Get document source based on template ID
 */
function getDocumentSource(templateId: TemplateId): 'BOM' | 'Process Flow' | 'PFMEA' | 'Unknown' {
  switch (templateId) {
    case 'processFlow':
      return 'BOM';
    case 'pfmea':
      return 'Process Flow';
    case 'controlPlan':
      return 'PFMEA';
    default:
      return 'Unknown';
  }
}

/**
 * Calculate mapping coverage percentage
 */
function calculateMappingCoverage(
  document: DocumentDraft,
  mappingMeta?: MappingMetadata
): number {
  if (!mappingMeta) {
    // No mapping metadata available, assume manual entry
    return 0;
  }

  const totalFields = Object.keys(mappingMeta).length;
  if (totalFields === 0) {
    return 0;
  }

  const successfulMappings = Object.values(mappingMeta).filter(meta => meta.success).length;
  return Math.round((successfulMappings / totalFields) * 100);
}

/**
 * Get trace information for a document
 */
export function getDocumentTrace(
  templateId: TemplateId,
  document: DocumentDraft | undefined,
  validationResult: ValidationResult | undefined,
  documentMeta: DocumentMetadata | undefined,
  mappingMeta?: MappingMetadata
): DocumentTrace {
  const source = getDocumentSource(templateId);
  const mappingCoverage = document && mappingMeta 
    ? calculateMappingCoverage(document, mappingMeta)
    : 0;
  const validationErrorCount = validationResult?.errors?.length || 0;
  const isValid = validationResult?.isValid || false;
  const isApproved = documentMeta?.status === 'approved';

  return {
    templateId,
    source,
    mappingCoverage,
    validationErrorCount,
    isValid,
    isApproved
  };
}

/**
 * Run complete system check
 */
export function runSystemCheck(
  documents: Record<TemplateId, DocumentDraft>,
  validationResults: Record<TemplateId, ValidationResult>,
  documentMeta: Record<TemplateId, DocumentMetadata>,
  mappingMetadata?: Record<TemplateId, MappingMetadata>,
  expectedTemplates: TemplateId[] = WORKFLOW_ORDER
): SystemCheckResult {
  const status = checkSystemCompleteness(
    documents,
    validationResults,
    documentMeta,
    expectedTemplates
  );

  const traces: DocumentTrace[] = expectedTemplates.map(templateId =>
    getDocumentTrace(
      templateId,
      documents[templateId],
      validationResults[templateId],
      documentMeta[templateId],
      mappingMetadata?.[templateId]
    )
  );

  const totalDocuments = expectedTemplates.length;
  const generatedDocuments = totalDocuments - status.missingDocuments.length;
  const validDocuments = totalDocuments - status.invalidDocuments.length;
  const approvedDocuments = totalDocuments - status.unapprovedDocuments.length;
  const totalValidationErrors = traces.reduce(
    (sum, trace) => sum + trace.validationErrorCount,
    0
  );

  return {
    status,
    traces,
    summary: {
      totalDocuments,
      generatedDocuments,
      validDocuments,
      approvedDocuments,
      totalValidationErrors
    }
  };
}

/**
 * Get readiness display information
 */
export function getReadinessDisplay(status: ReadinessStatus): {
  icon: string;
  label: string;
  color: string;
  bgColor: string;
} {
  switch (status) {
    case 'ready':
      return {
        icon: '🟢',
        label: 'Ready for Submission',
        color: 'text-green-700',
        bgColor: 'bg-green-50 border-green-200'
      };
    case 'needs_attention':
      return {
        icon: '🟡',
        label: 'Needs Attention',
        color: 'text-yellow-700',
        bgColor: 'bg-yellow-50 border-yellow-200'
      };
    case 'not_ready':
      return {
        icon: '🔴',
        label: 'Not Ready',
        color: 'text-red-700',
        bgColor: 'bg-red-50 border-red-200'
      };
  }
}
