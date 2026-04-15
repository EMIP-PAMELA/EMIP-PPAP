/**
 * harnessDecisionService.test.ts — Phase T9 unit tests
 *
 * Covers:
 *   - BLOCKED: ERROR validation, R8, UNTRUSTED confidence, absent T8
 *   - REVIEW: WARNING, LOW confidence, AMBIGUOUS endpoint, T5 NONE match
 *   - SAFE: clean wire, high confidence, no issues
 *   - Overall decision: BLOCKED / REVIEW_REQUIRED / SAFE
 *   - Readiness score: base + deductions + AMBIGUOUS + clamping
 *   - Mixed harness (safe + review + blocked wires)
 *   - Adversarial cases from spec section 13
 *   - Boundary confidence values (0.30, 0.60)
 *   - reviewRequired and blockedWires arrays
 *   - topIssues computation
 *   - Decision reasons (no silent decisions)
 *   - Supplemental reconciliation reasons when T7 absent
 *   - Empty harness
 *   - Graceful degradation (T5/T6/T7/T8 absent)
 *   - No upstream mutation
 */

import { describe, it } from 'node:test';
import assert from 'assert/strict';
import {
  evaluateHarnessDecision,
  type HarnessDecisionResult,
  type WireDecision,
} from '../harnessDecisionService';
import { RULE_SEVERITIES } from '../harnessValidationService';
import type { HarnessConnectivityResult, WireConnectivity } from '../harnessConnectivityService';
import type { HarnessReconciliationResult, ReconciledWire } from '../harnessReconciliationService';
import type {
  HarnessEndpointClassificationResult,
  WireClassification,
  ClassifiedEndpoint,
  EndpointType,
} from '../endpointClassifier';
import type {
  HarnessValidationResult,
  WireValidation,
  ValidationIssue,
  ValidationSeverity,
} from '../harnessValidationService';
import type {
  HarnessConfidenceResult,
  WireConfidence,
  EndpointConfidence,
  FinalState,
} from '../harnessConfidenceService';

// ---------------------------------------------------------------------------
// Mock builders
// ---------------------------------------------------------------------------

function makeWire(wireId: string, fromComp: string | null = 'J1', toComp: string | null = 'T1'): WireConnectivity {
  return {
    wireId, length: null, gauge: null, color: null,
    from: { component: fromComp, cavity: null, treatment: null },
    to:   { component: toComp,   cavity: null, treatment: null },
    sourceRowIndex: 0, rawText: wireId, confidence: 0.9, unresolved: false,
  };
}

function makeHc(wireIds: string[]): HarnessConnectivityResult {
  const wires = wireIds.map(id => makeWire(id));
  return {
    wires,
    unresolvedWires: [],
    confidenceSummary: { total: wires.length, resolved: wires.length, partial: 0, unresolved: 0 },
  };
}

function makeReconWire(
  wireId: string,
  fromMatchType: 'EXACT' | 'FUZZY' | 'PN_MATCH' | 'NONE' | 'AMBIGUOUS' = 'EXACT',
  toMatchType:   'EXACT' | 'FUZZY' | 'PN_MATCH' | 'NONE' | 'AMBIGUOUS' = 'EXACT',
): ReconciledWire {
  return {
    wireId,
    from: { originalLabel: null, matchedComponentId: null, matchedLabel: null, matchType: fromMatchType, confidence: 0.9 },
    to:   { originalLabel: null, matchedComponentId: null, matchedLabel: null, matchType: toMatchType,   confidence: 0.9 },
    unresolved: false,
  };
}

function makeRecon(entries: Array<{ wireId: string; from?: 'EXACT' | 'NONE'; to?: 'EXACT' | 'NONE' }>): HarnessReconciliationResult {
  const wires = entries.map(e => makeReconWire(e.wireId, e.from ?? 'EXACT', e.to ?? 'EXACT'));
  return { wires, summary: { total: wires.length, fullyMatched: 0, partialMatched: 0, unmatched: 0, ambiguous: 0 } };
}

function makeClassEndpoint(type: EndpointType, conf = 0.75): ClassifiedEndpoint {
  return { type, confidence: conf, scores: { connectorEvidence: 0, terminalEvidence: 0, openEvidence: 0 }, evidence: [] };
}

function makeClassification(
  entries: Array<{ wireId: string; fromType: EndpointType; toType: EndpointType }>,
  ambiguousTotal = 0,
): HarnessEndpointClassificationResult {
  const classifications = new Map<string, WireClassification>();
  const byType: Record<EndpointType, number> = { CONNECTOR: 0, TERMINAL: 0, OPEN: 0, AMBIGUOUS: 0 };
  for (const e of entries) {
    classifications.set(e.wireId, {
      from: makeClassEndpoint(e.fromType),
      to:   makeClassEndpoint(e.toType),
    });
    byType[e.fromType]++;
    byType[e.toType]++;
  }
  byType.AMBIGUOUS = ambiguousTotal; // allow explicit override for summary tests
  return { classifications, summary: { totalEndpoints: entries.length * 2, byType } };
}

