/**
 * AI Drawing Assist Service — Phase 3H.48 C10.3
 *
 * Conditional AI interpretation layer for weak or ambiguous drawing cases.
 * Activates ONLY when the deterministic pipeline produces low-confidence results.
 *
 * Architecture:
 *   - callAIModel:          posts to /api/ai/drawing-assist (Anthropic Claude proxy)
 *   - buildAIPrompt:        constructs structured prompt with missing-field context
 *   - safeParseAIResponse:  parses and validates the raw Claude JSON output
 *   - sanitizeAIResult:     strips malformed wire records before merge
 *   - runAIDrawingAssist:   orchestrates all of the above; returns null on any failure
 *   - mergeAIAssist:        non-destructive merge — deterministic results always win
 *
 * Governance:
 *   - AI is OPTIONAL and FAIL-SAFE. Never blocks the pipeline.
 *   - Deterministic extraction is ALWAYS the baseline — AI fills gaps only.
 *   - AI may only FILL missing fields, NEVER overwrite confident existing values.
 *   - All AI-derived fields are tagged in evidence strings for auditability.
 *   - No DB writes. No side effects outside of interpretation enrichment.
 */

import type {
  DrawingInterpretationResult,
  InterpretedWire,
} from './drawingInterpretationService';
import type { DrawingProcessingMode } from './adaptiveDrawingPipelineService';

// ---------------------------------------------------------------------------
// I/O Types
// ---------------------------------------------------------------------------

export interface AIAssistInput {
  rawText?: string | null;
  mode: DrawingProcessingMode;
  interpretation?: DrawingInterpretationResult;
}

export interface AIAssistWire {
  wireId: string;
  from?: {
    connectorId?: string;
    pin?: string | number;
  };
  to?: {
    terminalPartNumber?: string;
  };
  attributes?: {
    length?: number | null;
    gauge?: string | null;
    color?: string | null;
  };
  /** 0–1 confidence as reported by the AI model. Used for merge gating in future phases. */
  confidence: number;
  /** Short natural-language explanation from the AI model for this wire record. */
  reasoning?: string;
}

export interface AIAssistResult {
  wires?: AIAssistWire[];
  partNumber?: string | null;
  revision?: string | null;
}

// ---------------------------------------------------------------------------
// AI Invocation — Real Implementation (Phase C10.3)
// ---------------------------------------------------------------------------

/** Base URL for internal API calls from server-side service code. */
const AI_ROUTE_BASE =
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.NEXTAUTH_URL ??
  'http://localhost:3000';

/**
 * POST the pre-built prompt to the /api/ai/drawing-assist route.
 * Returns the raw text content string on success, or null on any failure.
 * The caller owns all JSON parsing and validation.
 */
async function callAIModel(prompt: string): Promise<string | null> {
  try {
    const res = await fetch(`${AI_ROUTE_BASE}/api/ai/drawing-assist`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ prompt }),
    });

    if (!res.ok) return null;

    const json = await res.json();
    return json?.content ?? null;
  } catch (err) {
    console.error('[AI CALL ERROR]', err);
    return null;
  }
}

/**
 * Build the structured prompt sent to the AI model.
 *
 * Constraints enforced in the prompt:
 *   - Explicitly prohibits overwriting existing values.
 *   - Requires null for any field that cannot be determined.
 *   - Limits drawing text to 8 000 chars to avoid token overflow.
 *   - Passes both the current interpretation and the unresolved field list
 *     so the model has precise, scoped context.
 */
function buildAIPrompt(input: AIAssistInput): string {
  return `You are an electrical harness engineer.

You are given:
1. Extracted drawing text
2. A partially interpreted wire model
3. Known missing fields

Your job:
ONLY fill in missing values. DO NOT overwrite existing values.

If a value cannot be determined, return null.

Return STRICT JSON only.

Schema:
{
  "wires": [
    {
      "wireId": "string",
      "from": { "connectorId": "string|null", "pin": "string|number|null" },
      "to": { "terminalPartNumber": "string|null" },
      "attributes": {
        "length": "number|null",
        "gauge": "string|null",
        "color": "string|null"
      },
      "confidence": "number (0–1)",
      "reasoning": "short explanation"
    }
  ]
}

Context:
Extracted Text:
${input.rawText?.slice(0, 8000) ?? ''}

Existing Interpretation:
${JSON.stringify(input.interpretation?.wires ?? [], null, 2)}

Missing Fields:
${JSON.stringify(input.interpretation?.unresolved ?? [], null, 2)}`;
}

/**
 * Parse and minimally validate the raw text returned by the AI model.
 * Returns null if the text is not valid JSON or does not contain a wires array.
 */
function safeParseAIResponse(text: string): AIAssistResult | null {
  try {
    // Extract first JSON object — Claude may occasionally prepend/append whitespace
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed: unknown = JSON.parse(jsonMatch[0]);

    if (!parsed || typeof parsed !== 'object') return null;
    if (!Array.isArray((parsed as { wires?: unknown }).wires)) return null;

    return parsed as AIAssistResult;
  } catch (err) {
    console.warn('[AI PARSE FAILED]', err);
    return null;
  }
}

/**
 * Strip malformed wire records from the AI result.
 * A wire record is valid only when wireId is a non-empty string.
 * Confidence is clamped to [0, 1].
 */
function sanitizeAIResult(result: AIAssistResult): AIAssistResult {
  return {
    ...result,
    wires: result.wires
      ?.filter(w => typeof w.wireId === 'string' && w.wireId.trim().length > 0)
      .map(w => ({
        ...w,
        confidence: Math.max(0, Math.min(1, w.confidence ?? 0)),
      })),
  };
}

