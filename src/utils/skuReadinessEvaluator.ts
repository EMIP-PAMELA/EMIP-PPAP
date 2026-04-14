import type { CrossSourceRevisionStatus, CrossSourceValidationResult } from './revisionCrossValidator';
import type { RevisionState } from './revisionEvaluator';

type DocumentType = 'BOM' | 'CUSTOMER_DRAWING' | 'INTERNAL_DRAWING' | 'UNKNOWN';

type DocumentClassificationStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'RESOLVED'
  | 'PARTIAL'
  | 'PARTIAL_MISMATCH'
  | 'NEEDS_REVIEW';

export type ReadinessStatus =
  | 'READY'
  | 'READY_LOW_CONFIDENCE'
  | 'NEEDS_REVIEW'
  | 'PARTIAL'
  | 'BLOCKED';

export type ReadinessTier = 'READY' | 'READY_WITH_WARNINGS' | 'INCOMPLETE' | 'BLOCKED';

export interface ReadinessIssue {
  code: string;
  severity: 'warning' | 'critical';
  message: string;
  source?: string;
}

export interface ConfidenceFactor {
  code: string;
  impact: number;
  description: string;
}

export interface OutputReadiness {
  status: ReadinessStatus;
  blockers: string[];
  warnings: string[];
  recommended_action: string;
  revision_gate_status?: CrossSourceRevisionStatus | null;
  revision_gate_reason?: string | null;
  revision_canonical_source?: string | null;
  revision_canonical_revision?: string | null;
}

export interface SKUReadinessResult {
  overall_status: ReadinessStatus;
  work_instructions: OutputReadiness;
  traveler_package: OutputReadiness;
  komax_cut_sheet: OutputReadiness;
  summary: string[];
  readiness_tier: ReadinessTier;
  issues: ReadinessIssue[];
  confidence_score: number;
  confidence_factors: ConfidenceFactor[];
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
  revisionRiskSignals?: Array<{ signal_type: string }> | null;
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
  options?: {
    revisionStatus?: CrossSourceRevisionStatus | null;
    revisionReason?: string | null;
    revisionAction?: string | null;
    canonicalRevision?: string | null;
    canonicalSource?: string | null;
  },
): OutputReadiness {
  let status: ReadinessStatus = 'READY';
  if (blockers.length > 0) {
    status = 'BLOCKED';
  } else if (warnings.length > 0) {
    status = 'PARTIAL';
  }

  const recommendedSource = blockers.length > 0 ? blockers : warnings;
  const recommended_action =
    status === 'READY'
      ? fallback
      : options?.revisionAction ?? recommendedSource[0]?.action ?? fallback;

  return {
    status,
    blockers: blockers.map(issue => issue.message),
    warnings: warnings.map(issue => issue.message),
    recommended_action,
    revision_gate_status: options?.revisionStatus ?? null,
    revision_gate_reason: options?.revisionReason ?? null,
    revision_canonical_source: options?.canonicalSource ?? null,
    revision_canonical_revision: options?.canonicalRevision ?? null,
  };
}

function revisionStatusToIssue(status: CrossSourceRevisionStatus | null): IssueCode | null {
  switch (status) {
    case 'CONFLICT':
      return 'REVISION_CONFLICT';
    case 'INCOMPARABLE':
      return 'REVISION_INCOMPARABLE';
    case 'OUT_OF_SYNC':
      return 'REVISION_OUT_OF_SYNC';
    case 'INCOMPLETE':
      return 'REVISION_INCOMPLETE';
    default:
      return null;
  }
}

function applyRevisionGate(
  revisionStatus: CrossSourceRevisionStatus,
  blockers: IssueDetail[],
  warnings: IssueDetail[],
  options: {
    blockStatuses: CrossSourceRevisionStatus[];
    warnStatuses: CrossSourceRevisionStatus[];
  },
): string | null {
  const issueCode = revisionStatusToIssue(revisionStatus);
  if (!issueCode) return null;

  if (options.blockStatuses.includes(revisionStatus)) {
    addIssue(blockers, issueCode);
    return ISSUE_MESSAGES[issueCode];
  }

  if (options.warnStatuses.includes(revisionStatus)) {
    addIssue(warnings, issueCode);
    return ISSUE_MESSAGES[issueCode];
  }

  return null;
}

interface TierParams {
  revisionStatus: CrossSourceRevisionStatus;
  hasBOM: boolean;
  hasCustomerDrawing: boolean;
  hasApogeeDrawing: boolean;
  hasTrustedBOM: boolean;
  hasTrustedDrawing: boolean;
}

