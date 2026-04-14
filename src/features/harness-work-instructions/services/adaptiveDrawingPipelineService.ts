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
 *   - AI assist is conditional (Phase C10.2): stub-only, fail-safe, never blocking.
 *   - No DB writes. No mandatory AI dependency.
 *   - All failures fall back gracefully; never crashes the ingestion pipeline.
 *   - Vector path is conservative — only extracts clearly present fields.
 *     No topology reconstruction. No connector-to-wire linking in this phase.
 */

import { detectRheemDrawing, parseRheemDrawing } from './rheemDrawingParser';
import { resolveWiresFromDrawing } from './wireResolutionService';
import { computeExtractionCoverage, type ExtractionCoverage } from './extractionCoverageService';
import { interpretRheemDrawingModel, type DrawingInterpretationResult } from './drawingInterpretationService';
import { runAIDrawingAssist, mergeAIAssist } from './aiDrawingAssistService';
import {
  runAIDrawingVisionParse,
  mergeVisionParsedData,
  type VisionParsedDrawingResult,
} from './aiDrawingVisionService';

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
  /** Phase 3H.48 C10.2: True when AI assist ran and filled at least one wire field. */
  aiAssistApplied?: boolean;
  /** Phase 3H.51 C13: Universal AI vision parse result for field authority resolver. */
  visionParsedResult?: VisionParsedDrawingResult | null;
  /** Phase 3H.51 C13: True when vision parse ran and produced a result. */
  visionParseApplied?: boolean;
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

  // Phase 3H.48 C10.2: Conditional AI assist — activates only on weak interpretation cases.
  let aiAssistApplied = false;
  if (shouldRunAIAssist({ mode: analysis.mode, interpretation: result.interpretation })) {
    try {
      const aiResult = await runAIDrawingAssist({
        rawText:        args.extractedText,
        mode:           analysis.mode,
        interpretation: result.interpretation,
      });

      console.log('[AI ASSIST RESULT]', {
        applied:       Boolean(aiResult),
        wiresEnhanced: aiResult?.wires?.length ?? 0,
      });

      if (aiResult && result.interpretation) {
        result = {
          ...result,
          interpretation: mergeAIAssist(result.interpretation, aiResult),
        };
        aiAssistApplied = true;
      }
    } catch (err) {
      console.warn('[AI ASSIST] AI assist step failed — continuing with base interpretation', {
        fileName,
        mode:  analysis.mode,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  result = { ...result, aiAssistApplied };

  // Phase 3H.51 C13: Universal AI vision parse — supplements ALL modes.
  // Runs after deterministic paths; never overwrites trusted structured data.
  let visionParsedResult: VisionParsedDrawingResult | null = null;
  let visionParseApplied = false;
  try {
    visionParsedResult = await runAIDrawingVisionParse({
      fileName:      fileName,
      documentType:  args.docType,
      extractedText: text,
    });

    if (visionParsedResult) {
      visionParseApplied = true;
      // Merge vision output into structuredData additively (deterministic wins)
      const mergedStructured = mergeVisionParsedData({
        deterministicStructuredData: result.structuredData,
        visionResult:                visionParsedResult,
      });
      result = { ...result, structuredData: mergedStructured ?? result.structuredData };
    }
  } catch (err) {
    console.warn('[ADAPTIVE DRAWING PIPELINE] C13 vision parse failed — continuing', {
      fileName,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  result = { ...result, visionParsedResult, visionParseApplied };

  console.log('[ADAPTIVE DRAWING RESULT]', {
    mode:              result.analysis.mode,
    hasStructuredData: Boolean(result.structuredData),
    hasInterpretation: Boolean(result.interpretation),
    hasCoverage:       Boolean(result.coverage),
    aiAssistApplied,
  });

  return result;
}

// ---------------------------------------------------------------------------
// Activation Guard — shouldRunAIAssist
// ---------------------------------------------------------------------------

/**
 * Determine whether the AI assist layer should be invoked for this drawing.
 *
 * Conditions (any one triggers AI):
 *   - Mode is HYBRID_UNKNOWN (ambiguous; deterministic result likely incomplete)
 *   - Mode is RASTER_OCR AND interpretation score is below 75
 *   - Any unresolved fields remain in the interpretation
 *
 * NEVER triggers for strong VECTOR_STRUCTURED results.
 */
function shouldRunAIAssist(args: {
  mode: DrawingProcessingMode;
  interpretation?: DrawingInterpretationResult;
}): boolean {
  if (args.mode === 'HYBRID_UNKNOWN') return true;
  if (args.mode === 'RASTER_OCR' && (args.interpretation?.interpretationScore ?? 0) < 75) return true;
  if ((args.interpretation?.unresolved.length ?? 0) > 0) return true;
  return false;
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
