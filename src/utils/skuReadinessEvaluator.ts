import type { CrossSourceValidationResult } from './revisionCrossValidator';
import type { RevisionState } from './revisionEvaluator';

type DocumentType = 'BOM' | 'CUSTOMER_DRAWING' | 'INTERNAL_DRAWING' | 'UNKNOWN';

type DocumentClassificationStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'RESOLVED'
  | 'PARTIAL'
  | 'PARTIAL_MISMATCH'
  | 'NEEDS_REVIEW';

export type ReadinessStatus = 'READY' | 'PARTIAL' | 'BLOCKED';

export interface OutputReadiness {
  status: ReadinessStatus;
  blockers: string[];
  warnings: string[];
  recommended_action: string;
}

export interface SKUReadinessResult {
  overall_status: ReadinessStatus;
  work_instructions: OutputReadiness;
  traveler_package: OutputReadiness;
  komax_cut_sheet: OutputReadiness;
  summary: string[];
}

export interface ReadinessDocument {
  id: string;
  document_type: DocumentType;
  revision_state?: RevisionState;
  classification_status?: DocumentClassificationStatus;
  phantom_rev_flag?: boolean;
}

export interface SKUReadinessInput {
  documents: ReadinessDocument[];
  revisionValidation: CrossSourceValidationResult;
}

type IssueCode =
  | 'MISSING_BOM'
  | 'MISSING_DRAWING'
  | 'REVISION_CONFLICT'
  | 'REVISION_INCOMPARABLE'
  | 'REVISION_OUT_OF_SYNC'
  | 'REVISION_INCOMPLETE'
  | 'MULTIPLE_BOMS'
  | 'MULTIPLE_DRAWINGS'
  | 'UNTRUSTED_BOM'
  | 'UNTRUSTED_DRAWING'
  | 'BOM_CLASSIFICATION_PENDING'
  | 'DRAWING_CLASSIFICATION_PENDING'
  | 'DRAWING_NOT_TRUSTED'
  | 'INSUFFICIENT_BOM_STRUCTURE';

interface IssueDetail {
  code: IssueCode;
  message: string;
  action: string;
}

const ISSUE_MESSAGES: Record<IssueCode, string> = {
  MISSING_BOM: 'Missing current BOM document.',
  MISSING_DRAWING: 'Missing current drawing source.',
  REVISION_CONFLICT: 'Cross-source revisions are in conflict.',
  REVISION_INCOMPARABLE: 'Revisions cannot be compared — normalize formats.',
  REVISION_OUT_OF_SYNC: 'BOM and drawing revisions do not match.',
  REVISION_INCOMPLETE: 'Revision data is incomplete — add missing revisions.',
  MULTIPLE_BOMS: 'Multiple CURRENT BOMs detected — resolve duplication.',
  MULTIPLE_DRAWINGS: 'Multiple CURRENT drawings detected — resolve duplication.',
  UNTRUSTED_BOM: 'Current BOM classification is not trustworthy.',
  UNTRUSTED_DRAWING: 'Current drawing classification is not trustworthy.',
  BOM_CLASSIFICATION_PENDING: 'BOM classification pending — rerun or correct.',
  DRAWING_CLASSIFICATION_PENDING: 'Drawing classification pending — rerun or correct.',
  DRAWING_NOT_TRUSTED: 'Drawing requires manual review before use.',
  INSUFFICIENT_BOM_STRUCTURE: 'BOM is not fully structured for downstream cut-sheet generation.',
};