function buildReadinessIssues(p: TierParams): ReadinessIssue[] {
  const issues: ReadinessIssue[] = [];

  if (p.revisionStatus === 'CONFLICT') {
    issues.push({ code: 'REVISION_CONFLICT', severity: 'critical', message: 'Revision mismatch between sources' });
  }
  if (p.revisionStatus === 'OUT_OF_SYNC') {
    issues.push({ code: 'REVISION_OUT_OF_SYNC', severity: 'critical', message: 'BOM and drawing revisions do not match' });
  }
  if (!p.hasBOM) {
    issues.push({ code: 'MISSING_BOM', severity: 'warning', message: 'BOM document is missing — required for all outputs' });
  }
  if (!p.hasCustomerDrawing) {
    issues.push({ code: 'MISSING_CUSTOMER_DRAWING', severity: 'warning', message: 'Customer drawing is missing — required early in lifecycle' });
  }
  if (!p.hasApogeeDrawing) {
    issues.push({ code: 'MISSING_APOGEE_DRAWING', severity: 'warning', message: 'Internal Apogee drawing not yet created' });
  }
  if (p.hasBOM && !p.hasTrustedBOM) {
    issues.push({ code: 'UNTRUSTED_BOM', severity: 'warning', message: 'BOM classification is not fully trusted' });
  }
  if ((p.hasCustomerDrawing || p.hasApogeeDrawing) && !p.hasTrustedDrawing) {
    issues.push({ code: 'UNTRUSTED_DRAWING', severity: 'warning', message: 'Drawing classification requires review' });
  }
  if (p.revisionStatus === 'INCOMPLETE') {
    issues.push({ code: 'REVISION_INCOMPLETE', severity: 'warning', message: 'Revision data is incomplete — add missing revision sources' });
  }
  if (p.revisionStatus === 'INCOMPARABLE') {
    issues.push({ code: 'REVISION_INCOMPARABLE', severity: 'warning', message: 'Revisions cannot be compared — normalize formats' });
  }

  return issues;
}

function deriveReadinessTier(p: TierParams): ReadinessTier {
  if (p.revisionStatus === 'CONFLICT' || p.revisionStatus === 'OUT_OF_SYNC') {
    return 'BLOCKED';
  }
  if (!p.hasBOM || !p.hasCustomerDrawing || p.revisionStatus === 'INCOMPLETE') {
    return 'INCOMPLETE';
  }
  if (!p.hasApogeeDrawing || !p.hasTrustedBOM || !p.hasTrustedDrawing || p.revisionStatus === 'INCOMPARABLE') {
    return 'READY_WITH_WARNINGS';
  }
  return 'READY';
}