function makeEpConf(conf: number): EndpointConfidence {
  const fs: FinalState = conf >= 0.80 ? 'HIGH' : conf >= 0.60 ? 'MEDIUM' : conf >= 0.30 ? 'LOW' : 'UNTRUSTED';
  return { baseConfidence: conf, adjustedConfidence: conf, penalties: [], finalState: fs };
}

function makeWireConf(wireId: string, fromConf: number, toConf: number): WireConfidence {
  return {
    wireId,
    from: makeEpConf(fromConf),
    to:   makeEpConf(toConf),
    overallConfidence: Math.min(fromConf, toConf),
  };
}

function makeConfResult(wires: WireConfidence[]): HarnessConfidenceResult {
  const avg = wires.length > 0 ? wires.reduce((s, w) => s + w.overallConfidence, 0) / wires.length : 0;
  const counts = { high: 0, medium: 0, low: 0, untrusted: 0 };
  for (const wc of wires) {
    const k = wc.overallConfidence >= 0.80 ? 'high' : wc.overallConfidence >= 0.60 ? 'medium' : wc.overallConfidence >= 0.30 ? 'low' : 'untrusted';
    counts[k as keyof typeof counts]++;
  }
  return { wires, summary: { avgConfidence: avg, ...counts } };
}

function issueSev(code: string): ValidationSeverity {
  return RULE_SEVERITIES[code] ?? 'INFO';
}

function makeWireValidation(wireId: string, issues: ValidationIssue[]): WireValidation {
  const hasError   = issues.some(i => issueSev(i.code) === 'ERROR');
  const hasWarning = issues.some(i => issueSev(i.code) === 'WARNING');
  const severity: ValidationSeverity = hasError ? 'ERROR' : hasWarning ? 'WARNING' : 'INFO';
  return { wireId, isValid: !hasError && !hasWarning, severity, issues };
}

function makeValidation(wires: WireValidation[]): HarnessValidationResult {
  return {
    wires,
    harnessIssues: [],
    summary: {
      total: wires.length,
      valid: wires.filter(w => w.isValid).length,
      warnings: wires.filter(w => w.severity === 'WARNING').length,
      errors:   wires.filter(w => w.severity === 'ERROR').length,
    },
  };
}

// Standard issue fixtures (exact T7 message strings)
const ISSUES = {
  R1_FROM:  { code: 'R1_CONNECTOR_NO_PIN',         message: 'CONNECTOR endpoint missing pin/cavity assignment', details: 'from: J1' },
  R4_BOTH:  { code: 'R4_CONNECTOR_CONNECTOR',       message: 'Connector-to-connector wire without splice — possible missing intermediate structure' },
  R6_FROM:  { code: 'R6_AMBIGUOUS_ENDPOINT',        message: 'FROM endpoint classification is AMBIGUOUS — requires review' },
  R7_FROM:  { code: 'R7_UNMATCHED_RECONCILIATION',  message: 'FROM endpoint has no diagram component match' },
  R8_FROM:  { code: 'R8_MISSING_TERMINATION',       message: 'FROM endpoint has no component, treatment, or strip callout — bare dangling end' },
  R10_FROM: { code: 'R10_CONFIDENCE_CONFLICT',      message: 'High-confidence T6 classification contradicts T5 reconciliation failure (FROM)' },
};

// Convenience: run a single-wire harness and return the wire decision
function runSingle(
  wireId:  string,
  issues?: ValidationIssue[],
  fromConf = 0.90,
  toConf   = 0.90,
  fromType: EndpointType = 'CONNECTOR',
  toType:   EndpointType = 'TERMINAL',
  fromMatch: 'EXACT' | 'NONE' = 'EXACT',
  toMatch:   'EXACT' | 'NONE' = 'EXACT',
): { wire: WireDecision; result: HarnessDecisionResult } {
  const connectivity = makeHc([wireId]);
  const validation   = issues !== undefined ? makeValidation([makeWireValidation(wireId, issues)]) : undefined;
  const conf         = makeConfResult([makeWireConf(wireId, fromConf, toConf)]);
  const cls          = makeClassification([{ wireId, fromType, toType }]);
  const recon        = makeRecon([{ wireId, from: fromMatch, to: toMatch }]);

  const result = evaluateHarnessDecision({ connectivity, validation, confidence: conf, endpointClassification: cls, reconciliation: recon });
  const wire   = result.wires.find(w => w.wireId === wireId)!;
  assert.ok(wire, `wireId ${wireId} missing`);
  return { wire, result };
}

