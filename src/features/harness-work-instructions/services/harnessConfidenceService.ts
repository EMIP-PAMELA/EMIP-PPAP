/**
 * Harness Confidence Service — Phase T8
 * Constraint-Aware Confidence Adjustment Engine
 *
 * Applies deterministic penalties to T5/T6 base confidence scores based on:
 *   - T7 validation issues (per-rule penalty weights)
 *   - Cross-layer disagreement between T5 (reconciliation) and T6 (classification)
 *
 * Produces an adjusted confidence score and final state for each endpoint,
 * preserving the original base confidence for full traceability.
 *
 * Governance:
 *   - Pure function. No I/O, no DB calls, no side effects. Never throws.
 *   - DOES NOT modify T5/T6/T7 outputs.
 *   - DOES NOT overwrite base confidence values.
 *   - DOES NOT use AI. Fully deterministic.
 *   - All penalty reasoning is exposed in ConfidencePenalty[].
 *   - Additive layer — downstream of T5/T6/T7, no upstream mutation.
 *
 * Penalty model summary:
 *   - R1–R10 validation rules → explicit weights (INFO: -0.05, WARNING: -0.10, ERROR: -0.30)
 *   - CROSS_A: CONNECTOR endpoint + T5 NONE match → -0.15
 *   - CROSS_B: base >= 0.8 + any wire validation failure → -0.10
 *   - CROSS_C: AMBIGUOUS classification → -0.20
 *
 * Final state thresholds:
 *   HIGH      >= 0.80
 *   MEDIUM    >= 0.60
 *   LOW       >= 0.30
 *   UNTRUSTED  < 0.30
 */

import type { HarnessConnectivityResult } from './harnessConnectivityService';
import type { HarnessReconciliationResult, ReconciledEndpoint, ReconciledWire } from './harnessReconciliationService';
import type {
  HarnessEndpointClassificationResult,
  ClassifiedEndpoint,
} from './endpointClassifier';
import type { HarnessValidationResult, ValidationIssue, WireValidation } from './harnessValidationService';
import { RULE_SEVERITIES } from './harnessValidationService';

// ---------------------------------------------------------------------------
// Data Model
// ---------------------------------------------------------------------------

export type FinalState = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNTRUSTED';

export interface ConfidencePenalty {
  code: string;
  severity: 'INFO' | 'WARNING' | 'ERROR';
  impact: number;
  reason: string;
}

export interface EndpointConfidence {
  /** Original T6 (or T5 fallback) confidence score — never modified. */
  baseConfidence: number;
  /** baseConfidence minus all applied penalties, clamped to [0, 1]. */
  adjustedConfidence: number;
  penalties: ConfidencePenalty[];
  finalState: FinalState;
}

export interface WireConfidence {
  wireId: string;
  from: EndpointConfidence;
  to: EndpointConfidence;
  /** Conservative wire-level signal: min(from.adjusted, to.adjusted). */
  overallConfidence: number;
}

export interface HarnessConfidenceResult {
  wires: WireConfidence[];
  summary: {
    avgConfidence: number;
    high: number;
    medium: number;
    low: number;
    untrusted: number;
  };
}

// ---------------------------------------------------------------------------
// Penalty tables
// ---------------------------------------------------------------------------

/**
 * Explicit penalty weight per validation rule code.
 * Matches the spec-defined severity → impact mapping with per-rule overrides.
 */
export const RULE_PENALTY: Record<string, number> = {
  R1_CONNECTOR_NO_PIN:          0.10,
  R2_OPEN_OPEN:                 0.10,
  R3_TERMINAL_TERMINAL:         0.05,
  R4_CONNECTOR_CONNECTOR:       0.10,
  R5_SPLICE_SOLO:               0.10,
  R6_AMBIGUOUS_ENDPOINT:        0.10,
  R7_UNMATCHED_RECONCILIATION:  0.10,
  R8_MISSING_TERMINATION:       0.30,
  R9_CONNECTOR_SINGLE_WIRE:     0.10,
  R10_CONFIDENCE_CONFLICT:      0.30,
};

/** Fallback penalty for unknown codes — derived from severity. */
const SEVERITY_FALLBACK_IMPACT: Record<'INFO' | 'WARNING' | 'ERROR', number> = {
  INFO:    0.05,
  WARNING: 0.10,
  ERROR:   0.30,
};

