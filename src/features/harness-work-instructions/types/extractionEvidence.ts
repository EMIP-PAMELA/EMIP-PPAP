/**
 * Extraction Evidence Types — Phase 3H.29
 *
 * Structured evidence produced during document ingestion.
 * Persisted to sku_documents.extraction_evidence (jsonb).
 *
 * Governance:
 *   - Evidence is captured once at ingestion time and never rewritten.
 *   - Fragments hold raw text regions — NOT extracted values.
 *   - Signals hold candidate values with source and confidence.
 *   - Document structure is structural layout analysis — NOT value extraction.
 *   - Resolved values mirror what was actually persisted in revision / drawing_number.
 */
import type { RegionOverlay } from './documentRegionOverlay';

// ---------------------------------------------------------------------------
// Field Extraction — a specific field value bound to a source region (Phase 3H.36)
// ---------------------------------------------------------------------------

/** How a FieldExtraction value was obtained. */
export type FieldExtractionSource = 'OCR' | 'HEURISTIC' | 'AI' | 'FILENAME' | 'USER';

/**
 * Links one extracted field (revision, part number, drawing number) to the
 * specific document region it came from, providing full traceability.
 */
export interface FieldExtraction {
  field: 'REVISION' | 'PART_NUMBER' | 'DRAWING_NUMBER';
  /** The extracted value, or null if extraction produced nothing. */
  value: string | null;
  confidence: number;
  /** ID of the RegionOverlay that yielded this value. Null = full-text fallback. */
  sourceRegionId: string | null;
  source: FieldExtractionSource;
  /** True when downstream systems must not override this value unless user edits. */
  locked?: boolean;
}

// ---------------------------------------------------------------------------
// Fragment — raw OCR or filename evidence
// ---------------------------------------------------------------------------

export type ExtractionFragmentSource = 'OCR_FULL' | 'OCR_TITLE_BLOCK' | 'FILENAME' | 'AI';