const ISSUE_ACTIONS: Record<IssueCode, string> = {
  MISSING_BOM: 'Upload a current BOM for this SKU.',
  MISSING_DRAWING: 'Upload a current drawing (customer or internal).',
  REVISION_CONFLICT: 'Resolve conflicting BOM/drawing revisions.',
  REVISION_INCOMPARABLE: 'Normalize revisions (e.g., convert to consistent format).',
  REVISION_OUT_OF_SYNC: 'Update the lagging source so revisions align.',
  REVISION_INCOMPLETE: 'Populate missing revision data for all sources.',
  MULTIPLE_BOMS: 'Mark the authoritative BOM and archive duplicates.',
  MULTIPLE_DRAWINGS: 'Mark the authoritative drawing and archive duplicates.',
  UNTRUSTED_BOM: 'Complete BOM classification to confirm structure.',
  UNTRUSTED_DRAWING: 'Complete drawing classification or manual review.',
  BOM_CLASSIFICATION_PENDING: 'Allow BOM classification to finish or rerun.',
  DRAWING_CLASSIFICATION_PENDING: 'Allow drawing classification to finish or rerun.',
  DRAWING_NOT_TRUSTED: 'Resolve drawing review blockers before use.',
  INSUFFICIENT_BOM_STRUCTURE: 'Enrich BOM structure for Komax/cut-sheet output.',
};

const trustedStatuses: DocumentClassificationStatus[] = ['RESOLVED', 'PARTIAL'];
const blockingStatuses: DocumentClassificationStatus[] = ['PENDING', 'PROCESSING', 'NEEDS_REVIEW'];

function isTrustedDocument(status?: DocumentClassificationStatus | null): boolean {
  if (!status) return false;
  return trustedStatuses.includes(status);
}

function isBlockingDocument(status?: DocumentClassificationStatus | null): boolean {
  if (!status) return true;
  return blockingStatuses.includes(status);
}

function addIssue(target: IssueDetail[], code: IssueCode, overrideMessage?: string) {
  target.push({
    code,
    message: overrideMessage ?? ISSUE_MESSAGES[code],
    action: ISSUE_ACTIONS[code],
  });
}

function compileReadiness(
  blockers: IssueDetail[],
  warnings: IssueDetail[],
  fallback: string,
): OutputReadiness {
  let status: ReadinessStatus = 'READY';
  if (blockers.length > 0) {
    status = 'BLOCKED';
  } else if (warnings.length > 0) {
    status = 'PARTIAL';
  }

  const recommendedSource = blockers.length > 0 ? blockers : warnings;
  const recommended_action =
    status === 'READY' ? fallback : recommendedSource[0]?.action ?? fallback;

  return {
    status,
    blockers: blockers.map(issue => issue.message),
    warnings: warnings.map(issue => issue.message),
    recommended_action,
  };
}

