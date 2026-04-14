/**
 * Field Authority Resolver — Phase 3H.49 C11
 *
 * Unified field resolution layer that combines all available extraction signals
 * and promotes the best candidate for Part Number, Revision, and Document Type
 * into the Upload Workbench confirm fields.
 *
 * Architecture:
 *   - Pure function, no I/O, no DB calls, no server-only imports.
 *   - Safe to import from both server-side services and client components.
 *   - Operates on already-extracted data; does NOT re-run parsers.
 *   - Operator-confirmed values are always authoritative and short-circuit resolution.
 *   - Parsed drawing (Rheem title block) is promoted at PARSED_DRAWING priority,
 *     above all heuristics — this eliminates the gap between the Parsed Drawing
 *     panel and the confirm field Part Number display.
 *
 * Governance:
 *   - ADDITIVE ONLY. Does not remove or modify any existing extraction pass.
 *   - Never fabricates values — only promotes what extractors already found.
 *   - Revision is left null when genuinely absent; no invention from notes text.
 *   - Operator-confirmed values are NEVER overwritten.
 *   - All competing candidates are preserved in ResolvedField for future UI evidence.
 */

import type { TitleBlockExtractionResult } from './titleBlockRegionExtractor';
import type { VisionParsedDrawingResult } from './aiDrawingVisionService';

// ---------------------------------------------------------------------------
// Core Types
// ---------------------------------------------------------------------------

export type FieldName =
  | 'partNumber'
  | 'revision'
  | 'documentType';

export type FieldAuthoritySource =
  | 'OPERATOR_CONFIRMED'
  | 'PARSED_DRAWING'
  /** Phase 3H.50 C12: explicit title block zone extraction (Apogee lower-right, Rheem left strip). */
  | 'TITLE_BLOCK_REGION'
  /** Phase 3H.50 C12: explicit revision record zone extraction (Apogee upper-right box, Rheem title strip). */
  | 'REVISION_REGION'
  | 'ADAPTIVE_VECTOR'
  | 'INTERPRETATION'
  /** Phase 3H.51 C13: universal AI vision parse metadata (below deterministic regions, above weak heuristic). */
  | 'AI_VISION'
  | 'AI_ASSIST'
  | 'HEURISTIC'
  | 'FILENAME'
  | 'UNKNOWN';

export interface FieldCandidate {
  field: FieldName;
  value: string;
  source: FieldAuthoritySource;
  confidence: number;
  evidence?: string[];
}

export interface ResolvedField {
  field: FieldName;
  value: string | null;
  source: FieldAuthoritySource;
  confidence: number;
  evidence: string[];
  competingCandidates: FieldCandidate[];
}

// ---------------------------------------------------------------------------
// Source Priority Order
// ---------------------------------------------------------------------------

const SOURCE_PRIORITY: FieldAuthoritySource[] = [
  'OPERATOR_CONFIRMED',
  'PARSED_DRAWING',
  'TITLE_BLOCK_REGION',
  'REVISION_REGION',
  'ADAPTIVE_VECTOR',
  'INTERPRETATION',
  'AI_VISION',
  'AI_ASSIST',
  'HEURISTIC',
  'FILENAME',
  'UNKNOWN',
];

function sourcePriority(source: FieldAuthoritySource): number {
  const idx = SOURCE_PRIORITY.indexOf(source);
  return idx === -1 ? SOURCE_PRIORITY.length : idx;
}

// ---------------------------------------------------------------------------
// Confidence Policy (per source tier, used when candidate has no explicit confidence)
// ---------------------------------------------------------------------------

const DEFAULT_CONFIDENCE: Record<FieldAuthoritySource, number> = {
  OPERATOR_CONFIRMED:  1.00,
  PARSED_DRAWING:      0.85,
  TITLE_BLOCK_REGION:  0.90,
  REVISION_REGION:     0.90,
  ADAPTIVE_VECTOR:     0.80,
  INTERPRETATION:      0.70,
  AI_VISION:           0.72,
  AI_ASSIST:           0.65,  // capped at 0.75 for field authority, but 0.65 default
  HEURISTIC:           0.50,
  FILENAME:            0.60,
  UNKNOWN:             0.10,
};

