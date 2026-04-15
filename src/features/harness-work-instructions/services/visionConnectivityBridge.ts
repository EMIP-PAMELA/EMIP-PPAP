/**
 * Vision → Connectivity Bridge — Phase T10
 *
 * Constructs a T2-compatible HarnessConnectivityResult from a VisionParsedDrawingResult
 * when deterministic T1/T2 did not produce wireTableResult / harnessConnectivity.
 *
 * Governance:
 *   - Pure function. No I/O, no DB, no side effects. Never throws.
 *   - ONLY used as fallback when harnessConnectivity is null after T2.
 *   - NEVER overwrites a non-null deterministic harnessConnectivity.
 *   - Produces the same WireConnectivity / HarnessConnectivityResult shapes as T2.
 *   - Ambiguity is preserved, never collapsed.
 *   - Single-connector fallback only applies when exactly 1 connector exists in vision output.
 */

import type { WireEndpoint, WireConnectivity, HarnessConnectivityResult } from './harnessConnectivityService';
import { endpointHasAuthoritativeTermination, inferTerminationType } from './harnessConnectivityService';
import type { VisionParsedDrawingResult } from './aiDrawingVisionService';
import type { LengthUnit } from './unitInferenceService';
import { resolveDrawingLengthUnit } from './unitInferenceService';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Normalize pin to string cavity, or null. */
function normalizeCavity(pin: string | number | null | undefined): string | null {
  if (pin === null || pin === undefined) return null;
  const s = String(pin).trim();
  return s.length > 0 ? s : null;
}

/**
 * Compute confidence conservatively from field completeness.
 * Starts from the vision wire confidence, then applies penalties
 * for missing fields so we never inflate.
 *
 *   - start: vision wire confidence (clamped to [0, 1])
 *   - missing from.component : −0.15
 *   - missing from.cavity    : −0.10
 *   - missing to.component   : −0.20
 *   - unresolved flag        : −0.10 additional
 */
function computeBridgedConfidence(
  visionConfidence: number,
  fromComponent: string | null,
  fromCavity: string | null,
  toComponent: string | null,
  unresolved: boolean,
): number {
  let score = Math.max(0, Math.min(1, visionConfidence));
  if (!fromComponent) score -= 0.15;
  if (!fromCavity)    score -= 0.10;
  if (!toComponent)   score -= 0.20;
  if (unresolved)     score -= 0.10;
  return Math.max(0, Math.min(1, score));
}

// ---------------------------------------------------------------------------
// Primary export
// ---------------------------------------------------------------------------

/**
 * Build a T2-compatible HarnessConnectivityResult from AI vision output.
 *
 * For each VisionParsedWire:
 *   - FROM  → connectorId  (with single-connector fallback) + pin as cavity
 *   - TO    → terminalPartNumber
 *   - unresolved when either endpoint is null (after fallback)
 *
 * Single-connector fallback:
 *   When exactly ONE connector exists in visionParsedResult.connectors[] and a
 *   wire's from.connectorId is null but pin is present, the sole connector's id
 *   is assigned as from.component. Does NOT apply when >1 connectors are present.
 *
 * @returns null when vision.wires is empty or absent.
 */
export function buildHarnessConnectivityFromVision(
  vision: VisionParsedDrawingResult,
): HarnessConnectivityResult | null {
  if (!vision.wires || vision.wires.length === 0) return null;

  // Single-connector fallback — only when exactly 1 connector in vision result
  const connectors = vision.connectors ?? [];
  const singleConnector = connectors.length === 1 ? connectors[0] : null;

  const wires: WireConnectivity[] = [];
  const unresolvedWires: string[] = [];

  for (let i = 0; i < vision.wires.length; i++) {
    const vw = vision.wires[i];
    const wireId = (vw.wireId ?? '').trim() || `VIS_${i + 1}`;

    // ── FROM endpoint ────────────────────────────────────────────────────
    let fromComponent: string | null = vw.from?.connectorId ?? null;
    const cavity = normalizeCavity(vw.from?.pin ?? null);

    // Single-connector fallback: assign sole connector when connectorId null but pin present
    if (!fromComponent && singleConnector && cavity !== null) {
      fromComponent = singleConnector.id;
    }

    const from: WireEndpoint = {
      component: fromComponent,
      cavity,
      treatment: null,
      terminationType: inferTerminationType({ component: fromComponent, cavity, treatment: null, rawText: vw.evidence?.join(' ') ?? '' }),
    };

    // ── TO endpoint ──────────────────────────────────────────────────────
    const toComponent = vw.to?.terminalPartNumber ?? null;
    const to: WireEndpoint = {
      component: toComponent,
      cavity:    null,
      treatment: null,
      terminationType: inferTerminationType({ component: toComponent, cavity: null, treatment: null, rawText: vw.evidence?.join(' ') ?? '' }),
    };

    // ── Unresolved ───────────────────────────────────────────────────────
    const unresolved = !endpointHasAuthoritativeTermination(from) || !endpointHasAuthoritativeTermination(to);

    // ── Confidence (conservative) ────────────────────────────────────────
    const confidence = computeBridgedConfidence(
      vw.confidence ?? 0,
      from.component,
      from.cavity,
      to.component,
      unresolved,
    );

    // ── Raw text (evidence string) ───────────────────────────────────────
    const rawText = [
      wireId,
      vw.gauge     ? vw.gauge             : null,
      vw.color     ? vw.color             : null,
      vw.length !== null && vw.length !== undefined ? `${vw.length}in` : null,
      from.component ? `FROM:${from.component}` : null,
      cavity         ? `PIN:${cavity}`           : null,
      to.component   ? `TO:${to.component}`      : null,
      ...(vw.evidence ?? []),
    ].filter(Boolean).join(' ');

    const rawLength = vw.length ?? null;
    const inferredUnit: LengthUnit | null = rawLength !== null ? resolveDrawingLengthUnit() : null;
    const lengthInches: number | null = rawLength;

    const wire: WireConnectivity = {
      wireId,
      length:         rawLength,
      lengthUnit:     inferredUnit,
      lengthInches,
      gauge:          vw.gauge  ?? null,
      color:          vw.color  ?? null,
      from,
      to,
      sourceRowIndex: i,
      rawText,
      confidence,
      unresolved,
    };

    wires.push(wire);
    if (unresolved) unresolvedWires.push(wireId);
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  const total = wires.length;
  let resolved        = 0;
  let partial         = 0;
  let unresolvedCount = 0;

  for (const w of wires) {
    if (w.unresolved) {
      unresolvedCount++;
    } else if (endpointHasAuthoritativeTermination(w.from) && endpointHasAuthoritativeTermination(w.to)) {
      resolved++;
    } else {
      partial++;
    }
  }

  console.log('[T10 BRIDGE] buildHarnessConnectivityFromVision', {
    total,
    resolved,
    partial,
    unresolved:             unresolvedCount,
    singleConnectorFallback: Boolean(singleConnector),
    connectorCount:          connectors.length,
  });

  return {
    wires,
    unresolvedWires,
    confidenceSummary: { total, resolved, partial, unresolved: unresolvedCount },
  };
}
