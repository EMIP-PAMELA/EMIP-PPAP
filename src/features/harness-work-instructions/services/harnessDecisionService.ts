/**
 * Harness Decision Service — Phase T9
 * Operator Decision Layer + PPAP Readiness Engine
 *
 * Aggregates outputs from T5 (reconciliation), T6 (classification), T7 (validation),
 * and T8 (confidence adjustment) to derive an operator-actionable decision for each
 * wire and for the harness as a whole.
 *
 * Outputs a PPAP-style readiness score (0–100) and a full decision audit trail so
 * every classification is explainable with zero silent decisions.
 *
 * Governance:
 *   - Pure function. No I/O, no DB, no side effects. Never throws.
 *   - DOES NOT modify T1–T8 outputs.
 *   - DOES NOT auto-correct data, suppress issues, or use AI.
 *   - Every BLOCKED / REVIEW / SAFE decision carries at least one reason.
 *   - Additive layer only.
 *
 * Decision hierarchy (priority: BLOCKED > REVIEW > SAFE):
 *
 *   BLOCKED  — validation ERROR present
 *              OR R8_MISSING_TERMINATION present
 *              OR adjusted confidence < 0.30 (UNTRUSTED)
 *              OR wire absent from T8 result
 *
 *   REVIEW   — any WARNING present
 *              OR adjusted confidence in [0.30, 0.60) (LOW)
 *              OR T6 AMBIGUOUS endpoint
 *              OR T5 matchType NONE on any endpoint
 *
 *   SAFE     — no errors, no warnings, confidence ≥ 0.60, no ambiguity
 *
 * Readiness score (0–100):
 *   base     = average(wire.overallConfidence) × 100
 *   − 10     per wire with any ERROR issue
 *   −  2     per wire with WARNING issues only
 *   −  3     per AMBIGUOUS endpoint (T6 summary)
 *   clamped  to [0, 100]
 */

import type { HarnessConnectivityResult, WireConnectivity } from './harnessConnectivityService';
import type { HarnessReconciliationResult, ReconciledWire } from './harnessReconciliationService';
import type {
  HarnessEndpointClassificationResult,
  WireClassification,
} from './endpointClassifier';
import type { HarnessValidationResult, WireValidation } from './harnessValidationService';
import { RULE_SEVERITIES } from './harnessValidationService';
import type { HarnessConfidenceResult, WireConfidence } from './harnessConfidenceService';
import { isOperatorWire, logOperatorAuthority } from './operatorAuthority';

// ---------------------------------------------------------------------------
// Data Model
// ---------------------------------------------------------------------------

export type DecisionState   = 'SAFE' | 'REVIEW' | 'BLOCKED';
export type OverallDecision = 'SAFE' | 'REVIEW_REQUIRED' | 'BLOCKED';

export interface DecisionReason {
  code:     string;
  severity: 'INFO' | 'WARNING' | 'ERROR';
  message:  string;
}

export interface WireDecision {
  wireId:   string;
  decision: DecisionState;
  reasons:  DecisionReason[];
}

export interface HarnessDecisionResult {
  wires:           WireDecision[];
  overallDecision: OverallDecision;
  readinessScore:  number;
  summary: {
    total:   number;
    safe:    number;
    review:  number;
    blocked: number;
  };
  reviewRequired: string[];
  blockedWires:   string[];
  topIssues:      string[];
}

// ---------------------------------------------------------------------------
// Thresholds and deduction weights
// ---------------------------------------------------------------------------

/** Below this adjusted confidence → BLOCKED (UNTRUSTED). */
const BLOCKED_CONF_THRESHOLD = 0.30;

/** Below this adjusted confidence (but ≥ BLOCKED) → REVIEW (LOW). */
const REVIEW_CONF_THRESHOLD = 0.60;

/** Readiness deduction per wire with an ERROR-severity issue. */
const DEDUCTION_ERROR_WIRE = 10;

/** Readiness deduction per wire with WARNING-only issues (no ERROR). */
const DEDUCTION_WARNING_WIRE = 2;

/** Readiness deduction per AMBIGUOUS endpoint (from T6 summary). */
const DEDUCTION_AMBIGUOUS_EP = 3;

// ---------------------------------------------------------------------------
// Wire-level decision
// ---------------------------------------------------------------------------