// ---------------------------------------------------------------------------
// Parsed Drawing Data Readers (duck-typed — no parser imports needed)
// ---------------------------------------------------------------------------

/**
 * Read the part number from a parsed drawing model (Rheem or other).
 * Expects: `{ titleBlock: { partNumber: string | null } }`.
 * Returns null if the shape is unrecognized or the value is blank.
 */
function readParsedDrawingPN(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  const tb = obj.titleBlock;
  if (!tb || typeof tb !== 'object') return null;
  const pn = (tb as Record<string, unknown>).partNumber;
  if (typeof pn !== 'string' || !pn.trim()) return null;
  return pn.trim();
}

/**
 * Read the revision from a parsed drawing model.
 * Expects: `{ titleBlock: { revision: string | null } }`.
 */
function readParsedDrawingRevision(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  const tb = obj.titleBlock;
  if (!tb || typeof tb !== 'object') return null;
  const rev = (tb as Record<string, unknown>).revision;
  if (typeof rev !== 'string' || !rev.trim()) return null;
  return rev.trim();
}

// ---------------------------------------------------------------------------
// Filename Pattern Readers
// ---------------------------------------------------------------------------

const RHEEM_PN_RE   = /\b(45-\d{5,6}-\d{2,4}[A-Z]?)\b/;
const APOGEE_DRN_RE = /\b(527-\d{4}-010)\b/;  // Apogee DRAWING NUMBER — not a part number
const NH_PN_RE      = /\b(NH\d{2}-\d{5,6}-\d{2,3})\b/i;
const REV_IN_FN_RE  = /[-_\s](?:rev|r)[-_\s]?([A-Z0-9]{1,4})(?:[-_\s.]|$)/i;

// ---------------------------------------------------------------------------
// Identifier Role Classification (C11.3)
// Narrow guard for known Apogee/Rheem identifier patterns only.
// ---------------------------------------------------------------------------

type IdentifierRole = 'PART_NUMBER' | 'DRAWING_NUMBER' | 'UNKNOWN';

function classifyIdentifierRole(value: string): IdentifierRole {
  if (!value) return 'UNKNOWN';
  if (APOGEE_DRN_RE.test(value.trim())) return 'DRAWING_NUMBER';
  if (RHEEM_PN_RE.test(value.trim()))   return 'PART_NUMBER';
  return 'UNKNOWN';
}

function readFilenamePN(filename: string | null | undefined): string | null {
  if (!filename) return null;
  // APOGEE_DRN_RE intentionally excluded — 527-xxxx-010 is a drawing number, not a part number
  const m = RHEEM_PN_RE.exec(filename) ?? NH_PN_RE.exec(filename);
  return m ? m[1] : null;
}

function readFilenameDrawingNumber(filename: string | null | undefined): string | null {
  if (!filename) return null;
  const m = APOGEE_DRN_RE.exec(filename);
  return m ? m[1] : null;
}

function readFilenameRevision(filename: string | null | undefined): string | null {
  if (!filename) return null;
  const m = REV_IN_FN_RE.exec(filename);
  if (!m) return null;
  const v = m[1].trim().toUpperCase();
  if (v.length === 0 || v.length > 4) return null;
  return v;
}

// ---------------------------------------------------------------------------
// Candidate Selector
// ---------------------------------------------------------------------------

function selectWinner(candidates: FieldCandidate[]): FieldCandidate | null {
  if (candidates.length === 0) return null;
  return candidates.slice().sort((a, b) => {
    const pd = sourcePriority(a.source) - sourcePriority(b.source);
    if (pd !== 0) return pd;
    return b.confidence - a.confidence;  // higher confidence wins within same tier
  })[0];
}

// ---------------------------------------------------------------------------
// Main Entry Point
// ---------------------------------------------------------------------------

