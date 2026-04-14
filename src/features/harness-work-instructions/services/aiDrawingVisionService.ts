/**
 * AI Drawing Vision Service — Phase 3H.51 C13
 *
 * Universal structured extraction layer that applies to BOTH Apogee (internal)
 * and Rheem (customer) drawings. Uses Claude as a vision/text-understanding
 * model to produce a structured drawing model that supplements — but NEVER
 * replaces — deterministic extraction.
 *
 * This service:
 *   - builds a structured prompt describing the drawing extraction schema
 *   - calls the /api/ai/drawing-vision-parse route (Claude proxy)
 *   - parses and sanitizes the returned JSON strictly
 *   - exposes a normalizer that maps vision output to ParsedDrawingDataPanel format
 *   - exposes a merge layer (deterministic-first) for adaptive pipeline integration
 *
 * Governance:
 *   - AI is OPTIONAL and FAIL-SAFE. Errors return null, never throw.
 *   - Deterministic extraction ALWAYS wins over AI vision for trusted fields.
 *   - AI_VISION candidates rank below TITLE_BLOCK_REGION and above weak HEURISTIC.
 *   - Never fabricates revision, PN, or wire topology from nothing.
 *   - All AI-derived output is tagged in evidence strings for auditability.
 *   - No DB writes. No side effects outside of enriching the pipeline result.
 */

// ---------------------------------------------------------------------------
// Core Output Types (spec-mandated)
// ---------------------------------------------------------------------------

export type VisionParsedWire = {
  wireId: string;
  length: number | null;
  gauge: string | null;
  color: string | null;
  from?: {
    connectorId?: string | null;
    pin?: string | number | null;
  };
  to?: {
    terminalPartNumber?: string | null;
  };
  confidence: number;
  evidence?: string[];
};

export type VisionParsedConnector = {
  id: string;
  manufacturer?: string | null;
  partNumber?: string | null;
  color?: string | null;
  confidence: number;
};

export type VisionParsedMetadata = {
  partNumber: string | null;
  drawingNumber: string | null;
  revision: string | null;
};

export type VisionParsedDrawingResult = {
  metadata: VisionParsedMetadata;
  wires: VisionParsedWire[];
  connectors: VisionParsedConnector[];
  notes: string[];
  confidence: number;
};

// ---------------------------------------------------------------------------
// Display Model — compatible with ParsedDrawingDataPanel
// ---------------------------------------------------------------------------

/**
 * Normalized form of the vision result for display in ParsedDrawingDataPanel.
 * Field names match exactly what the panel reads via duck-typing.
 */
