/**
 * harnessValidationService.test.ts — Phase T7 unit tests
 *
 * Covers:
 *   - All 10 wire-level rules (R1–R10)
 *   - All 4 harness-level rules (H1–H4)
 *   - Section 10 adversarial cases
 *   - Valid configuration no-false-positive proofs
 *   - Graceful degradation when T5/T6 absent
 *   - Summary correctness
 *   - No upstream mutation
 *
 * No I/O, no real PDFs, no AI. All inputs are inline mocks.
 */

import { describe, it } from 'node:test';
import assert from 'assert/strict';
import {
  validateHarness,
  RULE_SEVERITIES,
  type HarnessValidationResult,
  type WireValidation,
} from '../harnessValidationService';
import type { HarnessConnectivityResult, WireConnectivity } from '../harnessConnectivityService';
import type { EndpointTerminationType } from '../harnessConnectivityService';
import type { HarnessReconciliationResult, ReconciledWire } from '../harnessReconciliationService';
import type {
  HarnessEndpointClassificationResult,
  WireClassification,
  ClassifiedEndpoint,
  EndpointType,
} from '../endpointClassifier';

// ---------------------------------------------------------------------------
// Mock builders
// ---------------------------------------------------------------------------

function makeWire(
  wireId:        string,
  fromComp:      string | null,
  fromCavity:    string | null,
  toComp:        string | null,
  toCavity:      string | null,
  opts: {
    rawText?:       string;
    fromTreatment?: string | null;
    toTreatment?:   string | null;
    fromTermination?: EndpointTerminationType | null;
    toTermination?: EndpointTerminationType | null;
  } = {},
): WireConnectivity {
  return {
    wireId,
    length:         null,
    lengthUnit:     null,
    lengthInches:   null,
    gauge:          null,
    color:          null,
    from: {
      component: fromComp,
      cavity:    fromCavity,
      treatment: opts.fromTreatment ?? null,
      terminationType: opts.fromTermination ?? null,
    },
    to: {
      component: toComp,
      cavity:    toCavity,
      treatment: opts.toTreatment ?? null,
      terminationType: opts.toTermination ?? null,
    },
    sourceRowIndex: 0,
    rawText:        opts.rawText ?? `${wireId} ${fromComp ?? ''} ${toComp ?? ''}`,
    confidence:     0.9,
    unresolved:     false,
  };
}

function makeHc(wires: WireConnectivity[]): HarnessConnectivityResult {
  return {
    wires,
    unresolvedWires: [],
    confidenceSummary: {
      total: wires.length, resolved: wires.length, partial: 0, unresolved: 0,
    },
  };
}

function makeReconWire(
  wireId:       string,
  fromMatchType: 'EXACT' | 'FUZZY' | 'PN_MATCH' | 'NONE' | 'AMBIGUOUS',
  toMatchType:   'EXACT' | 'FUZZY' | 'PN_MATCH' | 'NONE' | 'AMBIGUOUS',
): ReconciledWire {
  const conf = (mt: string) => mt === 'EXACT' ? 0.95 : mt === 'PN_MATCH' ? 0.90 : mt === 'FUZZY' ? 0.75 : mt === 'AMBIGUOUS' ? 0.50 : 0;
  return {
    wireId,
    from: { originalLabel: null, matchedComponentId: null, matchedLabel: null, matchType: fromMatchType, confidence: conf(fromMatchType) },
    to:   { originalLabel: null, matchedComponentId: null, matchedLabel: null, matchType: toMatchType,   confidence: conf(toMatchType) },
    unresolved: fromMatchType !== 'EXACT' && fromMatchType !== 'PN_MATCH',
  };
}

function makeRecon(wires: ReconciledWire[]): HarnessReconciliationResult {
  return {
    wires,
    summary: { total: wires.length, fullyMatched: 0, partialMatched: 0, unmatched: 0, ambiguous: 0 },
  };
}

