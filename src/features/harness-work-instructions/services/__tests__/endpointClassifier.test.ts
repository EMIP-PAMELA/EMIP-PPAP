/**
 * endpointClassifier.test.ts — Phase T6 unit tests
 *
 * Covers all 6 spec scenarios (A–F) plus:
 *   - Phoenix connector detection
 *   - Housing keyword detection
 *   - FASTON / terminal keyword scoring
 *   - Multi-wire share-count boosting
 *   - AMBIGUOUS tie detection
 *   - All-null endpoint → OPEN
 *   - Batch classifyHarnessEndpoints
 *   - Evidence traceability
 *   - Zero false positives for short IDs and bus wires
 *
 * No I/O, no real PDFs, no AI. All inputs are inline mocks.
 */

import { describe, it } from 'node:test';
import assert from 'assert/strict';
import {
  classifyEndpoint,
  classifyHarnessEndpoints,
} from '../endpointClassifier';
import type {
  EndpointClassificationContext,
  HarnessEndpointClassificationResult,
} from '../endpointClassifier';
import type { HarnessConnectivityResult } from '../harnessConnectivityService';

// ---------------------------------------------------------------------------
// Mock builders
// ---------------------------------------------------------------------------

function makeCtx(
  component: string | null,
  cavity:    string | null,
  treatment: string | null,
  rawText:   string,
  wireShareCount = 1,
): EndpointClassificationContext {
  return { component, cavity, treatment, rawText, wireShareCount };
}

function makeHcResult(
  wires: Array<{
    wireId: string;
    fromComp: string | null;
    fromCavity: string | null;
    toComp: string | null;
    toCavity: string | null;
    rawText?: string;
  }>,
): HarnessConnectivityResult {
  return {
    wires: wires.map((w, i) => ({
      wireId:         w.wireId,
      length:         null,
      gauge:          null,
      color:          null,
      from: { component: w.fromComp, cavity: w.fromCavity, treatment: null },
      to:   { component: w.toComp,   cavity: w.toCavity,   treatment: null },
      sourceRowIndex: i,
      rawText:        w.rawText ?? `${w.wireId} ${w.fromComp ?? ''} ${w.toComp ?? ''}`,
      confidence:     0.9,
      unresolved:     false,
    })),
    unresolvedWires: [],
    confidenceSummary: { total: wires.length, resolved: wires.length, partial: 0, unresolved: 0 },
  };
}

// ---------------------------------------------------------------------------
// Spec Case A — Single wire, one terminal
// J1 / pin3 (CONNECTOR) → 929504-1 (TERMINAL)
// ---------------------------------------------------------------------------

describe('Spec A — single wire, connector → terminal', () => {
  it('from J1/pin3 → CONNECTOR', () => {
    const r = classifyEndpoint(makeCtx('J1', '3', null, 'W1 J1 3 929504-1'));
    assert.equal(r.type, 'CONNECTOR');
    assert.ok(r.confidence >= 0.70);
  });

  it('to 929504-1 (no cavity) → TERMINAL', () => {
    const r = classifyEndpoint(makeCtx('929504-1', null, null, 'W1 J1 3 929504-1'));
    assert.equal(r.type, 'TERMINAL');
    assert.ok(r.confidence >= 0.40); // TERMINAL_PN_RE only = 0.45
  });

  it('connector confidence reflects cavity + ref signals', () => {
    const r = classifyEndpoint(makeCtx('J1', '3', null, 'W1 J1 3 929504-1'));
    assert.ok(r.scores.connectorEvidence >= 0.70); // 0.40 cavity + 0.35 ref
    assert.ok(r.evidence.some(e => e.includes('cavity')));
    assert.ok(r.evidence.some(e => e.includes('connector ref')));
  });
});

// ---------------------------------------------------------------------------
// Spec Case B — Single wire, stripped end
// J1 / pin3 (CONNECTOR) → null (OPEN)
// ---------------------------------------------------------------------------

