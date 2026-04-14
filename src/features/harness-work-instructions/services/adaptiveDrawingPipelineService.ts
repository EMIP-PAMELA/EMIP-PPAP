/**
 * Adaptive Drawing Pipeline Service — Phase 3H.48 C10
 *
 * Routing layer that classifies incoming drawing text into a processing mode
 * and dispatches to the appropriate extraction strategy.
 *
 * Modes:
 *   VECTOR_STRUCTURED — deterministic extraction from clean structured text
 *                       (internal drawings, vector-rich PDFs)
 *   RASTER_OCR        — current Rheem/OCR parser path
 *                       (customer drawings, OCR-extracted PDFs)
 *   HYBRID_UNKNOWN    — ambiguous; falls back to OCR path safely
 *
 * Governance:
 *   - ADDITIVE ONLY. Does not modify any existing parser or service.
 *   - Rheem parser path remains active — routed through RASTER_OCR mode.
 *   - No AI calls. No DB writes. No side effects. Pure extraction + routing.
 *   - All failures fall back gracefully; never crashes the ingestion pipeline.
 *   - Vector path is conservative — only extracts clearly present fields.
 *     No topology reconstruction. No connector-to-wire linking in this phase.
 */

import { detectRheemDrawing, parseRheemDrawing } from './rheemDrawingParser';
import { resolveWiresFromDrawing } from './wireResolutionService';
import { computeExtractionCoverage, type ExtractionCoverage } from './extractionCoverageService';
import { interpretRheemDrawingModel, type DrawingInterpretationResult } from './drawingInterpretationService';

// ---------------------------------------------------------------------------
// Core Types
// ---------------------------------------------------------------------------

export type DrawingProcessingMode =
  | 'VECTOR_STRUCTURED'
  | 'RASTER_OCR'
  | 'HYBRID_UNKNOWN';

export interface AdaptiveDrawingAnalysis {
  mode: DrawingProcessingMode;
  detectedTextLength: number;
  vectorSignalScore: number;
  rasterSignalScore: number;
  rationale: string[];
}

export interface AdaptiveDrawingResult {
  analysis: AdaptiveDrawingAnalysis;
  structuredData?: unknown;
  interpretation?: DrawingInterpretationResult;
  coverage?: ExtractionCoverage;
}

// ---------------------------------------------------------------------------
// Internal Vector-Structured Model
// ---------------------------------------------------------------------------

interface VectorWireRecord {
  rawText: string;
  wireId: string | null;
  gauge: string | null;
  color: string | null;
  length: number | null;
  partNumber: string | null;
}

interface VectorConnectorRecord {
  rawText: string;
  connectorId: string | null;
  partNumber: string | null;
}

interface VectorTerminalRecord {
  rawText: string;
  partNumber: string | null;
}

export interface VectorStructuredModel {
  source: 'VECTOR_TEXT';
  wires: VectorWireRecord[];
  connectors: VectorConnectorRecord[];
  terminals: VectorTerminalRecord[];
  notes: string[];
}

// ---------------------------------------------------------------------------
// Step 1 — Mode Detection
// ---------------------------------------------------------------------------

/**
 * Classify a drawing's extracted text into a processing mode.
 *
 * Scoring is additive and heuristic — no single signal is conclusive.
 * docType is the most reliable signal and is weighted accordingly.
 * Rheem PN detection is a strong raster override.
 *
 * Async signature is intentional: future phases may add lightweight AI
 * classification or DB-backed drawing-type lookups here.
 */
