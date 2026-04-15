/**
 * harnessConfidenceService.test.ts — Phase T8 unit tests
 *
 * Covers:
 *   - All 10 rule-level penalties (R1–R10)
 *   - All 3 cross-layer penalties (CROSS_A, CROSS_B, CROSS_C)
 *   - Issue scope: FROM / TO / BOTH endpoint application
 *   - Multi-penalty stacking
 *   - Clamping to [0, 1]
 *   - Final state thresholds (HIGH / MEDIUM / LOW / UNTRUSTED)
 *   - Wire overall = min(from, to)
 *   - Harness summary (avgConfidence + distribution)
 *   - Perfect case (no false downgrades)
 *   - Adversarial cases from spec section 14
 *   - No upstream mutation
 *   - Graceful degradation when T5/T6/T7 absent
 *
 * All assertions use explicit math so penalty logic is auditable.
 */

import { describe, it } from 'node:test';
import assert from 'assert/strict';
import {
  adjustHarnessConfidence,
  RULE_PENALTY,
  type HarnessConfidenceResult,
  type WireConfidence,
  type EndpointConfidence,
} from '../harnessConfidenceService';
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

// ---------------------------------------------------------------------------
// Mock builders
// ---------------------------------------------------------------------------

function makeWireConnectivity(wireId: string, fromComp: string | null = 'J1', toComp: string | null = 'T1'): WireConnectivity {
  return {
    wireId,
    length: null,
    lengthUnit: null,
    lengthInches: null,
    gauge: null,
    color: null,
    from: { component: fromComp, cavity: null, treatment: null },
    to:   { component: toComp,   cavity: null, treatment: null },
    sourceRowIndex: 0,
    rawText: `${wireId} ${fromComp ?? ''} ${toComp ?? ''}`,
    confidence: 0.9, unresolved: false,
  };
}

function makeHc(wires: WireConnectivity[]): HarnessConnectivityResult {
  return {
    wires,
    unresolvedWires: [],
    confidenceSummary: { total: wires.length, resolved: wires.length, partial: 0, unresolved: 0 },
  };
}

function makeReconWire(
  wireId: string,
  fromMatchType: 'EXACT' | 'FUZZY' | 'PN_MATCH' | 'NONE' | 'AMBIGUOUS',
  toMatchType:   'EXACT' | 'FUZZY' | 'PN_MATCH' | 'NONE' | 'AMBIGUOUS',
  fromConf = 0.95,
  toConf   = 0.95,
): ReconciledWire {
  return {
    wireId,
    from: { originalLabel: null, matchedComponentId: null, matchedLabel: null, matchType: fromMatchType, confidence: fromConf },
    to:   { originalLabel: null, matchedComponentId: null, matchedLabel: null, matchType: toMatchType,   confidence: toConf },
    unresolved: false,
  };
}

function makeRecon(wires: ReconciledWire[]): HarnessReconciliationResult {
  return {
    wires,
    summary: { total: wires.length, fullyMatched: 0, partialMatched: 0, unmatched: 0, ambiguous: 0 },
  };
}

function makeClassEndpoint(type: EndpointType, conf: number): ClassifiedEndpoint {
  return {
    type, confidence: conf,
    scores: { connectorEvidence: 0, terminalEvidence: 0, openEvidence: 0 },
    evidence: [`mock:${type}`],
  };
}

