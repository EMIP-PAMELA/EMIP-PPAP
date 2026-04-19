/**
 * Ingestion Review Types — Phase 3H.31
 *
 * Models the analyze → review → commit contract.
 * No file with unresolved BLOCKING questions may enter the DB as committed truth.
 */

import type { DocumentExtractionEvidence } from '@/src/features/harness-work-instructions/types/extractionEvidence';
import type { DocumentType } from '@/src/features/harness-work-instructions/services/skuService';
import type { EndpointTerminationType } from '@/src/features/harness-work-instructions/services/harnessConnectivityService';
import type { ComponentAuthorityOption } from '@/src/features/harness-work-instructions/services/componentAuthorityService';

// ---------------------------------------------------------------------------
// Mode
// ---------------------------------------------------------------------------

/** Which upload path produced this item. */
export type IngestionMode = 'ADMIN_BATCH_WORKBENCH' | 'OPERATIONAL_UPLOAD';

export type ConfirmableDocumentType = Exclude<DocumentType, 'UNKNOWN'>;

export type RequiredFieldKey = 'documentType' | 'partNumber' | 'revision' | 'drawingNumber';

export const REQUIRED_FIELDS: Record<ConfirmableDocumentType, RequiredFieldKey[]> = {
  BOM: ['partNumber', 'revision'],
  CUSTOMER_DRAWING: ['partNumber', 'revision'],
  INTERNAL_DRAWING: ['partNumber', 'revision', 'drawingNumber'],
};

export function docTypeRequiresField(docType: DocumentType | string | null | undefined, field: RequiredFieldKey): boolean {
  if (!docType || docType === 'UNKNOWN') return false;
  const required = REQUIRED_FIELDS[docType as ConfirmableDocumentType];
  return Boolean(required?.includes(field));
}

/** How a commit was authorized. Persisted in extraction_evidence. */
export type ConfirmationMode = 'AUTO_VERIFIED' | 'USER_CONFIRMED' | 'ADMIN_CONFIRMED';

// ---------------------------------------------------------------------------
// Unresolved Questions
// ---------------------------------------------------------------------------

export type IssueCode =
  | 'REVISION_MISSING'
  | 'DOC_TYPE_UNCERTAIN'
  | 'PART_NUMBER_UNCERTAIN'
  | 'SIGNAL_CONFLICT'
  | 'REVISION_CONFLICT'
  | 'SKU_LINK_UNCERTAIN'
  | 'DRAWING_NUMBER_MISSING';

export type IssueSeverity = 'BLOCKING' | 'WARNING';

export type FieldToResolve = 'documentType' | 'revision' | 'partNumber' | 'drawingNumber';

export interface UnresolvedQuestion {
  id: string;
  issueCode: IssueCode;
  severity: IssueSeverity;
  /** When true, this question must be answered before commit is permitted. */
  blocksCommit: boolean;
  promptText: string;
  /** Heuristic-suggested value; null if none available. Labelled "Suggested by extraction". */
  suggestedValue: string | null;
  fieldToResolve: FieldToResolve;
}

// ---------------------------------------------------------------------------
// T11: Operator Wire Override Types
// ---------------------------------------------------------------------------

export type WireResolutionMode =
  | 'DIRECT_OVERRIDE'
  | 'BRANCH_DOUBLE_CRIMP'
  | 'GROUND'
  | 'SPLICE'
  | 'FLOATING';

export type OperatorResolutionMode = 'CANONICAL_SELECTION' | 'MANUAL_OVERRIDE';

export interface WireOperatorOverride {
  wireId: string;
  mode: WireResolutionMode;
  from?: { component?: string | null; cavity?: string | null; treatment?: string | null; terminationType?: EndpointTerminationType | null };
  to?: { component?: string | null; cavity?: string | null; treatment?: string | null; terminationType?: EndpointTerminationType | null };
  branch?: {
    sharedSourceComponent?: string | null;
    sharedSourceCavity?: string | null;
    secondaryCavity?: string | null;
    ferrulePartNumber?: string | null;
    terminalPartNumber?: string | null;
    notes?: string | null;
  };
  reason: string;
  operatorConfirmed: true;
  appliedAt: string;
  resolutionMode?: OperatorResolutionMode;
}

// ---------------------------------------------------------------------------
// Analysis Result (server → client, serializable)
// ---------------------------------------------------------------------------

export interface IngestionAnalysisResult {
  fileName: string;
  fileSize: number;