export async function analyzeDrawingProcessingMode(args: {
  extractedText?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  docType?: string | null;
}): Promise<AdaptiveDrawingAnalysis> {
  const text     = args.extractedText ?? '';
  const fileName = args.fileName      ?? '';
  const docType  = args.docType       ?? null;

  let vectorSignalScore = 0;
  let rasterSignalScore = 0;
  const rationale: string[] = [];

  // ── Document type ─────────────────────────────────────────────────────────
  // Most reliable structural signal; strongly weighted.
  if (docType === 'INTERNAL_DRAWING') {
    vectorSignalScore += 3;
    rationale.push('docType=INTERNAL_DRAWING — strong vector signal');
  } else if (docType === 'CUSTOMER_DRAWING') {
    rasterSignalScore += 1;
    rationale.push('docType=CUSTOMER_DRAWING — mild raster signal');
  }

  // ── Rheem part number pattern (strong raster override) ───────────────────
  const RHEEM_PN = /\b45-\d{5,6}-\d{2,4}[A-Z]?\b/;
  if (RHEEM_PN.test(text) || RHEEM_PN.test(fileName)) {
    rasterSignalScore += 4;
    rationale.push('Rheem PN pattern (45-XXXXX-XX) detected — strong raster signal');
  }

  // ── Rheem-specific table structure ────────────────────────────────────────
  if (/\bMANUFACTURER\b.*\bPART\s*(?:NO\.?|NUMBER)\b/i.test(text)) {
    rasterSignalScore += 2;
    rationale.push('Rheem connector table header detected — raster signal');
  }
  if (/\b(?:I\.?D\.?|WIRE\s*ID)\b.*\b(?:LENGTH|LEN)\b.*\b(?:GAUGE|AWG|GA)\b/i.test(text)) {
    rasterSignalScore += 1;
    rationale.push('Rheem wire table header pattern detected — raster signal');
  }

  // ── Internal (NH45) part number pattern ───────────────────────────────────
  const NH_PN = /\bNH\d{2}-\d{5,6}-\d{2}\b/;
  if (NH_PN.test(text) || NH_PN.test(fileName)) {
    vectorSignalScore += 2;
    rationale.push('NH internal part number pattern detected — vector signal');
  }

  // ── Text length ───────────────────────────────────────────────────────────
  const textLen = text.length;
  if (textLen > 3000) {
    vectorSignalScore += 1;
    rationale.push(`text length ${textLen} chars — adequate for structured extraction`);
  } else if (textLen < 500 && textLen > 0) {
    rasterSignalScore += 1;
    rationale.push(`text length ${textLen} chars — low, may indicate raster/OCR noise`);
  } else if (textLen === 0) {
    rasterSignalScore += 1;
    rationale.push('empty text — defaulting toward raster path');
  }

  // ── Gauge token density ───────────────────────────────────────────────────
  const gaugeMatches = text.match(/\b\d{1,2}\s*(?:AWG|GA(?:UGE)?)\b/gi) ?? [];
  if (gaugeMatches.length > 3) {
    vectorSignalScore += 1;
    rationale.push(`${gaugeMatches.length} AWG/gauge tokens — structured wire data signal`);
  }

  // ── OCR fragmentation: high proportion of very-short lines ───────────────
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length >= 10) {
    const shortLines  = lines.filter(l => l.trim().length <= 4);
    const fragRatio   = shortLines.length / lines.length;
    if (fragRatio > 0.40) {
      rasterSignalScore += 2;
      rationale.push(`${Math.round(fragRatio * 100)}% short lines — OCR fragmentation detected`);
    }
  }

  // ── Connector/circuit language in a structured non-Rheem context ──────────
  if (/\b(?:CIRCUIT|CKT|CONNECTOR)\b/i.test(text) && vectorSignalScore > 0) {
    vectorSignalScore += 1;
    rationale.push('circuit/connector terminology alongside vector signals');
  }

  // ── Mode assignment ───────────────────────────────────────────────────────
  let mode: DrawingProcessingMode;
  if (vectorSignalScore > rasterSignalScore + 1) {
    mode = 'VECTOR_STRUCTURED';
  } else if (rasterSignalScore > vectorSignalScore) {
    mode = 'RASTER_OCR';
  } else {
    mode = 'HYBRID_UNKNOWN';
  }

  return {
    mode,
    detectedTextLength: textLen,
    vectorSignalScore,
    rasterSignalScore,
    rationale,
  };
}

// ---------------------------------------------------------------------------
// Step 2 — Adaptive Pipeline Orchestrator
// ---------------------------------------------------------------------------

