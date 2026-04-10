/**
 * Harness Work Instruction Generator — Drawing Ingestion Service
 * Phase HWI.8 — Drawing Ingestion Foundation
 *
 * Responsibilities:
 *   1. Accept raw drawing text (extracted client-side from PDF)
 *   2. Normalize and split into lines
 *   3. Classify drawing type via heuristic scoring
 *   4. Extract deterministic metadata (drawing number, revision, title)
 *   5. Extract notes block
 *   6. Route to type-specific draft extractor
 *   7. Return CanonicalDrawingDraft (never throws; errors surface as flags)
 *
 * Governance:
 *   - NO AI extraction in this phase
 *   - NO geometry fabrication
 *   - NO BOM fusion
 *   - Extraction is best-effort; uncertain fields stay null with flags
 */

import type { DrawingType } from '../types/drawingTypes';
import type {
  CanonicalDrawingDraft,
  DraftFlag,
  DraftWireRow,
  DraftConnectorRow,
} from '../types/drawingDraft';

// ---------------------------------------------------------------------------
// Input type
// ---------------------------------------------------------------------------

export interface DrawingIngestInput {
  drawingText: string;
  fileName?: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

let flagSeq = 0;
function mkFlag(
  flag_type: DraftFlag['flag_type'],
  message: string,
  field: string | null = null,
): DraftFlag {
  return { flag_id: `DF${String(++flagSeq).padStart(3, '0')}`, flag_type, field, message };
}

function normalizeLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);
}

function countKeywords(text: string, keywords: string[]): number {
  const upper = text.toUpperCase();
  return keywords.filter(k => upper.includes(k)).length;
}

// ---------------------------------------------------------------------------
// Step 3: Drawing type classifier
// ---------------------------------------------------------------------------

export function classifyDrawingType(text: string): DrawingType {
  const upper = text.toUpperCase();

  const tableSignals = countKeywords(upper, [
    'LENGTH', 'GAUGE', 'COLOR', 'COLOUR', 'WIRE ID',
    'TERMINAL', 'ACI', 'PIN', 'CAVITY', 'CIRCUIT',
  ]);

  const layoutSignals = countKeywords(upper, [
    'SPLICE', 'BRANCH', 'RING', 'BREAKOUT', 'LOOM',
    'TRUNK', 'LEG ', 'NODE', 'HARNESS LAYOUT',
  ]);

  const calloutSignals = countKeywords(upper, [
    'CALLOUT', 'ITEM NO', 'PART NO', 'REF DES', 'NOTE:',
    'SEE NOTE', 'TYP.', 'TYP ',
  ]);

  const dimensionCount = (text.match(/\d+\.\d{2,3}["'"]?\s*(IN|MM|INCH)?/gi) ?? []).length;
  const aciRefCount    = (text.match(/\bACI[-\s]?\d{4,}/gi) ?? []).length;
  const lineCount      = text.split(/\r?\n/).length;

  console.log('[HWI DRAWING TYPE CLASSIFIED]', {
    tableSignals, layoutSignals, calloutSignals, dimensionCount, aciRefCount, lineCount,
  });

  if (tableSignals >= 4) return 'STRUCTURED_TABLE';
  if (tableSignals >= 2 && lineCount < 80 && dimensionCount <= 4) return 'SIMPLE_WIRE';
  if (layoutSignals >= 3 || (dimensionCount >= 8 && tableSignals < 3)) return 'HARNESS_LAYOUT';
  if (calloutSignals >= 2 || aciRefCount >= 3) return 'CALLOUT';
  if (tableSignals >= 2) return 'STRUCTURED_TABLE';

  return 'UNKNOWN';
}

// ---------------------------------------------------------------------------
// Step 4: Metadata extraction
// ---------------------------------------------------------------------------

interface DrawingMeta {
  drawing_number: string | null;
  revision:       string | null;
  title:          string | null;
}