describe('Spec B — stripped wire end', () => {
  it('to null component → OPEN', () => {
    const r = classifyEndpoint(makeCtx(null, null, null, 'W2 J1 3'));
    assert.equal(r.type, 'OPEN');
    assert.ok(r.confidence >= 0.50);
  });

  it('OPEN evidence includes no-component signal', () => {
    const r = classifyEndpoint(makeCtx(null, null, null, 'W2 J1 3'));
    assert.ok(r.evidence.some(e => e.includes('no component label')));
  });

  it('from J1/pin3 side of stripped wire → still CONNECTOR', () => {
    const r = classifyEndpoint(makeCtx('J1', '3', null, 'W2 J1 3'));
    assert.equal(r.type, 'CONNECTOR');
  });
});

// ---------------------------------------------------------------------------
// Spec Case C — Multi-wire housing
// 4 wires all routed into same connector housing J1
// ---------------------------------------------------------------------------

describe('Spec C — multi-wire housing', () => {
  it('wireShareCount=4 boosts CONNECTOR score', () => {
    const r = classifyEndpoint(makeCtx('J1', '1', null, 'W1 J1 1 929504-1', 4));
    assert.equal(r.type, 'CONNECTOR');
    assert.ok(r.scores.connectorEvidence >= 0.90); // 0.40+0.35+0.30=1.05 capped
  });

  it('evidence mentions multi-wire housing', () => {
    const r = classifyEndpoint(makeCtx('J1', '1', null, 'W1 J1 1 929504-1', 4));
    assert.ok(r.evidence.some(e => e.includes('multi-wire housing')));
  });

  it('wireShareCount=2 gives partial CONNECTOR boost', () => {
    const r = classifyEndpoint(makeCtx('J1', '1', null, 'W1 J1 1', 2));
    assert.equal(r.type, 'CONNECTOR');
    assert.ok(r.evidence.some(e => e.includes('2-wire housing')));
  });
});

// ---------------------------------------------------------------------------
// Spec Case D — Terminal both ends
// ACI01960 (TERMINAL) → 929504-1 (TERMINAL)
// ---------------------------------------------------------------------------

describe('Spec D — terminal both ends', () => {
  it('ACI PN from endpoint → TERMINAL', () => {
    const r = classifyEndpoint(makeCtx('ACI01960', null, null, 'W3 ACI01960 929504-1'));
    assert.equal(r.type, 'TERMINAL');
    assert.ok(r.scores.terminalEvidence >= 0.55);
  });

  it('ACI PN evidence is traceable', () => {
    const r = classifyEndpoint(makeCtx('ACI01960', null, null, 'W3 ACI01960 929504-1'));
    assert.ok(r.evidence.some(e => e.includes('ACI terminal PN')));
  });

  it('dash-numeric PN to endpoint → TERMINAL', () => {
    const r = classifyEndpoint(makeCtx('929504-1', null, null, 'W3 ACI01960 929504-1'));
    assert.equal(r.type, 'TERMINAL');
  });

  it('both endpoints TERMINAL in batch classifier', () => {
    const hc = makeHcResult([{
      wireId: 'W3', fromComp: 'ACI01960', fromCavity: null, toComp: '929504-1', toCavity: null,
    }]);
    const result: HarnessEndpointClassificationResult = classifyHarnessEndpoints(hc);
    const cls = result.classifications.get('W3')!;
    assert.equal(cls.from.type, 'TERMINAL');
    assert.equal(cls.to.type,   'TERMINAL');
  });
});

// ---------------------------------------------------------------------------
// Spec Case E — Connector one side, terminal other (MIXED)
// J1 / pin1 (CONNECTOR) → ACI01960 (TERMINAL)
// ---------------------------------------------------------------------------