function decideWire(
  wire:          WireConnectivity,
  validation:    WireValidation | undefined,
  wireConf:      WireConfidence | undefined,
  classification: WireClassification | undefined,
  reconciled:    ReconciledWire | undefined,
): WireDecision {
  const issues     = validation?.issues ?? [];
  const overallConf = wireConf?.overallConfidence ?? 0;
  const operatorWire = isOperatorWire(wire);

  // ── T7 flags ─────────────────────────────────────────────────────────────
  const hasError   = issues.some(i => (RULE_SEVERITIES[i.code] ?? 'INFO') === 'ERROR');
  const hasWarning = issues.some(i => (RULE_SEVERITIES[i.code] ?? 'INFO') === 'WARNING');
  const hasR8      = issues.some(i => i.code === 'R8_MISSING_TERMINATION');

  // ── T6 flags ─────────────────────────────────────────────────────────────
  const hasAmbiguous =
    classification?.from.type === 'AMBIGUOUS' ||
    classification?.to.type   === 'AMBIGUOUS';

  // ── T5 flags ─────────────────────────────────────────────────────────────
  const fromIsNone = reconciled?.from.matchType === 'NONE';
  const toIsNone   = reconciled?.to.matchType   === 'NONE';
  const hasNoneMatch = fromIsNone || toIsNone;

  // ── Build reasons ─────────────────────────────────────────────────────────

  // Primary: T7 validation issues
  const reasons: DecisionReason[] = issues.map(issue => ({
    code:     issue.code,
    severity: (RULE_SEVERITIES[issue.code] ?? 'INFO') as 'INFO' | 'WARNING' | 'ERROR',
    message:  issue.message,
  }));

  // Supplemental: T5 reconciliation failures not already covered by R7
  const hasR7 = issues.some(i => i.code === 'R7_UNMATCHED_RECONCILIATION');
  if (!hasR7 && reconciled) {
    if (fromIsNone) {
      reasons.push({
        code:     'RECON_FROM_UNMATCHED',
        severity: 'WARNING',
        message:  'FROM endpoint has no diagram component match (T5: NONE)',
      });
    }
    if (toIsNone) {
      reasons.push({
        code:     'RECON_TO_UNMATCHED',
        severity: 'WARNING',
        message:  'TO endpoint has no diagram component match (T5: NONE)',
      });
    }
  }

  // Supplemental: T8 confidence state
  if (wireConf === undefined) {
    reasons.push({
      code:     'NO_CONFIDENCE_DATA',
      severity: 'ERROR',
      message:  'Wire confidence data unavailable — T8 result absent or wire not processed',
    });
  } else if (overallConf < BLOCKED_CONF_THRESHOLD) {
    reasons.push({
      code:     'UNTRUSTED_CONFIDENCE',
      severity: 'ERROR',
      message:  `Adjusted confidence ${(overallConf * 100).toFixed(1)}% is UNTRUSTED (< ${BLOCKED_CONF_THRESHOLD * 100}%)`,
    });
  } else if (overallConf < REVIEW_CONF_THRESHOLD) {
    reasons.push({
      code:     'LOW_CONFIDENCE',
      severity: 'WARNING',
      message:  `Adjusted confidence ${(overallConf * 100).toFixed(1)}% is LOW (${BLOCKED_CONF_THRESHOLD * 100}%–${REVIEW_CONF_THRESHOLD * 100}%)`,
    });
  }

  // Guarantee: every decision has at least one reason (no silent outcomes)
  if (reasons.length === 0) {
    reasons.push({
      code:     'WIRE_SAFE',
      severity: 'INFO',
      message:  'All validation and confidence checks passed — wire is safe to proceed',
    });
  }

  // ── Classify (priority: BLOCKED > REVIEW > SAFE) ─────────────────────────
  let decision: DecisionState;
  if (hasError || hasR8 || overallConf < BLOCKED_CONF_THRESHOLD || wireConf === undefined) {
    decision = 'BLOCKED';
  } else if (hasWarning || overallConf < REVIEW_CONF_THRESHOLD || hasAmbiguous || hasNoneMatch) {
    decision = 'REVIEW';
  } else {
    decision = 'SAFE';
  }

  if (operatorWire && decision === 'BLOCKED') {
    decision = (hasWarning || overallConf < REVIEW_CONF_THRESHOLD || hasAmbiguous || hasNoneMatch)
      ? 'REVIEW'
      : 'SAFE';
    logOperatorAuthority(wire, 'DECISION', {
      overriddenFrom: 'BLOCKED',
      finalDecision:  decision,
      reasonCodes:    reasons.map(r => r.code),
    });
  }

  return { wireId: wire.wireId, decision, reasons };
}

// ---------------------------------------------------------------------------
// Readiness score
// ---------------------------------------------------------------------------

function computeReadiness(
  wireDecisions:  WireDecision[],
  confidence:     HarnessConfidenceResult | null | undefined,
  validation:     HarnessValidationResult | null | undefined,
  classification: HarnessEndpointClassificationResult | null | undefined,
): number {
  if (wireDecisions.length === 0) return 0;

  const base = (confidence?.summary.avgConfidence ?? 0) * 100;

  const validByWireId = new Map<string, WireValidation>();
  for (const wv of validation?.wires ?? []) {
    validByWireId.set(wv.wireId, wv);
  }

  let deductions = 0;
  for (const wd of wireDecisions) {
    const issues    = validByWireId.get(wd.wireId)?.issues ?? [];
    const hasError   = issues.some(i => (RULE_SEVERITIES[i.code] ?? 'INFO') === 'ERROR');
    const hasWarning = issues.some(i => (RULE_SEVERITIES[i.code] ?? 'INFO') === 'WARNING');
    if (hasError)        deductions += DEDUCTION_ERROR_WIRE;
    else if (hasWarning) deductions += DEDUCTION_WARNING_WIRE;
  }

  deductions += (classification?.summary.byType.AMBIGUOUS ?? 0) * DEDUCTION_AMBIGUOUS_EP;

  return Math.max(0, Math.min(100, base - deductions));
}