// ---------------------------------------------------------------------------
// Wire-level BLOCKED cases
// ---------------------------------------------------------------------------

describe('BLOCKED — validation ERROR present', () => {
  it('R10 ERROR → BLOCKED (despite confidence 0.90)', () => {
    const { wire } = runSingle('W1', [ISSUES.R10_FROM], 0.90, 0.90);
    assert.equal(wire.decision, 'BLOCKED');
    assert.ok(wire.reasons.some(r => r.code === 'R10_CONFIDENCE_CONFLICT'));
  });

  it('R8 ERROR (MISSING_TERMINATION) → BLOCKED', () => {
    const { wire } = runSingle('W1', [ISSUES.R8_FROM], 0.85, 0.85);
    assert.equal(wire.decision, 'BLOCKED');
    assert.ok(wire.reasons.some(r => r.code === 'R8_MISSING_TERMINATION'));
  });
});

describe('BLOCKED — UNTRUSTED confidence (< 0.30)', () => {
  it('overallConf=0.20 → BLOCKED even with no validation issues', () => {
    const { wire } = runSingle('W1', [], 0.20, 0.20);
    assert.equal(wire.decision, 'BLOCKED');
    assert.ok(wire.reasons.some(r => r.code === 'UNTRUSTED_CONFIDENCE'));
  });

  it('overallConf=0.00 → BLOCKED', () => {
    const { wire } = runSingle('W1', [], 0.00, 0.00);
    assert.equal(wire.decision, 'BLOCKED');
    assert.equal(wire.reasons.find(r => r.code === 'UNTRUSTED_CONFIDENCE')!.severity, 'ERROR');
  });
});

describe('BLOCKED — T8 absent (no confidence data)', () => {
  it('null T8 → wire absent from confByWireId → BLOCKED with NO_CONFIDENCE_DATA reason', () => {
    const connectivity = makeHc(['W1']);
    const result = evaluateHarnessDecision({ connectivity }); // no T8
    const wire = result.wires[0];
    assert.equal(wire.decision, 'BLOCKED');
    assert.ok(wire.reasons.some(r => r.code === 'NO_CONFIDENCE_DATA'), 'must have NO_CONFIDENCE_DATA reason');
    assert.equal(wire.reasons.find(r => r.code === 'NO_CONFIDENCE_DATA')!.severity, 'ERROR');
  });
});

describe('BLOCKED — confidence boundary', () => {
  it('exactly 0.29 → BLOCKED', () => {
    const { wire } = runSingle('W1', [], 0.29, 0.29);
    assert.equal(wire.decision, 'BLOCKED');
  });

  it('exactly 0.30 → REVIEW (boundary: not BLOCKED)', () => {
    const { wire } = runSingle('W1', [], 0.30, 0.30);
    // 0.30 = BLOCKED_CONF_THRESHOLD, not < it → REVIEW (or SAFE if no issues)
    // No WARNING, no AMBIGUOUS, no NONE match, but 0.30 < 0.60 → REVIEW
    assert.equal(wire.decision, 'REVIEW');
  });
});

// ---------------------------------------------------------------------------
// Wire-level REVIEW cases
// ---------------------------------------------------------------------------

describe('REVIEW — WARNING present', () => {
  it('R1 WARNING → REVIEW (confidence 0.90 is not enough to override WARNING)', () => {
    const { wire } = runSingle('W1', [ISSUES.R1_FROM], 0.90, 0.90);
    assert.equal(wire.decision, 'REVIEW');
    assert.ok(wire.reasons.some(r => r.code === 'R1_CONNECTOR_NO_PIN'));
  });

  it('R4 WARNING (BOTH scope) → REVIEW', () => {
    const { wire } = runSingle('W1', [ISSUES.R4_BOTH], 0.80, 0.80);
    assert.equal(wire.decision, 'REVIEW');
  });
});

describe('REVIEW — LOW confidence (0.30–0.59)', () => {
  it('overallConf=0.45, no issues → REVIEW', () => {
    const { wire } = runSingle('W1', [], 0.45, 0.45);
    assert.equal(wire.decision, 'REVIEW');
    assert.ok(wire.reasons.some(r => r.code === 'LOW_CONFIDENCE'));
    assert.equal(wire.reasons.find(r => r.code === 'LOW_CONFIDENCE')!.severity, 'WARNING');
  });

  it('overallConf=0.59 → REVIEW (boundary below 0.60)', () => {
    const { wire } = runSingle('W1', [], 0.59, 0.59);
    assert.equal(wire.decision, 'REVIEW');
  });

  it('overallConf=0.60 → SAFE (no issues, no AMBIGUOUS, no NONE match)', () => {
    const { wire } = runSingle('W1', [], 0.60, 0.60);
    assert.equal(wire.decision, 'SAFE');
  });
});

