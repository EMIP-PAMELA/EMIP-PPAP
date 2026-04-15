/**
 * harnessReconciliationService.test.ts — Phase T5 unit tests
 *
 * Tests for endpoint matching (exact, PN, fuzzy, ambiguous, none),
 * summary computation, and edge cases. All inputs are mocked inline —
 * no real PDF, OCR, or AI calls.
 */

import { describe, it } from 'node:test';
import assert from 'assert/strict';
import { reconcileHarnessConnectivity } from '../harnessReconciliationService';
import type { HarnessConnectivityResult } from '../harnessConnectivityService';
import type { DiagramExtractionResult } from '../diagramExtractor';

// ---------------------------------------------------------------------------
// Minimal mock builders
// ---------------------------------------------------------------------------

function makeWire(
  wireId: string,
  fromComponent: string | null,
  toComponent: string | null,
): HarnessConnectivityResult['wires'][0] {
  return {
    wireId,
    length: null,
    lengthUnit: null,
    lengthInches: null,
    gauge: null,
    color: null,
    from: { component: fromComponent, cavity: null, treatment: null },
    to:   { component: toComponent,   cavity: null, treatment: null },
    confidence: 0.9,
    unresolved: false,
    rawText: `${wireId} mock row`,
    sourceRowIndex: 0,
  };
}

function makeHc(wires: HarnessConnectivityResult['wires'][]): HarnessConnectivityResult {
  return {
    wires: wires.flat(),
    unresolvedWires: [],
    confidenceSummary: {
      total: wires.flat().length,
      resolved: 0,
      partial: 0,
      unresolved: 0,
    },
  };
}

function makeDiagram(
  components: Array<{ id: string; label: string; pn?: string | null }>,
  callouts: Array<{ text: string; pn?: string | null }> = [],
): DiagramExtractionResult {
  return {
    components: components.map(c => ({
      id:                  c.id,
      type:                'CONNECTOR' as const,
      label:               c.label,
      normalizedPartNumber: c.pn ?? null,
      locationHint:        null,
      source:              'OCR' as const,
      confidence:          0.85,
      rawText:             c.label,
    })),
    callouts: callouts.map(co => ({
      text:                  co.text,
      normalizedPartNumber:  co.pn ?? null,
      associatedComponentId: null,
      source:                'OCR' as const,
      confidence:            0.80,
      rawText:               co.text,
    })),
    unresolvedCallouts: [],
  };
}

// ---------------------------------------------------------------------------
// Exact match
// ---------------------------------------------------------------------------

describe('T5 exact match', () => {
  it('matches endpoint by exact label (case-insensitive)', () => {
    const hc = makeHc([[makeWire('W1', 'J1', '929504-1')]]);
    const diagram = makeDiagram(
      [{ id: 'CONN_1', label: 'J1' }],
      [{ text: '929504-1', pn: '929504-1' }],
    );
    const result = reconcileHarnessConnectivity({ harnessConnectivity: hc, diagramExtraction: diagram });
    const w = result.wires[0];
    assert.equal(w.from.matchType, 'EXACT');
    assert.equal(w.from.matchedComponentId, 'CONN_1');
    assert.equal(w.from.confidence, 0.95);
    assert.equal(w.from.originalLabel, 'J1');
  });

  it('exact match is case-insensitive', () => {
    const hc = makeHc([[makeWire('W1', 'phoenix contact', null)]]);
    const diagram = makeDiagram([{ id: 'CONN_1', label: 'PHOENIX CONTACT' }]);
    const result = reconcileHarnessConnectivity({ harnessConnectivity: hc, diagramExtraction: diagram });
    assert.equal(result.wires[0].from.matchType, 'EXACT');
  });

  it('exact match sets unresolved=false when both endpoints match', () => {
    const hc = makeHc([[makeWire('W1', 'J1', '929504-1')]]);
    const diagram = makeDiagram(
      [{ id: 'CONN_1', label: 'J1' }],
      [{ text: '929504-1', pn: '929504-1' }],
    );
    const result = reconcileHarnessConnectivity({ harnessConnectivity: hc, diagramExtraction: diagram });
    // to matches via PN_MATCH (callout with normalizedPartNumber)
    assert.equal(result.wires[0].unresolved, false);
  });
});