export function evaluateSKUReadiness(input: SKUReadinessInput): SKUReadinessResult {
  const { documents, revisionValidation } = input;
  const currentDocs = documents.filter(doc => doc.revision_state === 'CURRENT');
  const bomDocs = currentDocs.filter(doc => doc.document_type === 'BOM');
  const customerDrawings = currentDocs.filter(doc => doc.document_type === 'CUSTOMER_DRAWING');
  const internalDrawings = currentDocs.filter(doc => doc.document_type === 'INTERNAL_DRAWING');
  const drawingDocs = [...customerDrawings, ...internalDrawings];

  const hasBOM = bomDocs.length > 0;
  const hasDrawing = drawingDocs.length > 0;
  const hasTrustedBOM = bomDocs.some(doc => isTrustedDocument(doc.classification_status));
  const hasTrustedDrawing = drawingDocs.some(doc => isTrustedDocument(doc.classification_status));
  const bomClassificationPending = bomDocs.some(doc => isBlockingDocument(doc.classification_status));
  const drawingClassificationPending = drawingDocs.some(doc => isBlockingDocument(doc.classification_status));

  const wiBlockers: IssueDetail[] = [];
  const wiWarnings: IssueDetail[] = [];

  if (!hasBOM) {
    addIssue(wiBlockers, 'MISSING_BOM');
  }
  if (!hasDrawing) {
    addIssue(wiBlockers, 'MISSING_DRAWING');
  }

  if (bomDocs.length > 1) {
    addIssue(wiBlockers, 'MULTIPLE_BOMS');
  }
  if (drawingDocs.length > 1) {
    addIssue(wiBlockers, 'MULTIPLE_DRAWINGS');
  }

  if (revisionValidation.status === 'CONFLICT') {
    addIssue(wiBlockers, 'REVISION_CONFLICT');
  } else if (revisionValidation.status === 'INCOMPARABLE') {
    addIssue(wiBlockers, 'REVISION_INCOMPARABLE');
  } else if (revisionValidation.status === 'OUT_OF_SYNC') {
    addIssue(wiWarnings, 'REVISION_OUT_OF_SYNC');
  } else if (revisionValidation.status === 'INCOMPLETE') {
    addIssue(wiWarnings, 'REVISION_INCOMPLETE');
  }

  if (!hasTrustedBOM && hasBOM) {
    addIssue(wiWarnings, 'UNTRUSTED_BOM');
  }
  if (!hasTrustedDrawing && hasDrawing) {
    addIssue(wiWarnings, 'UNTRUSTED_DRAWING');
  }

  const workInstructions = compileReadiness(
    wiBlockers,
    wiWarnings,
    'Proceed to generate work instructions.',
  );

  const travelerBlockers: IssueDetail[] = [];
  const travelerWarnings: IssueDetail[] = [];

  if (workInstructions.status === 'BLOCKED') {
    travelerBlockers.push(...wiBlockers);
  }

  if (!hasTrustedDrawing) {
    addIssue(travelerBlockers, 'DRAWING_NOT_TRUSTED');
  }
  if (revisionValidation.status !== 'SYNCHRONIZED') {
    addIssue(travelerWarnings, 'REVISION_OUT_OF_SYNC');
  }
  if (drawingClassificationPending) {
    addIssue(travelerBlockers, 'DRAWING_CLASSIFICATION_PENDING');
  }

  const travelerPackage = compileReadiness(
    travelerBlockers,
    travelerWarnings,
    'Proceed to compile traveler package.',
  );

  const komaxBlockers: IssueDetail[] = [];
  const komaxWarnings: IssueDetail[] = [];

  if (!hasBOM) {
    addIssue(komaxBlockers, 'MISSING_BOM');
  }
  if (bomDocs.length > 1) {
    addIssue(komaxBlockers, 'MULTIPLE_BOMS');
  }
  if (!hasTrustedBOM && hasBOM) {
    addIssue(komaxBlockers, 'UNTRUSTED_BOM');
  }
  if (bomClassificationPending) {
    addIssue(komaxBlockers, 'BOM_CLASSIFICATION_PENDING');
  }
  if (revisionValidation.status === 'CONFLICT') {
    addIssue(komaxBlockers, 'REVISION_CONFLICT');
  } else if (revisionValidation.status === 'INCOMPARABLE') {
    addIssue(komaxBlockers, 'REVISION_INCOMPARABLE');
  } else if (revisionValidation.status !== 'SYNCHRONIZED') {
    addIssue(komaxWarnings, 'REVISION_OUT_OF_SYNC');
  }

  if (!hasTrustedBOM) {
    addIssue(komaxWarnings, 'INSUFFICIENT_BOM_STRUCTURE');
  }

  const komaxCutSheet = compileReadiness(
    komaxBlockers,
    komaxWarnings,
    'Proceed to Komax / cut-sheet preparation.',
  );

  let overall_status: ReadinessStatus = 'READY';
  if (
    workInstructions.status === 'BLOCKED' ||
    travelerPackage.status === 'BLOCKED' ||
    komaxCutSheet.status === 'BLOCKED'
  ) {
    overall_status = 'BLOCKED';
  } else if (
    workInstructions.status === 'PARTIAL' ||
    travelerPackage.status === 'PARTIAL' ||
    komaxCutSheet.status === 'PARTIAL'
  ) {
    overall_status = 'PARTIAL';
  }

  const summary = [
    `Work Instructions: ${workInstructions.status}`,
    `Traveler Package: ${travelerPackage.status}`,
    `Komax / Cut Sheet: ${komaxCutSheet.status}`,
  ];

  return {
    overall_status,
    work_instructions: workInstructions,
    traveler_package: travelerPackage,
    komax_cut_sheet: komaxCutSheet,
    summary,
  };
}