describe('REVIEW — AMBIGUOUS endpoint (T6)', () => {
  it('T6 AMBIGUOUS from, no T7, high conf → REVIEW', () => {
    const connectivity = makeHc(['W1']);
    const conf = makeConfResult([makeWireConf('W1', 0.90, 0.90)]);
    const cls  = makeClassification([{ wireId: 'W1', fromType: 'AMBIGUOUS', toType: 'TERMINAL' }]);
    const result = evaluateHarnessDecision({ connectivity, confidence: conf, endpointClassification: cls });
    assert.equal(result.wires[0].decision, 'REVIEW');
  });

  it('T6 AMBIGUOUS to, no T7, high conf → REVIEW', () => {
    const connectivity = makeHc(['W1']);
    const conf = makeConfResult([makeWireConf('W1', 0.90, 0.90)]);
    const cls  = makeClassification([{ wireId: 'W1', fromType: 'CONNECTOR', toType: 'AMBIGUOUS' }]);
    const result = evaluateHarnessDecision({ connectivity, confidence: conf, endpointClassification: cls });
    assert.equal(result.wires[0].decision, 'REVIEW');
  });
});

describe('REVIEW — T5 NONE match (no T7)', () => {
  it('T5 from=NONE, no T7 issues, high conf → REVIEW + RECON_FROM_UNMATCHED reason', () => {
    const connectivity = makeHc(['W1']);
    const conf  = makeConfResult([makeWireConf('W1', 0.90, 0.90)]);
    const recon = makeRecon([{ wireId: 'W1', from: 'NONE', to: 'EXACT' }]);
    const result = evaluateHarnessDecision({ connectivity, confidence: conf, reconciliation: recon });
    const wire = result.wires[0];
    assert.equal(wire.decision, 'REVIEW');
    assert.ok(wire.reasons.some(r => r.code === 'RECON_FROM_UNMATCHED'), 'must have supplemental reason');
  });

  it('T5 to=NONE, no T7 → REVIEW + RECON_TO_UNMATCHED reason', () => {
    const connectivity = makeHc(['W1']);
    const conf  = makeConfResult([makeWireConf('W1', 0.90, 0.90)]);
    const recon = makeRecon([{ wireId: 'W1', from: 'EXACT', to: 'NONE' }]);
    const result = evaluateHarnessDecision({ connectivity, confidence: conf, reconciliation: recon });
    assert.ok(result.wires[0].reasons.some(r => r.code === 'RECON_TO_UNMATCHED'));
    assert.equal(result.wires[0].decision, 'REVIEW');
  });

  it('T5 NONE + T7 has R7 → no duplicate RECON_ reason (R7 already covers it)', () => {
    const { wire } = runSingle('W1', [ISSUES.R7_FROM], 0.90, 0.90, 'CONNECTOR', 'TERMINAL', 'NONE', 'EXACT');
    assert.ok(wire.reasons.some(r => r.code === 'R7_UNMATCHED_RECONCILIATION'));
    assert.ok(!wire.reasons.some(r => r.code === 'RECON_FROM_UNMATCHED'), 'must NOT double-add when R7 present');
    assert.equal(wire.decision, 'REVIEW');
  });
});

// ---------------------------------------------------------------------------
// Wire-level SAFE
// ---------------------------------------------------------------------------

describe('SAFE — clean wire', () => {
  it('no issues, conf=0.90, CONNECTOR/TERMINAL, EXACT → SAFE with WIRE_SAFE reason', () => {
    const { wire } = runSingle('W1', [], 0.90, 0.90);
    assert.equal(wire.decision, 'SAFE');
    assert.ok(wire.reasons.some(r => r.code === 'WIRE_SAFE'));
    assert.equal(wire.reasons.find(r => r.code === 'WIRE_SAFE')!.severity, 'INFO');
  });

  it('conf exactly 0.60, no issues → SAFE (boundary inclusive for SAFE)', () => {
    const { wire } = runSingle('W1', [], 0.60, 0.60);
    assert.equal(wire.decision, 'SAFE');
  });

  it('conf=0.85 with R7_UNMATCHED (T7 present, R7 creates REVIEW) and T5 from=NONE → REVIEW not SAFE', () => {
    const { wire } = runSingle('W1', [ISSUES.R7_FROM], 0.85, 0.85, 'CONNECTOR', 'TERMINAL', 'NONE', 'EXACT');
    assert.equal(wire.decision, 'REVIEW'); // WARNING from R7
  });
});

// ---------------------------------------------------------------------------
// Overall harness decision
// ---------------------------------------------------------------------------