// ---------------------------------------------------------------------------
// PN match
// ---------------------------------------------------------------------------

describe('T5 PN match', () => {
  it('matches endpoint label that equals a component normalizedPartNumber', () => {
    const hc = makeHc([[makeWire('W1', '1700443', null)]]);
    const diagram = makeDiagram([{ id: 'CONN_1', label: 'PHOENIX 1700443', pn: '1700443' }]);
    const result = reconcileHarnessConnectivity({ harnessConnectivity: hc, diagramExtraction: diagram });
    assert.equal(result.wires[0].from.matchType, 'PN_MATCH');
    assert.equal(result.wires[0].from.matchedComponentId, 'CONN_1');
    assert.equal(result.wires[0].from.confidence, 0.90);
  });

  it('matches endpoint label against callout text (exact wins over PN_MATCH)', () => {
    // callout.text === '929504-1' → label match fires first (EXACT), not PN_MATCH
    const hc = makeHc([[makeWire('W1', null, '929504-1')]]);
    const diagram = makeDiagram([], [{ text: '929504-1', pn: '929504-1' }]);
    const result = reconcileHarnessConnectivity({ harnessConnectivity: hc, diagramExtraction: diagram });
    assert.equal(result.wires[0].to.matchType, 'EXACT');
    assert.equal(result.wires[0].to.matchedComponentId, 'CALLOUT_929504-1');
    assert.equal(result.wires[0].to.confidence, 0.95);
  });
});

// ---------------------------------------------------------------------------
// Fuzzy match
// ---------------------------------------------------------------------------

describe('T5 fuzzy match', () => {
  it('matches via token overlap (PHOENIX in both)', () => {
    const hc = makeHc([[makeWire('W1', 'PHOENIX', null)]]);
    const diagram = makeDiagram([{ id: 'CONN_1', label: 'PHOENIX CONTACT' }]);
    const result = reconcileHarnessConnectivity({ harnessConnectivity: hc, diagramExtraction: diagram });
    assert.equal(result.wires[0].from.matchType, 'FUZZY');
    assert.equal(result.wires[0].from.confidence, 0.75);
  });

  it('fuzzy match does NOT match short IDs (J1 vs J10)', () => {
    const hc = makeHc([[makeWire('W1', 'J1', null)]]);
    const diagram = makeDiagram([{ id: 'CONN_1', label: 'J10' }]);
    const result = reconcileHarnessConnectivity({ harnessConnectivity: hc, diagramExtraction: diagram });
    // 'J1' is too short for fuzzy, and exact 'j1' !== 'j10' → NONE
    assert.equal(result.wires[0].from.matchType, 'NONE');
  });

  it('fuzzy match sets unresolved=true (not a strong match)', () => {
    const hc = makeHc([[makeWire('W1', 'PHOENIX', '929504-1')]]);
    const diagram = makeDiagram(
      [{ id: 'CONN_1', label: 'PHOENIX CONTACT' }],
      [{ text: '929504-1', pn: '929504-1' }],
    );
    const result = reconcileHarnessConnectivity({ harnessConnectivity: hc, diagramExtraction: diagram });
    assert.equal(result.wires[0].from.matchType, 'FUZZY');
    assert.equal(result.wires[0].to.matchType, 'EXACT'); // callout text matches exactly
    // from is FUZZY → not strong → unresolved=true
    assert.equal(result.wires[0].unresolved, true);
  });
});

// ---------------------------------------------------------------------------
// Ambiguous match
// ---------------------------------------------------------------------------