describe('Spec E — connector/terminal mixed wire', () => {
  it('from J1/pin1 → CONNECTOR', () => {
    const r = classifyEndpoint(makeCtx('J1', '1', null, 'W4 J1 1 ACI01960'));
    assert.equal(r.type, 'CONNECTOR');
  });

  it('to ACI01960 → TERMINAL', () => {
    const r = classifyEndpoint(makeCtx('ACI01960', null, null, 'W4 J1 1 ACI01960'));
    assert.equal(r.type, 'TERMINAL');
  });

  it('batch produces CONNECTOR from + TERMINAL to', () => {
    const hc = makeHcResult([{
      wireId: 'W4', fromComp: 'J1', fromCavity: '1', toComp: 'ACI01960', toCavity: null,
    }]);
    const result = classifyHarnessEndpoints(hc);
    const cls = result.classifications.get('W4')!;
    assert.equal(cls.from.type, 'CONNECTOR');
    assert.equal(cls.to.type,   'TERMINAL');
  });
});

// ---------------------------------------------------------------------------
// Spec Case F — Splice present → NOT connector
// ---------------------------------------------------------------------------

describe('Spec F — splice treatment → OPEN, not CONNECTOR', () => {
  it('null component + SPLICE treatment → OPEN', () => {
    const r = classifyEndpoint(makeCtx(null, null, 'SPLICE', 'W5 J1 SPLICE'));
    assert.equal(r.type, 'OPEN');
  });

  it('OPEN confidence includes SPLICE signal', () => {
    const r = classifyEndpoint(makeCtx(null, null, 'SPLICE', 'W5 J1 SPLICE'));
    assert.ok(r.scores.openEvidence >= 0.70); // 0.60 + 0.20
    assert.ok(r.evidence.some(e => e.includes('SPLICE')));
  });

  it('HEAT_SHRINK treatment contributes to OPEN', () => {
    const r = classifyEndpoint(makeCtx(null, null, 'HEAT_SHRINK', 'W6 J1 HEAT_SHRINK'));
    assert.equal(r.type, 'OPEN');
    assert.ok(r.evidence.some(e => e.includes('HEAT_SHRINK')));
  });

  it('connector ref J1 + SPLICE treatment: connector signal dominates', () => {
    // J1 + pin + SPLICE: connScore = 0.40+0.35=0.75, openScore = 0.20
    const r = classifyEndpoint(makeCtx('J1', '3', 'SPLICE', 'W5 J1 3 SPLICE'));
    assert.equal(r.type, 'CONNECTOR');
  });
});

// ---------------------------------------------------------------------------
// Phoenix connector detection
// ---------------------------------------------------------------------------

describe('Phoenix connector detection', () => {
  it('PHOENIX_1700443 (T2 format) → CONNECTOR', () => {
    const r = classifyEndpoint(makeCtx('PHOENIX_1700443', '1', null, 'W7 PHOENIX 1700443'));
    assert.equal(r.type, 'CONNECTOR');
    assert.ok(r.evidence.some(e => e.includes('Phoenix connector brand')));
  });

  it('PHOENIX (bare keyword) → CONNECTOR', () => {
    const r = classifyEndpoint(makeCtx('PHOENIX', '2', null, 'W7 PHOENIX'));
    assert.equal(r.type, 'CONNECTOR');
  });

  it('PHOENIX without cavity still → CONNECTOR (brand signal)', () => {
    const r = classifyEndpoint(makeCtx('PHOENIX_1700443', null, null, 'W7 PHOENIX 1700443'));
    assert.equal(r.type, 'CONNECTOR');
  });

  it('multi-wire Phoenix housing gets high confidence', () => {
    const r = classifyEndpoint(makeCtx('PHOENIX_1700443', '1', null, 'W7 PHOENIX 1700443', 4));
    assert.ok(r.scores.connectorEvidence >= 0.80);
  });
});

// ---------------------------------------------------------------------------
// Housing keyword detection
// ---------------------------------------------------------------------------

describe('Housing keyword detection', () => {
  it('component "CONNECTOR BLOCK" → CONNECTOR', () => {
    const r = classifyEndpoint(makeCtx('CONNECTOR BLOCK', null, null, 'W8'));
    assert.equal(r.type, 'CONNECTOR');
    assert.ok(r.evidence.some(e => e.includes('housing keyword')));
  });

  it('component "PLUG HOUSING" → CONNECTOR', () => {
    const r = classifyEndpoint(makeCtx('PLUG HOUSING', null, null, 'W8'));
    assert.equal(r.type, 'CONNECTOR');
  });

  it('component "HSG_3P" → CONNECTOR', () => {
    const r = classifyEndpoint(makeCtx('HSG_3P', null, null, 'W8'));
    assert.equal(r.type, 'CONNECTOR');
  });
});