/**
 * Run the full adaptive extraction pipeline for a drawing.
 *
 * Routes to the appropriate path based on `analyzeDrawingProcessingMode`,
 * then returns a unified result with optional structuredData, interpretation,
 * and coverage. All paths are safe to call with empty/null text.
 *
 * Failures in any path are caught and logged; the result degrades gracefully
 * to analysis-only rather than crashing the ingestion pipeline.
 */
export async function runAdaptiveDrawingPipeline(args: {
  extractedText?: string | null;
  fileName?: string | null;
  docType?: string | null;
  existingStructuredData?: unknown;
}): Promise<AdaptiveDrawingResult> {
  const text     = args.extractedText ?? '';
  const fileName = args.fileName      ?? '';

  const analysis = await analyzeDrawingProcessingMode({
    extractedText: text,
    fileName,
    docType: args.docType,
  });

  console.log('[ADAPTIVE DRAWING MODE]', {
    fileName,
    mode:                analysis.mode,
    detectedTextLength:  analysis.detectedTextLength,
    vectorSignalScore:   analysis.vectorSignalScore,
    rasterSignalScore:   analysis.rasterSignalScore,
    rationale:           analysis.rationale,
  });

  let result: AdaptiveDrawingResult;

  try {
    switch (analysis.mode) {
      case 'VECTOR_STRUCTURED':
        result = runVectorPath(text, analysis);
        break;
      case 'RASTER_OCR':
        result = runRasterPath(text, fileName, analysis);
        break;
      default:
        // HYBRID_UNKNOWN: attempt raster path as safe fallback
        result = runRasterPath(text, fileName, analysis);
        break;
    }
  } catch (err) {
    console.warn('[ADAPTIVE DRAWING PIPELINE] Adaptive path failed — returning analysis only', {
      fileName,
      mode:  analysis.mode,
      error: err instanceof Error ? err.message : String(err),
    });
    result = { analysis };
  }

  console.log('[ADAPTIVE DRAWING RESULT]', {
    mode:              result.analysis.mode,
    hasStructuredData: Boolean(result.structuredData),
    hasInterpretation: Boolean(result.interpretation),
    hasCoverage:       Boolean(result.coverage),
  });

  return result;
}

// ---------------------------------------------------------------------------
// Path: VECTOR_STRUCTURED
// ---------------------------------------------------------------------------

function runVectorPath(text: string, analysis: AdaptiveDrawingAnalysis): AdaptiveDrawingResult {
  const structuredData = parseVectorStructuredText(text);

  // Interpretation is not run against VectorStructuredModel in this phase —
  // interpretRheemDrawingModel requires a RheemDrawingModel-compatible type.
  // Coverage is also deferred; vector path records are structurally different.
  // Both will be added when a unified wire model abstraction is introduced.
  return {
    analysis,
    structuredData,
  };
}

// ---------------------------------------------------------------------------
// Path: RASTER_OCR (and HYBRID_UNKNOWN fallback)
// ---------------------------------------------------------------------------

function runRasterPath(text: string, fileName: string, analysis: AdaptiveDrawingAnalysis): AdaptiveDrawingResult {
  if (!detectRheemDrawing(text, fileName)) {
    // Non-Rheem raster drawing: no parser available in this phase.
    // Return analysis only; future phases may add a generic OCR table parser.
    return { analysis };
  }

  const rheemModel    = parseRheemDrawing(text, fileName);
  const resolvedWires = resolveWiresFromDrawing(rheemModel);
  const coverage      = computeExtractionCoverage(rheemModel, resolvedWires);
  const interpretation = interpretRheemDrawingModel(rheemModel);

  return {
    analysis,
    structuredData: rheemModel,
    interpretation,
    coverage,
  };
}

// ---------------------------------------------------------------------------
// Vector Text Parser — conservative, deterministic
// ---------------------------------------------------------------------------

/**
 * Extract wire, connector, and terminal records from vector-style drawing text.
 *
 * Rules:
 *   - Wire records: must have gauge OR length AND a wire ID token.
 *   - Connector records: must have an explicit connector designator (J/P/CN).
 *   - Terminal records: part-number-only lines, short, no wire context.
 *   - No topology reconstruction.
 *   - No connector-to-wire assignment.
 *   - Do NOT fabricate fields — only populate what regex clearly extracts.
 */
