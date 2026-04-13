/**
 * Ingestion Review Types — Phase 3H.31
 *
 * Models the analyze → review → commit contract.
 * No file with unresolved BLOCKING questions may enter the DB as committed truth.
 */

import type { DocumentExtractionEvidence } from '@/src/features/harness-work-instructions/types/extractionEvidence';

// ---------------------------------------------------------------------------
// Mode
// ---------------------------------------------------------------------------

/** Which upload path produced this item. */
export type IngestionMode = 'ADMIN_BATCH_WORKBENCH' | 'OPERATIONAL_UPLOAD';

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
  | 'SKU_LINK_UNCERTAIN';

export type IssueSeverity = 'BLOCKING' | 'WARNING';

export type FieldToResolve = 'documentType' | 'revision' | 'partNumber';

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

  analyzedAt: string;
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
  confirmationMode?: ConfirmationMode;

  /** questionId → operator answer string. */
  answers: Record<string, string>;

  commitResult?: {
    ok: boolean;
    sku?: { id: string; part_number: string };
    message?: string;
  };
}