/**
 * Invoke AI-assisted drawing interpretation.
 *
 * Flow:
 *   1. Log trigger context.
 *   2. Guard: return null immediately if no raw text available.
 *   3. Build prompt, POST to Claude proxy route.
 *   4. Log raw output preview.
 *   5. Parse + validate response.
 *   6. Sanitize (strip invalid wires, clamp confidence).
 *   7. Return sanitized result, or null on any failure.
 */
export async function runAIDrawingAssist(input: AIAssistInput): Promise<AIAssistResult | null> {
  console.log('[AI ASSIST TRIGGERED]', {
    mode:                input.mode,
    interpretationScore: input.interpretation?.interpretationScore,
  });

  if (!input.rawText) return null;

  const prompt = buildAIPrompt(input);

  const raw = await callAIModel(prompt);

  console.log('[AI RAW OUTPUT]', raw?.slice(0, 500));

  if (!raw) return null;

  const parsed = safeParseAIResponse(raw);

  if (!parsed) {
    console.warn('[AI INVALID OUTPUT]', { rawPreview: raw.slice(0, 200) });
    return null;
  }

  console.log('[AI PARSED OUTPUT]', {
    wires: parsed.wires?.length ?? 0,
  });

  return sanitizeAIResult(parsed);
}

// ---------------------------------------------------------------------------
// Merge Helper — Non-Destructive
// ---------------------------------------------------------------------------

/**
 * Merge AI-derived wire data into a deterministic interpretation result.
 *
 * Merge rules (strictly enforced):
 *   - Existing confident fields are NEVER overwritten.
 *   - AI fills only fields that are currently null / undefined / unresolved.
 *   - Confidence is bumped +0.10 (capped at 1.0) only when a field is actually filled.
 *   - AI evidence is appended to the wire's existing evidence trail.
 *   - Resolved fields are removed from unresolvedFields.
 *   - interpretationScore and unresolved summary are NOT recomputed here —
 *     they reflect the deterministic baseline and are recomputed in a future phase
 *     when the wire model is re-evaluated end-to-end.
 *
 * This function is pure — it returns a new object and does not mutate its inputs.
 */
export function mergeAIAssist(
  base: DrawingInterpretationResult,
  ai: AIAssistResult,
): DrawingInterpretationResult {
  if (!ai.wires || ai.wires.length === 0) {
    return base;
  }

  const aiWireMap = new Map<string, AIAssistWire>(
    ai.wires.map(w => [w.wireId, w]),
  );

  const mergedWires: InterpretedWire[] = base.wires.map(wire => {
    const aiWire = aiWireMap.get(wire.wireId);
    if (!aiWire) return wire;

    // ── Fill missing fields (never overwrite) ─────────────────────────────
    const filledFields: string[] = [];

    const newConnectorId =
      !wire.from.connectorId && aiWire.from?.connectorId
        ? aiWire.from.connectorId
        : wire.from.connectorId;
    if (newConnectorId !== wire.from.connectorId) filledFields.push('connectorId');

    const newPin =
      wire.from.pin == null && aiWire.from?.pin != null
        ? aiWire.from.pin
        : wire.from.pin;
    if (newPin !== wire.from.pin) filledFields.push('pin');

    const newTerminal =
      !wire.to.terminalPartNumber && aiWire.to?.terminalPartNumber
        ? aiWire.to.terminalPartNumber
        : wire.to.terminalPartNumber;
    if (newTerminal !== wire.to.terminalPartNumber) filledFields.push('terminalPartNumber');

    const newLength =
      wire.attributes.length == null && (aiWire.attributes?.length ?? null) != null
        ? aiWire.attributes!.length!
        : wire.attributes.length;
    if (newLength !== wire.attributes.length) filledFields.push('length');

    const newGauge =
      !wire.attributes.gauge && aiWire.attributes?.gauge
        ? aiWire.attributes.gauge
        : wire.attributes.gauge;
    if (newGauge !== wire.attributes.gauge) filledFields.push('gauge');

    const newColor =
      !wire.attributes.color && aiWire.attributes?.color
        ? aiWire.attributes.color
        : wire.attributes.color;
    if (newColor !== wire.attributes.color) filledFields.push('color');

    // ── Nothing filled → return wire unchanged ────────────────────────────
    if (filledFields.length === 0) return wire;

    // ── Bump confidence only when fields were actually filled ─────────────
    const newConfidence = Math.min(wire.confidence + 0.10, 1.0);

    // ── Append evidence ───────────────────────────────────────────────────
    const newEvidence = [
      ...wire.evidence,
      `AI assist filled: ${filledFields.join(', ')}`,
      ...(aiWire.reasoning ? [`AI reasoning: ${aiWire.reasoning}`] : []),
    ];

    // ── Remove resolved fields from unresolved list ───────────────────────
    const resolvedSet = new Set(filledFields);
    const newUnresolvedFields = wire.unresolvedFields.filter(f => !resolvedSet.has(f));

    return {
      ...wire,
      from: {
        connectorId: newConnectorId,
        pin:         newPin,
      },
      to: {
        terminalPartNumber: newTerminal,
      },
      attributes: {
        length: newLength,
        gauge:  newGauge,
        color:  newColor,
      },
      confidence:       newConfidence,
      evidence:         newEvidence,
      unresolvedFields: newUnresolvedFields,
    };
  });

  return {
    ...base,
    wires: mergedWires,
  };
}