function makeClassification(
  entries: Array<{ wireId: string; fromType: EndpointType; fromConf: number; toType: EndpointType; toConf: number }>,
): HarnessEndpointClassificationResult {
  const classifications = new Map<string, WireClassification>();
  const byType: Record<EndpointType, number> = { CONNECTOR: 0, TERMINAL: 0, OPEN: 0, AMBIGUOUS: 0 };
  for (const e of entries) {
    classifications.set(e.wireId, {
      from: makeClassEndpoint(e.fromType, e.fromConf),
      to:   makeClassEndpoint(e.toType,   e.toConf),
    });
    byType[e.fromType]++;
    byType[e.toType]++;
  }
  return { classifications, summary: { totalEndpoints: entries.length * 2, byType } };
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

// Exact T7 issue message strings — must match harnessValidationService.ts
const MSG = {
  R1_FROM:  { code: 'R1_CONNECTOR_NO_PIN',         message: 'CONNECTOR endpoint missing pin/cavity assignment',                                   details: 'from: J1' },
  R1_TO:    { code: 'R1_CONNECTOR_NO_PIN',         message: 'CONNECTOR endpoint missing pin/cavity assignment',                                   details: 'to: J2' },
  R2_BOTH:  { code: 'R2_OPEN_OPEN',               message: 'Both endpoints classified OPEN — possible raw wire',                                  details: undefined },
  R3_BOTH:  { code: 'R3_TERMINAL_TERMINAL',        message: 'Terminal-to-terminal wire — valid jumper or cable',                                  details: undefined },
  R4_BOTH:  { code: 'R4_CONNECTOR_CONNECTOR',      message: 'Connector-to-connector wire without splice — possible missing intermediate structure', details: undefined },
  R5_FROM:  { code: 'R5_SPLICE_SOLO',             message: 'SPLICE treatment on component shared by fewer than 2 wires',                         details: 'from: SP1 (share: 1)' },
  R5_TO:    { code: 'R5_SPLICE_SOLO',             message: 'SPLICE treatment on component shared by fewer than 2 wires',                         details: 'to: SP2 (share: 1)' },
  R6_FROM:  { code: 'R6_AMBIGUOUS_ENDPOINT',      message: 'FROM endpoint classification is AMBIGUOUS — requires review',                         details: undefined },
  R6_TO:    { code: 'R6_AMBIGUOUS_ENDPOINT',      message: 'TO endpoint classification is AMBIGUOUS — requires review',                           details: undefined },
  R7_FROM:  { code: 'R7_UNMATCHED_RECONCILIATION',message: 'FROM endpoint has no diagram component match',                                        details: undefined },
  R7_TO:    { code: 'R7_UNMATCHED_RECONCILIATION',message: 'TO endpoint has no diagram component match',                                          details: undefined },
  R8_FROM:  { code: 'R8_MISSING_TERMINATION',     message: 'FROM endpoint has no component, treatment, or strip callout — bare dangling end',     details: undefined },
  R8_TO:    { code: 'R8_MISSING_TERMINATION',     message: 'TO endpoint has no component, treatment, or strip callout — bare dangling end',       details: undefined },
  R9_FROM:  { code: 'R9_CONNECTOR_SINGLE_WIRE',   message: 'CONNECTOR FROM endpoint has only 1 wire — possible misclassification',                details: undefined },
  R9_TO:    { code: 'R9_CONNECTOR_SINGLE_WIRE',   message: 'CONNECTOR TO endpoint has only 1 wire — possible misclassification',                  details: undefined },
  R10_FROM: { code: 'R10_CONFIDENCE_CONFLICT',    message: 'High-confidence T6 classification contradicts T5 reconciliation failure (FROM)',       details: undefined },
  R10_TO:   { code: 'R10_CONFIDENCE_CONFLICT',    message: 'High-confidence T6 classification contradicts T5 reconciliation failure (TO)',         details: undefined },
};

// Convenience runner
function run(
  wireId:  string,
  t6from?:  { type: EndpointType; conf: number },
  t6to?:    { type: EndpointType; conf: number },
  t5from?:  { matchType: 'EXACT' | 'FUZZY' | 'PN_MATCH' | 'NONE' | 'AMBIGUOUS'; conf: number },
  t5to?:    { matchType: 'EXACT' | 'FUZZY' | 'PN_MATCH' | 'NONE' | 'AMBIGUOUS'; conf: number },
  issues?:  ValidationIssue[],
): WireConfidence {
  const connectivity = makeHc([makeWireConnectivity(wireId)]);

  const recon = (t5from || t5to) ? makeRecon([
    makeReconWire(wireId, t5from?.matchType ?? 'EXACT', t5to?.matchType ?? 'EXACT', t5from?.conf ?? 0.95, t5to?.conf ?? 0.95),
  ]) : undefined;

  const cls = (t6from || t6to) ? makeClassification([{
    wireId,
    fromType: t6from?.type ?? 'CONNECTOR', fromConf: t6from?.conf ?? 0.9,
    toType:   t6to?.type   ?? 'TERMINAL',  toConf:   t6to?.conf   ?? 0.45,
  }]) : undefined;

  const validation = issues !== undefined ? makeValidation([makeWireValidation(wireId, issues)]) : undefined;

  const result = adjustHarnessConfidence({ connectivity, reconciliation: recon, endpointClassification: cls, validation });
  const wc = result.wires.find(w => w.wireId === wireId)!;
  assert.ok(wc, `wireId ${wireId} not found in result`);
  return wc;
}

// ---------------------------------------------------------------------------
// Rule-level penalties: scope and impact
// ---------------------------------------------------------------------------

describe('R1 — CONNECTOR_NO_PIN: scope FROM', () => {
  it('penalty applied only to FROM endpoint', () => {
    // base FROM=0.90, TO=0.45; R1 FROM fires → FROM: -0.10
    const wc = run('W1',
      { type: 'CONNECTOR', conf: 0.90 }, { type: 'TERMINAL', conf: 0.45 },
      undefined, undefined,
      [MSG.R1_FROM],
    );
    // FROM: base 0.90 - R1(0.10) - CROSS_B(base>=0.8 + failure 0.10) = 0.70
    assert.ok(wc.from.penalties.some(p => p.code === 'R1_CONNECTOR_NO_PIN'));
    assert.ok(!wc.to.penalties.some(p => p.code === 'R1_CONNECTOR_NO_PIN'), 'R1 should NOT apply to TO');
    assert.equal(wc.from.penalties.find(p => p.code === 'R1_CONNECTOR_NO_PIN')!.impact, 0.10);
  });
});

describe('R1 — CONNECTOR_NO_PIN: scope TO', () => {
  it('penalty applied only to TO endpoint', () => {
    const wc = run('W1',
      { type: 'TERMINAL', conf: 0.45 }, { type: 'CONNECTOR', conf: 0.90 },
      undefined, undefined,
      [MSG.R1_TO],
    );
    assert.ok(wc.to.penalties.some(p => p.code === 'R1_CONNECTOR_NO_PIN'));
    assert.ok(!wc.from.penalties.some(p => p.code === 'R1_CONNECTOR_NO_PIN'), 'R1 should NOT apply to FROM');
  });
});

describe('R2 — OPEN_OPEN: scope BOTH', () => {
  it('penalty applied to BOTH endpoints', () => {
    const wc = run('W1',
      { type: 'OPEN', conf: 0.60 }, { type: 'OPEN', conf: 0.60 },
      undefined, undefined,
      [MSG.R2_BOTH],
    );
    assert.ok(wc.from.penalties.some(p => p.code === 'R2_OPEN_OPEN'), 'R2 must hit FROM');
    assert.ok(wc.to.penalties.some(p => p.code === 'R2_OPEN_OPEN'),   'R2 must hit TO');
    // base 0.60 - R2(0.10) - CROSS_B(base<0.8 → NO CROSS_B) = 0.50, MEDIUM
    const expected = 0.60 - RULE_PENALTY.R2_OPEN_OPEN;
    assert.ok(Math.abs(wc.from.adjustedConfidence - expected) < 0.001, `FROM adjusted=${wc.from.adjustedConfidence} expected~=${expected}`);
  });
});

describe('R3 — TERMINAL_TERMINAL: scope BOTH, INFO penalty', () => {
  it('small INFO penalty applied to both, wire stays valid', () => {
    // T6 TERMINAL+TERMINAL, conf 0.55/0.45
    const wc = run('W1',
      { type: 'TERMINAL', conf: 0.55 }, { type: 'TERMINAL', conf: 0.45 },
      undefined, undefined,
      [MSG.R3_BOTH],
    );
    assert.ok(wc.from.penalties.some(p => p.code === 'R3_TERMINAL_TERMINAL'));
    assert.ok(wc.to.penalties.some(p => p.code === 'R3_TERMINAL_TERMINAL'));
    assert.equal(wc.from.penalties.find(p => p.code === 'R3_TERMINAL_TERMINAL')!.impact, 0.05);
    // FROM: 0.55 - 0.05 = 0.50, LOW (0.50 < 0.60)
    assert.ok(Math.abs(wc.from.adjustedConfidence - 0.50) < 0.001);
    // TO: 0.45 - 0.05 = 0.40, LOW
    assert.ok(Math.abs(wc.to.adjustedConfidence - 0.40) < 0.001);
    assert.equal(wc.from.finalState, 'LOW');
    assert.equal(wc.to.finalState, 'LOW');
  });
});

describe('R4 — CONNECTOR_CONNECTOR: scope BOTH', () => {
  it('WARNING penalty on both endpoints', () => {
    const wc = run('W1',
      { type: 'CONNECTOR', conf: 0.75 }, { type: 'CONNECTOR', conf: 0.75 },
      undefined, undefined,
      [MSG.R4_BOTH],
    );
    assert.ok(wc.from.penalties.some(p => p.code === 'R4_CONNECTOR_CONNECTOR'));
    assert.ok(wc.to.penalties.some(p => p.code === 'R4_CONNECTOR_CONNECTOR'));
  });
});

describe('R5 — SPLICE_SOLO: details-based scope', () => {
  it('from-scoped via details "from: SP1..."', () => {
    const wc = run('W1',
      { type: 'OPEN', conf: 0.60 }, { type: 'CONNECTOR', conf: 0.75 },
      undefined, undefined,
      [MSG.R5_FROM],
    );
    assert.ok(wc.from.penalties.some(p => p.code === 'R5_SPLICE_SOLO'), 'R5 must hit FROM');
    assert.ok(!wc.to.penalties.some(p => p.code === 'R5_SPLICE_SOLO'), 'R5 must NOT hit TO');
  });

  it('to-scoped via details "to: SP2..."', () => {
    const wc = run('W1',
      { type: 'CONNECTOR', conf: 0.75 }, { type: 'OPEN', conf: 0.60 },
      undefined, undefined,
      [MSG.R5_TO],
    );
    assert.ok(!wc.from.penalties.some(p => p.code === 'R5_SPLICE_SOLO'), 'R5 must NOT hit FROM');
    assert.ok(wc.to.penalties.some(p => p.code === 'R5_SPLICE_SOLO'), 'R5 must hit TO');
  });
});

describe('R6 — AMBIGUOUS_ENDPOINT: message-based scope', () => {
  it('R6 FROM scoped by "FROM endpoint" in message', () => {
    const wc = run('W1',
      { type: 'AMBIGUOUS', conf: 0.35 }, { type: 'TERMINAL', conf: 0.45 },
      undefined, undefined,
      [MSG.R6_FROM],
    );
    assert.ok(wc.from.penalties.some(p => p.code === 'R6_AMBIGUOUS_ENDPOINT'));
    assert.ok(!wc.to.penalties.some(p => p.code === 'R6_AMBIGUOUS_ENDPOINT'));
  });

  it('R6 TO scoped by "TO endpoint" in message', () => {
    const wc = run('W1',
      { type: 'TERMINAL', conf: 0.45 }, { type: 'AMBIGUOUS', conf: 0.35 },
      undefined, undefined,
      [MSG.R6_TO],
    );
    assert.ok(!wc.from.penalties.some(p => p.code === 'R6_AMBIGUOUS_ENDPOINT'));
    assert.ok(wc.to.penalties.some(p => p.code === 'R6_AMBIGUOUS_ENDPOINT'));
  });
});

describe('R7 — UNMATCHED_RECONCILIATION: FROM scope', () => {
  it('R7 FROM fires only on FROM', () => {
    const wc = run('W1',
      { type: 'CONNECTOR', conf: 0.75 }, { type: 'TERMINAL', conf: 0.45 },
      { matchType: 'NONE', conf: 0 }, { matchType: 'EXACT', conf: 0.95 },
      [MSG.R7_FROM],
    );
    assert.ok(wc.from.penalties.some(p => p.code === 'R7_UNMATCHED_RECONCILIATION'));
    assert.ok(!wc.to.penalties.some(p => p.code === 'R7_UNMATCHED_RECONCILIATION'));
  });
});

describe('R8 — MISSING_TERMINATION: ERROR penalty', () => {
  it('R8 FROM: impact=0.30, severity=ERROR, adjustedConfidence reduced', () => {
    // base FROM=0.95; R8(-0.30) + CROSS_B(-0.10) = -0.40 → 0.55
    const wc = run('W1',
      { type: 'OPEN', conf: 0.95 }, { type: 'TERMINAL', conf: 0.45 },
      undefined, undefined,
      [MSG.R8_FROM],
    );
    const p = wc.from.penalties.find(p => p.code === 'R8_MISSING_TERMINATION')!;
    assert.ok(p, 'R8 penalty must exist on FROM');
    assert.equal(p.impact, 0.30);
    assert.equal(p.severity, 'ERROR');
    const expected = 0.95 - 0.30 - 0.10; // R8 + CROSS_B (base>=0.8 + failure)
    assert.ok(Math.abs(wc.from.adjustedConfidence - expected) < 0.001, `expected ${expected} got ${wc.from.adjustedConfidence}`);
    assert.ok(!wc.to.penalties.some(p => p.code === 'R8_MISSING_TERMINATION'), 'R8 must NOT hit TO');
  });

  it('R8 TO: scoped to TO endpoint only', () => {
    const wc = run('W1',
      { type: 'CONNECTOR', conf: 0.90 }, { type: 'OPEN', conf: 0.60 },
      undefined, undefined,
      [MSG.R8_TO],
    );
    assert.ok(!wc.from.penalties.some(p => p.code === 'R8_MISSING_TERMINATION'));
    assert.ok(wc.to.penalties.some(p => p.code === 'R8_MISSING_TERMINATION'));
  });
});

describe('R9 — CONNECTOR_SINGLE_WIRE: message-based scope', () => {
  it('"CONNECTOR FROM endpoint..." → FROM scope', () => {
    const wc = run('W1',
      { type: 'CONNECTOR', conf: 0.75 }, { type: 'TERMINAL', conf: 0.45 },
      undefined, undefined,
      [MSG.R9_FROM],
    );
    assert.ok(wc.from.penalties.some(p => p.code === 'R9_CONNECTOR_SINGLE_WIRE'));
    assert.ok(!wc.to.penalties.some(p => p.code === 'R9_CONNECTOR_SINGLE_WIRE'));
  });

  it('"CONNECTOR TO endpoint..." → TO scope (contains "TO ENDPOINT")', () => {
    const wc = run('W1',
      { type: 'TERMINAL', conf: 0.45 }, { type: 'CONNECTOR', conf: 0.75 },
      undefined, undefined,
      [MSG.R9_TO],
    );
    assert.ok(!wc.from.penalties.some(p => p.code === 'R9_CONNECTOR_SINGLE_WIRE'));
    assert.ok(wc.to.penalties.some(p => p.code === 'R9_CONNECTOR_SINGLE_WIRE'));
  });
});

describe('R10 — CONFIDENCE_CONFLICT: (FROM)/(TO) scope', () => {
  it('(FROM) → FROM scope only', () => {
    const wc = run('W1',
      { type: 'CONNECTOR', conf: 0.90 }, { type: 'TERMINAL', conf: 0.45 },
      { matchType: 'NONE', conf: 0 }, { matchType: 'EXACT', conf: 0.95 },
      [MSG.R10_FROM],
    );
    assert.ok(wc.from.penalties.some(p => p.code === 'R10_CONFIDENCE_CONFLICT'));
    assert.ok(!wc.to.penalties.some(p => p.code === 'R10_CONFIDENCE_CONFLICT'));
    assert.equal(wc.from.penalties.find(p => p.code === 'R10_CONFIDENCE_CONFLICT')!.impact, 0.30);
  });

  it('(TO) → TO scope only', () => {
    const wc = run('W1',
      { type: 'TERMINAL', conf: 0.45 }, { type: 'CONNECTOR', conf: 0.90 },
      { matchType: 'EXACT', conf: 0.95 }, { matchType: 'NONE', conf: 0 },
      [MSG.R10_TO],
    );
    assert.ok(!wc.from.penalties.some(p => p.code === 'R10_CONFIDENCE_CONFLICT'));
    assert.ok(wc.to.penalties.some(p => p.code === 'R10_CONFIDENCE_CONFLICT'));
  });
});

// ---------------------------------------------------------------------------
// Cross-layer penalties
// ---------------------------------------------------------------------------

describe('CROSS_A — CONNECTOR + T5 NONE → -0.15', () => {
  it('CONNECTOR classified + matchType NONE fires CROSS_A', () => {
    const wc = run('W1',
      { type: 'CONNECTOR', conf: 0.75 }, { type: 'TERMINAL', conf: 0.45 },
      { matchType: 'NONE', conf: 0 }, { matchType: 'EXACT', conf: 0.95 },
      [],
    );
    const p = wc.from.penalties.find(p => p.code === 'CROSS_A_CONNECTOR_UNMATCHED')!;
    assert.ok(p, 'CROSS_A must fire on FROM');
    assert.equal(p.impact, 0.15);
    // base 0.75 - CROSS_A(0.15) = 0.60 (no CROSS_B: base < 0.8)
    assert.ok(Math.abs(wc.from.adjustedConfidence - 0.60) < 0.001, `expected 0.60 got ${wc.from.adjustedConfidence}`);
    assert.equal(wc.from.finalState, 'MEDIUM');
  });

  it('TERMINAL + T5 NONE does NOT fire CROSS_A', () => {
    const wc = run('W1',
      { type: 'TERMINAL', conf: 0.45 }, { type: 'TERMINAL', conf: 0.55 },
      { matchType: 'NONE', conf: 0 }, { matchType: 'NONE', conf: 0 },
      [],
    );
    assert.ok(!wc.from.penalties.some(p => p.code === 'CROSS_A_CONNECTOR_UNMATCHED'));
    assert.ok(!wc.to.penalties.some(p => p.code === 'CROSS_A_CONNECTOR_UNMATCHED'));
  });

  it('CONNECTOR + T5 EXACT does NOT fire CROSS_A', () => {
    const wc = run('W1',
      { type: 'CONNECTOR', conf: 0.90 }, { type: 'TERMINAL', conf: 0.45 },
      { matchType: 'EXACT', conf: 0.95 }, { matchType: 'EXACT', conf: 0.95 },
      [],
    );
    assert.ok(!wc.from.penalties.some(p => p.code === 'CROSS_A_CONNECTOR_UNMATCHED'));
  });
});

describe('CROSS_B — high base confidence + validation failure → -0.10', () => {
  it('base >= 0.80 + wire has WARNING fires CROSS_B', () => {
    const wc = run('W1',
      { type: 'CONNECTOR', conf: 0.90 }, { type: 'TERMINAL', conf: 0.45 },
      undefined, undefined,
      [MSG.R1_FROM], // R1 WARNING creates wireHasValidationFail = true
    );
    assert.ok(wc.from.penalties.some(p => p.code === 'CROSS_B_HIGH_CONF_FAILURE'), 'CROSS_B must fire (FROM base=0.90 >= 0.8)');
    assert.equal(wc.from.penalties.find(p => p.code === 'CROSS_B_HIGH_CONF_FAILURE')!.impact, 0.10);
  });

  it('base >= 0.80 but NO validation issues → CROSS_B does NOT fire', () => {
    const wc = run('W1',
      { type: 'CONNECTOR', conf: 0.90 }, { type: 'TERMINAL', conf: 0.45 },
      undefined, undefined,
      [], // empty issues → wireHasValidationFail = false
    );
    assert.ok(!wc.from.penalties.some(p => p.code === 'CROSS_B_HIGH_CONF_FAILURE'));
  });

  it('base < 0.80 + validation failure → CROSS_B does NOT fire', () => {
    // base 0.75 < 0.8 → no CROSS_B
    const wc = run('W1',
      { type: 'CONNECTOR', conf: 0.75 }, { type: 'TERMINAL', conf: 0.45 },
      undefined, undefined,
      [MSG.R1_FROM],
    );
    assert.ok(!wc.from.penalties.some(p => p.code === 'CROSS_B_HIGH_CONF_FAILURE'), 'CROSS_B must NOT fire when base < 0.8');
  });

  it('base exactly 0.80 + validation failure → CROSS_B fires', () => {
    const wc = run('W1',
      { type: 'CONNECTOR', conf: 0.80 }, { type: 'TERMINAL', conf: 0.45 },
      undefined, undefined,
      [MSG.R1_FROM],
    );
    assert.ok(wc.from.penalties.some(p => p.code === 'CROSS_B_HIGH_CONF_FAILURE'), 'CROSS_B must fire at exactly 0.80');
  });

  it('TO endpoint with base < 0.8 does NOT get CROSS_B even if FROM has failure', () => {
    const wc = run('W1',
      { type: 'CONNECTOR', conf: 0.90 }, { type: 'TERMINAL', conf: 0.45 },
      undefined, undefined,
      [MSG.R1_FROM],
    );
    // TO base=0.45 < 0.8 → no CROSS_B on TO
    assert.ok(!wc.to.penalties.some(p => p.code === 'CROSS_B_HIGH_CONF_FAILURE'));
  });
});

describe('CROSS_C — AMBIGUOUS classification → -0.20', () => {
  it('T6 AMBIGUOUS fires CROSS_C', () => {
    const wc = run('W1',
      { type: 'AMBIGUOUS', conf: 0.35 }, { type: 'TERMINAL', conf: 0.45 },
      undefined, undefined,
      [],
    );
    const p = wc.from.penalties.find(p => p.code === 'CROSS_C_AMBIGUOUS')!;
    assert.ok(p, 'CROSS_C must fire');
    assert.equal(p.impact, 0.20);
    // base 0.35 - CROSS_C(0.20) = 0.15, UNTRUSTED
    assert.ok(Math.abs(wc.from.adjustedConfidence - 0.15) < 0.001);
    assert.equal(wc.from.finalState, 'UNTRUSTED');
  });

  it('CONNECTOR type does NOT fire CROSS_C', () => {
    const wc = run('W1',
      { type: 'CONNECTOR', conf: 0.90 }, { type: 'TERMINAL', conf: 0.45 },
      undefined, undefined,
      [],
    );
    assert.ok(!wc.from.penalties.some(p => p.code === 'CROSS_C_AMBIGUOUS'));
  });
});

// ---------------------------------------------------------------------------
// Multi-penalty stacking
// ---------------------------------------------------------------------------

describe('Multi-penalty stacking', () => {
  it('R7 + CROSS_A stack correctly (no T6 >= 0.8 → no CROSS_B)', () => {
    // base 0.75, CONNECTOR + NONE → R7(-0.10) + CROSS_A(-0.15) = -0.25 → 0.50, LOW (0.50 < 0.60)
    const wc = run('W1',
      { type: 'CONNECTOR', conf: 0.75 }, { type: 'TERMINAL', conf: 0.45 },
      { matchType: 'NONE', conf: 0 }, { matchType: 'EXACT', conf: 0.95 },
      [MSG.R7_FROM],
    );
    const fromPenaltyTotal = wc.from.penalties.reduce((s, p) => s + p.impact, 0);
    assert.ok(Math.abs(fromPenaltyTotal - 0.25) < 0.001, `total penalty expected 0.25 got ${fromPenaltyTotal}`);
    assert.ok(Math.abs(wc.from.adjustedConfidence - 0.50) < 0.001);
    assert.equal(wc.from.finalState, 'LOW');
  });

  it('R6 + CROSS_C: AMBIGUOUS gets R6(-0.10) + CROSS_C(-0.20) = -0.30', () => {
    // base 0.35
    const wc = run('W1',
      { type: 'AMBIGUOUS', conf: 0.35 }, { type: 'TERMINAL', conf: 0.45 },
      undefined, undefined,
      [MSG.R6_FROM],
    );
    const fromTotal = wc.from.penalties.reduce((s, p) => s + p.impact, 0);
    assert.ok(Math.abs(fromTotal - 0.30) < 0.001); // R6(0.10) + CROSS_C(0.20)
    assert.ok(Math.abs(wc.from.adjustedConfidence - 0.05) < 0.001);
    assert.equal(wc.from.finalState, 'UNTRUSTED');
  });

  it('R10 + R7 + CROSS_A + CROSS_B stack (high-conf conflict scenario)', () => {
    // base 0.90, CONNECTOR + NONE match
    // R10(-0.30) + R7(-0.10) + CROSS_A(-0.15) + CROSS_B(-0.10) = -0.65 → 0.25, UNTRUSTED
    const wc = run('W1',
      { type: 'CONNECTOR', conf: 0.90 }, { type: 'TERMINAL', conf: 0.45 },
      { matchType: 'NONE', conf: 0 }, { matchType: 'EXACT', conf: 0.95 },
      [MSG.R10_FROM, MSG.R7_FROM],
    );
    const fromTotal = wc.from.penalties.reduce((s, p) => s + p.impact, 0);
    const expected = 0.30 + 0.10 + 0.15 + 0.10; // R10 + R7 + CROSS_A + CROSS_B
    assert.ok(Math.abs(fromTotal - expected) < 0.001, `expected ${expected} got ${fromTotal}`);
    assert.ok(Math.abs(wc.from.adjustedConfidence - Math.max(0, 0.90 - expected)) < 0.001);
    assert.equal(wc.from.finalState, 'UNTRUSTED');
  });
});

// ---------------------------------------------------------------------------
// Clamping
// ---------------------------------------------------------------------------

describe('Clamping to [0, 1]', () => {
  it('excessive penalties clamp to 0.0', () => {
    // base 0.20, R8(-0.30) + R10(-0.30) → −0.40 → clamp to 0
    const wc = run('W1',
      { type: 'OPEN', conf: 0.20 }, { type: 'CONNECTOR', conf: 0.45 },
      { matchType: 'NONE', conf: 0 }, { matchType: 'EXACT', conf: 0.95 },
      [MSG.R8_FROM, MSG.R10_FROM],
    );
    assert.equal(wc.from.adjustedConfidence, 0.0);
    assert.equal(wc.from.finalState, 'UNTRUSTED');
  });

  it('zero penalties on perfect base → unchanged (no artificial downgrade)', () => {
    const wc = run('W1',
      { type: 'CONNECTOR', conf: 1.0 }, { type: 'TERMINAL', conf: 0.55 },
      { matchType: 'EXACT', conf: 0.95 }, { matchType: 'EXACT', conf: 0.95 },
      [],
    );
    assert.equal(wc.from.adjustedConfidence, 1.0);
  });
});

// ---------------------------------------------------------------------------
// Final state thresholds
// ---------------------------------------------------------------------------

describe('Final state thresholds', () => {
  it('adjusted >= 0.80 → HIGH', () => {
    const wc = run('W1', { type: 'CONNECTOR', conf: 0.90 }, { type: 'TERMINAL', conf: 0.45 }, undefined, undefined, []);
    assert.equal(wc.from.finalState, 'HIGH');
  });

  it('adjusted = 0.80 boundary → HIGH', () => {
    // base=0.90 - R1(0.10) = 0.80 (assuming no CROSS_B: need wireHasValidationFail determination)
    // With R1 FROM fire: wireHasValidationFail=true but base=0.90 >= 0.8 → CROSS_B also fires → 0.90 - 0.10 - 0.10 = 0.70
    // So to get exactly 0.80: use base=0.90, R1 TO only (FROM has base 0.90, no issues on FROM side)
    const wc = run('W1',
      { type: 'CONNECTOR', conf: 0.90 }, { type: 'CONNECTOR', conf: 0.90 },
      undefined, undefined,
      [MSG.R1_TO], // only TO-scoped issue → wireHasValidationFail=true but FROM has no R1
    );
    // FROM: base=0.90 - CROSS_B(0.10) = 0.80 → HIGH
    assert.ok(Math.abs(wc.from.adjustedConfidence - 0.80) < 0.001, `expected 0.80 got ${wc.from.adjustedConfidence}`);
    assert.equal(wc.from.finalState, 'HIGH');
  });

  it('adjusted 0.60–0.79 → MEDIUM', () => {
    // base=0.75 - CROSS_A(0.15) = 0.60
    const wc = run('W1',
      { type: 'CONNECTOR', conf: 0.75 }, { type: 'TERMINAL', conf: 0.45 },
      { matchType: 'NONE', conf: 0 }, { matchType: 'EXACT', conf: 0.95 },
      [],
    );
    assert.ok(Math.abs(wc.from.adjustedConfidence - 0.60) < 0.001);
    assert.equal(wc.from.finalState, 'MEDIUM');
  });

  it('adjusted 0.30–0.59 → LOW', () => {
    // base=0.45, R8_TO(-0.30) → but R8 is TO, not FROM. Let's use: base=0.55, R7_FROM(-0.10) - CROSS_A(-0.15) = 0.30
    const wc = run('W1',
      { type: 'CONNECTOR', conf: 0.55 }, { type: 'TERMINAL', conf: 0.45 },
      { matchType: 'NONE', conf: 0 }, { matchType: 'EXACT', conf: 0.95 },
      [MSG.R7_FROM],
    );
    // FROM: 0.55 - R7(0.10) - CROSS_A(0.15) = 0.30
    assert.ok(Math.abs(wc.from.adjustedConfidence - 0.30) < 0.001, `expected 0.30 got ${wc.from.adjustedConfidence}`);
    assert.equal(wc.from.finalState, 'LOW');
  });

  it('adjusted < 0.30 → UNTRUSTED', () => {
    const wc = run('W1',
      { type: 'AMBIGUOUS', conf: 0.35 }, { type: 'TERMINAL', conf: 0.45 },
      undefined, undefined,
      [MSG.R6_FROM],
    );
    // 0.35 - R6(0.10) - CROSS_C(0.20) = 0.05
    assert.equal(wc.from.finalState, 'UNTRUSTED');
  });

  it('adjusted exactly 0.30 → LOW (boundary inclusive)', () => {
    const wc = run('W1',
      { type: 'CONNECTOR', conf: 0.55 }, { type: 'TERMINAL', conf: 0.45 },
      { matchType: 'NONE', conf: 0 }, { matchType: 'EXACT', conf: 0.95 },
      [MSG.R7_FROM],
    );
    // 0.55 - 0.10 - 0.15 = 0.30 → LOW
    assert.equal(wc.from.finalState, 'LOW');
  });
});

// ---------------------------------------------------------------------------
// Wire overall confidence = min(from, to)
// ---------------------------------------------------------------------------

describe('Wire overallConfidence = min(from, to)', () => {
  it('overallConfidence is min of from and to adjusted', () => {
    // from adjusted: high (no penalties), to adjusted: low (R8 TO)
    const wc = run('W1',
      { type: 'CONNECTOR', conf: 0.90 }, { type: 'OPEN', conf: 0.60 },
      { matchType: 'EXACT', conf: 0.95 }, { matchType: 'EXACT', conf: 0.95 },
      [MSG.R8_TO],
    );
    // TO: 0.60 - R8(0.30) - CROSS_B(base<0.8 → NO CROSS_B) = 0.30
    // FROM: 0.90 - CROSS_B(base>=0.8, wireHasValidationFail=true, -0.10) = 0.80
    // overall = min(0.80, 0.30) = 0.30
    assert.ok(wc.overallConfidence <= wc.from.adjustedConfidence, 'overall must be <= from');
    assert.ok(wc.overallConfidence <= wc.to.adjustedConfidence,   'overall must be <= to');
    assert.ok(Math.abs(wc.overallConfidence - 0.30) < 0.001);
  });

  it('when from < to: overall = from', () => {
    const wc = run('W1',
      { type: 'OPEN', conf: 0.30 }, { type: 'CONNECTOR', conf: 0.90 },
      undefined, undefined, [],
    );
    assert.equal(wc.overallConfidence, wc.from.adjustedConfidence);
  });
});

// ---------------------------------------------------------------------------
// Perfect case — no false downgrades
// ---------------------------------------------------------------------------

describe('Perfect case — no false downgrades', () => {
  it('CONNECTOR/EXACT/no issues → stays HIGH with zero penalties', () => {
    // Full data, no issues, CONNECTOR + EXACT + no validation failures
    const wc = run('W1',
      { type: 'CONNECTOR', conf: 0.90 }, { type: 'TERMINAL', conf: 0.55 },
      { matchType: 'EXACT', conf: 0.95 }, { matchType: 'EXACT', conf: 0.95 },
      [],
    );
    assert.equal(wc.from.penalties.length, 0, 'no penalties on perfect FROM');
    assert.equal(wc.to.penalties.length, 0, 'no penalties on perfect TO');
    assert.ok(wc.from.adjustedConfidence >= 0.80, 'FROM must be HIGH');
    // TO base=0.55 with no penalties → 0.55, LOW (0.55 < 0.60)
    assert.ok(wc.to.adjustedConfidence >= 0.50, 'TO base must be preserved (no downgrade)');
    assert.equal(wc.from.finalState, 'HIGH');
    assert.equal(wc.to.finalState, 'LOW');
  });

  it('base confidence preserved in baseConfidence field', () => {
    const wc = run('W1',
      { type: 'CONNECTOR', conf: 0.90 }, { type: 'TERMINAL', conf: 0.55 },
      { matchType: 'EXACT', conf: 0.95 }, { matchType: 'EXACT', conf: 0.95 },
      [MSG.R1_FROM],
    );
    assert.equal(wc.from.baseConfidence, 0.90); // unchanged
    assert.ok(wc.from.adjustedConfidence < wc.from.baseConfidence); // penalized
  });
});

// ---------------------------------------------------------------------------
// Adversarial cases (spec section 14)
// ---------------------------------------------------------------------------

describe('Adversarial — high base confidence + validation errors', () => {
  it('R8 ERROR on high-conf endpoint collapses confidence to LOW/UNTRUSTED', () => {
    const wc = run('W1',
      { type: 'OPEN', conf: 0.95 }, { type: 'CONNECTOR', conf: 0.90 },
      undefined, undefined,
      [MSG.R8_FROM],
    );
    // 0.95 - R8(0.30) - CROSS_B(0.10) = 0.55, MEDIUM
    assert.ok(wc.from.adjustedConfidence < 0.80, 'high-conf + R8 must drop below HIGH');
    assert.ok(wc.from.finalState !== 'HIGH', 'must not remain HIGH');
  });
});

describe('Adversarial — ambiguous endpoints', () => {
  it('AMBIGUOUS drops to UNTRUSTED even with moderate base', () => {
    const wc = run('W1',
      { type: 'AMBIGUOUS', conf: 0.50 }, { type: 'TERMINAL', conf: 0.45 },
      undefined, undefined, [],
    );
    // 0.50 - CROSS_C(0.20) = 0.30, LOW
    assert.ok(wc.from.adjustedConfidence <= 0.30);
  });
});

describe('Adversarial — unmatched reconciliation', () => {
  it('CONNECTOR + T5 NONE: CROSS_A drops confidence', () => {
    const wc = run('W1',
      { type: 'CONNECTOR', conf: 0.70 }, { type: 'TERMINAL', conf: 0.45 },
      { matchType: 'NONE', conf: 0 }, { matchType: 'EXACT', conf: 0.95 },
      [],
    );
    // 0.70 - CROSS_A(0.15) = 0.55, LOW (0.55 < 0.60)
    assert.ok(wc.from.adjustedConfidence < 0.70, 'must be reduced by CROSS_A');
    assert.equal(wc.from.finalState, 'LOW');
  });
});

// ---------------------------------------------------------------------------
// Harness summary
// ---------------------------------------------------------------------------

describe('Harness summary', () => {
  it('avgConfidence and distribution computed over wires', () => {
    // Wire 1: overall → 0.90 (HIGH); Wire 2: overall → 0.20 (UNTRUSTED)
    const connectivity = makeHc([
      makeWireConnectivity('W1', 'J1', 'T1'),
      makeWireConnectivity('W2', 'J2', null),
    ]);
    const cls = makeClassification([
      { wireId: 'W1', fromType: 'CONNECTOR', fromConf: 0.90, toType: 'TERMINAL',  toConf: 0.90 },
      { wireId: 'W2', fromType: 'OPEN',      fromConf: 0.20, toType: 'OPEN',      toConf: 0.20 },
    ]);
    const recon = makeRecon([
      makeReconWire('W1', 'EXACT', 'EXACT'),
      makeReconWire('W2', 'NONE', 'NONE'),
    ]);
    const val = makeValidation([
      makeWireValidation('W1', []),
      makeWireValidation('W2', [MSG.R8_FROM, MSG.R8_TO]),
    ]);

    const result = adjustHarnessConfidence({ connectivity, reconciliation: recon, endpointClassification: cls, validation: val });

    assert.equal(result.summary.high + result.summary.medium + result.summary.low + result.summary.untrusted, 2);
    assert.ok(result.summary.avgConfidence >= 0 && result.summary.avgConfidence <= 1);
    // W1 stays HIGH; W2 loses all confidence from R8×2 + CROSS_B×2
    assert.ok(result.summary.high >= 1, 'at least W1 should be HIGH');
    assert.ok(result.summary.untrusted >= 1, 'W2 with R8×2 should be UNTRUSTED');
  });

  it('empty harness → summary all zeros, avgConfidence=0', () => {
    const result = adjustHarnessConfidence({ connectivity: makeHc([]) });
    assert.equal(result.summary.avgConfidence, 0);
    assert.equal(result.summary.high, 0);
    assert.equal(result.summary.medium, 0);
    assert.equal(result.summary.low, 0);
    assert.equal(result.summary.untrusted, 0);
  });
});

// ---------------------------------------------------------------------------
// Graceful degradation
// ---------------------------------------------------------------------------

describe('Graceful degradation — T5/T6/T7 absent', () => {
  it('no T6, no T5 → base=0, UNTRUSTED, no cross-layer penalties', () => {
    const connectivity = makeHc([makeWireConnectivity('W1')]);
    const result = adjustHarnessConfidence({ connectivity });
    const wc = result.wires[0];
    assert.equal(wc.from.baseConfidence, 0);
    assert.equal(wc.from.adjustedConfidence, 0);
    assert.equal(wc.from.finalState, 'UNTRUSTED');
    assert.equal(wc.from.penalties.length, 0);
  });

  it('T5 present but no T6 → base from T5 confidence, no T6 cross-layer penalties', () => {
    const wc = run('W1',
      undefined, undefined,
      { matchType: 'EXACT', conf: 0.95 }, { matchType: 'EXACT', conf: 0.90 },
      [],
    );
    assert.equal(wc.from.baseConfidence, 0.95); // from T5
    assert.equal(wc.from.finalState, 'HIGH');
    assert.ok(!wc.from.penalties.some(p => p.code === 'CROSS_C_AMBIGUOUS'));
    assert.ok(!wc.from.penalties.some(p => p.code === 'CROSS_A_CONNECTOR_UNMATCHED'));
  });

  it('no T7 → no rule-level penalties, cross-layer still applies from T5/T6', () => {
    const wc = run('W1',
      { type: 'CONNECTOR', conf: 0.75 }, { type: 'TERMINAL', conf: 0.45 },
      { matchType: 'NONE', conf: 0 }, { matchType: 'EXACT', conf: 0.95 },
      // no issues parameter → no validation passed
    );
    // no T7 issues, but CROSS_A still fires (CONNECTOR + NONE)
    assert.ok(wc.from.penalties.some(p => p.code === 'CROSS_A_CONNECTOR_UNMATCHED'));
    assert.ok(!wc.from.penalties.some(p => p.code === 'R7_UNMATCHED_RECONCILIATION'), 'no R7 without T7');
  });
});

// ---------------------------------------------------------------------------
// No upstream mutation
// ---------------------------------------------------------------------------

describe('No upstream mutation', () => {
  it('input T5 reconciliation is not mutated', () => {
    const recon = makeRecon([makeReconWire('W1', 'EXACT', 'NONE')]);
    const origMatch = recon.wires[0].to.matchType;
    const connectivity = makeHc([makeWireConnectivity('W1')]);
    adjustHarnessConfidence({ connectivity, reconciliation: recon });
    assert.equal(recon.wires[0].to.matchType, origMatch);
  });

  it('input T6 classification is not mutated', () => {
    const connectivity = makeHc([makeWireConnectivity('W1')]);
    const cls = makeClassification([{ wireId: 'W1', fromType: 'CONNECTOR', fromConf: 0.90, toType: 'TERMINAL', toConf: 0.45 }]);
    const origType = cls.classifications.get('W1')!.from.type;
    adjustHarnessConfidence({ connectivity, endpointClassification: cls });
    assert.equal(cls.classifications.get('W1')!.from.type, origType);
  });
});

// ---------------------------------------------------------------------------
// RULE_PENALTY export sanity
// ---------------------------------------------------------------------------

describe('RULE_PENALTY export sanity', () => {
  it('all 10 rule codes are present', () => {
    const expected = ['R1_CONNECTOR_NO_PIN','R2_OPEN_OPEN','R3_TERMINAL_TERMINAL','R4_CONNECTOR_CONNECTOR',
      'R5_SPLICE_SOLO','R6_AMBIGUOUS_ENDPOINT','R7_UNMATCHED_RECONCILIATION','R8_MISSING_TERMINATION',
      'R9_CONNECTOR_SINGLE_WIRE','R10_CONFIDENCE_CONFLICT'];
    for (const code of expected) {
      assert.ok(code in RULE_PENALTY, `Missing penalty for ${code}`);
    }
  });

  it('ERROR-level rules have highest penalty (0.30)', () => {
    assert.equal(RULE_PENALTY.R8_MISSING_TERMINATION,   0.30);
    assert.equal(RULE_PENALTY.R10_CONFIDENCE_CONFLICT,   0.30);
  });

  it('INFO-level rule has lowest penalty (0.05)', () => {
    assert.equal(RULE_PENALTY.R3_TERMINAL_TERMINAL, 0.05);
  });
});