// ---------------------------------------------------------------------------
// Top issue codes
// ---------------------------------------------------------------------------

function computeTopIssues(
  validation: HarnessValidationResult | null | undefined,
  n = 3,
): string[] {
  const counts = new Map<string, number>();
  for (const wv of validation?.wires ?? []) {
    for (const issue of wv.issues) {
      counts.set(issue.code, (counts.get(issue.code) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([code]) => code);
}

// ---------------------------------------------------------------------------
// Primary export: evaluateHarnessDecision
// ---------------------------------------------------------------------------

/**
 * Evaluate the operator decision state for each wire and the overall harness.
 *
 * Inputs:
 *   connectivity            — T2 HC-BOM (required; defines the wire set)
 *   reconciliation          — T5 result (optional)
 *   endpointClassification  — T6 result (optional)
 *   validation              — T7 result (optional)
 *   confidence              — T8 result (optional)
 *
 * All inputs are read-only. Never throws.
 */
export function evaluateHarnessDecision(args: {
  connectivity:            HarnessConnectivityResult;
  reconciliation?:         HarnessReconciliationResult | null;
  endpointClassification?: HarnessEndpointClassificationResult | null;
  validation?:             HarnessValidationResult | null;
  confidence?:             HarnessConfidenceResult | null;
}): HarnessDecisionResult {
  const { connectivity, reconciliation, endpointClassification, validation, confidence } = args;

  const wireById = new Map(connectivity.wires.map(w => [w.wireId, w]));

  // Build O(1) lookup indexes
  const validByWireId = new Map<string, WireValidation>();
  for (const wv of validation?.wires ?? []) {
    validByWireId.set(wv.wireId, wv);
  }

  const confByWireId = new Map<string, WireConfidence>();
  for (const wc of confidence?.wires ?? []) {
    confByWireId.set(wc.wireId, wc);
  }

  const classMap = endpointClassification?.classifications ?? new Map<string, WireClassification>();

  const reconByWireId = new Map<string, ReconciledWire>();
  for (const rw of reconciliation?.wires ?? []) {
    reconByWireId.set(rw.wireId, rw);
  }

  // Decide each wire
  const wireDecisions: WireDecision[] = connectivity.wires.map(wire =>
    decideWire(
      wire,
      validByWireId.get(wire.wireId),
      confByWireId.get(wire.wireId),
      classMap.get(wire.wireId),
      reconByWireId.get(wire.wireId),
    ),
  );

  // Aggregate
  const blockedWires   = wireDecisions.filter(w => w.decision === 'BLOCKED').map(w => w.wireId);
  const reviewRequired = wireDecisions.filter(w => w.decision === 'REVIEW').map(w => w.wireId);
  const safe           = wireDecisions.filter(w => w.decision === 'SAFE').length;

  const hasNonOperatorBlockers = blockedWires.some(wid => {
    const wire = wireById.get(wid);
    return !isOperatorWire(wire);
  });
  const operatorBlockingOnly = blockedWires.length > 0 && !hasNonOperatorBlockers;

  const overallDecision: OverallDecision =
    blockedWires.length > 0 && !operatorBlockingOnly ? 'BLOCKED' :
    reviewRequired.length > 0 ? 'REVIEW_REQUIRED' :
    'SAFE';

  const readinessScore = computeReadiness(
    wireDecisions, confidence, validation, endpointClassification,
  );
  const topIssues = computeTopIssues(validation);

  // T23.5: Log physical endpoint descriptions for blocked wires so the log
  // identifies unconnected nodes by component:cavity, not customer wire labels.
  const blockedPhysical = blockedWires.map(wid => {
    const wire = connectivity.wires.find(w => w.wireId === wid);
    if (!wire) return wid;
    const from = `${wire.from.component ?? '?'}${wire.from.cavity ? ` pin ${wire.from.cavity}` : ''}`;
    const to   = `${wire.to.component   ?? '?'}${wire.to.cavity   ? ` pin ${wire.to.cavity}` : ''}`;
    return `${from} → ${to}`;
  });

  console.log('[T9 DECISION]', {
    overallDecision,
    readinessScore: readinessScore.toFixed(1),
    safe,
    review:  reviewRequired.length,
    blocked: blockedWires.length,
    topIssues,
  });

  if (blockedWires.length > 0) {
    console.log('[T23.5 VALIDATION] unconnected nodes:', blockedPhysical);
  }

  return {
    wires: wireDecisions,
    overallDecision,
    readinessScore,
    summary: {
      total:   connectivity.wires.length,
      safe,
      review:  reviewRequired.length,
      blocked: blockedWires.length,
    },
    reviewRequired,
    blockedWires,
    topIssues,
  };
}