  proposedDocumentType: 'BOM' | 'CUSTOMER_DRAWING' | 'INTERNAL_DRAWING' | 'UNKNOWN';
  /** 0–1. Low confidence triggers DOC_TYPE_UNCERTAIN question. */
  docTypeConfidence: number;
  /** Signal strings from detectDocumentType. */
  docTypeSignals: string[];

  proposedPartNumber: string | null;
  /** True when part number could not be resolved — provisional PENDING- would be used. */
  partNumberIsProvisional: boolean;
  partNumberConfidence: number;

  proposedRevision: string | null;
  revisionConfidence: number;
  /** Extraction path that produced proposedRevision. */
  revisionSource: string | null;

  proposedDrawingNumber: string | null;

  extractionEvidence: DocumentExtractionEvidence;

  unresolvedQuestions: UnresolvedQuestion[];
  /** True when zero BLOCKING questions remain — safe to commit without user input. */
  readyToCommit: boolean;

  /** Phase 3H.43.X: Structured drawing data from domain-specific parser (e.g. RheemDrawingModel). */
  structuredData?: Record<string, unknown> | null;

  /** Phase 3H.50 C12: Region-aware title block + revision extraction result. */
  titleBlockRegionResult?: import('@/src/features/harness-work-instructions/services/titleBlockRegionExtractor').TitleBlockExtractionResult | null;

  /** Phase 3H.51 C13: Universal AI vision parse result (structured drawing model). */
  visionParsedResult?: import('@/src/features/harness-work-instructions/services/aiDrawingVisionService').VisionParsedDrawingResult | null;

  /** Phase 3H.52 C12.2: crop-based extraction result (coordinate-filtered OCR + AI vision on title block image). */
  titleBlockCropResult?: {
    ocrCropPartNumber:       string | null;
    visionCropPartNumber:    string | null;
    visionCropDrawingNumber: string | null;
    visionCropRevision:      string | null;
    confidence:              number;
  } | null;

  /**
   * Phase T1: Wire/connectivity table detection and structured row capture.
   * INTERMEDIATE DATA — not authoritative. Does not affect field resolution.
   * Available for downstream topology and BOM correlation phases.
   */
  wireTableResult?: {
    region: { x: number; y: number; w: number; h: number } | null;
    confidence: number;
    rows: import('@/src/features/harness-work-instructions/services/wireTableParser').WireRow[];
    rowCount: number;
    parseQuality: 'GOOD' | 'PARTIAL' | 'POOR';
    headerText: string | null;
    inferredLengthUnit: import('@/src/features/harness-work-instructions/services/unitInferenceService').LengthUnit;
    unitInferenceReason: import('@/src/features/harness-work-instructions/services/unitInferenceService').UnitInferenceReason;
  } | null;

  /**
   * Phase T2: Harness Connectivity BOM — normalized from/to endpoint model.
   * INTERMEDIATE DATA — not authoritative. Does not affect field resolution.
   * Ambiguous wires are explicitly flagged; forced mappings are forbidden.
   */
  harnessConnectivity?: import('@/src/features/harness-work-instructions/services/harnessConnectivityService').HarnessConnectivityResult | null;

  /**
   * Phase T4: Connector and callout extraction from the diagram region.
   * INTERMEDIATE DATA — not authoritative. Does not affect field resolution.
   * Components and callouts are signals for future reconciliation with HC-BOM.
   */
  diagramExtraction?: import('@/src/features/harness-work-instructions/services/diagramExtractor').DiagramExtractionResult | null;

  /**
   * Phase T5: HC-BOM ↔ diagram reconciliation layer.
   * INTERMEDIATE DATA — not authoritative. Does not affect field resolution.
   * Maps HC-BOM endpoint labels to diagram ComponentNodes with match quality.
   */
  harnessReconciliation?: import('@/src/features/harness-work-instructions/services/harnessReconciliationService').HarnessReconciliationResult | null;

  /** T23.6.70: Canonical dropdown options sourced from Simplified BOM projection. */
  canonicalComponentOptions?: ComponentAuthorityOption[] | null;
  canonicalComponentOptionsSource?: 'SIMPLIFIED_BOM' | 'DOCUMENT_ENGINE' | 'OPERATOR_SEEDED' | string | null;

  /**
   * Phase T7: Harness physical plausibility validation.
   * INTERMEDIATE DATA — not authoritative. Does not affect field resolution.
   * Advisory WARNING/ERROR flags for invalid or suspicious wire configurations.
   */
  harnessValidation?: import('@/src/features/harness-work-instructions/services/harnessValidationService').HarnessValidationResult | null;