function computeConfidenceScore(
  p: TierParams,
  revisionValidation: CrossSourceValidationResult,
  riskSignals?: Array<{ signal_type: string }> | null,
): { score: number; factors: ConfidenceFactor[] } {
  let score = 100;
  const factors: ConfidenceFactor[] = [];

  const deduct = (code: string, impact: number, description: string) => {
    score += impact;
    factors.push({ code, impact, description });
  };

  if (p.revisionStatus === 'CONFLICT') {
    deduct('REVISION_CONFLICT', -60, 'Cross-source revision conflict detected');
  } else if (p.revisionStatus === 'OUT_OF_SYNC') {
    deduct('REVISION_OUT_OF_SYNC', -40, 'BOM and drawing revisions do not match');
  } else if (p.revisionStatus === 'INCOMPARABLE') {
    deduct('REVISION_INCOMPARABLE', -25, 'Revision formats cannot be compared');
  }

  if (!p.hasBOM) {
    deduct('MISSING_BOM', -50, 'BOM document is missing');
  }
  if (!p.hasCustomerDrawing) {
    deduct('MISSING_CUSTOMER_DRAWING', -25, 'Customer drawing not present');
  }
  if (!p.hasApogeeDrawing) {
    deduct('MISSING_APOGEE_DRAWING', -10, 'Internal Apogee drawing not created');
  }

  const signalsUsed = revisionValidation.signals_used ?? [];
  if (signalsUsed.includes('TEXT')) {
    deduct('WEAK_SIGNAL_TEXT', -10, 'Revision detected via text scan only');
  }
  if (signalsUsed.includes('UNKNOWN')) {
    deduct('WEAK_SIGNAL_UNKNOWN', -20, 'Revision source could not be determined');
  }

  if (riskSignals?.length) {
    const applied = new Set<string>();
    for (const signal of riskSignals) {
      const st = signal.signal_type;
      if (!applied.has(st)) {
        if (st === 'REPEATED_OVERRIDE') {
          deduct('RISK_REPEATED_OVERRIDE', -10, 'Historical repeated override detected');
          applied.add(st);
        } else if (st === 'FREQUENT_CONFLICT_UPLOADS') {
          deduct('RISK_FREQUENT_CONFLICT_UPLOADS', -15, 'History of frequent conflict uploads');
          applied.add(st);
        } else if (st === 'WEAK_REVISION_DETECTION') {
          deduct('RISK_WEAK_REVISION_DETECTION', -10, 'Weak historical revision detection signals');
          applied.add(st);
        }
      }
    }
  }

  factors.sort((a, b) => a.impact - b.impact);

  return {
    score: Math.max(0, Math.min(100, score)),
    factors,
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
  // Phase 3H.45 C1: Only flag MULTIPLE_DRAWINGS when revisions are not in consensus.
  // A customer + internal drawing pair sharing the same revision is valid, not a conflict.
  if (drawingDocs.length > 1 && revisionValidation.status !== 'SYNCHRONIZED') {
    addIssue(wiBlockers, 'MULTIPLE_DRAWINGS');
  }

  const wiRevisionReason = applyRevisionGate(revisionValidation.status, wiBlockers, wiWarnings, {
    blockStatuses: ['CONFLICT', 'INCOMPARABLE', 'INCOMPLETE'],
    warnStatuses: ['OUT_OF_SYNC'],
  });

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
    {
      revisionStatus: revisionValidation.status,
      revisionReason: wiRevisionReason,
      revisionAction: revisionValidation.recommended_action,
      canonicalRevision: revisionValidation.canonical_revision ?? revisionValidation.bom_revision ?? null,
      canonicalSource: revisionValidation.canonical_source ?? null,
    },
  );

  const travelerBlockers: IssueDetail[] = [];
  const travelerWarnings: IssueDetail[] = [];

  if (workInstructions.status === 'BLOCKED') {
    travelerBlockers.push(...wiBlockers);
  }

  if (!hasTrustedDrawing) {
    addIssue(travelerBlockers, 'DRAWING_NOT_TRUSTED');
  }
  const travelerRevisionReason = applyRevisionGate(revisionValidation.status, travelerBlockers, travelerWarnings, {
    blockStatuses: ['CONFLICT', 'INCOMPARABLE', 'OUT_OF_SYNC', 'INCOMPLETE'],
    warnStatuses: [],
  });
  if (drawingClassificationPending) {
    addIssue(travelerBlockers, 'DRAWING_CLASSIFICATION_PENDING');
  }

  const travelerPackage = compileReadiness(
    travelerBlockers,
    travelerWarnings,
    'Proceed to compile traveler package.',
    {
      revisionStatus: revisionValidation.status,
      revisionReason: travelerRevisionReason,
      revisionAction: revisionValidation.recommended_action,
      canonicalRevision: revisionValidation.canonical_revision ?? revisionValidation.bom_revision ?? null,
      canonicalSource: revisionValidation.canonical_source ?? null,
    },
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
  const komaxRevisionReason = applyRevisionGate(revisionValidation.status, komaxBlockers, komaxWarnings, {
    blockStatuses: ['CONFLICT', 'INCOMPARABLE', 'OUT_OF_SYNC', 'INCOMPLETE'],
    warnStatuses: [],
  });

  if (!hasTrustedBOM) {
    addIssue(komaxWarnings, 'INSUFFICIENT_BOM_STRUCTURE');
  }

  const komaxCutSheet = compileReadiness(
    komaxBlockers,
    komaxWarnings,
    'Proceed to Komax / cut-sheet preparation.',
    {
      revisionStatus: revisionValidation.status,
      revisionReason: komaxRevisionReason,
      revisionAction: revisionValidation.recommended_action,
      canonicalRevision: revisionValidation.canonical_revision ?? revisionValidation.bom_revision ?? null,
      canonicalSource: revisionValidation.canonical_source ?? null,
    },
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

  const hasCustomerDrawing = customerDrawings.length > 0;
  const hasApogeeDrawing = internalDrawings.length > 0;
  const tierParams: TierParams = {
    revisionStatus: revisionValidation.status,
    hasBOM,
    hasCustomerDrawing,
    hasApogeeDrawing,
    hasTrustedBOM,
    hasTrustedDrawing,
  };
  const readiness_tier = deriveReadinessTier(tierParams);
  const issues = buildReadinessIssues(tierParams);
  const { score: confidence_score, factors: confidence_factors } = computeConfidenceScore(
    tierParams,
    revisionValidation,
    input.revisionRiskSignals,
  );

  return {
    overall_status,
    work_instructions: workInstructions,
    traveler_package: travelerPackage,
    komax_cut_sheet: komaxCutSheet,
    summary,
    readiness_tier,
    issues,
    confidence_score,
    confidence_factors,
  };
}