export type VisionDisplayModel = {
  source: 'AI_VISION';
  partNumber: string | null;
  revision: string | null;
  description: string | null;
  wires: Array<{
    id: string;
    length: number | null;
    gauge: string | null;
    color: string | null;
    pin: number | null;
  }>;
  connectors: Array<{
    manufacturer: string | null;
    partNumber: string | null;
    torque: string | null;
    color: string | null;
  }>;
  notes: {
    tolerances: string[];
    instructions: string[];
  };
  parseQuality: {
    wireTableDetected: boolean;
    connectorTableDetected: boolean;
    titleBlockDetected: boolean;
    wireCount: number;
    connectorCount: number;
    toleranceCount: number;
  };
  overallConfidence: number;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AI_ROUTE_BASE =
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.NEXTAUTH_URL ??
  'http://localhost:3000';

const PLACEHOLDER_STRINGS = new Set([
  'string', 'null', 'number', 'example', 'unknown', 'tbd', 'n/a', 'xxx',
  'test', 'placeholder', 'sample', 'value', 'your_value', 'wireId', 'id',
]);

const EXTRACT_TEXT_LIMIT = 10_000;

// ---------------------------------------------------------------------------
// Step 1 — Prompt Builder
// ---------------------------------------------------------------------------

export function buildVisionParsePrompt(args: {
  fileName?: string | null;
  documentType?: string | null;
  extractedText?: string | null;
  /** C12.1: Optional title block layout hint for region-targeted extraction. */
  titleBlockHint?: string | null;
}): string {
  const docHint = args.documentType
    ? `Document type: ${args.documentType}.`
    : '';
  const fileHint = args.fileName
    ? `File name: ${args.fileName}.`
    : '';
  const tbHint = args.titleBlockHint
    ? `\nTITLE BLOCK CONTEXT: ${args.titleBlockHint}`
    : '';

  const text = (args.extractedText ?? '').slice(0, EXTRACT_TEXT_LIMIT);

  return `You are analyzing an electrical harness drawing.
${fileHint} ${docHint}${tbHint}

Extract a COMPLETE structured drawing model from the text below.

RULES:
- If a field cannot be determined, set it to null.
- Do NOT invent wire IDs, part numbers, or revision values.
- Do NOT include schema type comments like "string|null" as actual values.
- Return ONLY valid JSON matching the schema exactly. No markdown fences.
- All confidence values must be numbers between 0.0 and 1.0.
- Evidence strings must be short factual notes, not generic labels.

SCHEMA:
{
  "metadata": {
    "partNumber": "string|null",
    "drawingNumber": "string|null",
    "revision": "string|null"
  },
  "wires": [
    {
      "wireId": "string",
      "length": "number|null",
      "gauge": "string|null",
      "color": "string|null",
      "from": {
        "connectorId": "string|null",
        "pin": "string|number|null"
      },
      "to": {
        "terminalPartNumber": "string|null"
      },
      "confidence": "number 0-1",
      "evidence": ["string"]
    }
  ],
  "connectors": [
    {
      "id": "string",
      "manufacturer": "string|null",
      "partNumber": "string|null",
      "color": "string|null",
      "confidence": "number 0-1"
    }
  ],
  "notes": ["string"],
  "confidence": "number 0-1"
}

DRAWING TEXT:
${text}`;
}

// ---------------------------------------------------------------------------
// Step 2 — HTTP Call
// ---------------------------------------------------------------------------

async function callVisionRoute(prompt: string, imageDataUrls?: string[]): Promise<string | null> {
  try {
    const res = await fetch(`${AI_ROUTE_BASE}/api/ai/drawing-vision-parse`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ prompt, imageDataUrls }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.content ?? null;
  } catch (err) {
    console.error('[AI VISION PARSE CALL ERROR]', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Step 3 — Safe Parse
// ---------------------------------------------------------------------------

export function safeParseVisionResponse(raw: string): VisionParsedDrawingResult | null {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed: unknown = JSON.parse(jsonMatch[0]);
    if (!parsed || typeof parsed !== 'object') return null;

    const obj = parsed as Record<string, unknown>;

    // Require metadata and at least an array for wires
    if (!obj.metadata || typeof obj.metadata !== 'object') return null;
    if (!Array.isArray(obj.wires)) return null;

    return parsed as VisionParsedDrawingResult;
  } catch (err) {
    console.warn('[AI VISION PARSE] JSON parse failed', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Step 4 — Sanitize
// ---------------------------------------------------------------------------

function isPlaceholder(v: unknown): boolean {
  if (typeof v !== 'string') return false;
  return PLACEHOLDER_STRINGS.has(v.trim().toLowerCase());
}

function cleanString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (t.length === 0 || isPlaceholder(t)) return null;
  return t;
}

function clampConf(v: unknown): number {
  const n = typeof v === 'number' ? v : 0;
  return Math.max(0, Math.min(1, n));
}

export function sanitizeVisionResult(result: VisionParsedDrawingResult): VisionParsedDrawingResult {
  const meta = result.metadata ?? {};

  const sanitizedWires: VisionParsedWire[] = (result.wires ?? [])
    .filter(w => typeof w.wireId === 'string' && w.wireId.trim().length > 0 && !isPlaceholder(w.wireId))
    .map(w => ({
      wireId:     w.wireId.trim(),
      length:     typeof w.length === 'number' && w.length > 0 ? w.length : null,
      gauge:      cleanString(w.gauge),
      color:      cleanString(w.color),
      from: {
        connectorId: cleanString(w.from?.connectorId),
        pin:         w.from?.pin ?? null,
      },
      to: {
        terminalPartNumber: cleanString(w.to?.terminalPartNumber),
      },
      confidence: clampConf(w.confidence),
      evidence:   Array.isArray(w.evidence) ? w.evidence.filter(e => typeof e === 'string') : [],
    }));

  const sanitizedConnectors: VisionParsedConnector[] = (result.connectors ?? [])
    .filter(c => typeof c.id === 'string' && c.id.trim().length > 0 && !isPlaceholder(c.id))
    .map(c => ({
      id:           c.id.trim(),
      manufacturer: cleanString(c.manufacturer),
      partNumber:   cleanString(c.partNumber),
      color:        cleanString(c.color),
      confidence:   clampConf(c.confidence),
    }));

  const sanitizedNotes: string[] = (result.notes ?? []).filter(n => typeof n === 'string' && n.trim().length > 0);

  // C11.3: Guard — if AI erroneously returns a 527 drawing number as partNumber, null it
  // and rescue it as drawingNumber so the signal is preserved without poisoning the PN pool.
  const APOGEE_DRN_PATTERN = /^527-\d{4}-010$/i;
  const rawPN  = cleanString(meta.partNumber);
  const rawDRN = cleanString(meta.drawingNumber);
  const pnIsDrawingNumber = Boolean(rawPN && APOGEE_DRN_PATTERN.test(rawPN.trim()));
  const sanitizedPN  = pnIsDrawingNumber ? null : rawPN;
  const sanitizedDRN = rawDRN ?? (pnIsDrawingNumber ? rawPN : null);
  if (pnIsDrawingNumber) {
    console.log('[IDENTIFIER ROLE]', { value: rawPN, classifiedAs: 'DRAWING_NUMBER', context: 'AI_VISION sanitizeVisionResult — partNumber nulled, rescued as drawingNumber' });
  }

  return {
    metadata: {
      partNumber:    sanitizedPN,
      drawingNumber: sanitizedDRN,
      revision:      cleanString(meta.revision),
    },
    wires:      sanitizedWires,
    connectors: sanitizedConnectors,
    notes:      sanitizedNotes,
    confidence: clampConf(result.confidence),
  };
}

// ---------------------------------------------------------------------------
// Step 5 — Main Entry Point
// ---------------------------------------------------------------------------

export async function runAIDrawingVisionParse(args: {
  fileName?: string | null;
  documentType?: string | null;
  extractedText?: string | null;
  imageDataUrls?: string[];
  /** C12.1: Optional title block layout hint forwarded to the vision prompt. */
  titleBlockHint?: string | null;
}): Promise<VisionParsedDrawingResult | null> {
  console.log('[AI VISION PARSE TRIGGERED]', {
    fileName:     args.fileName,
    documentType: args.documentType,
    pageCount:    args.imageDataUrls?.length ?? 0,
  });

  if (!args.extractedText?.trim() && (!args.imageDataUrls?.length)) {
    console.warn('[AI VISION PARSE] No text or images provided — skipping');
    return null;
  }

  try {
    const prompt = buildVisionParsePrompt(args);
    const raw    = await callVisionRoute(prompt, args.imageDataUrls);

    if (!raw) {
      console.warn('[AI VISION PARSE] Empty response from route');
      return null;
    }

    console.log('[AI VISION PARSE RAW OUTPUT]', raw.slice(0, 300));

    const parsed = safeParseVisionResponse(raw);
    if (!parsed) {
      console.warn('[AI VISION PARSE] Invalid JSON structure', { rawPreview: raw.slice(0, 200) });
      return null;
    }

    const sanitized = sanitizeVisionResult(parsed);

    console.log('[AI VISION PARSE RESULT]', {
      metadata:       sanitized.metadata ?? null,
      wireCount:      sanitized.wires?.length ?? 0,
      connectorCount: sanitized.connectors?.length ?? 0,
      confidence:     sanitized.confidence ?? 0,
    });

    return sanitized;
  } catch (err) {
    console.error('[AI VISION PARSE] Unhandled error — returning null', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Step 6 — Normalize to ParsedDrawingDataPanel Display Model
// ---------------------------------------------------------------------------

/**
 * Convert a VisionParsedDrawingResult into the flat display model that
 * ParsedDrawingDataPanel reads. This model is stored as structuredData on
 * IngestionAnalysisResult for Apogee drawings (where no deterministic
 * structured parser exists).
 */
export function normalizeToParsedDrawingDisplayModel(
  result: VisionParsedDrawingResult,
): VisionDisplayModel {
  const wires = (result.wires ?? []).map(w => {
    const rawPin = w.from?.pin;
    const pin: number | null =
      typeof rawPin === 'number' ? rawPin :
      typeof rawPin === 'string' && /^\d+$/.test(rawPin.trim()) ? parseInt(rawPin.trim(), 10) :
      null;

    return {
      id:     w.wireId,
      length: w.length,
      gauge:  w.gauge,
      color:  w.color,
      pin,
    };
  });

  const connectors = (result.connectors ?? []).map(c => ({
    manufacturer: c.manufacturer ?? null,
    partNumber:   c.partNumber   ?? null,
    torque:       null,   // vision doesn't extract torque in this phase
    color:        c.color ?? null,
  }));

  const allNotes = result.notes ?? [];
  const TOLERANCE_RE = /\b(?:TOLERANCE|±|±\d|TOL)\b/i;
  const tolerances   = allNotes.filter(n => TOLERANCE_RE.test(n));
  const instructions = allNotes.filter(n => !TOLERANCE_RE.test(n));

  const titleBlockDetected = Boolean(
    result.metadata?.partNumber || result.metadata?.revision || result.metadata?.drawingNumber,
  );

  return {
    source:      'AI_VISION',
    partNumber:  result.metadata?.partNumber  ?? null,
    revision:    result.metadata?.revision    ?? null,
    description: null,
    wires,
    connectors,
    notes: { tolerances, instructions },
    parseQuality: {
      wireTableDetected:      wires.length > 0,
      connectorTableDetected: connectors.length > 0,
      titleBlockDetected,
      wireCount:      wires.length,
      connectorCount: connectors.length,
      toleranceCount: tolerances.length,
    },
    overallConfidence: result.confidence,
  };
}

// ---------------------------------------------------------------------------
// Step 7 — Merge Layer (deterministic-first)
// ---------------------------------------------------------------------------

/**
 * Merge vision-parsed data with existing deterministic structured data.
 *
 * Rules:
 *   - If no deterministic data → normalize vision result directly.
 *   - If deterministic data is a VectorStructuredModel (source='VECTOR_TEXT')
 *     → normalize vision but inject deterministic wires for any not in vision.
 *   - If deterministic data is a RheemDrawingModel (has .titleBlock)
 *     → return deterministic model unchanged; Rheem parser is authoritative.
 *   - Vision metadata (PN/Rev) NEVER overwrites titleBlockRegionResult values —
 *     that enforcement happens in the field authority resolver layer.
 */
export function mergeVisionParsedData(args: {
  deterministicStructuredData?: unknown;
  visionResult?: VisionParsedDrawingResult | null;
}): unknown {
  const { deterministicStructuredData: det, visionResult: vis } = args;

  console.log('[AI VISION MERGE]', {
    hasDeterministicStructuredData: Boolean(det),
    hasVisionResult:                Boolean(vis),
  });

  if (!vis) return det ?? null;

  // ── Rheem model (has titleBlock property) — authoritative, vision is additive but conservative ──
  if (det && typeof det === 'object' && 'titleBlock' in (det as object)) {
    // In this phase, return Rheem model unchanged. Vision-derived wires/connectors
    // are deferred to a future phase (conflict resolution needed for Rheem tables).
    return det;
  }

  const displayModel = normalizeToParsedDrawingDisplayModel(vis);

  // ── VectorStructuredModel (source === 'VECTOR_TEXT') — inject deterministic wires ──
  if (
    det && typeof det === 'object' &&
    (det as Record<string, unknown>).source === 'VECTOR_TEXT'
  ) {
    const detObj   = det as { wires?: Array<{ wireId?: string | null; rawText?: string; gauge?: string | null; color?: string | null; length?: number | null }> };
    const visWireIds = new Set(displayModel.wires.map(w => w.id));

    const extraWires = (detObj.wires ?? [])
      .filter(vw => vw.wireId && !visWireIds.has(vw.wireId))
      .map(vw => ({
        id:     vw.wireId as string,
        length: typeof vw.length === 'number' ? vw.length : null,
        gauge:  vw.gauge  ?? null,
        color:  vw.color  ?? null,
        pin:    null as number | null,
      }));

    if (extraWires.length > 0) {
      return {
        ...displayModel,
        wires: [...displayModel.wires, ...extraWires],
        parseQuality: {
          ...displayModel.parseQuality,
          wireCount:         displayModel.wires.length + extraWires.length,
          wireTableDetected: true,
        },
      };
    }
  }

  // ── No deterministic data (or unrecognized shape) — use vision model directly ──
  return displayModel;
}