/** Cross-layer penalty: CONNECTOR classified but no T5 diagram match. */
const CROSS_A_IMPACT = 0.15;
/** Cross-layer penalty: high base confidence contradicted by validation failure. */
const CROSS_B_IMPACT = 0.10;
/** Cross-layer penalty: AMBIGUOUS T6 classification (tie not resolved). */
const CROSS_C_IMPACT = 0.20;

// ---------------------------------------------------------------------------
// Final state thresholds
// ---------------------------------------------------------------------------

function computeFinalState(conf: number): FinalState {
  if (conf >= 0.80) return 'HIGH';
  if (conf >= 0.60) return 'MEDIUM';
  if (conf >= 0.30) return 'LOW';
  return 'UNTRUSTED';
}

// ---------------------------------------------------------------------------
// Issue scope detection
// ---------------------------------------------------------------------------

/**
 * Determines whether a T7 ValidationIssue applies to the FROM endpoint,
 * TO endpoint, or BOTH endpoints.
 *
 * Strategy:
 *   - Check message for 'FROM ENDPOINT', 'CONNECTOR FROM', '(FROM)' → FROM
 *   - Check message for 'TO ENDPOINT', '(TO)' → TO
 *   - Check details prefix 'from:' / 'to:' as secondary signal
 *   - Default: BOTH (wire-wide issue)
 */
function issueScope(issue: ValidationIssue): 'FROM' | 'TO' | 'BOTH' {
  const msg = issue.message.toUpperCase();
  const det = (issue.details ?? '').toLowerCase();

  if (
    msg.includes('FROM ENDPOINT') ||
    msg.includes('CONNECTOR FROM') ||
    msg.includes('(FROM)') ||
    det.startsWith('from:')
  ) return 'FROM';

  if (
    msg.includes('TO ENDPOINT') ||
    msg.includes('(TO)') ||
    det.startsWith('to:')
  ) return 'TO';

  return 'BOTH';
}

// ---------------------------------------------------------------------------
// Base confidence selection
// ---------------------------------------------------------------------------

/**
 * Selects the base confidence for an endpoint.
 * Priority: T6 classification confidence > T5 reconciliation confidence > 0.
 */
function selectBase(
  t6: ClassifiedEndpoint | undefined,
  t5: ReconciledEndpoint | undefined,
): number {
  if (t6) return t6.confidence;
  if (t5) return t5.confidence;
  return 0;
}

// ---------------------------------------------------------------------------
// Per-endpoint confidence adjustment
// ---------------------------------------------------------------------------

function adjustEndpoint(
  side:                  'FROM' | 'TO',
  base:                  number,
  t6:                    ClassifiedEndpoint | undefined,
  t5:                    ReconciledEndpoint | undefined,
  wireIssues:            ValidationIssue[],
  wireHasValidationFail: boolean,
): EndpointConfidence {
  const penalties: ConfidencePenalty[] = [];

  // ── Rule-level penalties from T7 issues ──────────────────────────────────
  for (const issue of wireIssues) {
    const scope = issueScope(issue);
    if (scope !== 'BOTH' && scope !== side) continue;

    const impact = RULE_PENALTY[issue.code]
      ?? SEVERITY_FALLBACK_IMPACT[RULE_SEVERITIES[issue.code] ?? 'INFO'];
    const severity = RULE_SEVERITIES[issue.code] ?? 'INFO';

    penalties.push({ code: issue.code, severity, impact, reason: issue.message });
  }

  // ── Cross-layer penalties ─────────────────────────────────────────────────

  // CASE A: CONNECTOR classification but no T5 diagram match
  if (t6?.type === 'CONNECTOR' && t5?.matchType === 'NONE') {
    penalties.push({
      code:     'CROSS_A_CONNECTOR_UNMATCHED',
      severity: 'WARNING',
      impact:   CROSS_A_IMPACT,
      reason:   'Endpoint classified as CONNECTOR but has no diagram component match (T5: NONE)',
    });
  }

  // CASE B: High base confidence contradicted by wire-level validation failure
  if (base >= 0.8 && wireHasValidationFail) {
    penalties.push({
      code:     'CROSS_B_HIGH_CONF_FAILURE',
      severity: 'WARNING',
      impact:   CROSS_B_IMPACT,
      reason:   'High base confidence contradicted by wire validation failure',
    });
  }

  // CASE C: AMBIGUOUS T6 classification — tie never resolved
  if (t6?.type === 'AMBIGUOUS') {
    penalties.push({
      code:     'CROSS_C_AMBIGUOUS',
      severity: 'WARNING',
      impact:   CROSS_C_IMPACT,
      reason:   'Endpoint classification is AMBIGUOUS — scoring tie not resolved by T6',
    });
  }

  const totalPenalty       = penalties.reduce((s, p) => s + p.impact, 0);
  const adjustedConfidence = Math.max(0, Math.min(1, base - totalPenalty));

  return {
    baseConfidence:     base,
    adjustedConfidence,
    penalties,
    finalState: computeFinalState(adjustedConfidence),
  };
}