describe('Overall: BLOCKED when any wire is BLOCKED', () => {
  it('1 blocked + 1 review + 1 safe → overallDecision=BLOCKED', () => {
    const connectivity = makeHc(['W1', 'W2', 'W3']);
    const val = makeValidation([
      makeWireValidation('W1', [ISSUES.R10_FROM]),  // ERROR → BLOCKED
      makeWireValidation('W2', [ISSUES.R1_FROM]),   // WARNING → REVIEW
      makeWireValidation('W3', []),                  // SAFE
    ]);
    const conf = makeConfResult([
      makeWireConf('W1', 0.90, 0.90),
      makeWireConf('W2', 0.90, 0.90),
      makeWireConf('W3', 0.90, 0.90),
    ]);
    const result = evaluateHarnessDecision({ connectivity, validation: val, confidence: conf });
    assert.equal(result.overallDecision, 'BLOCKED');
    assert.ok(result.blockedWires.includes('W1'));
    assert.ok(result.reviewRequired.includes('W2'));
  });
});

describe('Overall: REVIEW_REQUIRED when no blocked wires', () => {
  it('1 review + 1 safe → REVIEW_REQUIRED', () => {
    const connectivity = makeHc(['W1', 'W2']);
    const val = makeValidation([
      makeWireValidation('W1', [ISSUES.R1_FROM]),
      makeWireValidation('W2', []),
    ]);
    const conf = makeConfResult([
      makeWireConf('W1', 0.90, 0.90),
      makeWireConf('W2', 0.90, 0.90),
    ]);
    const result = evaluateHarnessDecision({ connectivity, validation: val, confidence: conf });
    assert.equal(result.overallDecision, 'REVIEW_REQUIRED');
    assert.equal(result.blockedWires.length, 0);
    assert.ok(result.reviewRequired.includes('W1'));
  });
});

describe('Overall: SAFE when all wires safe', () => {
  it('all wires have no issues and high confidence → SAFE', () => {
    const connectivity = makeHc(['W1', 'W2', 'W3']);
    const val  = makeValidation(['W1','W2','W3'].map(id => makeWireValidation(id, [])));
    const conf = makeConfResult(['W1','W2','W3'].map(id => makeWireConf(id, 0.90, 0.90)));
    const result = evaluateHarnessDecision({ connectivity, validation: val, confidence: conf });
    assert.equal(result.overallDecision, 'SAFE');
    assert.equal(result.blockedWires.length, 0);
    assert.equal(result.reviewRequired.length, 0);
    assert.equal(result.summary.safe, 3);
  });
});

// ---------------------------------------------------------------------------
// Summary counts
// ---------------------------------------------------------------------------

describe('Summary counts', () => {
  it('counts match wire decisions exactly', () => {
    const connectivity = makeHc(['W1', 'W2', 'W3', 'W4']);
    const val = makeValidation([
      makeWireValidation('W1', [ISSUES.R10_FROM]),
      makeWireValidation('W2', [ISSUES.R1_FROM]),
      makeWireValidation('W3', []),
      makeWireValidation('W4', []),
    ]);
    const conf = makeConfResult([
      makeWireConf('W1', 0.90, 0.90),
      makeWireConf('W2', 0.90, 0.90),
      makeWireConf('W3', 0.90, 0.90),
      makeWireConf('W4', 0.45, 0.45), // LOW → REVIEW
    ]);
    const result = evaluateHarnessDecision({ connectivity, validation: val, confidence: conf });
    assert.equal(result.summary.total,   4);
    assert.equal(result.summary.blocked, 1);
    assert.equal(result.summary.review,  2); // W2 (WARNING) + W4 (LOW conf)
    assert.equal(result.summary.safe,    1); // W3
  });
});

// ---------------------------------------------------------------------------
// reviewRequired and blockedWires arrays
// ---------------------------------------------------------------------------

describe('reviewRequired and blockedWires arrays', () => {
  it('arrays contain exactly the right wireIds', () => {
    const connectivity = makeHc(['W1', 'W2', 'W3']);
    const val = makeValidation([
      makeWireValidation('W1', [ISSUES.R8_FROM]),
      makeWireValidation('W2', [ISSUES.R4_BOTH]),
      makeWireValidation('W3', []),
    ]);
    const conf = makeConfResult([
      makeWireConf('W1', 0.80, 0.80),
      makeWireConf('W2', 0.80, 0.80),
      makeWireConf('W3', 0.85, 0.85),
    ]);
    const result = evaluateHarnessDecision({ connectivity, validation: val, confidence: conf });
    assert.deepEqual(result.blockedWires,   ['W1']); // R8 is ERROR
    assert.deepEqual(result.reviewRequired, ['W2']); // R4 is WARNING
  });
});

