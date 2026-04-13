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
}