export interface ResolveDocumentFieldsArgs {
  /** Field values already confirmed by the operator (short-circuit authority). */
  operatorConfirmed?: Partial<Record<FieldName, string | null>>;
  /** Pre-built heuristic candidates from analyzeFileIngestion. */
  heuristicCandidates?: FieldCandidate[];
  /** Serialized RheemDrawingModel or other structured parsed data. */
  parsedDrawingData?: Record<string, unknown> | null | unknown;
  /** AdaptiveDrawingAnalysis shape — used for document type hints. */
  adaptiveAnalysis?: { mode?: string } | null;
  /** DrawingInterpretationResult shape — reserved for future interpretation signals. */
  interpretation?: { wires?: unknown[] } | null;
  /** AIAssistResult shape — used for AI-suggested PN/revision at capped confidence. */
  aiAssistResult?: { partNumber?: string | null; revision?: string | null } | null;
  /** Raw filename for filename-pattern candidates. */
  filename?: string | null;
  /** Current/default document type string. */
  currentDocType?: string | null;
  /** Phase 3H.50 C12: region-aware title block extraction result. */
  titleBlockResult?: TitleBlockExtractionResult | null;
  /** Phase 3H.51 C13: universal AI vision parse result (metadata candidates only). */
  visionResult?: VisionParsedDrawingResult | null;
}

/**
 * Resolve the best candidate for each field from all available sources.
 *
 * Priority order (per SOURCE_PRIORITY constant):
 *   OPERATOR_CONFIRMED > PARSED_DRAWING > TITLE_BLOCK_REGION > REVISION_REGION
 *   > ADAPTIVE_VECTOR > INTERPRETATION > AI_VISION > AI_ASSIST > HEURISTIC > FILENAME > UNKNOWN
 *
 * All competing candidates are preserved in the returned ResolvedField.
 * The function never throws — degraded results are returned on bad input.
 */