// ---------------------------------------------------------------------------
// Harness-level summary
// ---------------------------------------------------------------------------

function computeSummary(wires: WireConfidence[]): HarnessConfidenceResult['summary'] {
  let high = 0, medium = 0, low = 0, untrusted = 0;
  let total = 0;

  for (const wc of wires) {
    total += wc.overallConfidence;
    switch (computeFinalState(wc.overallConfidence)) {
      case 'HIGH':      high++;      break;
      case 'MEDIUM':    medium++;    break;
      case 'LOW':       low++;       break;
      case 'UNTRUSTED': untrusted++; break;
    }
  }

  return {
    avgConfidence: wires.length > 0 ? total / wires.length : 0,
    high,
    medium,
    low,
    untrusted,
  };
}

// ---------------------------------------------------------------------------
// Primary export: adjustHarnessConfidence
// ---------------------------------------------------------------------------

/**
 * Adjust confidence for every wire endpoint using validation penalties
 * and cross-layer disagreement signals.
 *
 * Inputs:
 *   connectivity            — T2 HC-BOM (required; defines the wire set)
 *   reconciliation          — T5 result (optional; supplies matchType per endpoint)
 *   endpointClassification  — T6 result (optional; supplies type + base confidence)
 *   validation              — T7 result (optional; supplies issue codes to penalize)
 *
 * All inputs are read-only. Never throws.
 */
export function adjustHarnessConfidence(args: {
  connectivity:            HarnessConnectivityResult;
  reconciliation?:         HarnessReconciliationResult | null;
  endpointClassification?: HarnessEndpointClassificationResult | null;
  validation?:             HarnessValidationResult | null;
}): HarnessConfidenceResult {
  const { connectivity, reconciliation, endpointClassification, validation } = args;

  // Build O(1) lookup indexes
  const reconByWireId = new Map<string, ReconciledWire>();
  for (const rw of reconciliation?.wires ?? []) {
    reconByWireId.set(rw.wireId, rw);
  }

  const classMap = endpointClassification?.classifications ?? new Map();

  const validationByWireId = new Map<string, WireValidation>();
  for (const wv of validation?.wires ?? []) {
    validationByWireId.set(wv.wireId, wv);
  }

  // Adjust each wire
  const wires: WireConfidence[] = connectivity.wires.map(wire => {
    const classified = classMap.get(wire.wireId);
    const reconciled = reconByWireId.get(wire.wireId);
    const validated  = validationByWireId.get(wire.wireId);

    const wireIssues = validated?.issues ?? [];
    const wireHasValidationFail =
      validated?.severity === 'WARNING' || validated?.severity === 'ERROR';

    const fromBase = selectBase(classified?.from, reconciled?.from);
    const toBase   = selectBase(classified?.to,   reconciled?.to);

    const from = adjustEndpoint('FROM', fromBase, classified?.from, reconciled?.from, wireIssues, wireHasValidationFail);
    const to   = adjustEndpoint('TO',   toBase,   classified?.to,   reconciled?.to,   wireIssues, wireHasValidationFail);

    return {
      wireId:             wire.wireId,
      from,
      to,
      overallConfidence: Math.min(from.adjustedConfidence, to.adjustedConfidence),
    };
  });

  const summary = computeSummary(wires);

  // Identify most-common penalty codes for logging
  const penaltyCounts = wires
    .flatMap(wc => [...wc.from.penalties, ...wc.to.penalties].map(p => p.code))
    .reduce<Record<string, number>>((acc, code) => {
      acc[code] = (acc[code] ?? 0) + 1;
      return acc;
    }, {});
  const topPenalties = Object.entries(penaltyCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([code, n]) => `${code}×${n}`);

  console.log('[T8 CONFIDENCE]', {
    avgConfidence: summary.avgConfidence.toFixed(3),
    untrusted:     summary.untrusted,
    high:          summary.high,
    medium:        summary.medium,
    low:           summary.low,
    topPenalties,
  });

  return { wires, summary };
}