export function parseVectorStructuredText(text: string): VectorStructuredModel {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

  const wires:      VectorWireRecord[]      = [];
  const connectors: VectorConnectorRecord[] = [];
  const terminals:  VectorTerminalRecord[]  = [];
  const notes:      string[]                = [];

  // ── Patterns ─────────────────────────────────────────────────────────────
  const GAUGE_RE       = /\b(\d{1,2})\s*(?:AWG|GA(?:UGE)?)\b/i;
  const COLOR_RE       = /\b(RED|BLACK|BLK|WHITE|WHT|BLUE|BLU|GREEN|GRN|YELLOW|YEL|ORANGE|ORN|PINK|PNK|VIOLET|VIO|GRAY|GRA|GRY|GREY|BROWN|BRN|TAN|NATURAL|NAT|PURPLE|PUR)\b/i;
  const LENGTH_RE      = /\b(\d{1,4}(?:\.\d{1,3})?)\s*(?:IN|")/i;
  const WIRE_ID_RE     = /\b(W\d{1,4}|CKT[-\s]?\d{1,3}|\d{3,4})\b/;
  const CONN_ID_RE     = /\b([JP]\d{1,3}|CN\d{1,3})\b/i;
  const TERMINAL_PN_RE = /\b(\d{1,4}-\d{4,9}(?:-\d{1,4})?)\b/;
  const ACI_PN_RE      = /\b(NH\d{2}-\d{5,6}-\d{2}|ACI-?\d{5,8})\b/i;
  const NOTE_RE        = /^NOTE[S]?\s*[:.\d]/i;

  for (const line of lines) {
    // ── Notes ────────────────────────────────────────────────────────────
    if (NOTE_RE.test(line)) {
      notes.push(line);
      continue;
    }

    const gaugeMatch   = GAUGE_RE.exec(line);
    const lengthMatch  = LENGTH_RE.exec(line);
    const wireIdMatch  = WIRE_ID_RE.exec(line);
    const connIdMatch  = CONN_ID_RE.exec(line);

    // ── Connector records ─────────────────────────────────────────────────
    // Explicit connector designator (J/P/CN) takes priority.
    if (connIdMatch) {
      const pnMatch = ACI_PN_RE.exec(line) ?? TERMINAL_PN_RE.exec(line);
      connectors.push({
        rawText:     line,
        connectorId: connIdMatch[1],
        partNumber:  pnMatch?.[1] ?? null,
      });
      continue; // don't double-classify as wire
    }

    // ── Wire records ──────────────────────────────────────────────────────
    // Require both a wire ID AND (gauge OR length) — conservative threshold.
    if (wireIdMatch && (gaugeMatch ?? lengthMatch)) {
      const colorMatch = COLOR_RE.exec(line);
      const pnMatch    = ACI_PN_RE.exec(line);

      const rawLength = lengthMatch ? parseFloat(lengthMatch[1]) : null;
      const length = (rawLength !== null && !isNaN(rawLength) && rawLength > 0) ? rawLength : null;

      wires.push({
        rawText:    line,
        wireId:     wireIdMatch[1],
        gauge:      gaugeMatch    ? `${gaugeMatch[1]} AWG` : null,
        color:      colorMatch    ? colorMatch[1].toUpperCase() : null,
        length,
        partNumber: pnMatch?.[1]  ?? null,
      });
      continue;
    }

    // ── Terminal records ──────────────────────────────────────────────────
    // Part-number-only lines: short, no gauge/length/wire-ID context.
    // Conservative: only lines under 60 chars with a clear PN and no other signals.
    const termPnMatch = TERMINAL_PN_RE.exec(line);
    if (
      termPnMatch        &&
      line.length < 60   &&
      !gaugeMatch        &&
      !lengthMatch       &&
      !wireIdMatch
    ) {
      terminals.push({
        rawText:    line,
        partNumber: termPnMatch[1],
      });
    }
  }

  return { source: 'VECTOR_TEXT', wires, connectors, terminals, notes };
}