// ---------------------------------------------------------------------------
// Terminal keyword (FASTON etc.) scoring
// ---------------------------------------------------------------------------

describe('Terminal keyword detection', () => {
  it('FASTON in rawText boosts TERMINAL score', () => {
    const r = classifyEndpoint(makeCtx('929504-1', null, null, 'W9 FASTON 929504-1'));
    assert.equal(r.type, 'TERMINAL');
    assert.ok(r.evidence.some(e => e.includes('terminal keyword')));
  });

  it('FASTON alone (no PN) → TERMINAL from keyword signal', () => {
    // No PN in component, but FASTON in rawText
    const r = classifyEndpoint(makeCtx('TERM_A', null, null, 'W9 FASTON TERM_A'));
    // termScore: keyword +0.35 = 0.35
    // connScore: CONN_REF=no, PHOENIX=no, HOUSING=no = 0
    // openScore: component present = 0
    assert.equal(r.type, 'TERMINAL');
  });

  it('null component + RING TERMINAL keyword in rawText → OPEN wins over terminal keyword', () => {
    // termScore: keyword +0.35 = 0.35
    // openScore: no component +0.60
    // OPEN (0.60) wins — null component is dominant signal; keyword alone cannot overcome it
    const r = classifyEndpoint(makeCtx(null, null, null, 'W9 RING TERMINAL'));
    assert.equal(r.type, 'OPEN');
  });

  it('RING TERMINAL keyword with PN present → TERMINAL', () => {
    const r = classifyEndpoint(makeCtx('929504-1', null, null, 'W9 RING TERMINAL 929504-1'));
    assert.equal(r.type, 'TERMINAL');
    assert.ok(r.scores.terminalEvidence >= 0.75); // 0.45+0.35=0.80, capped at 1.0
  });
});

// ---------------------------------------------------------------------------
// AMBIGUOUS tie detection
// ---------------------------------------------------------------------------

describe('AMBIGUOUS tie', () => {
  it('J1 connector ref + FASTON keyword (no cavity) → exact tie → AMBIGUOUS', () => {
    // connScore: CONN_REF +0.35, no cavity, shareCount=1 = 0.35
    // termScore: TERMINAL_KW(FASTON) +0.35 = 0.35
    // exact tie (diff=0.00 < TIE_THRESHOLD=0.10) → AMBIGUOUS
    const r = classifyEndpoint(makeCtx('J1', null, null, 'W10 J1 FASTON'));
    assert.equal(r.type, 'AMBIGUOUS');
    assert.ok(r.scores.connectorEvidence > 0);
    assert.ok(r.scores.terminalEvidence > 0);
  });

  it('AMBIGUOUS never forces a resolution (no winner selected)', () => {
    const r = classifyEndpoint(makeCtx('J1', null, null, 'W10 J1 FASTON'));
    assert.equal(r.type, 'AMBIGUOUS');
    assert.ok(r.evidence.length >= 2); // both signal sets contribute
  });
});

// ---------------------------------------------------------------------------
// All-zero case
// ---------------------------------------------------------------------------

describe('all-zero endpoint signals', () => {
  it('no component + no cavity + no treatment + no keywords → OPEN', () => {
    const r = classifyEndpoint(makeCtx(null, null, null, ''));
    // openScore = 0.60 (no component)
    assert.equal(r.type, 'OPEN');
  });

  it('truly unrecognized label with no patterns → OPEN fallback (all signals zero)', () => {
    // "XYZQ" doesn't match any pattern
    const r = classifyEndpoint(makeCtx('XYZQ', null, null, 'W11 XYZQ'));
    // connScore: CONN_REF=no, PHOENIX=no, HOUSING=no, no cavity = 0
    // termScore: ACI=no, PN=no, no terminal keyword = 0
    // openScore: component IS present (not null) = 0
    // All-zero → OPEN fallback (safest default for unrecognized labels)
    assert.equal(r.type, 'OPEN');
    assert.equal(r.confidence, 0.0); // zero confidence
  });
});