describe('T5 ambiguous match', () => {
  it('marks AMBIGUOUS when multiple exact label matches exist', () => {
    const hc = makeHc([[makeWire('W1', 'J1', null)]]);
    const diagram = makeDiagram([
      { id: 'CONN_1', label: 'J1' },
      { id: 'CONN_2', label: 'J1' },  // duplicate label
    ]);
    const result = reconcileHarnessConnectivity({ harnessConnectivity: hc, diagramExtraction: diagram });
    assert.equal(result.wires[0].from.matchType, 'AMBIGUOUS');
    assert.equal(result.wires[0].from.matchedComponentId, null);
    assert.ok(Array.isArray(result.wires[0].from.candidateComponentIds));
    assert.equal(result.wires[0].from.candidateComponentIds!.length, 2);
    assert.equal(result.wires[0].from.confidence, 0.50);
  });

  it('marks AMBIGUOUS when multiple fuzzy candidates exist', () => {
    const hc = makeHc([[makeWire('W1', 'PHOENIX', null)]]);
    const diagram = makeDiagram([
      { id: 'CONN_1', label: 'PHOENIX CONTACT' },
      { id: 'CONN_2', label: 'PHOENIX BLOCK' },
    ]);
    const result = reconcileHarnessConnectivity({ harnessConnectivity: hc, diagramExtraction: diagram });
    assert.equal(result.wires[0].from.matchType, 'AMBIGUOUS');
    assert.ok(result.wires[0].from.candidateComponentIds!.length >= 2);
  });

  it('ambiguous does NOT force a match (matchedComponentId is null)', () => {
    const hc = makeHc([[makeWire('W1', 'J1', null)]]);
    const diagram = makeDiagram([
      { id: 'CONN_1', label: 'J1' },
      { id: 'CONN_2', label: 'J1' },
    ]);
    const result = reconcileHarnessConnectivity({ harnessConnectivity: hc, diagramExtraction: diagram });
    assert.equal(result.wires[0].from.matchedComponentId, null);
  });

  it('preserves original label even when ambiguous', () => {
    const hc = makeHc([[makeWire('W1', 'J1', null)]]);
    const diagram = makeDiagram([
      { id: 'CONN_1', label: 'J1' },
      { id: 'CONN_2', label: 'J1' },
    ]);
    const result = reconcileHarnessConnectivity({ harnessConnectivity: hc, diagramExtraction: diagram });
    assert.equal(result.wires[0].from.originalLabel, 'J1');
  });
});

// ---------------------------------------------------------------------------
// No match
// ---------------------------------------------------------------------------

describe('T5 no match', () => {
  it('returns NONE when no candidate found', () => {
    const hc = makeHc([[makeWire('W1', 'UNKNOWN_CONNECTOR', null)]]);
    const diagram = makeDiagram([{ id: 'CONN_1', label: 'J1' }]);
    const result = reconcileHarnessConnectivity({ harnessConnectivity: hc, diagramExtraction: diagram });
    assert.equal(result.wires[0].from.matchType, 'NONE');
    assert.equal(result.wires[0].from.confidence, 0.0);
    assert.equal(result.wires[0].from.matchedComponentId, null);
  });

  it('null endpoint label returns NONE', () => {
    const hc = makeHc([[makeWire('W1', null, null)]]);
    const diagram = makeDiagram([{ id: 'CONN_1', label: 'J1' }]);
    const result = reconcileHarnessConnectivity({ harnessConnectivity: hc, diagramExtraction: diagram });
    assert.equal(result.wires[0].from.matchType, 'NONE');
    assert.equal(result.wires[0].from.originalLabel, null);
  });

  it('both NONE → unresolved=true', () => {
    const hc = makeHc([[makeWire('W1', null, null)]]);
    const diagram = makeDiagram([]);
    const result = reconcileHarnessConnectivity({ harnessConnectivity: hc, diagramExtraction: diagram });
    assert.equal(result.wires[0].unresolved, true);
  });
});

// ---------------------------------------------------------------------------
// unresolved flag
// ---------------------------------------------------------------------------