export interface ExtractionFragment {
  /** Which extraction pass produced this fragment. */
  source: ExtractionFragmentSource;
  /** The raw text region captured. Capped at 1 500 chars to keep JSONB manageable. */
  raw_text: string;
  /** Capture confidence: 1.0 for direct OCR/filename, lower for AI estimates. */
  confidence: number;
  /** Optional ancillary metadata (line count, char count, etc.). */
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Evidence Signal — a single candidate value with provenance
// ---------------------------------------------------------------------------

export interface EvidenceSignal {
  /** Which extraction pass produced this candidate. */
  source: string;
  /** The candidate value, or null if the pass produced no result. */
  value: string | null;
  /** Confidence in this specific candidate (0–1). */
  confidence: number;
  /** Region label (TITLE_BLOCK, REVISION, TABLE, FILENAME, etc.) that produced this value. */
  region_label?: RegionOverlay['label'] | 'FILENAME' | 'UNKNOWN';
  /** Optional reason describing why this signal was ignored downstream (wrong region, noise, etc.). */
  ignored_reason?: string | null;
  /** Priority bucket used during resolution (USER_CONFIRMED, FILENAME, TITLE_BLOCK_OCR, etc.). */
  priority_tag?: 'USER_CONFIRMED' | 'FILENAME' | 'TITLE_BLOCK_OCR' | 'AI_REGION' | 'HEURISTIC' | 'TABLE_TEXT';
}

export type ResolutionMode = 'SHORT_CIRCUIT' | 'RESOLVED' | 'USER_OVERRIDE';

export interface FieldResolutionAudit {
  field: 'REVISION' | 'DRAWING_NUMBER' | 'PART_NUMBER';
  resolution_mode: ResolutionMode;
  source: string | null;
  locked: boolean;
  short_circuit_applied: boolean;
  signals_considered: number;
  signals_discarded: number;
  enforcement_rules_applied: string[];
}

// ---------------------------------------------------------------------------
// Document Structure Analysis — structural layout, not extracted values
// ---------------------------------------------------------------------------

export type DocumentClassHint =
  | 'ENGINEERING_MASTER'
  | 'APOGEE_DRAWING'
  | 'RHEEM_DRAWING'
  | 'UNKNOWN';

export interface DocumentRegion {
  /** Human-readable label for the region type. */
  label: string;
  /** Detection confidence (0–1). */
  confidence: number;
  /** Approximate start line index within the scanned text. */
  line_start: number;
  /** Approximate end line index. */
  line_end: number;
  /** Keyword indicators that triggered detection. */
  indicators: string[];
}

export interface DocumentStructureAnalysis {
  /** Most likely document class based on pattern recognition. */
  document_class_hint: DocumentClassHint;
  /** True if a title block region was detected. */
  has_title_block: boolean;
  /** Detected title block region (null if not found). */
  title_block_region: DocumentRegion | null;
  /** True if connector/pin table patterns were detected. */
  has_connector_tables: boolean;
  /** Detected connector regions (may be empty). */
  connector_regions: DocumentRegion[];
  /** True if wire mapping / cut-sheet patterns were detected. */
  has_wire_mapping: boolean;
  /** Detected wire mapping regions (may be empty). */
  mapping_regions: DocumentRegion[];
  /** Optional normalized overlay regions merged from heuristic + AI passes. */
  regions?: RegionOverlay[];
  /** How this analysis was produced — 'HEURISTIC' until an AI model is wired in. */
  analyzed_by: 'HEURISTIC' | 'AI';
  analyzed_at: string;
}

// ---------------------------------------------------------------------------
// Evidence Bundle — everything captured for one document ingestion
// ---------------------------------------------------------------------------


export interface DocumentExtractionEvidence {
  /** Raw text fragments captured during ingestion. */
  fragments: ExtractionFragment[];
  /** All candidate revision values found, ordered by source priority. */
  revision_signals: EvidenceSignal[];
  /** All candidate drawing number values found. */
  drawing_number_signals: EvidenceSignal[];
  /** All candidate part number values considered after filtering. */
  part_number_signals?: EvidenceSignal[];
  /** Structural layout analysis (heuristic). */
  document_structure: DocumentStructureAnalysis | null;
  /** The revision value that was actually persisted to sku_documents.revision. */
  resolved_revision: string | null;
  /** The signal source that produced the resolved revision. */
  resolved_revision_source: string | null;
  /** The drawing number that was actually persisted to sku_documents.drawing_number. */
  resolved_drawing_number: string | null;
  /** The signal source that produced the resolved drawing number. */
  resolved_drawing_number_source: string | null;
  /** ISO timestamp of evidence capture. */
  captured_at: string;
  /**
   * Phase 3H.31: How this document's commit was authorized.
   * AUTO_VERIFIED  — all signals were high-confidence; system allowed auto-commit.
   * USER_CONFIRMED — operator confirmed values before commit (operational upload).
   * ADMIN_CONFIRMED — admin reviewed and approved in batch workbench.
   * null            — committed via legacy path (before Phase 3H.31).
   */
  confirmation_mode?: 'AUTO_VERIFIED' | 'USER_CONFIRMED' | 'ADMIN_CONFIRMED' | null;
  /** Phase 3H.33: Operator confirmation metadata. */
  confirmation_details?: {
    confirmed_by?: string | null;
    confirmed_at?: string | null;
    document_type?: string | null;
    part_number?: string | null;
    revision?: string | null;
    drawing_number?: string | null;
  } | null;
  /** Snapshot of original extraction suggestions prior to operator overrides. */
  original_suggestions?: {
    document_type?: string | null;
    part_number?: string | null;
    revision?: string | null;
    drawing_number?: string | null;
    doc_type_confidence?: number | null;
  } | null;
  /** Any unresolved questions present at the time of analysis (for audit trail). */
  original_unresolved_questions?: {
    id: string;
    issueCode: string;
    fieldToResolve?: string;
    blocksCommit: boolean;
  }[];
  /**
   * Phase 3H.36: Field-to-region bindings for fully traceable extraction.
   * Every extracted field is linked to the document region it was derived from.
   */
  field_extractions?: FieldExtraction[];
  /** Signals that were discarded (e.g., wrong region, noise) for transparency in debug UI. */
  discarded_signals?: Array<{
    field: 'REVISION' | 'DRAWING_NUMBER' | 'PART_NUMBER';
    reason: string;
    signals: EvidenceSignal[];
  }>;
  /** Guardrail enforcement summary per field (Phase 3H.39.1). */
  resolution_audit?: {
    part_number?: FieldResolutionAudit;
    revision?: FieldResolutionAudit;
    drawing_number?: FieldResolutionAudit;
  };
  /** Phase 3H.43: Pipeline mode active during extraction (BOM / DRAWING). */
  pipeline_mode?: string | null;
  /** Phase 3H.43: Drawing subtype identified during extraction (INTERNAL_DRAWING / CUSTOMER_DRAWING / DRAWING_UNKNOWN). */
  drawing_subtype?: string | null;
}