  /**
   * Phase T8: Constraint-aware confidence adjustment.
   * INTERMEDIATE DATA — not authoritative. Does not affect field resolution.
   * Adjusted endpoint confidence scores with explainable penalty reasoning.
   */
  harnessConfidence?: import('@/src/features/harness-work-instructions/services/harnessConfidenceService').HarnessConfidenceResult | null;

  /**
   * Phase T9: Operator decision layer + PPAP readiness engine.
   * INTERMEDIATE DATA — not authoritative. Does not affect field resolution.
   * Wire-level SAFE/REVIEW/BLOCKED decisions with full audit trail and readiness score.
   */
  harnessDecision?: import('@/src/features/harness-work-instructions/services/harnessDecisionService').HarnessDecisionResult | null;

  /** T11: Operator wire overrides applied in this session (session-local, not persisted). */
  wireOperatorOverrides?: WireOperatorOverride[];
  /** T11: HC-BOM after operator overrides applied. */
  resolvedHarnessConnectivity?: import('@/src/features/harness-work-instructions/services/harnessConnectivityService').HarnessConnectivityResult | null;
  /** T11: Validation result after overrides. */
  resolvedHarnessValidation?: import('@/src/features/harness-work-instructions/services/harnessValidationService').HarnessValidationResult | null;
  /** T11: Confidence result after overrides. */
  resolvedHarnessConfidence?: import('@/src/features/harness-work-instructions/services/harnessConfidenceService').HarnessConfidenceResult | null;
  /** T11: Decision result after overrides. */
  resolvedHarnessDecision?: import('@/src/features/harness-work-instructions/services/harnessDecisionService').HarnessDecisionResult | null;

  analyzedAt: string;

  /**
   * C12.4-R10: Runtime diagnostics for Vercel/local parity auditing.
   * Visible in Raw Extraction Debug panel. Temporary — remove after parity confirmed.
   */
  debugRuntime?: {
    buildTag: string;
    routeRuntime: string;
    fallbackEligible: boolean;
    fallbackLinesPresent: boolean;
    fallbackCropPresent: boolean;
    enteredC124Fallback: boolean;
    enteredVisionFallback: boolean;
    visionProviderConfigured: boolean;
    visionCallAttempted: boolean;
    visionCallSucceeded: boolean;
    visionErrorCode: string | null;
    visionErrorMessage: string | null;
    visionErrorStatus: number | null;
    visionErrorType: string | null;
    visionRequestSummary: {
      model: string;
      hasImage: boolean;
      imageBytesApprox: number;
      mimeType: string | null;
    } | null;
    vercelEnv: string | null;
    nodeEnv: string | null;
    vercelUrl: string | null;
    anthropicKeyPresent: boolean;
    anthropicKeyLength: number;
    anthropicKeyTrimmedLength: number;
    anthropicKeyHasWhitespaceDifference: boolean;
    anthropicKeyPrefix: string | null;
    clientTriggerDebug: Record<string, unknown> | null;
    inferredLengthUnit?: import('@/src/features/harness-work-instructions/services/unitInferenceService').LengthUnit | null;
    unitInferenceReason?: import('@/src/features/harness-work-instructions/services/unitInferenceService').UnitInferenceReason | null;
  } | null;
}

// ---------------------------------------------------------------------------
// Workbench Item (client-side transient state; not persisted)
// ---------------------------------------------------------------------------

export type WorkbenchItemStatus =
  | 'queued'
  | 'extracting'
  | 'analyzing'
  | 'ready_to_commit'
  | 'needs_review'
  | 'committing'
  | 'committed'
  | 'failed';

export interface WorkbenchItem {
  id: string;
  file: File;
  status: WorkbenchItemStatus;
  error?: string;
  extractedText?: string;
  analysis?: IngestionAnalysisResult;

  /** Values confirmed by operator (override proposals from analysis). */
  confirmedDocumentType?: 'BOM' | 'CUSTOMER_DRAWING' | 'INTERNAL_DRAWING';
  confirmedPartNumber?: string;
  confirmedRevision?: string;
  confirmedDrawingNumber?: string;
  confirmationMode?: ConfirmationMode;

  /**
   * Tracks which fields the operator has explicitly confirmed (vs auto-populated from analysis).
   * Used to label fields as "Suggested" or "Confirmed" in the UI.
   */
  operatorConfirmed?: Partial<Record<'documentType' | 'partNumber' | 'revision' | 'drawingNumber', boolean>>;

  /** questionId → operator answer string. */
  answers: Record<string, string>;

  commitResult?: {
    ok: boolean;
    sku?: { id: string; part_number: string };
    message?: string;
  };
  /** T11: Operator wire resolution overrides — session-local, not persisted. */
  wireOperatorOverrides?: WireOperatorOverride[];
}