export function resolveDocumentFields(
  args: ResolveDocumentFieldsArgs,
): Record<FieldName, ResolvedField> {
  const allCandidates: FieldCandidate[] = [];

  try {
    // ── OPERATOR_CONFIRMED ────────────────────────────────────────────────
    const op = args.operatorConfirmed ?? {};
    if (op.partNumber?.trim()) {
      allCandidates.push({ field: 'partNumber', value: op.partNumber.trim(), source: 'OPERATOR_CONFIRMED', confidence: 1.0, evidence: ['operator confirmed'] });
    }
    if (op.revision?.trim()) {
      allCandidates.push({ field: 'revision', value: op.revision.trim(), source: 'OPERATOR_CONFIRMED', confidence: 1.0, evidence: ['operator confirmed'] });
    }
    if (op.documentType?.trim()) {
      allCandidates.push({ field: 'documentType', value: op.documentType.trim(), source: 'OPERATOR_CONFIRMED', confidence: 1.0, evidence: ['operator confirmed'] });
    }

    // ── PARSED_DRAWING ────────────────────────────────────────────────────
    // Key fix: promotes Rheem title block PN/Rev even when signal filtering
    // (title-block sanity) incorrectly drops them in analyzeIngestion.
    const parsedPN  = readParsedDrawingPN(args.parsedDrawingData);
    const parsedRev = readParsedDrawingRevision(args.parsedDrawingData);
    if (parsedPN) {
      allCandidates.push({ field: 'partNumber', value: parsedPN, source: 'PARSED_DRAWING', confidence: 0.85, evidence: ['parsed drawing title block PN'] });
    }
    if (parsedRev) {
      allCandidates.push({ field: 'revision', value: parsedRev, source: 'PARSED_DRAWING', confidence: 0.85, evidence: ['parsed drawing title block revision'] });
    }

    // ── TITLE_BLOCK_REGION / REVISION_REGION (C12 region-aware extractor) ────
    const tbr = args.titleBlockResult;
    if (tbr) {
      if (tbr.partNumber.value && classifyIdentifierRole(tbr.partNumber.value) !== 'DRAWING_NUMBER') {
        console.log('[IDENTIFIER ROLE]', { value: tbr.partNumber.value, classifiedAs: classifyIdentifierRole(tbr.partNumber.value), context: 'TITLE_BLOCK_REGION partNumber' });
        allCandidates.push({
          field: 'partNumber',
          value: tbr.partNumber.value,
          source: 'TITLE_BLOCK_REGION',
          confidence: tbr.partNumber.confidence || DEFAULT_CONFIDENCE.TITLE_BLOCK_REGION,
          evidence: tbr.partNumber.evidence.length ? tbr.partNumber.evidence : ['region-aware title block extraction'],
        });
      }
      if (tbr.drawingNumber.value && tbr.drawingNumber.value !== tbr.partNumber.value && classifyIdentifierRole(tbr.drawingNumber.value) !== 'DRAWING_NUMBER') {
        console.log('[IDENTIFIER ROLE]', { value: tbr.drawingNumber.value, classifiedAs: classifyIdentifierRole(tbr.drawingNumber.value), context: 'TITLE_BLOCK_REGION drawingNumber→partNumber' });
        allCandidates.push({
          field: 'partNumber',
          value: tbr.drawingNumber.value,
          source: 'TITLE_BLOCK_REGION',
          confidence: tbr.drawingNumber.confidence || DEFAULT_CONFIDENCE.TITLE_BLOCK_REGION,
          evidence: tbr.drawingNumber.evidence.length ? tbr.drawingNumber.evidence : ['region-aware drawing number extraction'],
        });
      }
      if (tbr.revision.value) {
        allCandidates.push({
          field: 'revision',
          value: tbr.revision.value,
          source: tbr.revision.source === 'REVISION_REGION' ? 'REVISION_REGION' : 'TITLE_BLOCK_REGION',
          confidence: tbr.revision.confidence || DEFAULT_CONFIDENCE.REVISION_REGION,
          evidence: tbr.revision.evidence.length ? tbr.revision.evidence : ['region-aware revision extraction'],
        });
      }
    }

    // ── AI_VISION (C13 universal vision parse metadata) ────────────────────
    const vis = args.visionResult;
    if (vis?.metadata) {
      const visConf = Math.min(vis.confidence ?? 0, 0.80);  // cap to stay below deterministic region
      if (vis.metadata.partNumber && classifyIdentifierRole(vis.metadata.partNumber) !== 'DRAWING_NUMBER') {
        console.log('[IDENTIFIER ROLE]', { value: vis.metadata.partNumber, classifiedAs: classifyIdentifierRole(vis.metadata.partNumber), context: 'AI_VISION partNumber' });
        allCandidates.push({
          field:      'partNumber',
          value:      vis.metadata.partNumber,
          source:     'AI_VISION',
          confidence: visConf,
          evidence:   ['AI vision parse — drawing metadata'],
        });
      }
      if (vis.metadata.drawingNumber && vis.metadata.drawingNumber !== vis.metadata.partNumber && classifyIdentifierRole(vis.metadata.drawingNumber) !== 'DRAWING_NUMBER') {
        console.log('[IDENTIFIER ROLE]', { value: vis.metadata.drawingNumber, classifiedAs: classifyIdentifierRole(vis.metadata.drawingNumber), context: 'AI_VISION drawingNumber→partNumber' });
        allCandidates.push({
          field:      'partNumber',
          value:      vis.metadata.drawingNumber,
          source:     'AI_VISION',
          confidence: visConf * 0.9,
          evidence:   ['AI vision parse — drawing number'],
        });
      }
      if (vis.metadata.revision) {
        allCandidates.push({
          field:      'revision',
          value:      vis.metadata.revision,
          source:     'AI_VISION',
          confidence: visConf * 0.95,
          evidence:   ['AI vision parse — revision metadata'],
        });
      }
    }

    // ── ADAPTIVE_VECTOR document type hints ───────────────────────────────
    const mode = args.adaptiveAnalysis?.mode ?? null;
    if (mode === 'VECTOR_STRUCTURED') {
      allCandidates.push({ field: 'documentType', value: 'INTERNAL_DRAWING', source: 'ADAPTIVE_VECTOR', confidence: 0.80, evidence: ['adaptive mode = VECTOR_STRUCTURED'] });
    } else if (mode === 'RASTER_OCR') {
      allCandidates.push({ field: 'documentType', value: 'CUSTOMER_DRAWING', source: 'ADAPTIVE_VECTOR', confidence: 0.70, evidence: ['adaptive mode = RASTER_OCR'] });
    }

    // ── AI_ASSIST (capped at 0.75 for field-level authority) ──────────────
    const aiPN  = args.aiAssistResult?.partNumber?.trim() ?? null;
    const aiRev = args.aiAssistResult?.revision?.trim() ?? null;
    if (aiPN) {
      allCandidates.push({ field: 'partNumber', value: aiPN, source: 'AI_ASSIST', confidence: Math.min(0.75, DEFAULT_CONFIDENCE.AI_ASSIST), evidence: ['AI assist result'] });
    }
    if (aiRev) {
      allCandidates.push({ field: 'revision', value: aiRev, source: 'AI_ASSIST', confidence: Math.min(0.75, DEFAULT_CONFIDENCE.AI_ASSIST), evidence: ['AI assist result'] });
    }

    // ── HEURISTIC (from analyzeIngestion signals) ─────────────────────────
    for (const c of args.heuristicCandidates ?? []) {
      if (!c.value?.trim()) continue;
      allCandidates.push({
        ...c,
        value: c.value.trim(),
        source: c.source ?? 'HEURISTIC',
        confidence: c.confidence ?? DEFAULT_CONFIDENCE.HEURISTIC,
      });
    }

    // ── FILENAME ──────────────────────────────────────────────────────────
    const fnPN  = readFilenamePN(args.filename);
    const fnRev = readFilenameRevision(args.filename);
    if (fnPN) {
      allCandidates.push({ field: 'partNumber', value: fnPN, source: 'FILENAME', confidence: 0.60, evidence: ['extracted from filename'] });
    }
    if (fnRev) {
      allCandidates.push({ field: 'revision', value: fnRev, source: 'FILENAME', confidence: 0.60, evidence: ['extracted from filename'] });
    }

    // ── CURRENT DOC TYPE (existing selection as HEURISTIC baseline) ───────
    if (args.currentDocType?.trim() && args.currentDocType !== 'UNKNOWN') {
      allCandidates.push({ field: 'documentType', value: args.currentDocType.trim(), source: 'HEURISTIC', confidence: 0.50, evidence: ['current document type selection'] });
    }
  } catch (err) {
    console.warn('[FIELD AUTHORITY RESOLVER] candidate gathering failed', err);
  }

  // ── Resolve each field ────────────────────────────────────────────────────
  const fields: FieldName[] = ['partNumber', 'revision', 'documentType'];
  const result = {} as Record<FieldName, ResolvedField>;

  for (const field of fields) {
    const candidates = allCandidates.filter(c => c.field === field);
    const winner = selectWinner(candidates);

    result[field] = {
      field,
      value:               winner?.value ?? null,
      source:              winner?.source ?? 'UNKNOWN',
      confidence:          winner?.confidence ?? 0,
      evidence:            winner?.evidence ?? [],
      competingCandidates: candidates,
    };
  }

  console.log('[FIELD AUTHORITY RESOLUTION]', {
    fileName: args.filename,
    resolved: {
      partNumber:   { value: result.partNumber.value,   source: result.partNumber.source,   confidence: result.partNumber.confidence },
      revision:     { value: result.revision.value,     source: result.revision.source,     confidence: result.revision.confidence },
      documentType: { value: result.documentType.value, source: result.documentType.source, confidence: result.documentType.confidence },
    },
    candidateCounts: {
      partNumber:   allCandidates.filter(c => c.field === 'partNumber').length,
      revision:     allCandidates.filter(c => c.field === 'revision').length,
      documentType: allCandidates.filter(c => c.field === 'documentType').length,
    },
  });

  return result;
}