// ---------------------------------------------------------------------------
// False positive rejection — bus wires and short IDs
// ---------------------------------------------------------------------------

describe('false positive rejection', () => {
  it('COM endpoint: no component in diagram → OPEN', () => {
    const r = classifyEndpoint(makeCtx(null, null, null, 'COM'));
    assert.equal(r.type, 'OPEN');
  });

  it('GND endpoint with no cavity: TERMINAL signals dominate (no cavity + share=1)', () => {
    // GND typically appears as component="GND", no cavity
    // termScore: no ACI, no PN, no keyword = 0.08+0.08=0.16
    // connScore: CONN_REF=no, PHOENIX=no, HOUSING=no = 0
    // TERMINAL wins (weak)
    const r = classifyEndpoint(makeCtx('GND', null, null, 'GND wire'));
    // "GND" doesn't match CONN_REF (/^[JPX]\d+$/), no PN, no keyword
    // termScore = 0.16, connScore = 0, openScore = 0
    assert.ok(r.type === 'TERMINAL' || r.type === 'OPEN');
    assert.ok(r.confidence <= 0.20); // never high confidence
  });

  it('J1 without cavity → CONNECTOR via ref designator only', () => {
    const r = classifyEndpoint(makeCtx('J1', null, null, 'W1 J1'));
    assert.equal(r.type, 'CONNECTOR');
    assert.ok(r.scores.connectorEvidence >= 0.35);
  });
});

// ---------------------------------------------------------------------------
// Strip length callout → OPEN signal
// ---------------------------------------------------------------------------

describe('strip length callout', () => {
  it('fractional strip length in rawText boosts OPEN', () => {
    const r = classifyEndpoint(makeCtx(null, null, null, 'strip 1/4 inch'));
    assert.equal(r.type, 'OPEN');
    assert.ok(r.scores.openEvidence >= 0.75); // 0.60 + 0.20 (strip) — capped at 1.0 but raw = 0.80
    assert.ok(r.evidence.some(e => e.includes('strip length')));
  });

  it('mm strip length in rawText boosts OPEN', () => {
    const r = classifyEndpoint(makeCtx(null, null, null, 'strip 6mm'));
    assert.equal(r.type, 'OPEN');
    assert.ok(r.evidence.some(e => e.includes('strip length')));
  });
});

// ---------------------------------------------------------------------------
// ACI PN variants
// ---------------------------------------------------------------------------

describe('ACI PN variants', () => {
  it('ACI01960 (5 digits) → TERMINAL', () => {
    const r = classifyEndpoint(makeCtx('ACI01960', null, null, 'W12'));
    assert.equal(r.type, 'TERMINAL');
  });

  it('ACI10898 (5 digits) → TERMINAL', () => {
    const r = classifyEndpoint(makeCtx('ACI10898', null, null, 'W12'));
    assert.equal(r.type, 'TERMINAL');
  });

  it('ACI1234 (4 digits) → TERMINAL', () => {
    const r = classifyEndpoint(makeCtx('ACI1234', null, null, 'W12'));
    assert.equal(r.type, 'TERMINAL');
  });

  it('ACI123 (3 digits, too short) → not classified as ACI terminal', () => {
    const r = classifyEndpoint(makeCtx('ACI123', null, null, 'W12'));
    // ACI_PN_RE requires 4-7 digits → no match → falls to no-cavity signal only
    assert.notEqual(r.type, 'TERMINAL'); // or low confidence TERMINAL via weak signals only
    assert.ok(r.confidence <= 0.20);
  });

  it('ACI12345678 (8 digits, too long) → not classified as ACI terminal', () => {
    const r = classifyEndpoint(makeCtx('ACI12345678', null, null, 'W12'));
    assert.ok(r.confidence <= 0.20);
  });
});

// ---------------------------------------------------------------------------
// Batch classifyHarnessEndpoints — summary + share count
// ---------------------------------------------------------------------------