// ---------------------------------------------------------------------------
// Readiness score
// ---------------------------------------------------------------------------

describe('Readiness score', () => {
  it('base=avg(confs)×100, minus ERROR wire(-10) and WARNING wire(-2)', () => {
    // W1: SAFE, conf=0.90; W2: WARNING (R1), conf=0.70; W3: ERROR (R8), conf=0.10
    const connectivity = makeHc(['W1', 'W2', 'W3']);
    const val = makeValidation([
      makeWireValidation('W1', []),
      makeWireValidation('W2', [ISSUES.R1_FROM]),
      makeWireValidation('W3', [ISSUES.R8_FROM]),
    ]);
    const conf = makeConfResult([
      makeWireConf('W1', 0.90, 0.90),
      makeWireConf('W2', 0.70, 0.70),
      makeWireConf('W3', 0.10, 0.10),
    ]);
    const result = evaluateHarnessDecision({ connectivity, validation: val, confidence: conf });
    // base = avg(0.90, 0.70, 0.10) × 100 = 56.67
    // deductions: W2(-2) + W3(-10) = -12
    // score ≈ 44.67
    const expected = ((0.90 + 0.70 + 0.10) / 3) * 100 - 12;
    assert.ok(Math.abs(result.readinessScore - expected) < 0.01, `expected ≈${expected.toFixed(2)} got ${result.readinessScore}`);
  });

  it('AMBIGUOUS endpoints subtract −3 each from score', () => {
    const connectivity = makeHc(['W1']);
    const val  = makeValidation([makeWireValidation('W1', [])]);
    const conf = makeConfResult([makeWireConf('W1', 0.80, 0.80)]);
    // 2 AMBIGUOUS endpoints in T6 summary
    const cls  = makeClassification([{ wireId: 'W1', fromType: 'CONNECTOR', toType: 'TERMINAL' }], 2);
    const result = evaluateHarnessDecision({ connectivity, validation: val, confidence: conf, endpointClassification: cls });
    // base = 80.0, deductions = 2×3 = 6
    assert.ok(Math.abs(result.readinessScore - 74.0) < 0.01, `expected 74.0 got ${result.readinessScore}`);
  });

  it('score clamped to 0 when deductions exceed base', () => {
    // 5 ERROR wires, base low
    const ids = ['W1','W2','W3','W4','W5'];
    const connectivity = makeHc(ids);
    const val  = makeValidation(ids.map(id => makeWireValidation(id, [ISSUES.R8_FROM])));
    const conf = makeConfResult(ids.map(id => makeWireConf(id, 0.10, 0.10)));
    const result = evaluateHarnessDecision({ connectivity, validation: val, confidence: conf });
    // base = 10, deductions = 5×10 = 50 → 10-50 = -40 → clamped to 0
    assert.equal(result.readinessScore, 0);
  });

  it('score clamped to 100 when base is perfect and no deductions', () => {
    const connectivity = makeHc(['W1']);
    const val  = makeValidation([makeWireValidation('W1', [])]);
    const conf = makeConfResult([makeWireConf('W1', 1.0, 1.0)]);
    const result = evaluateHarnessDecision({ connectivity, validation: val, confidence: conf });
    assert.equal(result.readinessScore, 100);
  });

  it('no T8 → base=0, deductions still applied, score=0', () => {
    const connectivity = makeHc(['W1']);
    const val = makeValidation([makeWireValidation('W1', [ISSUES.R1_FROM])]);
    const result = evaluateHarnessDecision({ connectivity, validation: val });
    // base=0, deduction=-2 → 0-2 = -2 → clamp to 0
    assert.equal(result.readinessScore, 0);
  });

  it('ERROR wire gets -10, WARNING wire gets -2 (ERROR takes precedence, no double-count)', () => {
    // Wire with both ERROR and WARNING issues should only cost -10 (not -12)
    const connectivity = makeHc(['W1']);
    const val = makeValidation([makeWireValidation('W1', [ISSUES.R8_FROM, ISSUES.R1_FROM])]); // ERROR + WARNING
    const conf = makeConfResult([makeWireConf('W1', 0.80, 0.80)]);
    const result = evaluateHarnessDecision({ connectivity, validation: val, confidence: conf });
    // base = 80, deduction = 10 (ERROR) not 12
    assert.ok(Math.abs(result.readinessScore - 70.0) < 0.01, `expected 70.0 got ${result.readinessScore}`);
  });
});

// ---------------------------------------------------------------------------
// topIssues
// ---------------------------------------------------------------------------