function extractDrawingMetadata(lines: string[]): DrawingMeta {
  let drawing_number: string | null = null;
  let revision:       string | null = null;
  let title:          string | null = null;

  const pnPattern  = /\b(\d{3}[-\s]\d{4,5}[-\s]\d{3,4}[A-Z]?)\b/i;
  const revPattern = /\bREV(?:ISION)?[:\s.]*([A-Z0-9]{1,4})\b/i;
  const titleKw    = /WIRE\s+HARNESS|ASSEMBLY|CABLE\s+ASSY|WIRING\s+DIAGRAM/i;

  for (const line of lines) {
    if (!drawing_number) {
      const m = line.match(pnPattern);
      if (m) drawing_number = m[1].replace(/\s/g, '-');
    }
    if (!revision) {
      const m = line.match(revPattern);
      if (m) revision = m[1].toUpperCase();
    }
    if (!title && titleKw.test(line) && line.length < 120) {
      title = line.replace(/\s+/g, ' ').trim();
    }
  }

  return { drawing_number, revision, title };
}

// ---------------------------------------------------------------------------
// Step 5: Notes extraction
// ---------------------------------------------------------------------------

const NOTES_BLOCK_RE = /^(?:GENERAL\s+)?NOTES?[:\s]*$/i;
const NUMBERED_NOTE_RE = /^\d+[.)]\s+.{5,}/;

function extractNotes(lines: string[]): string[] {
  const notes: string[] = [];
  let inNotesBlock = false;

  for (const line of lines) {
    if (NOTES_BLOCK_RE.test(line)) { inNotesBlock = true; continue; }
    if (inNotesBlock && NUMBERED_NOTE_RE.test(line)) {
      notes.push(line);
    } else if (!inNotesBlock && NUMBERED_NOTE_RE.test(line)) {
      const upper = line.toUpperCase();
      if (
        upper.includes('STRIP') || upper.includes('UL') ||
        upper.includes('TOLERANCE') || upper.includes('HOT STAMP') ||
        upper.includes('PACKAGING') || upper.includes('UNLESS') ||
        upper.includes('ALL ') || upper.includes('SEE ')
      ) {
        notes.push(line);
      }
    }
  }

  return notes;
}

// ---------------------------------------------------------------------------
// Step 6a: Extract dimensions
// ---------------------------------------------------------------------------

