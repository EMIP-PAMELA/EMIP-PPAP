/**
 * AI Drawing Assist Service — Phase 3H.48 C10.2
 *
 * Conditional AI interpretation layer for weak or ambiguous drawing cases.
 * Activates ONLY when the deterministic pipeline produces low-confidence results.
 *
 * Architecture:
 *   - runAIDrawingAssist: async stub — real API integration deferred to future phase.
 *   - mergeAIAssist: non-destructive merge — deterministic results always win.
 *   - AI-derived fields are clearly distinguished via evidence strings.
 *
 * Governance:
 *   - AI is OPTIONAL and FAIL-SAFE. Never blocks the pipeline.
 *   - Deterministic extraction is ALWAYS the baseline.
 *   - AI may only FILL missing fields, NEVER overwrite confident existing values.
 *   - No DB writes. No side effects outside of interpretation enrichment.
 *   - Real AI API (e.g. GPT-4o) must be injected in a future phase — not here.
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
// AI Invocation — Stub
// ---------------------------------------------------------------------------

/**
 * Invoke AI-assisted drawing interpretation.
 *
 * CURRENT STATE: Stub only. Returns null (no-op).
 * This preserves the full integration surface (types, logging, activation logic)
 * without introducing a real API dependency in this phase.
 *
 * When activating the real AI path:
 *   1. Replace the stub body with an LLM API call (e.g. GPT-4o structured output).
 *   2. Pass input.rawText as the user message.
 *   3. Parse the structured JSON response into AIAssistResult.
 *   4. Keep the try-catch in the caller — never let AI failure surface.
 */
export async function runAIDrawingAssist(input: AIAssistInput): Promise<AIAssistResult | null> {
  console.log('[AI ASSIST TRIGGERED]', {
    mode:               input.mode,
    interpretationScore: input.interpretation?.interpretationScore,
  });

  // Phase C10.2: Stub — real AI integration is deferred.
  // Returning null is safe: callers skip the merge step when null is received.
  return null;
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