describe('topIssues computation', () => {
  it('returns top 3 most frequent issue codes across all wires', () => {
    const connectivity = makeHc(['W1', 'W2', 'W3']);
    const val = makeValidation([
      makeWireValidation('W1', [ISSUES.R1_FROM, ISSUES.R7_FROM]),
      makeWireValidation('W2', [ISSUES.R1_FROM, ISSUES.R8_FROM]),
      makeWireValidation('W3', [ISSUES.R7_FROM]),
    ]);
    // R1=2, R7=2, R8=1
    const result = evaluateHarnessDecision({ connectivity, validation: val });
    assert.ok(result.topIssues.length <= 3);
    assert.ok(result.topIssues.includes('R1_CONNECTOR_NO_PIN'),         'R1 must be top issue');
    assert.ok(result.topIssues.includes('R7_UNMATCHED_RECONCILIATION'), 'R7 must be top issue');
  });

  it('empty T7 → topIssues is empty array', () => {
    const result = evaluateHarnessDecision({ connectivity: makeHc(['W1']) });
    assert.deepEqual(result.topIssues, []);
  });
});

// ---------------------------------------------------------------------------
// Adversarial cases (spec section 13)
// ---------------------------------------------------------------------------

describe('Adversarial — high conf + ERROR → BLOCKED (not SAFE)', () => {
  it('conf=0.95 but R10 ERROR fires → BLOCKED', () => {
    const { wire } = runSingle('W1', [ISSUES.R10_FROM], 0.95, 0.95);
    assert.equal(wire.decision, 'BLOCKED');
    assert.ok(wire.reasons.some(r => r.severity === 'ERROR'));
  });
});

describe('Adversarial — low conf, no issues → REVIEW/BLOCKED', () => {
  it('conf=0.45 (LOW), no issues → REVIEW (not SAFE)', () => {
    const { wire } = runSingle('W1', [], 0.45, 0.45);
    assert.equal(wire.decision, 'REVIEW');
  });

  it('conf=0.20 (UNTRUSTED), no issues → BLOCKED (confidence drives decision)', () => {
    const { wire } = runSingle('W1', [], 0.20, 0.20);
    assert.equal(wire.decision, 'BLOCKED');
  });
});

describe('Adversarial — all wires ambiguous', () => {
  it('entire harness AMBIGUOUS → overallDecision REVIEW_REQUIRED', () => {
    const connectivity = makeHc(['W1', 'W2']);
    const conf = makeConfResult([makeWireConf('W1', 0.90, 0.90), makeWireConf('W2', 0.90, 0.90)]);
    const cls  = makeClassification([
      { wireId: 'W1', fromType: 'AMBIGUOUS', toType: 'TERMINAL' },
      { wireId: 'W2', fromType: 'CONNECTOR', toType: 'AMBIGUOUS' },
    ]);
    const result = evaluateHarnessDecision({ connectivity, confidence: conf, endpointClassification: cls });
    assert.equal(result.overallDecision, 'REVIEW_REQUIRED');
    assert.equal(result.blockedWires.length, 0);
    assert.equal(result.reviewRequired.length, 2);
  });
});

describe('Adversarial — perfect harness stays SAFE', () => {
  it('all wires: no issues, conf=0.95, EXACT match, non-AMBIGUOUS → overallDecision=SAFE', () => {
    const connectivity = makeHc(['W1', 'W2', 'W3']);
    const val  = makeValidation(['W1','W2','W3'].map(id => makeWireValidation(id, [])));
    const conf = makeConfResult(['W1','W2','W3'].map(id => makeWireConf(id, 0.95, 0.95)));
    const cls  = makeClassification(['W1','W2','W3'].map(id => ({ wireId: id, fromType: 'CONNECTOR' as EndpointType, toType: 'TERMINAL' as EndpointType })));
    const recon = makeRecon(['W1','W2','W3'].map(id => ({ wireId: id })));
    const result = evaluateHarnessDecision({ connectivity, validation: val, confidence: conf, endpointClassification: cls, reconciliation: recon });
    assert.equal(result.overallDecision, 'SAFE');
    assert.equal(result.summary.safe, 3);
    assert.equal(result.summary.blocked, 0);
    assert.equal(result.summary.review, 0);
    assert.ok(result.readinessScore >= 90);
  });
});

// ---------------------------------------------------------------------------
// Decision reasons — no silent decisions
// ---------------------------------------------------------------------------

describe('No silent decisions', () => {
  it('every wire has at least one reason', () => {
    const connectivity = makeHc(['W1', 'W2', 'W3']);
    const val  = makeValidation([
      makeWireValidation('W1', [ISSUES.R8_FROM]),
      makeWireValidation('W2', [ISSUES.R1_FROM]),
      makeWireValidation('W3', []),
    ]);
    const conf = makeConfResult([
      makeWireConf('W1', 0.85, 0.85),
      makeWireConf('W2', 0.85, 0.85),
      makeWireConf('W3', 0.90, 0.90),
    ]);
    const result = evaluateHarnessDecision({ connectivity, validation: val, confidence: conf });
    for (const wd of result.wires) {
      assert.ok(wd.reasons.length > 0, `wire ${wd.wireId} has no reasons (silent decision)`);
    }
  });

  it('SAFE wire with no issues gets WIRE_SAFE INFO reason', () => {
    const { wire } = runSingle('W1', [], 0.90, 0.90);
    assert.ok(wire.reasons.some(r => r.code === 'WIRE_SAFE' && r.severity === 'INFO'));
  });
});