function extractDimensions(lines: string[]): string[] {
  const dims: string[] = [];
  const dimRe = /\b\d+(?:\.\d+)?\s*(?:IN(?:CH(?:ES)?)?|MM|")\b/gi;
  for (const line of lines) {
    const matches = line.match(dimRe);
    if (matches) dims.push(...matches.map(m => m.trim()));
  }
  return [...new Set(dims)];
}

// ---------------------------------------------------------------------------
// Step 6b: Extract equivalent parts
// ---------------------------------------------------------------------------

function extractEquivalentParts(lines: string[]): string[] {
  const parts: string[] = [];
  const eqRe = /\b([A-Z0-9]{3,4}-[A-Z0-9]{4,7}(?:-[A-Z0-9]{1,5})?)\b/g;
  for (const line of lines) {
    if (/EQUIV|ALTERNATE|REPLACES|SEE ALSO/i.test(line)) {
      const m = [...line.matchAll(eqRe)];
      parts.push(...m.map(x => x[1]));
    }
  }
  return [...new Set(parts)];
}

// ---------------------------------------------------------------------------
// Step 7a: STRUCTURED_TABLE extractor
// ---------------------------------------------------------------------------

const TABLE_HEADER_RE = /\b(?:ID|CIRCUIT|#)\b.*\b(?:LENGTH|LEN)\b/i;
const LENGTH_RE       = /\b(\d{1,4}(?:\.\d{1,3})?)\s*(?:IN|")?/i;
const GAUGE_RE        = /\b(\d{2})\s*(?:AWG|GA)\b/i;
const COLOR_RE        = /\b(RED|BLK|BLACK|WHT|WHITE|BLU|BLUE|GRN|GREEN|YEL|YELLOW|ORN|ORANGE|PNK|PINK|VIO|VIOLET|GRA|GRAY|GRY|BRN|BROWN|TAN|NAT|NATURAL)\b/i;
const ACI_PN_RE       = /\b([A-Z]{2,4}\d{4,}(?:-[A-Z0-9]+)*)\b/g;

function parseWireRowFromLine(raw: string, row_index: number): DraftWireRow {
  const lenM   = raw.match(LENGTH_RE);
  const gaugeM = raw.match(GAUGE_RE);
  const colorM = raw.match(COLOR_RE);
  const aciM   = [...raw.matchAll(ACI_PN_RE)];

  const idM = raw.match(/^([A-Z]?\d{1,4})\s/);

  return {
    row_index,
    raw_text:        raw,
    wire_id:         idM ? idM[1] : null,
    length:          lenM  ? parseFloat(lenM[1])   : null,
    gauge:           gaugeM ? gaugeM[1]             : null,
    color:           colorM ? colorM[1].toUpperCase() : null,
    aci_part_number: aciM.length > 0 ? aciM[0][1] : null,
    terminal_a:      aciM.length > 1 ? aciM[1][1] : null,
    terminal_b:      aciM.length > 2 ? aciM[2][1] : null,
    connector_a:     null,
    connector_b:     null,
    cavity_a:        null,
    cavity_b:        null,
  };
}

function extractStructuredTableDraft(
  lines: string[],
  flags: DraftFlag[],
): { wire_rows: DraftWireRow[]; connector_rows: DraftConnectorRow[] } {
  const wire_rows: DraftWireRow[] = [];
  const connector_rows: DraftConnectorRow[] = [];

  let inTable = false;
  let rowIdx = 0;

  for (const line of lines) {
    if (!inTable && TABLE_HEADER_RE.test(line)) { inTable = true; continue; }
    if (!inTable) continue;

    if (line.length < 8) continue;
    if (/^(?:NOTES?|REVISION|TITLE|DRAWN)/i.test(line)) break;

    const row = parseWireRowFromLine(line, rowIdx++);
    if (row.length !== null || row.aci_part_number !== null || row.gauge !== null) {
      wire_rows.push(row);
    }
  }

  if (wire_rows.length === 0) {
    flags.push(mkFlag('warning', 'STRUCTURED_TABLE drawing: no wire rows extracted from table — header pattern may not match', 'wire_rows'));
  }

  return { wire_rows, connector_rows };
}

// ---------------------------------------------------------------------------
// Step 7b: SIMPLE_WIRE extractor
// ---------------------------------------------------------------------------

function extractSimpleWireDraft(
  lines: string[],
  flags: DraftFlag[],
): { wire_rows: DraftWireRow[]; connector_rows: DraftConnectorRow[] } {
  const full = lines.join(' ');
  const row  = parseWireRowFromLine(full, 0);
  row.raw_text = full.slice(0, 300);

  if (row.length === null) {
    flags.push(mkFlag('review_required', 'SIMPLE_WIRE: no cut length detected in drawing text', 'wire_rows.0.length'));
  }
  if (row.aci_part_number === null) {
    flags.push(mkFlag('review_required', 'SIMPLE_WIRE: no ACI part number detected in drawing text', 'wire_rows.0.aci_part_number'));
  }

  return { wire_rows: [row], connector_rows: [] };
}

// ---------------------------------------------------------------------------
// Step 7c: CALLOUT extractor
// ---------------------------------------------------------------------------

function extractCalloutDraft(
  lines: string[],
  flags: DraftFlag[],
): { wire_rows: DraftWireRow[]; connector_rows: DraftConnectorRow[] } {
  const wire_rows: DraftWireRow[] = [];
  const connector_rows: DraftConnectorRow[] = [];

  let rowIdx = 0;
  for (const line of lines) {
    const aciM = [...line.matchAll(ACI_PN_RE)];
    const lenM = line.match(LENGTH_RE);
    if (aciM.length === 0 && lenM === null) continue;

    wire_rows.push({
      row_index:       rowIdx++,
      raw_text:        line,
      wire_id:         null,
      length:          lenM ? parseFloat(lenM[1]) : null,
      gauge:           null,
      color:           null,
      aci_part_number: aciM[0]?.[1] ?? null,
      terminal_a:      aciM[1]?.[1] ?? null,
      terminal_b:      aciM[2]?.[1] ?? null,
      connector_a:     null,
      connector_b:     null,
      cavity_a:        null,
      cavity_b:        null,
    });
  }

  if (wire_rows.length === 0) {
    flags.push(mkFlag('review_required', 'CALLOUT drawing: no ACI references or lengths found in extracted text', 'wire_rows'));
  }

  return { wire_rows, connector_rows };
}

// ---------------------------------------------------------------------------
// Step 7d: HARNESS_LAYOUT extractor (routing only)
// ---------------------------------------------------------------------------

function extractHarnessLayoutDraft(
  flags: DraftFlag[],
): { wire_rows: DraftWireRow[]; connector_rows: DraftConnectorRow[] } {
  flags.push(mkFlag(
    'review_required',
    'Layout-style drawing detected — geometry and routing data require vision/graph extraction in a later phase',
    null,
  ));
  return { wire_rows: [], connector_rows: [] };
}

// ---------------------------------------------------------------------------
// Step 2: Main ingestion entry point
// ---------------------------------------------------------------------------

export function ingestDrawingPdf(input: DrawingIngestInput): CanonicalDrawingDraft {
  flagSeq = 0;
  const { drawingText, fileName = null } = input;

  console.log('[HWI DRAWING INGEST START]', {
    fileName,
    textLength: drawingText.length,
    timestamp: new Date().toISOString(),
  });

  const lines = normalizeLines(drawingText);

  const drawing_type = classifyDrawingType(drawingText);
  const meta         = extractDrawingMetadata(lines);
  const notes        = extractNotes(lines);
  const dimensions   = extractDimensions(lines);
  const equiv_parts  = extractEquivalentParts(lines);
  const flags: DraftFlag[] = [];

  if (meta.drawing_number === null) {
    flags.push(mkFlag('warning', 'Drawing number not detected — add manually', 'drawing_number'));
  }
  if (meta.revision === null) {
    flags.push(mkFlag('warning', 'Revision not detected — add manually', 'revision'));
  }
  if (meta.title === null) {
    flags.push(mkFlag('info', 'Title block not detected from text', 'title'));
  }

  let wire_rows: DraftWireRow[]       = [];
  let connector_rows: DraftConnectorRow[] = [];

  switch (drawing_type) {
    case 'STRUCTURED_TABLE': {
      const r = extractStructuredTableDraft(lines, flags);
      wire_rows = r.wire_rows; connector_rows = r.connector_rows;
      break;
    }
    case 'SIMPLE_WIRE': {
      const r = extractSimpleWireDraft(lines, flags);
      wire_rows = r.wire_rows; connector_rows = r.connector_rows;
      break;
    }
    case 'CALLOUT': {
      const r = extractCalloutDraft(lines, flags);
      wire_rows = r.wire_rows; connector_rows = r.connector_rows;
      break;
    }
    case 'HARNESS_LAYOUT': {
      const r = extractHarnessLayoutDraft(flags);
      wire_rows = r.wire_rows; connector_rows = r.connector_rows;
      break;
    }
    case 'UNKNOWN': {
      flags.push(mkFlag('review_required', 'Drawing type could not be classified — manual review required', null));
      break;
    }
  }

  const pageEstimate = Math.max(1, Math.round(drawingText.length / 3000));

  const draft: CanonicalDrawingDraft = {
    drawing_number:   meta.drawing_number,
    revision:         meta.revision,
    title:            meta.title,
    drawing_type,
    source_pages:     pageEstimate,
    extracted_text:   drawingText,
    notes,
    wire_rows,
    connector_rows,
    equivalent_parts: equiv_parts,
    dimensions,
    flags,
    provenance: {
      ingested_at:     new Date().toISOString(),
      source_filename: fileName,
      text_length:     drawingText.length,
      page_estimate:   pageEstimate,
    },
  };

  console.log('[HWI DRAWING DRAFT BUILT]', {
    drawing_type,
    drawing_number:  draft.drawing_number,
    revision:        draft.revision,
    wire_rows:       wire_rows.length,
    connector_rows:  connector_rows.length,
    notes:           notes.length,
    dimensions:      dimensions.length,
    flags:           flags.length,
  });

  return draft;
}