function makeClassEndpoint(type: EndpointType, confidence: number): ClassifiedEndpoint {
  return {
    type,
    confidence,
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

// Convenience: run validateHarness with minimal wiring
function validate(
  wires:    WireConnectivity[],
  recon?:   ReconciledWire[],
  cls?:     Array<{ wireId: string; fromType: EndpointType; fromConf: number; toType: EndpointType; toConf: number }>,
): HarnessValidationResult {
  return validateHarness({
    connectivity:           makeHc(wires),
    reconciliation:         recon  ? makeRecon(recon) : undefined,
    endpointClassification: cls    ? makeClassification(cls) : undefined,
  });
}

function wireResult(result: HarnessValidationResult, wireId: string): WireValidation {
  const wv = result.wires.find(w => w.wireId === wireId);
  assert.ok(wv, `No WireValidation found for wireId=${wireId}`);
  return wv!;
}

function hasCode(wv: WireValidation, code: string): boolean {
  return wv.issues.some(i => i.code === code);
}

// ---------------------------------------------------------------------------
// R1 — CONNECTOR PIN CONSISTENCY
// ---------------------------------------------------------------------------

describe('R1 — CONNECTOR without cavity → WARNING', () => {
  it('CONNECTOR from endpoint with no cavity fires R1', () => {
    const wires = [makeWire('W1', 'J1', null, '929504-1', null)];
    const cls = [{ wireId: 'W1', fromType: 'CONNECTOR' as EndpointType, fromConf: 0.75, toType: 'TERMINAL' as EndpointType, toConf: 0.45 }];
    const result = validate(wires, undefined, cls);
    const wv = wireResult(result, 'W1');
    assert.ok(hasCode(wv, 'R1_CONNECTOR_NO_PIN'));
    assert.equal(wv.severity, 'WARNING');
    assert.equal(wv.isValid, false);
  });

  it('CONNECTOR from endpoint WITH cavity does NOT fire R1', () => {
    const wires = [makeWire('W1', 'J1', '3', '929504-1', null)];
    const cls = [{ wireId: 'W1', fromType: 'CONNECTOR' as EndpointType, fromConf: 0.75, toType: 'TERMINAL' as EndpointType, toConf: 0.45 }];
    const result = validate(wires, undefined, cls);
    const wv = wireResult(result, 'W1');
    assert.ok(!hasCode(wv, 'R1_CONNECTOR_NO_PIN'));
  });

  it('CONNECTOR to endpoint with no cavity fires R1', () => {
    const wires = [makeWire('W1', '929504-1', null, 'J2', null)];
    const cls = [{ wireId: 'W1', fromType: 'TERMINAL' as EndpointType, fromConf: 0.45, toType: 'CONNECTOR' as EndpointType, toConf: 0.75 }];
    const result = validate(wires, undefined, cls);
    const wv = wireResult(result, 'W1');
    assert.ok(hasCode(wv, 'R1_CONNECTOR_NO_PIN'));
  });

  it('TERMINAL endpoint without cavity does NOT fire R1', () => {
    const wires = [makeWire('W1', '929504-1', null, 'ACI01960', null)];
    const cls = [{ wireId: 'W1', fromType: 'TERMINAL' as EndpointType, fromConf: 0.45, toType: 'TERMINAL' as EndpointType, toConf: 0.55 }];
    const result = validate(wires, undefined, cls);
    const wv = wireResult(result, 'W1');
    assert.ok(!hasCode(wv, 'R1_CONNECTOR_NO_PIN'));
  });
});

// ---------------------------------------------------------------------------
// R2 — OPEN END MISUSE
// ---------------------------------------------------------------------------

describe('R2 — OPEN ↔ OPEN → WARNING', () => {
  it('both endpoints OPEN fires R2', () => {
    // Strip callout suppresses R8 so that R2 (WARNING) is the highest severity.
    const wires = [makeWire('W1', null, null, null, null, { rawText: 'W1 stripped 1/4 both ends' })];
    const cls = [{ wireId: 'W1', fromType: 'OPEN' as EndpointType, fromConf: 0.6, toType: 'OPEN' as EndpointType, toConf: 0.6 }];
    const result = validate(wires, undefined, cls);
    const wv = wireResult(result, 'W1');
    assert.ok(hasCode(wv, 'R2_OPEN_OPEN'));
    assert.equal(wv.severity, 'WARNING');
  });

  it('CONNECTOR ↔ OPEN does NOT fire R2', () => {
    const wires = [makeWire('W1', 'J1', '1', null, null)];
    const cls = [{ wireId: 'W1', fromType: 'CONNECTOR' as EndpointType, fromConf: 0.75, toType: 'OPEN' as EndpointType, toConf: 0.6 }];
    const result = validate(wires, undefined, cls);
    const wv = wireResult(result, 'W1');
    assert.ok(!hasCode(wv, 'R2_OPEN_OPEN'));
  });
});

// ---------------------------------------------------------------------------
// R3 — TERMINAL TO TERMINAL (INFO — isValid = true)
// ---------------------------------------------------------------------------

describe('R3 — TERMINAL ↔ TERMINAL → INFO, valid', () => {
  it('TERMINAL ↔ TERMINAL fires R3 INFO', () => {
    const wires = [makeWire('W1', '929504-1', null, 'ACI01960', null)];
    const cls = [{ wireId: 'W1', fromType: 'TERMINAL' as EndpointType, fromConf: 0.45, toType: 'TERMINAL' as EndpointType, toConf: 0.55 }];
    const result = validate(wires, undefined, cls);
    const wv = wireResult(result, 'W1');
    assert.ok(hasCode(wv, 'R3_TERMINAL_TERMINAL'));
    assert.equal(wv.severity, 'INFO');
    assert.equal(wv.isValid, true); // INFO does not invalidate
  });

  it('R3 severity is INFO per RULE_SEVERITIES', () => {
    assert.equal(RULE_SEVERITIES.R3_TERMINAL_TERMINAL, 'INFO');
  });

  it('TERMINAL ↔ CONNECTOR does NOT fire R3', () => {
    const wires = [makeWire('W1', 'ACI01960', null, 'J1', '3')];
    const cls = [{ wireId: 'W1', fromType: 'TERMINAL' as EndpointType, fromConf: 0.55, toType: 'CONNECTOR' as EndpointType, toConf: 0.75 }];
    const result = validate(wires, undefined, cls);
    const wv = wireResult(result, 'W1');
    assert.ok(!hasCode(wv, 'R3_TERMINAL_TERMINAL'));
  });
});

// ---------------------------------------------------------------------------
// R4 — CONNECTOR TO CONNECTOR
// ---------------------------------------------------------------------------

describe('R4 — CONNECTOR ↔ CONNECTOR without splice → WARNING', () => {
  it('CONNECTOR ↔ CONNECTOR fires R4', () => {
    const wires = [makeWire('W1', 'J1', '1', 'J2', '1')];
    const cls = [{ wireId: 'W1', fromType: 'CONNECTOR' as EndpointType, fromConf: 0.75, toType: 'CONNECTOR' as EndpointType, toConf: 0.75 }];
    const result = validate(wires, undefined, cls);
    const wv = wireResult(result, 'W1');
    assert.ok(hasCode(wv, 'R4_CONNECTOR_CONNECTOR'));
    assert.equal(wv.severity, 'WARNING');
  });

  it('CONNECTOR ↔ CONNECTOR with SPLICE treatment does NOT fire R4', () => {
    const wires = [makeWire('W1', 'J1', '1', 'J2', '1', { fromTreatment: 'SPLICE' })];
    const cls = [{ wireId: 'W1', fromType: 'CONNECTOR' as EndpointType, fromConf: 0.75, toType: 'CONNECTOR' as EndpointType, toConf: 0.75 }];
    const result = validate(wires, undefined, cls);
    const wv = wireResult(result, 'W1');
    assert.ok(!hasCode(wv, 'R4_CONNECTOR_CONNECTOR'));
  });

  it('to-side SPLICE also suppresses R4', () => {
    const wires = [makeWire('W1', 'J1', '1', 'J2', '1', { toTreatment: 'SPLICE' })];
    const cls = [{ wireId: 'W1', fromType: 'CONNECTOR' as EndpointType, fromConf: 0.75, toType: 'CONNECTOR' as EndpointType, toConf: 0.75 }];
    const result = validate(wires, undefined, cls);
    const wv = wireResult(result, 'W1');
    assert.ok(!hasCode(wv, 'R4_CONNECTOR_CONNECTOR'));
  });
});

// ---------------------------------------------------------------------------
// R5 — SPLICE VALIDATION
// ---------------------------------------------------------------------------

describe('R5 — splice on solo component → WARNING', () => {
  it('named component with SPLICE + shareCount < 2 fires R5', () => {
    // "SPLICE_NODE_A" appears on only 1 wire → shareCount = 1
    const wires = [makeWire('W1', 'SPLICE_NODE_A', null, 'J2', '1', { fromTreatment: 'SPLICE' })];
    const result = validate(wires);
    const wv = wireResult(result, 'W1');
    assert.ok(hasCode(wv, 'R5_SPLICE_SOLO'));
    assert.equal(wv.severity, 'WARNING');
  });

  it('SPLICE with NULL component does NOT fire R5', () => {
    const wires = [makeWire('W1', null, null, 'J2', '1', { fromTreatment: 'SPLICE' })];
    const result = validate(wires);
    const wv = wireResult(result, 'W1');
    assert.ok(!hasCode(wv, 'R5_SPLICE_SOLO'));
  });

  it('SPLICE on named component shared by 2 wires does NOT fire R5', () => {
    const wires = [
      makeWire('W1', 'SP1', null, 'J1', '1', { fromTreatment: 'SPLICE' }),
      makeWire('W2', 'SP1', null, 'J2', '1', { fromTreatment: 'SPLICE' }),
    ];
    const result = validate(wires);
    for (const wireId of ['W1', 'W2']) {
      assert.ok(!hasCode(wireResult(result, wireId), 'R5_SPLICE_SOLO'));
    }
  });
});

// ---------------------------------------------------------------------------
// R6 — AMBIGUOUS ENDPOINT
// ---------------------------------------------------------------------------

describe('R6 — AMBIGUOUS classification → WARNING', () => {
  it('AMBIGUOUS from type fires R6', () => {
    const wires = [makeWire('W1', 'J1', null, '929504-1', null)];
    const cls = [{ wireId: 'W1', fromType: 'AMBIGUOUS' as EndpointType, fromConf: 0.35, toType: 'TERMINAL' as EndpointType, toConf: 0.45 }];
    const result = validate(wires, undefined, cls);
    const wv = wireResult(result, 'W1');
    assert.ok(hasCode(wv, 'R6_AMBIGUOUS_ENDPOINT'));
    assert.equal(wv.severity, 'WARNING');
  });

  it('AMBIGUOUS to type fires R6', () => {
    const wires = [makeWire('W1', 'J1', '1', 'J1', null)];
    const cls = [{ wireId: 'W1', fromType: 'CONNECTOR' as EndpointType, fromConf: 0.75, toType: 'AMBIGUOUS' as EndpointType, toConf: 0.35 }];
    const result = validate(wires, undefined, cls);
    const wv = wireResult(result, 'W1');
    assert.ok(hasCode(wv, 'R6_AMBIGUOUS_ENDPOINT'));
  });

  it('both endpoints AMBIGUOUS fires R6 twice', () => {
    const wires = [makeWire('W1', 'J1', null, 'J2', null)];
    const cls = [{ wireId: 'W1', fromType: 'AMBIGUOUS' as EndpointType, fromConf: 0.35, toType: 'AMBIGUOUS' as EndpointType, toConf: 0.35 }];
    const result = validate(wires, undefined, cls);
    const wv = wireResult(result, 'W1');
    assert.equal(wv.issues.filter(i => i.code === 'R6_AMBIGUOUS_ENDPOINT').length, 2);
  });
});

// ---------------------------------------------------------------------------
// R7 — UNMATCHED RECONCILIATION
// ---------------------------------------------------------------------------

describe('R7 — T5 NONE/AMBIGUOUS matchType → WARNING', () => {
  it('from matchType NONE fires R7', () => {
    const wires = [makeWire('W1', 'J1', '1', '929504-1', null)];
    const recon = [makeReconWire('W1', 'NONE', 'EXACT')];
    const result = validate(wires, recon);
    const wv = wireResult(result, 'W1');
    assert.ok(hasCode(wv, 'R7_UNMATCHED_RECONCILIATION'));
    assert.equal(wv.severity, 'WARNING');
  });

  it('to matchType NONE fires R7', () => {
    const wires = [makeWire('W1', 'J1', '1', '929504-1', null)];
    const recon = [makeReconWire('W1', 'EXACT', 'NONE')];
    const result = validate(wires, recon);
    const wv = wireResult(result, 'W1');
    assert.ok(hasCode(wv, 'R7_UNMATCHED_RECONCILIATION'));
  });

  it('from matchType AMBIGUOUS fires R7', () => {
    const wires = [makeWire('W1', 'J1', '1', '929504-1', null)];
    const recon = [makeReconWire('W1', 'AMBIGUOUS', 'EXACT')];
    const result = validate(wires, recon);
    const wv = wireResult(result, 'W1');
    assert.ok(hasCode(wv, 'R7_UNMATCHED_RECONCILIATION'));
  });

  it('EXACT matchType does NOT fire R7', () => {
    const wires = [makeWire('W1', 'J1', '1', '929504-1', null)];
    const recon = [makeReconWire('W1', 'EXACT', 'EXACT')];
    const result = validate(wires, recon);
    const wv = wireResult(result, 'W1');
    assert.ok(!hasCode(wv, 'R7_UNMATCHED_RECONCILIATION'));
  });

  it('FUZZY matchType does NOT fire R7', () => {
    const wires = [makeWire('W1', 'J1', '1', '929504-1', null)];
    const recon = [makeReconWire('W1', 'FUZZY', 'FUZZY')];
    const result = validate(wires, recon);
    const wv = wireResult(result, 'W1');
    assert.ok(!hasCode(wv, 'R7_UNMATCHED_RECONCILIATION'));
  });

  it('R7 skipped when T5 not provided', () => {
    const wires = [makeWire('W1', 'J1', '1', '929504-1', null)];
    const result = validate(wires); // no recon
    const wv = wireResult(result, 'W1');
    assert.ok(!hasCode(wv, 'R7_UNMATCHED_RECONCILIATION'));
  });
});

// ---------------------------------------------------------------------------
// R8 — MISSING TERMINATION (ERROR)
// ---------------------------------------------------------------------------

describe('R8 — missing termination → ERROR', () => {
  it('null component + null treatment + no strip → ERROR', () => {
    const wires = [makeWire('W1', null, null, 'J1', '1')];
    const result = validate(wires);
    const wv = wireResult(result, 'W1');
    assert.ok(hasCode(wv, 'R8_MISSING_TERMINATION'));
    assert.equal(wv.severity, 'ERROR');
    assert.equal(wv.isValid, false);
  });

  it('null component + SPLICE treatment → no R8 (treatment present)', () => {
    const wires = [makeWire('W1', null, null, 'J1', '1', { fromTreatment: 'SPLICE' })];
    const result = validate(wires);
    const wv = wireResult(result, 'W1');
    assert.ok(!hasCode(wv, 'R8_MISSING_TERMINATION'));
  });

  it('null component + strip length callout → no R8', () => {
    const wires = [makeWire('W1', null, null, 'J1', '1', { rawText: 'W1 strip 1/4 inch' })];
    const result = validate(wires);
    const wv = wireResult(result, 'W1');
    assert.ok(!hasCode(wv, 'R8_MISSING_TERMINATION'));
  });

  it('null component + mm strip callout → no R8', () => {
    const wires = [makeWire('W1', null, null, 'J1', '1', { rawText: 'W1 strip 6mm' })];
    const result = validate(wires);
    const wv = wireResult(result, 'W1');
    assert.ok(!hasCode(wv, 'R8_MISSING_TERMINATION'));
  });

  it('both endpoints missing → 2× R8 ERROR', () => {
    const wires = [makeWire('W1', null, null, null, null)];
    const result = validate(wires);
    const wv = wireResult(result, 'W1');
    assert.equal(wv.issues.filter(i => i.code === 'R8_MISSING_TERMINATION').length, 2);
    assert.equal(wv.severity, 'ERROR');
  });

  it('non-null component → no R8', () => {
    const wires = [makeWire('W1', 'J1', '1', '929504-1', null)];
    const result = validate(wires);
    const wv = wireResult(result, 'W1');
    assert.ok(!hasCode(wv, 'R8_MISSING_TERMINATION'));
  });
});

// ---------------------------------------------------------------------------
// R9 — CONNECTOR WITHOUT MULTIPLE WIRES
// ---------------------------------------------------------------------------

describe('R9 — CONNECTOR with shareCount < 2 → WARNING', () => {
  it('single-wire CONNECTOR endpoint fires R9', () => {
    // J1 appears only once (fromComp of W1), shareCount=1
    const wires = [makeWire('W1', 'J1', '1', '929504-1', null)];
    const cls = [{ wireId: 'W1', fromType: 'CONNECTOR' as EndpointType, fromConf: 0.75, toType: 'TERMINAL' as EndpointType, toConf: 0.45 }];
    const result = validate(wires, undefined, cls);
    const wv = wireResult(result, 'W1');
    assert.ok(hasCode(wv, 'R9_CONNECTOR_SINGLE_WIRE'));
    assert.equal(wv.severity, 'WARNING');
  });

  it('multi-wire CONNECTOR endpoint (share=3) does NOT fire R9', () => {
    const wires = [
      makeWire('W1', 'J1', '1', '929504-1', null),
      makeWire('W2', 'J1', '2', 'ACI01960', null),
      makeWire('W3', 'J1', '3', null, null),
    ];
    const cls = [
      { wireId: 'W1', fromType: 'CONNECTOR' as EndpointType, fromConf: 0.90, toType: 'TERMINAL' as EndpointType, toConf: 0.45 },
      { wireId: 'W2', fromType: 'CONNECTOR' as EndpointType, fromConf: 0.90, toType: 'TERMINAL' as EndpointType, toConf: 0.55 },
      { wireId: 'W3', fromType: 'CONNECTOR' as EndpointType, fromConf: 0.90, toType: 'OPEN' as EndpointType,     toConf: 0.60 },
    ];
    const result = validate(wires, undefined, cls);
    for (const wireId of ['W1', 'W2', 'W3']) {
      assert.ok(!hasCode(wireResult(result, wireId), 'R9_CONNECTOR_SINGLE_WIRE'),
        `R9 should not fire for ${wireId} (multi-wire)`);
    }
  });

  it('TERMINAL endpoint ignores R9 (not CONNECTOR)', () => {
    const wires = [makeWire('W1', '929504-1', null, 'ACI01960', null)];
    const cls = [{ wireId: 'W1', fromType: 'TERMINAL' as EndpointType, fromConf: 0.45, toType: 'TERMINAL' as EndpointType, toConf: 0.55 }];
    const result = validate(wires, undefined, cls);
    const wv = wireResult(result, 'W1');
    assert.ok(!hasCode(wv, 'R9_CONNECTOR_SINGLE_WIRE'));
  });

  it('R9 skipped when T6 not provided', () => {
    const wires = [makeWire('W1', 'J1', '1', '929504-1', null)];
    const result = validate(wires); // no cls
    const wv = wireResult(result, 'W1');
    assert.ok(!hasCode(wv, 'R9_CONNECTOR_SINGLE_WIRE'));
  });
});

// ---------------------------------------------------------------------------
// R10 — HIGH CONFIDENCE CONFLICT
// ---------------------------------------------------------------------------

describe('R10 — T6 high-confidence + T5 NONE → ERROR', () => {
  it('from: T6 conf >= 0.8 + T5 NONE → ERROR R10', () => {
    const wires = [makeWire('W1', 'J1', '1', '929504-1', null)];
    const recon = [makeReconWire('W1', 'NONE', 'EXACT')];
    const cls = [{ wireId: 'W1', fromType: 'CONNECTOR' as EndpointType, fromConf: 0.90, toType: 'TERMINAL' as EndpointType, toConf: 0.45 }];
    const result = validate(wires, recon, cls);
    const wv = wireResult(result, 'W1');
    assert.ok(hasCode(wv, 'R10_CONFIDENCE_CONFLICT'));
    assert.equal(wv.severity, 'ERROR');
  });

  it('to: T6 conf >= 0.8 + T5 NONE → ERROR R10', () => {
    const wires = [makeWire('W1', 'J1', '1', '929504-1', null)];
    const recon = [makeReconWire('W1', 'EXACT', 'NONE')];
    const cls = [{ wireId: 'W1', fromType: 'CONNECTOR' as EndpointType, fromConf: 0.75, toType: 'CONNECTOR' as EndpointType, toConf: 0.90 }];
    const result = validate(wires, recon, cls);
    const wv = wireResult(result, 'W1');
    assert.ok(hasCode(wv, 'R10_CONFIDENCE_CONFLICT'));
  });

  it('T6 conf < 0.8 + T5 NONE → no R10', () => {
    const wires = [makeWire('W1', 'J1', '1', '929504-1', null)];
    const recon = [makeReconWire('W1', 'NONE', 'EXACT')];
    const cls = [{ wireId: 'W1', fromType: 'CONNECTOR' as EndpointType, fromConf: 0.75, toType: 'TERMINAL' as EndpointType, toConf: 0.45 }];
    const result = validate(wires, recon, cls);
    const wv = wireResult(result, 'W1');
    assert.ok(!hasCode(wv, 'R10_CONFIDENCE_CONFLICT'));
  });

  it('T6 high-conf + T5 EXACT → no R10 (no conflict)', () => {
    const wires = [makeWire('W1', 'J1', '1', '929504-1', null)];
    const recon = [makeReconWire('W1', 'EXACT', 'EXACT')];
    const cls = [{ wireId: 'W1', fromType: 'CONNECTOR' as EndpointType, fromConf: 0.90, toType: 'TERMINAL' as EndpointType, toConf: 0.55 }];
    const result = validate(wires, recon, cls);
    const wv = wireResult(result, 'W1');
    assert.ok(!hasCode(wv, 'R10_CONFIDENCE_CONFLICT'));
  });

  it('R10 skipped when T5 not provided', () => {
    const wires = [makeWire('W1', 'J1', '1', '929504-1', null)];
    const cls = [{ wireId: 'W1', fromType: 'CONNECTOR' as EndpointType, fromConf: 0.95, toType: 'TERMINAL' as EndpointType, toConf: 0.55 }];
    const result = validate(wires, undefined, cls);
    const wv = wireResult(result, 'W1');
    assert.ok(!hasCode(wv, 'R10_CONFIDENCE_CONFLICT'));
  });
});

// ---------------------------------------------------------------------------
// Harness-level rules
// ---------------------------------------------------------------------------

describe('H1 — excessive AMBIGUOUS endpoints → WARNING', () => {
  it('>20% AMBIGUOUS fires H1', () => {
    // 6 wires × 2 endpoints = 12; 3 AMBIGUOUS = 25%
    const wires = Array.from({ length: 6 }, (_, i) => makeWire(`W${i}`, 'J1', `${i}`, null, null));
    const cls = Array.from({ length: 6 }, (_, i) => ({
      wireId: `W${i}`,
      fromType: (i < 3 ? 'AMBIGUOUS' : 'CONNECTOR') as EndpointType, fromConf: 0.35,
      toType: 'OPEN' as EndpointType, toConf: 0.60,
    }));
    const result = validateHarness({ connectivity: makeHc(wires), endpointClassification: makeClassification(cls) });
    assert.ok(result.harnessIssues.some(i => i.code === 'H1_EXCESSIVE_AMBIGUOUS'));
    assert.equal(result.harnessIssues.find(i => i.code === 'H1_EXCESSIVE_AMBIGUOUS')!.severity, 'WARNING');
  });

  it('20% or less AMBIGUOUS does NOT fire H1', () => {
    // 5 wires × 2 = 10 endpoints; 2 AMBIGUOUS = 20% — NOT > 20%
    const wires = Array.from({ length: 5 }, (_, i) => makeWire(`W${i}`, 'J1', `${i}`, null, null));
    const cls = Array.from({ length: 5 }, (_, i) => ({
      wireId: `W${i}`,
      fromType: (i < 2 ? 'AMBIGUOUS' : 'CONNECTOR') as EndpointType, fromConf: 0.35,
      toType: 'OPEN' as EndpointType, toConf: 0.60,
    }));
    const result = validateHarness({ connectivity: makeHc(wires), endpointClassification: makeClassification(cls) });
    assert.ok(!result.harnessIssues.some(i => i.code === 'H1_EXCESSIVE_AMBIGUOUS'));
  });
});

describe('H2 — excessive NONE-match endpoints → WARNING', () => {
  it('>20% NONE-match fires H2', () => {
    // 5 wires × 2 = 10 endpoints; 3 NONE from-side = 30%
    const wires = Array.from({ length: 5 }, (_, i) => makeWire(`W${i}`, 'J1', `${i}`, 'T1', null));
    const recon = Array.from({ length: 5 }, (_, i) =>
      makeReconWire(`W${i}`, i < 3 ? 'NONE' : 'EXACT', 'EXACT'),
    );
    const result = validateHarness({ connectivity: makeHc(wires), reconciliation: makeRecon(recon) });
    assert.ok(result.harnessIssues.some(i => i.code === 'H2_EXCESSIVE_UNMATCHED'));
  });

  it('20% or fewer NONE-match does NOT fire H2', () => {
    // 5 wires × 2 = 10 endpoints; 2 NONE from-side = 20% — NOT > 20%
    const wires = Array.from({ length: 5 }, (_, i) => makeWire(`W${i}`, 'J1', `${i}`, 'T1', null));
    const recon = Array.from({ length: 5 }, (_, i) =>
      makeReconWire(`W${i}`, i < 2 ? 'NONE' : 'EXACT', 'EXACT'),
    );
    const result = validateHarness({ connectivity: makeHc(wires), reconciliation: makeRecon(recon) });
    assert.ok(!result.harnessIssues.some(i => i.code === 'H2_EXCESSIVE_UNMATCHED'));
  });
});

describe('H3 — no connectors in multi-wire harness → WARNING', () => {
  it('multi-wire harness with zero CONNECTOR endpoints fires H3', () => {
    const wires = [
      makeWire('W1', '929504-1', null, 'ACI01960', null),
      makeWire('W2', '929505-1', null, 'ACI01961', null),
    ];
    const cls = [
      { wireId: 'W1', fromType: 'TERMINAL' as EndpointType, fromConf: 0.45, toType: 'TERMINAL' as EndpointType, toConf: 0.55 },
      { wireId: 'W2', fromType: 'TERMINAL' as EndpointType, fromConf: 0.45, toType: 'TERMINAL' as EndpointType, toConf: 0.55 },
    ];
    const result = validateHarness({ connectivity: makeHc(wires), endpointClassification: makeClassification(cls) });
    assert.ok(result.harnessIssues.some(i => i.code === 'H3_NO_CONNECTORS'));
  });

  it('single-wire harness with no connectors does NOT fire H3', () => {
    const wires = [makeWire('W1', '929504-1', null, 'ACI01960', null)];
    const cls = [{ wireId: 'W1', fromType: 'TERMINAL' as EndpointType, fromConf: 0.45, toType: 'TERMINAL' as EndpointType, toConf: 0.55 }];
    const result = validateHarness({ connectivity: makeHc(wires), endpointClassification: makeClassification(cls) });
    assert.ok(!result.harnessIssues.some(i => i.code === 'H3_NO_CONNECTORS'));
  });
});

describe('H4 — all endpoints OPEN → INFO', () => {
  it('all endpoints OPEN fires H4 INFO', () => {
    const wires = [
      makeWire('W1', null, null, null, null),
      makeWire('W2', null, null, null, null),
    ];
    const cls = [
      { wireId: 'W1', fromType: 'OPEN' as EndpointType, fromConf: 0.60, toType: 'OPEN' as EndpointType, toConf: 0.60 },
      { wireId: 'W2', fromType: 'OPEN' as EndpointType, fromConf: 0.60, toType: 'OPEN' as EndpointType, toConf: 0.60 },
    ];
    const result = validateHarness({ connectivity: makeHc(wires), endpointClassification: makeClassification(cls) });
    const h4 = result.harnessIssues.find(i => i.code === 'H4_ALL_OPEN');
    assert.ok(h4);
    assert.equal(h4!.severity, 'INFO');
  });

  it('mixed OPEN/CONNECTOR does NOT fire H4', () => {
    const wires = [makeWire('W1', 'J1', '1', null, null)];
    const cls = [{ wireId: 'W1', fromType: 'CONNECTOR' as EndpointType, fromConf: 0.75, toType: 'OPEN' as EndpointType, toConf: 0.60 }];
    const result = validateHarness({ connectivity: makeHc(wires), endpointClassification: makeClassification(cls) });
    assert.ok(!result.harnessIssues.some(i => i.code === 'H4_ALL_OPEN'));
  });
});

// ---------------------------------------------------------------------------
// Adversarial cases (spec section 10)
// ---------------------------------------------------------------------------

describe('Adversarial — connector ↔ open', () => {
  it('R1 fires (connector no cavity) + R9 (single wire)', () => {
    // Strip callout on rawText suppresses R8 on the null to-endpoint so
    // WARNING (R1 + R9) is the highest severity, not ERROR.
    const wires = [makeWire('W1', 'J1', null, null, null, { rawText: 'W1 J1 1/4 strip open end' })];
    const cls = [{ wireId: 'W1', fromType: 'CONNECTOR' as EndpointType, fromConf: 0.35, toType: 'OPEN' as EndpointType, toConf: 0.60 }];
    const result = validate(wires, undefined, cls);
    const wv = wireResult(result, 'W1');
    assert.ok(hasCode(wv, 'R1_CONNECTOR_NO_PIN'));
    assert.ok(hasCode(wv, 'R9_CONNECTOR_SINGLE_WIRE'));
    assert.equal(wv.severity, 'WARNING');
  });
});

describe('Adversarial — open ↔ open (fully bare wire)', () => {
  it('R2 (OPEN+OPEN) + R8 (×2) fires → severity ERROR', () => {
    const wires = [makeWire('W1', null, null, null, null)];
    const cls = [{ wireId: 'W1', fromType: 'OPEN' as EndpointType, fromConf: 0.60, toType: 'OPEN' as EndpointType, toConf: 0.60 }];
    const result = validate(wires, undefined, cls);
    const wv = wireResult(result, 'W1');
    assert.ok(hasCode(wv, 'R2_OPEN_OPEN'));
    assert.equal(wv.issues.filter(i => i.code === 'R8_MISSING_TERMINATION').length, 2);
    assert.equal(wv.severity, 'ERROR');
    assert.equal(wv.isValid, false);
  });
});

describe('Adversarial — connector without pins', () => {
  it('CONNECTOR no cavity fires R1 and R9 (single wire)', () => {
    const wires = [makeWire('W1', 'PHOENIX_1700443', null, '929504-1', null)];
    const cls = [{ wireId: 'W1', fromType: 'CONNECTOR' as EndpointType, fromConf: 0.65, toType: 'TERMINAL' as EndpointType, toConf: 0.45 }];
    const result = validate(wires, undefined, cls);
    const wv = wireResult(result, 'W1');
    assert.ok(hasCode(wv, 'R1_CONNECTOR_NO_PIN'));
    assert.ok(hasCode(wv, 'R9_CONNECTOR_SINGLE_WIRE'));
  });
});

describe('Adversarial — splice-only harness', () => {
  it('all-OPEN harness with SPLICE treatment → R5 does not fire (null component)', () => {
    const wires = [
      makeWire('W1', null, null, null, null, { fromTreatment: 'SPLICE' }),
      makeWire('W2', null, null, null, null, { fromTreatment: 'SPLICE' }),
    ];
    const result = validate(wires);
    for (const wireId of ['W1', 'W2']) {
      assert.ok(!hasCode(wireResult(result, wireId), 'R5_SPLICE_SOLO'));
    }
  });

  it('named splice component appearing once → R5 fires', () => {
    const wires = [makeWire('W1', 'SP_NODE', null, null, null, { fromTreatment: 'SPLICE' })];
    const result = validate(wires);
    const wv = wireResult(result, 'W1');
    assert.ok(hasCode(wv, 'R5_SPLICE_SOLO'));
  });
});

describe('Adversarial — conflicting reconciliation vs classification', () => {
  it('high-conf CONNECTOR + T5 NONE → R10 ERROR', () => {
    const wires = [makeWire('W1', 'J1', '3', '929504-1', null)];
    const recon = [makeReconWire('W1', 'NONE', 'NONE')];
    const cls = [{ wireId: 'W1', fromType: 'CONNECTOR' as EndpointType, fromConf: 0.95, toType: 'TERMINAL' as EndpointType, toConf: 0.45 }];
    const result = validate(wires, recon, cls);
    const wv = wireResult(result, 'W1');
    assert.ok(hasCode(wv, 'R10_CONFIDENCE_CONFLICT'));
    assert.equal(wv.severity, 'ERROR');
  });
});

// ---------------------------------------------------------------------------
// Valid configurations — no false positives
// ---------------------------------------------------------------------------

describe('Valid configurations — no false positives', () => {
  it('CONNECTOR/3 → TERMINAL (fully populated) → minimal issues', () => {
    // J1 shared by 3 wires, all with cavities → no R1, R4, R9
    const wires = [
      makeWire('W1', 'J1', '1', '929504-1', null),
      makeWire('W2', 'J1', '2', 'ACI01960', null),
      makeWire('W3', 'J1', '3', '929505-1', null),
    ];
    const recon = [
      makeReconWire('W1', 'EXACT', 'PN_MATCH'),
      makeReconWire('W2', 'EXACT', 'EXACT'),
      makeReconWire('W3', 'EXACT', 'PN_MATCH'),
    ];
    const cls = [
      { wireId: 'W1', fromType: 'CONNECTOR' as EndpointType, fromConf: 0.90, toType: 'TERMINAL' as EndpointType, toConf: 0.45 },
      { wireId: 'W2', fromType: 'CONNECTOR' as EndpointType, fromConf: 0.90, toType: 'TERMINAL' as EndpointType, toConf: 0.55 },
      { wireId: 'W3', fromType: 'CONNECTOR' as EndpointType, fromConf: 0.90, toType: 'TERMINAL' as EndpointType, toConf: 0.45 },
    ];
    const result = validate(wires, recon, cls);
    for (const wireId of ['W1', 'W2', 'W3']) {
      const wv = wireResult(result, wireId);
      const badCodes = wv.issues
        .filter(i => ['R1_CONNECTOR_NO_PIN','R4_CONNECTOR_CONNECTOR','R7_UNMATCHED_RECONCILIATION','R8_MISSING_TERMINATION','R9_CONNECTOR_SINGLE_WIRE','R10_CONFIDENCE_CONFLICT'].includes(i.code))
        .map(i => i.code);
      assert.deepEqual(badCodes, [], `Unexpected issues on ${wireId}: ${badCodes.join(', ')}`);
    }
    assert.equal(result.summary.errors, 0);
    assert.equal(result.harnessIssues.filter(i => i.severity !== 'INFO').length, 0);
  });

  it('TERMINAL ↔ TERMINAL (full match) → only R3 INFO, no WARNING/ERROR', () => {
    const wires = [makeWire('W1', 'ACI01960', null, '929504-1', null)];
    const recon = [makeReconWire('W1', 'EXACT', 'PN_MATCH')];
    const cls = [{ wireId: 'W1', fromType: 'TERMINAL' as EndpointType, fromConf: 0.55, toType: 'TERMINAL' as EndpointType, toConf: 0.45 }];
    const result = validate(wires, recon, cls);
    const wv = wireResult(result, 'W1');
    assert.equal(wv.severity, 'INFO');
    assert.equal(wv.isValid, true);
    assert.equal(result.summary.warnings, 0);
    assert.equal(result.summary.errors, 0);
  });

  it('empty harness → zero total, no harness issues', () => {
    const result = validateHarness({ connectivity: makeHc([]) });
    assert.equal(result.summary.total, 0);
    assert.equal(result.harnessIssues.length, 0);
  });
});

// ---------------------------------------------------------------------------
// Graceful degradation
// ---------------------------------------------------------------------------

describe('Graceful degradation — T5 and T6 absent', () => {
  it('no T6 → R1, R2, R3, R4, R6, R9 all skipped', () => {
    const wires = [makeWire('W1', 'J1', null, null, null)];
    const result = validate(wires); // no cls
    const wv = wireResult(result, 'W1');
    const classificationRuleCodes = ['R1_CONNECTOR_NO_PIN', 'R2_OPEN_OPEN', 'R3_TERMINAL_TERMINAL', 'R4_CONNECTOR_CONNECTOR', 'R6_AMBIGUOUS_ENDPOINT', 'R9_CONNECTOR_SINGLE_WIRE'];
    for (const code of classificationRuleCodes) {
      assert.ok(!hasCode(wv, code), `${code} should not fire without T6`);
    }
  });

  it('no T5 → R7, R10 all skipped', () => {
    const wires = [makeWire('W1', 'J1', '1', '929504-1', null)];
    const cls = [{ wireId: 'W1', fromType: 'CONNECTOR' as EndpointType, fromConf: 0.95, toType: 'TERMINAL' as EndpointType, toConf: 0.45 }];
    const result = validate(wires, undefined, cls);
    const wv = wireResult(result, 'W1');
    assert.ok(!hasCode(wv, 'R7_UNMATCHED_RECONCILIATION'));
    assert.ok(!hasCode(wv, 'R10_CONFIDENCE_CONFLICT'));
  });

  it('no T5 or T6 → only T2-based rules fire (R5, R8)', () => {
    const wires = [makeWire('W1', null, null, null, null)];
    const result = validate(wires);
    const wv = wireResult(result, 'W1');
    assert.ok(hasCode(wv, 'R8_MISSING_TERMINATION'));
    assert.equal(wv.severity, 'ERROR');
  });
});

// ---------------------------------------------------------------------------
// Summary correctness
// ---------------------------------------------------------------------------

describe('Summary correctness', () => {
  it('total = wire count', () => {
    const wires = [
      makeWire('W1', 'J1', '1', '929504-1', null),
      makeWire('W2', null, null, null, null),
      makeWire('W3', 'J2', '1', 'ACI01960', null),
    ];
    const result = validate(wires);
    assert.equal(result.summary.total, 3);
  });

  it('valid + warnings + errors = total', () => {
    const wires = [
      makeWire('W1', 'J1', '1', '929504-1', null),  // no issues (with T6) or R8 free
      makeWire('W2', null, null, null, null),         // R8 ERROR
    ];
    const result = validate(wires);
    assert.equal(result.summary.valid + result.summary.warnings + result.summary.errors, result.summary.total);
  });

  it('error wire counted in summary.errors not summary.warnings', () => {
    const wires = [makeWire('W1', null, null, null, null)];
    const result = validate(wires);
    assert.equal(result.summary.errors, 1);
    assert.equal(result.summary.warnings, 0);
  });

  it('INFO-only wire (R3) counted as valid', () => {
    const wires = [makeWire('W1', 'ACI01960', null, '929504-1', null)];
    const cls = [{ wireId: 'W1', fromType: 'TERMINAL' as EndpointType, fromConf: 0.55, toType: 'TERMINAL' as EndpointType, toConf: 0.45 }];
    const result = validate(wires, undefined, cls);
    assert.equal(result.summary.valid, 1);
    assert.equal(result.summary.warnings, 0);
    assert.equal(result.summary.errors, 0);
  });
});

// ---------------------------------------------------------------------------
// No upstream mutation
// ---------------------------------------------------------------------------

describe('No upstream mutation', () => {
  it('validateHarness does not mutate HarnessConnectivityResult', () => {
    const wires = [makeWire('W1', 'J1', '1', '929504-1', null)];
    const hc = makeHc(wires);
    const originalComp = hc.wires[0].from.component;
    validateHarness({ connectivity: hc });
    assert.equal(hc.wires[0].from.component, originalComp);
    assert.equal(hc.wires.length, 1);
  });

  it('validateHarness does not mutate HarnessReconciliationResult', () => {
    const wires = [makeWire('W1', 'J1', '1', '929504-1', null)];
    const recon = makeRecon([makeReconWire('W1', 'EXACT', 'NONE')]);
    const originalMatchType = recon.wires[0].to.matchType;
    validateHarness({ connectivity: makeHc(wires), reconciliation: recon });
    assert.equal(recon.wires[0].to.matchType, originalMatchType);
  });
});
