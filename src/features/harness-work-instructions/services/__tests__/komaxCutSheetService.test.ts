import { describe, it } from 'node:test';
import assert from 'assert/strict';

import { buildKomaxCutSheet, buildWireCsvString, type KomaxCutSheetRow } from '../komaxCutSheetService';
import type { EffectiveHarnessState } from '../effectiveHarnessModelService';
import type { HarnessConnectivityResult, WireConnectivity, WireEndpoint, EndpointTerminationType } from '../harnessConnectivityService';
import type { HarnessTopologyResult, TopologyNode } from '../harnessTopologyService';
import type { WireIdentityResult, WireIdentityEntry } from '../wireIdentityService';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeEndpoint(
  component: string | null,
  cavity: string | null = null,
  terminationType: EndpointTerminationType | null = null,
): WireEndpoint {
  return { component, cavity, treatment: null, terminationType };
}

function makeWire(
  wireId: string,
  fromComp: string | null,
  fromCav: string | null,
  toComp: string | null,
  toCav: string | null,
  overrides: Partial<WireConnectivity> = {},
): WireConnectivity {
  return {
    wireId,
    length: 10,
    lengthUnit: 'in',
    lengthInches: 10,
    gauge: '18 AWG',
    color: 'BLU',
    from: makeEndpoint(fromComp, fromCav, 'CONNECTOR_PIN'),
    to:   makeEndpoint(toComp,   toCav,   'CONNECTOR_PIN'),
    confidence: 0.9,
    unresolved: false,
    sourceRowIndex: 0,
    rawText: '',
    ...overrides,
  };
}

function makeConnectivity(wires: WireConnectivity[]): HarnessConnectivityResult {
  return {
    wires,
    unresolvedWires: [],
    confidenceSummary: { total: wires.length, resolved: wires.length, partial: 0, unresolved: 0 },
  };
}

function makeTopology(multiWireEndpoints: TopologyNode[] = []): HarnessTopologyResult {
  return {
    nodes: [],
    edges: [],
    danglingEndpoints: [],
    multiWireEndpoints,
    isolatedSubgraphs: [],
    missingWireCandidates: [],
    warnings: [],
  };
}

function makeIdentityEntry(originalWireId: string, internalWireId: string, customerWireId?: string): WireIdentityEntry {
  const mapKey = originalWireId && originalWireId.trim() ? originalWireId : `_anon_test_${internalWireId}`;
  return { originalWireId, internalWireId, customerWireId, mapKey };
}

function makeIdentities(entries: WireIdentityEntry[]): WireIdentityResult {
  return {
    wires: entries,
    byOriginalId: new Map(entries.map(e => [e.mapKey, e])),
    bySourceRowIndex: new Map(), // T23.3: not exercised in these tests
  };
}

/** Minimal EffectiveHarnessState with connectivity + identities populated. */
function makeState(
  wires: WireConnectivity[],
  identityEntries: WireIdentityEntry[],
): EffectiveHarnessState {
  return {
    effectiveConnectivity:   makeConnectivity(wires),
    effectiveWireIdentities: makeIdentities(identityEntries),
    effectiveTopology:       makeTopology(),
    effectiveValidation:     null,
    effectiveConfidence:     null,
    effectiveDecision:       null,
    effectiveDocumentType:   null,
    effectiveDocTypeSource:  'UNKNOWN',
    effectivePartNumber:     null,
    effectiveRevision:       null,
    effectiveDrawingNumber:  null,
    unresolvedQuestions:     [],
    readyToCommit:           false,
  };
}

// ---------------------------------------------------------------------------
// A. Simple harness → rows match wires in natural ID order
// ---------------------------------------------------------------------------

