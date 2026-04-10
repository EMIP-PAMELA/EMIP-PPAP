/**
 * Harness Work Instruction Generator — Canonical Drawing Draft
 * Phase HWI.8 — Drawing Ingestion Foundation
 *
 * CanonicalDrawingDraft is the intermediate representation produced by
 * drawingIngestionService. It is intentionally partial — fields that
 * require deeper extraction or vision are left null and flagged.
 *
 * This type is NOT the fusion type. BOM + drawing fusion happens in a
 * later phase. This draft exists only to capture what is deterministically
 * extractable from the raw drawing text.
 */

import type { DrawingType } from './drawingTypes';

// ---------------------------------------------------------------------------
// Sub-types
// ---------------------------------------------------------------------------

export interface DraftWireRow {
  row_index:        number;
  raw_text:         string;
  wire_id:          string | null;
  length:           number | null;
  gauge:            string | null;
  color:            string | null;
  aci_part_number:  string | null;
  terminal_a:       string | null;
  terminal_b:       string | null;
  connector_a:      string | null;
  connector_b:      string | null;
  cavity_a:         string | null;
  cavity_b:         string | null;
}

export interface DraftConnectorRow {
  row_index:    number;
  raw_text:     string;
  connector_id: string | null;
  cavity:       string | null;
  wire_id:      string | null;
  terminal_pn:  string | null;
}

export interface DraftFlag {
  flag_id:   string;
  flag_type: 'warning' | 'info' | 'review_required';
  field:     string | null;
  message:   string;
}

export interface DrawingProvenance {
  ingested_at:     string;     // ISO8601
  source_filename: string | null;
  text_length:     number;
  page_estimate:   number;
}

// ---------------------------------------------------------------------------
// Root draft type
// ---------------------------------------------------------------------------

export interface CanonicalDrawingDraft {
  drawing_number:    string | null;
  revision:          string | null;
  title:             string | null;
  drawing_type:      DrawingType;
  source_pages:      number;
  extracted_text:    string;
  notes:             string[];
  wire_rows:         DraftWireRow[];
  connector_rows:    DraftConnectorRow[];
  equivalent_parts:  string[];
  dimensions:        string[];
  flags:             DraftFlag[];
  provenance:        DrawingProvenance;
}