describe('T5 unresolved flag', () => {
  it('unresolved=false only when both endpoints have strong match', () => {
    // J1 → EXACT via label; 929504-1 → EXACT via callout text (label match wins)
    const hc = makeHc([[makeWire('W1', 'J1', '929504-1')]]);
    const diagram = makeDiagram(
      [{ id: 'CONN_1', label: 'J1' }],
      [{ text: '929504-1', pn: '929504-1' }],
    );
    const result = reconcileHarnessConnectivity({ harnessConnectivity: hc, diagramExtraction: diagram });
    assert.equal(result.wires[0].from.matchType, 'EXACT');
    assert.equal(result.wires[0].to.matchType, 'EXACT');
    assert.equal(result.wires[0].unresolved, false);
  });

  it('unresolved=true when one side is FUZZY', () => {
    const hc = makeHc([[makeWire('W1', 'PHOENIX', 'J1')]]);
    const diagram = makeDiagram([
      { id: 'CONN_1', label: 'PHOENIX CONTACT' },
      { id: 'CONN_2', label: 'J1' },
    ]);
    const result = reconcileHarnessConnectivity({ harnessConnectivity: hc, diagramExtraction: diagram });
    assert.equal(result.wires[0].from.matchType, 'FUZZY');
    assert.equal(result.wires[0].to.matchType, 'EXACT');
    assert.equal(result.wires[0].unresolved, true);
  });

  it('unresolved=true when one side is AMBIGUOUS', () => {
    const hc = makeHc([[makeWire('W1', 'J1', '929504-1')]]);
    const diagram = makeDiagram(
      [{ id: 'CONN_1', label: 'J1' }, { id: 'CONN_2', label: 'J1' }],
      [{ text: '929504-1', pn: '929504-1' }],
    );
    const result = reconcileHarnessConnectivity({ harnessConnectivity: hc, diagramExtraction: diagram });
    assert.equal(result.wires[0].from.matchType, 'AMBIGUOUS');
    assert.equal(result.wires[0].unresolved, true);
  });
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

describe('T5 summary', () => {
  it('fullyMatched when both endpoints are strong', () => {
    const hc = makeHc([[makeWire('W1', 'J1', '929504-1')]]);
    const diagram = makeDiagram(
      [{ id: 'CONN_1', label: 'J1' }],
      [{ text: '929504-1', pn: '929504-1' }],
    );
    const result = reconcileHarnessConnectivity({ harnessConnectivity: hc, diagramExtraction: diagram });
    assert.equal(result.summary.fullyMatched, 1);
    assert.equal(result.summary.partialMatched, 0);
    assert.equal(result.summary.unmatched, 0);
    assert.equal(result.summary.ambiguous, 0);
  });

  it('partialMatched when one side strong, one side NONE', () => {
    const hc = makeHc([[makeWire('W1', 'J1', null)]]);
    const diagram = makeDiagram([{ id: 'CONN_1', label: 'J1' }]);
    const result = reconcileHarnessConnectivity({ harnessConnectivity: hc, diagramExtraction: diagram });
    assert.equal(result.summary.partialMatched, 1);
    assert.equal(result.summary.fullyMatched, 0);
    assert.equal(result.summary.unmatched, 0);
  });

  it('unmatched when both endpoints are NONE', () => {
    const hc = makeHc([[makeWire('W1', null, null)]]);
    const diagram = makeDiagram([{ id: 'CONN_1', label: 'J1' }]);
    const result = reconcileHarnessConnectivity({ harnessConnectivity: hc, diagramExtraction: diagram });
    assert.equal(result.summary.unmatched, 1);
    assert.equal(result.summary.fullyMatched, 0);
  });

  it('ambiguous counted separately when any endpoint is AMBIGUOUS', () => {
    const hc = makeHc([[makeWire('W1', 'J1', null)]]);
    const diagram = makeDiagram([
      { id: 'CONN_1', label: 'J1' },
      { id: 'CONN_2', label: 'J1' },
    ]);
    const result = reconcileHarnessConnectivity({ harnessConnectivity: hc, diagramExtraction: diagram });
    assert.equal(result.summary.ambiguous, 1);
  });

  it('total reflects all wires', () => {
    const hc = makeHc([
      [makeWire('W1', 'J1', '929504-1')],
      [makeWire('W2', null, null)],
      [makeWire('W3', 'UNKNOWN', null)],
    ]);
    const diagram = makeDiagram(
      [{ id: 'CONN_1', label: 'J1' }],
      [{ text: '929504-1', pn: '929504-1' }],
    );
    const result = reconcileHarnessConnectivity({ harnessConnectivity: hc, diagramExtraction: diagram });
    assert.equal(result.summary.total, 3);
    assert.equal(result.wires.length, 3);
  });

  it('mixed wires produce correct summary', () => {
    const hc = makeHc([
      [makeWire('W1', 'J1', '929504-1')],   // fully matched
      [makeWire('W2', 'J1', null)],           // partial (to=null → NONE)
      [makeWire('W3', null, null)],           // unmatched
    ]);
    const diagram = makeDiagram(
      [{ id: 'CONN_1', label: 'J1' }],
      [{ text: '929504-1', pn: '929504-1' }],
    );
    const result = reconcileHarnessConnectivity({ harnessConnectivity: hc, diagramExtraction: diagram });
    assert.equal(result.summary.fullyMatched,  1);
    assert.equal(result.summary.partialMatched, 1);
    assert.equal(result.summary.unmatched,     1);
  });

  it('empty HC-BOM → empty result', () => {
    const hc = makeHc([[]]);
    const diagram = makeDiagram([{ id: 'CONN_1', label: 'J1' }]);
    const result = reconcileHarnessConnectivity({ harnessConnectivity: hc, diagramExtraction: diagram });
    assert.equal(result.summary.total, 0);
    assert.equal(result.wires.length, 0);
  });

  it('empty diagram → all NONE', () => {
    const hc = makeHc([[makeWire('W1', 'J1', '929504-1')]]);
    const diagram = makeDiagram([]);
    const result = reconcileHarnessConnectivity({ harnessConnectivity: hc, diagramExtraction: diagram });
    assert.equal(result.wires[0].from.matchType, 'NONE');
    assert.equal(result.wires[0].to.matchType, 'NONE');
    assert.equal(result.summary.unmatched, 1);
  });
});

// ---------------------------------------------------------------------------
// T5-AUDIT: Misclassification hardening
// ---------------------------------------------------------------------------

describe('T5-AUDIT fuzzy false-positive rejection', () => {
  it('COM must NOT fuzzy-match COMPONENT BLOCK (substring false positive)', () => {
    const hc = makeHc([[makeWire('W1', 'COM', null)]]);
    const diagram = makeDiagram([{ id: 'CONN_1', label: 'COMPONENT BLOCK' }]);
    const result = reconcileHarnessConnectivity({ harnessConnectivity: hc, diagramExtraction: diagram });
    assert.equal(result.wires[0].from.matchType, 'NONE');
  });

  it('GND must NOT fuzzy-match GROUNDING_PAD (substring false positive)', () => {
    const hc = makeHc([[makeWire('W1', 'GND', null)]]);
    const diagram = makeDiagram([{ id: 'CONN_1', label: 'GROUNDING_PAD' }]);
    const result = reconcileHarnessConnectivity({ harnessConnectivity: hc, diagramExtraction: diagram });
    assert.equal(result.wires[0].from.matchType, 'NONE');
  });

  it('J10 must NOT fuzzy-match J100 (suffix absorption false positive)', () => {
    const hc = makeHc([[makeWire('W1', 'J10', null)]]);
    const diagram = makeDiagram([{ id: 'CONN_1', label: 'J100' }]);
    const result = reconcileHarnessConnectivity({ harnessConnectivity: hc, diagramExtraction: diagram });
    assert.equal(result.wires[0].from.matchType, 'NONE');
  });

  it('SHLD must NOT fuzzy-match SHIELDED CONNECTOR (substring false positive)', () => {
    const hc = makeHc([[makeWire('W1', 'SHLD', null)]]);
    const diagram = makeDiagram([{ id: 'CONN_1', label: 'SHIELDED CONNECTOR' }]);
    const result = reconcileHarnessConnectivity({ harnessConnectivity: hc, diagramExtraction: diagram });
    assert.equal(result.wires[0].from.matchType, 'NONE');
  });

  it('PHOENIX still fuzzy-matches PHOENIX CONTACT (legitimate whole-word match)', () => {
    const hc = makeHc([[makeWire('W1', 'PHOENIX', null)]]);
    const diagram = makeDiagram([{ id: 'CONN_1', label: 'PHOENIX CONTACT' }]);
    const result = reconcileHarnessConnectivity({ harnessConnectivity: hc, diagramExtraction: diagram });
    assert.equal(result.wires[0].from.matchType, 'FUZZY');
  });
});

describe('T5-AUDIT PN-like label edge cases', () => {
  it('label looks like PN but no match exists → NONE', () => {
    const hc = makeHc([[makeWire('W1', '9999999-99', null)]]);
    const diagram = makeDiagram([{ id: 'CONN_1', label: 'J1', pn: '1700443' }]);
    const result = reconcileHarnessConnectivity({ harnessConnectivity: hc, diagramExtraction: diagram });
    assert.equal(result.wires[0].from.matchType, 'NONE');
  });

  it('pure PN_MATCH from component (not callout) → PN_MATCH 0.90', () => {
    const hc = makeHc([[makeWire('W1', '1700443', null)]]);
    const diagram = makeDiagram([{ id: 'CONN_1', label: 'PHOENIX 1700443', pn: '1700443' }]);
    const result = reconcileHarnessConnectivity({ harnessConnectivity: hc, diagramExtraction: diagram });
    assert.equal(result.wires[0].from.matchType, 'PN_MATCH');
    assert.equal(result.wires[0].from.matchedComponentId, 'CONN_1');
    assert.equal(result.wires[0].from.confidence, 0.90);
  });
});

describe('T5-AUDIT both endpoints AMBIGUOUS', () => {
  it('both from and to AMBIGUOUS → unresolved + ambiguous=1', () => {
    const hc = makeHc([[makeWire('W1', 'J1', 'P2')]]);
    const diagram = makeDiagram([
      { id: 'CONN_1', label: 'J1' },
      { id: 'CONN_2', label: 'J1' },
      { id: 'CONN_3', label: 'P2' },
      { id: 'CONN_4', label: 'P2' },
    ]);
    const result = reconcileHarnessConnectivity({ harnessConnectivity: hc, diagramExtraction: diagram });
    assert.equal(result.wires[0].from.matchType, 'AMBIGUOUS');
    assert.equal(result.wires[0].to.matchType, 'AMBIGUOUS');
    assert.equal(result.wires[0].unresolved, true);
    assert.equal(result.summary.ambiguous, 1);
  });
});

describe('T5-AUDIT FUZZY+NONE summary gap', () => {
  it('FUZZY from + NONE to → not counted in fullyMatched/partial/unmatched (expected gap)', () => {
    // This documents a known spec design choice: FUZZY+NONE falls outside all 4 categories.
    // It only appears in summary.total. This is correct per the category definitions.
    const hc = makeHc([[makeWire('W1', 'PHOENIX', null)]]);
    const diagram = makeDiagram([{ id: 'CONN_1', label: 'PHOENIX CONTACT' }]);
    const result = reconcileHarnessConnectivity({ harnessConnectivity: hc, diagramExtraction: diagram });
    assert.equal(result.wires[0].from.matchType, 'FUZZY');
    assert.equal(result.wires[0].to.matchType, 'NONE');
    assert.equal(result.summary.total, 1);
    assert.equal(result.summary.fullyMatched, 0);
    assert.equal(result.summary.partialMatched, 0);
    assert.equal(result.summary.unmatched, 0);
    assert.equal(result.summary.ambiguous, 0);
  });
});

// ---------------------------------------------------------------------------
// Original label preservation
// ---------------------------------------------------------------------------

describe('T5 original label preservation', () => {
  it('originalLabel is never overwritten regardless of match outcome', () => {
    const hc = makeHc([[makeWire('W1', 'J1', 'MYSTERY')]]);
    const diagram = makeDiagram([{ id: 'CONN_1', label: 'J1' }]);
    const result = reconcileHarnessConnectivity({ harnessConnectivity: hc, diagramExtraction: diagram });
    assert.equal(result.wires[0].from.originalLabel, 'J1');
    assert.equal(result.wires[0].to.originalLabel, 'MYSTERY');
  });
});