describe('batch classifier', () => {
  it('summary totals all endpoints (wires × 2)', () => {
    const hc = makeHcResult([
      { wireId: 'W1', fromComp: 'J1', fromCavity: '1', toComp: '929504-1', toCavity: null },
      { wireId: 'W2', fromComp: 'J1', fromCavity: '2', toComp: 'ACI01960', toCavity: null },
      { wireId: 'W3', fromComp: 'J1', fromCavity: '3', toComp: null,       toCavity: null },
    ]);
    const result = classifyHarnessEndpoints(hc);
    assert.equal(result.summary.totalEndpoints, 6); // 3 wires × 2
  });

  it('multi-wire J1 (3 wires) detected as housing', () => {
    // J1 appears 3 times as fromComp → shareCount=3 → CONNECTOR boost
    const hc = makeHcResult([
      { wireId: 'W1', fromComp: 'J1', fromCavity: '1', toComp: '929504-1', toCavity: null },
      { wireId: 'W2', fromComp: 'J1', fromCavity: '2', toComp: 'ACI01960', toCavity: null },
      { wireId: 'W3', fromComp: 'J1', fromCavity: '3', toComp: null,       toCavity: null },
    ]);
    const result = classifyHarnessEndpoints(hc);
    for (const wireId of ['W1', 'W2', 'W3']) {
      assert.equal(result.classifications.get(wireId)!.from.type, 'CONNECTOR');
    }
  });

  it('mixed harness produces correct by-type counts', () => {
    const hc = makeHcResult([
      { wireId: 'W1', fromComp: 'J1',      fromCavity: '1',  toComp: '929504-1', toCavity: null },
      { wireId: 'W2', fromComp: 'J1',      fromCavity: '2',  toComp: 'ACI01960', toCavity: null },
      { wireId: 'W3', fromComp: 'PHOENIX_1700443', fromCavity: '1', toComp: null, toCavity: null },
    ]);
    const result = classifyHarnessEndpoints(hc);
    assert.equal(result.summary.byType.CONNECTOR, 3); // J1×2 + PHOENIX×1
    assert.equal(result.summary.byType.TERMINAL,  2); // 929504-1 + ACI01960
    assert.equal(result.summary.byType.OPEN,      1); // null endpoint
  });

  it('empty harness → zero totals', () => {
    const hc = makeHcResult([]);
    const result = classifyHarnessEndpoints(hc);
    assert.equal(result.summary.totalEndpoints, 0);
    assert.equal(result.classifications.size, 0);
  });
});

// ---------------------------------------------------------------------------
// Evidence traceability
// ---------------------------------------------------------------------------

describe('evidence traceability', () => {
  it('every classification returns non-empty evidence array', () => {
    const cases: EndpointClassificationContext[] = [
      makeCtx('J1',           '1',  null, 'W1 J1 1'),
      makeCtx('929504-1',     null, null, 'W2 929504-1'),
      makeCtx('ACI01960',     null, null, 'W3 ACI01960'),
      makeCtx(null,           null, null, 'W4'),
      makeCtx('PHOENIX_1700443', '1', null, 'W5 PHOENIX'),
    ];
    for (const ctx of cases) {
      const r = classifyEndpoint(ctx);
      assert.ok(r.evidence.length >= 1, `No evidence for component=${ctx.component}`);
    }
  });

  it('all three score fields are always present', () => {
    const r = classifyEndpoint(makeCtx('J1', '1', null, 'W1'));
    assert.ok('connectorEvidence' in r.scores);
    assert.ok('terminalEvidence'  in r.scores);
    assert.ok('openEvidence'      in r.scores);
  });

  it('confidence equals winner score (not a fixed constant)', () => {
    const r1 = classifyEndpoint(makeCtx('J1', '1', null, 'W1'));
    assert.equal(r1.confidence, r1.scores.connectorEvidence);

    const r2 = classifyEndpoint(makeCtx('929504-1', null, null, 'W2'));
    assert.equal(r2.confidence, r2.scores.terminalEvidence);
  });
});