describe('komaxCutSheetService', () => {
  it('A: simple harness rows match wires in natural W1/W2/W3 order', () => {
    const wires = [
      makeWire('alpha', 'J1', '1', 'J2', '1', { color: 'RED',  gauge: '20 AWG', lengthInches: 5 }),
      makeWire('beta',  'J1', '2', 'J2', '2', { color: 'BLU',  gauge: '18 AWG', lengthInches: 8 }),
      makeWire('gamma', 'J1', '3', 'J2', '3', { color: 'WHT',  gauge: '22 AWG', lengthInches: 3 }),
    ];
    const identities = [
      makeIdentityEntry('alpha', 'W1', 'alpha'),
      makeIdentityEntry('beta',  'W2', 'beta'),
      makeIdentityEntry('gamma', 'W3', 'gamma'),
    ];
    const state = makeState(wires, identities);
    const result = buildKomaxCutSheet(state);

    assert.equal(result.rows.length, 3);
    assert.equal(result.summary.totalWires, 3);
    assert.equal(result.summary.branchCount, 0);

    // Rows should be in W1 / W2 / W3 order
    assert.equal(result.rows[0].internalWireId, 'W1');
    assert.equal(result.rows[0].wireColor, 'RED');
    assert.equal(result.rows[0].lengthInches, 5);
    assert.equal(result.rows[0].topology, 'NORMAL');
    assert.equal(result.rows[0].notes.length, 0);

    assert.equal(result.rows[1].internalWireId, 'W2');
    assert.equal(result.rows[2].internalWireId, 'W3');
  });

  // -------------------------------------------------------------------------
  // B. Branch wires → topology flagged BRANCH_DOUBLE_CRIMP, notes added
  // -------------------------------------------------------------------------

  it('B: branch wires are flagged BRANCH_DOUBLE_CRIMP with sibling notes', () => {
    const wires = [
      makeWire('b1', 'J1', '4', 'J2', '1'),
      makeWire('b2', 'J1', '4', 'J3', '1'),
      makeWire('plain', 'J1', '5', 'J2', '2'),
    ];
    const identities = [
      makeIdentityEntry('b1',    'W1A', 'b1'),
      makeIdentityEntry('b2',    'W1B', 'b2'),
      makeIdentityEntry('plain', 'W2',  'plain'),
    ];
    const state = makeState(wires, identities);
    const result = buildKomaxCutSheet(state);

    assert.equal(result.summary.branchCount, 2);

    const rowW1A = result.rows.find((r: KomaxCutSheetRow) => r.internalWireId === 'W1A')!;
    const rowW1B = result.rows.find((r: KomaxCutSheetRow) => r.internalWireId === 'W1B')!;
    const rowW2  = result.rows.find((r: KomaxCutSheetRow) => r.internalWireId === 'W2')!;

    assert.ok(rowW1A, 'W1A row should exist');
    assert.equal(rowW1A.topology, 'BRANCH_DOUBLE_CRIMP');
    assert.ok(rowW1A.notes.some((n: string) => n.includes('W1B')), 'W1A should note W1B as sibling');

    assert.equal(rowW1B.topology, 'BRANCH_DOUBLE_CRIMP');
    assert.ok(rowW1B.notes.some((n: string) => n.includes('W1A')), 'W1B should note W1A as sibling');

    assert.equal(rowW2.topology, 'NORMAL');
    assert.equal(rowW2.notes.length, 0);

    // Natural sort: W1A, W1B, W2
    assert.equal(result.rows[0].internalWireId, 'W1A');
    assert.equal(result.rows[1].internalWireId, 'W1B');
    assert.equal(result.rows[2].internalWireId, 'W2');
  });

  // -------------------------------------------------------------------------
  // C. Strip-only endpoints → terminationType = 'STRIP', notes added
  // -------------------------------------------------------------------------

  it('C: strip-only endpoints are labeled STRIP and generate notes', () => {
    const wireStrip = makeWire('s1', 'J1', '1', 'J2', '1');
    wireStrip.from.terminationType = 'STRIP_ONLY';
    wireStrip.to.terminationType   = 'CONNECTOR_PIN';

    const state = makeState(
      [wireStrip],
      [makeIdentityEntry('s1', 'W1', 's1')],
    );
    const result = buildKomaxCutSheet(state);

    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0].fromTerminationType, 'STRIP');
    assert.equal(result.rows[0].toTerminationType,   'CONNECTOR_PIN');
    assert.equal(result.summary.stripOnlyCount, 1);
    assert.ok(
      result.rows[0].notes.some((n: string) => n.toLowerCase().includes('from end')),
      'should note strip-only FROM end',
    );
  });

  // -------------------------------------------------------------------------
  // D. Mixed terminations → all mapped correctly
  // -------------------------------------------------------------------------

  it('D: mixed termination types are all mapped in output rows', () => {
    const wires: WireConnectivity[] = [
      { ...makeWire('t1', 'J1', '1', 'J2', '1'), from: makeEndpoint('J1', '1', 'FERRULE'),   to: makeEndpoint('J2', '1', 'TERMINAL') },
      { ...makeWire('t2', 'J1', '2', 'J2', '2'), from: makeEndpoint('J1', '2', 'RING'),       to: makeEndpoint('J2', '2', 'GROUND')   },
      { ...makeWire('t3', 'J1', '3', null,  null), from: makeEndpoint('J1', '3', 'CONNECTOR_PIN'), to: makeEndpoint(null, null, 'SPLICE') },
    ];
    const identities = [
      makeIdentityEntry('t1', 'W1'),
      makeIdentityEntry('t2', 'W2'),
      makeIdentityEntry('t3', 'W3'),
    ];
    const state = makeState(wires, identities);
    const result = buildKomaxCutSheet(state);

    const r1 = result.rows.find((r: KomaxCutSheetRow) => r.internalWireId === 'W1')!;
    const r2 = result.rows.find((r: KomaxCutSheetRow) => r.internalWireId === 'W2')!;
    const r3 = result.rows.find((r: KomaxCutSheetRow) => r.internalWireId === 'W3')!;

    assert.equal(r1.fromTerminationType, 'FERRULE');
    assert.equal(r1.toTerminationType,   'TERMINAL');
    assert.equal(r1.topology, 'NORMAL');

    assert.equal(r2.fromTerminationType, 'RING');
    assert.equal(r2.toTerminationType,   'GROUND');

    assert.equal(r3.topology, 'SPLICE');
  });

  // -------------------------------------------------------------------------
  // E. Stability: same input → identical output on repeated calls
  // -------------------------------------------------------------------------

  it('E: same input always produces identical rows and CSV', () => {
    const wires = [
      makeWire('x1', 'J1', '1', 'J2', '1'),
      makeWire('x2', 'J1', '2', 'J2', '2'),
    ];
    const identities = [
      makeIdentityEntry('x1', 'W1', 'x1'),
      makeIdentityEntry('x2', 'W2', 'x2'),
    ];
    const state = makeState(wires, identities);

    const r1 = buildKomaxCutSheet(state);
    const r2 = buildKomaxCutSheet(state);

    assert.equal(r1.rows.length, r2.rows.length);
    assert.equal(r1.rows[0].internalWireId, r2.rows[0].internalWireId);
    assert.equal(r1.rows[1].internalWireId, r2.rows[1].internalWireId);
    assert.equal(r1.summary.totalWires, r2.summary.totalWires);

    // CSV output must also be identical
    const csv1 = buildWireCsvString(r1);
    const csv2 = buildWireCsvString(r2);
    assert.equal(csv1, csv2);

    // CSV must contain the wire IDs and headers
    assert.ok(csv1.includes('Wire,Cust ID'), 'CSV should have header');
    assert.ok(csv1.includes('W1'), 'CSV should contain W1');
    assert.ok(csv1.includes('W2'), 'CSV should contain W2');
  });
});