// ---------------------------------------------------------------------------
// Confidence thresholds
// ---------------------------------------------------------------------------

describe('Confidence boundary correctness', () => {
  it('0.30 → REVIEW (LOW, not BLOCKED)', () => {
    const { wire } = runSingle('W1', [], 0.30, 0.30);
    assert.equal(wire.decision, 'REVIEW');
    assert.ok(wire.reasons.some(r => r.code === 'LOW_CONFIDENCE'));
  });

  it('0.60 → SAFE (MEDIUM, no issues)', () => {
    const { wire } = runSingle('W1', [], 0.60, 0.60);
    assert.equal(wire.decision, 'SAFE');
    assert.ok(!wire.reasons.some(r => r.code === 'LOW_CONFIDENCE'));
  });

  it('0.80 → SAFE (HIGH, no issues)', () => {
    const { wire } = runSingle('W1', [], 0.80, 0.80);
    assert.equal(wire.decision, 'SAFE');
  });
});

// ---------------------------------------------------------------------------
// Empty harness
// ---------------------------------------------------------------------------

describe('Empty harness', () => {
  it('zero wires → overallDecision=SAFE, readinessScore=0, empty arrays', () => {
    const result = evaluateHarnessDecision({ connectivity: makeHc([]) });
    assert.equal(result.overallDecision, 'SAFE');
    assert.equal(result.readinessScore, 0);
    assert.equal(result.wires.length, 0);
    assert.deepEqual(result.blockedWires, []);
    assert.deepEqual(result.reviewRequired, []);
    assert.deepEqual(result.topIssues, []);
  });
});

// ---------------------------------------------------------------------------
// Graceful degradation
// ---------------------------------------------------------------------------

describe('Graceful degradation', () => {
  it('all T5/T6/T7/T8 absent → all wires BLOCKED (no data = UNTRUSTED)', () => {
    const result = evaluateHarnessDecision({ connectivity: makeHc(['W1', 'W2']) });
    assert.equal(result.overallDecision, 'BLOCKED');
    assert.equal(result.summary.blocked, 2);
    for (const wd of result.wires) {
      assert.equal(wd.decision, 'BLOCKED');
    }
  });

  it('only T7 present (no T8) → BLOCKED from confidence, reasons contain T7 issues', () => {
    const connectivity = makeHc(['W1']);
    const val = makeValidation([makeWireValidation('W1', [ISSUES.R1_FROM])]);
    const result = evaluateHarnessDecision({ connectivity, validation: val });
    const wire = result.wires[0];
    // No T8 → wireConf=undefined → BLOCKED
    assert.equal(wire.decision, 'BLOCKED');
    assert.ok(wire.reasons.some(r => r.code === 'R1_CONNECTOR_NO_PIN'), 'T7 issues still included in reasons');
    assert.ok(wire.reasons.some(r => r.code === 'NO_CONFIDENCE_DATA'), 'must flag missing T8 data');
  });

  it('only T8 present (no T7, no T5, no T6) → SAFE for high-conf wire', () => {
    const connectivity = makeHc(['W1']);
    const conf = makeConfResult([makeWireConf('W1', 0.90, 0.90)]);
    const result = evaluateHarnessDecision({ connectivity, confidence: conf });
    assert.equal(result.wires[0].decision, 'SAFE');
  });
});

// ---------------------------------------------------------------------------
// No upstream mutation
// ---------------------------------------------------------------------------

describe('No upstream mutation', () => {
  it('T7 validation result is not mutated', () => {
    const connectivity = makeHc(['W1']);
    const val = makeValidation([makeWireValidation('W1', [ISSUES.R8_FROM])]);
    const origIssueCount = val.wires[0].issues.length;
    evaluateHarnessDecision({ connectivity, validation: val });
    assert.equal(val.wires[0].issues.length, origIssueCount);
  });

  it('T8 confidence result is not mutated', () => {
    const connectivity = makeHc(['W1']);
    const conf = makeConfResult([makeWireConf('W1', 0.90, 0.90)]);
    const origConf = conf.wires[0].overallConfidence;
    evaluateHarnessDecision({ connectivity, confidence: conf });
    assert.equal(conf.wires[0].overallConfidence, origConf);
  });
});
