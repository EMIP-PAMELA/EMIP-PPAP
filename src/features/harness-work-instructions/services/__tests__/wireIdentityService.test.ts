import { describe, it } from 'node:test';
import assert from 'assert/strict';

import { assignWireIdentities } from '../wireIdentityService';
import type { HarnessConnectivityResult, WireConnectivity, WireEndpoint, EndpointTerminationType } from '../harnessConnectivityService';
import type { HarnessTopologyResult, TopologyNode } from '../harnessTopologyService';

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
  fromComp: string,
  fromCav: string,
  toComp: string,
  toCav: string,
): WireConnectivity {
  return {
    wireId,
    length: 3,
    lengthUnit: 'in',
    lengthInches: 3,
    gauge: null,
    color: null,
    from: makeEndpoint(fromComp, fromCav, 'CONNECTOR_PIN'),
    to:   makeEndpoint(toComp,   toCav,   'CONNECTOR_PIN'),
    confidence: 0.9,
    unresolved: false,
    sourceRowIndex: 0,
    rawText: '',
  };
}

function makeConnectivity(wires: WireConnectivity[]): HarnessConnectivityResult {
  return {
    wires,
    unresolvedWires: [],
    confidenceSummary: { total: wires.length, resolved: wires.length, partial: 0, unresolved: 0 },
  };
}

/** Build a minimal HarnessTopologyResult with specified multiWireEndpoints. */
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

/** Build a TopologyNode representing a branch origin. */
function branchNode(component: string, cavity: string, wireIds: string[]): TopologyNode {
  return {
    id: `${component.toLowerCase()}:${cavity.toLowerCase()}`,
    component,
    cavity,
    terminationType: 'CONNECTOR_PIN',
    wireIds,
  };
}

// ---------------------------------------------------------------------------
// A. Simple linear wires → W1, W2, W3
// ---------------------------------------------------------------------------

describe('wireIdentityService', () => {
  it('A: assigns W1, W2, W3 to simple linear wires in sorted order', () => {
    const wires = [
      makeWire('COM', 'J1', '3', 'J2', '1'),
      makeWire('PWR', 'J1', '1', 'J2', '3'),
      makeWire('GND', 'J1', '2', 'J2', '2'),
    ];
    const result = assignWireIdentities(makeConnectivity(wires), makeTopology());

    assert.equal(result.wires.length, 3);

    // Sorted: J1:1 (PWR), J1:2 (GND), J1:3 (COM)
    assert.equal(result.wires[0].internalWireId, 'W1');
    assert.equal(result.wires[0].customerWireId, 'PWR');
    assert.equal(result.wires[1].internalWireId, 'W2');
    assert.equal(result.wires[1].customerWireId, 'GND');
    assert.equal(result.wires[2].internalWireId, 'W3');
    assert.equal(result.wires[2].customerWireId, 'COM');

    // Lookup by original wireId
    assert.equal(result.byOriginalId.get('PWR')?.internalWireId, 'W1');
    assert.equal(result.byOriginalId.get('GND')?.internalWireId, 'W2');
    assert.equal(result.byOriginalId.get('COM')?.internalWireId, 'W3');
  });

  // -------------------------------------------------------------------------
  // B. Branch at same cavity → W1A, W1B
  // -------------------------------------------------------------------------

  it('B: assigns W1A, W1B to wires sharing a from-cavity branch origin', () => {
    const wires = [
      makeWire('SIGNAL', 'J1', '4', 'J2', '1'),
      makeWire('SIGNAL2', 'J1', '4', 'J3', '1'),
    ];
    // Both wires share J1:4 — multiWireEndpoint
    const topology = makeTopology([
      branchNode('J1', '4', ['SIGNAL', 'SIGNAL2']),
    ]);

    const result = assignWireIdentities(makeConnectivity(wires), topology);

    assert.equal(result.wires.length, 2);
    // Both should share base W1 with A/B suffixes
    const ids = result.wires.map(e => e.internalWireId).sort();
    assert.deepEqual(ids, ['W1A', 'W1B']);
  });

  // -------------------------------------------------------------------------
  // C. Multiple branch groups + non-branch → W1A/W1B, W2, W3A/W3B/W3C
  // -------------------------------------------------------------------------

  it('C: handles multiple branch groups and plain wires with correct sequence', () => {
    // Group 1: W1A, W1B (J1:1)
    // Plain:   W2   (J1:5)
    // Group 2: W3A, W3B, W3C (J2:1)
    const wires = [
      makeWire('branch1a', 'J1', '1', 'J2', '2'),
      makeWire('branch1b', 'J1', '1', 'J2', '3'),
      makeWire('plain',    'J1', '5', 'J2', '9'),
      makeWire('branch2a', 'J2', '1', 'J3', '1'),
      makeWire('branch2b', 'J2', '1', 'J3', '2'),
      makeWire('branch2c', 'J2', '1', 'J3', '3'),
    ];
    const topology = makeTopology([
      branchNode('J1', '1', ['branch1a', 'branch1b']),
      branchNode('J2', '1', ['branch2a', 'branch2b', 'branch2c']),
    ]);

    const result = assignWireIdentities(makeConnectivity(wires), topology);

    const idMap = new Map(result.wires.map(e => [e.originalWireId, e.internalWireId]));

    // Group 1 at J1:1 → W1A/W1B
    assert.ok(['W1A', 'W1B'].includes(idMap.get('branch1a')!));
    assert.ok(['W1A', 'W1B'].includes(idMap.get('branch1b')!));
    assert.notEqual(idMap.get('branch1a'), idMap.get('branch1b'));

    // Plain wire at J1:5 → W2
    assert.equal(idMap.get('plain'), 'W2');

    // Group 2 at J2:1 → W3A/W3B/W3C
    const group2 = [idMap.get('branch2a')!, idMap.get('branch2b')!, idMap.get('branch2c')!].sort();
    assert.deepEqual(group2, ['W3A', 'W3B', 'W3C']);
  });

  // -------------------------------------------------------------------------
  // D. Stability: same input always produces same IDs
  // -------------------------------------------------------------------------

  it('D: produces identical IDs on repeated calls with identical input', () => {
    const wires = [
      makeWire('alpha', 'J1', '2', 'J2', '1'),
      makeWire('beta',  'J1', '1', 'J2', '2'),
    ];
    const connectivity = makeConnectivity(wires);
    const topology     = makeTopology();

    const r1 = assignWireIdentities(connectivity, topology);
    const r2 = assignWireIdentities(connectivity, topology);

    assert.equal(r1.wires[0].internalWireId, r2.wires[0].internalWireId);
    assert.equal(r1.wires[1].internalWireId, r2.wires[1].internalWireId);
    assert.equal(r1.wires[0].originalWireId, r2.wires[0].originalWireId);
  });

  // -------------------------------------------------------------------------
  // E. Mixed customer IDs — preserved as-is, never overwritten
  // -------------------------------------------------------------------------

  it('E: preserves non-empty customerWireId and omits it when wireId is empty', () => {
    const wireWithId: WireConnectivity = {
      ...makeWire('1234', 'J1', '1', 'J2', '1'),
      wireId: '1234',
    };
    const wireNoId: WireConnectivity = {
      ...makeWire('', 'J1', '2', 'J2', '2'),
      wireId: '',
    };
    const result = assignWireIdentities(
      makeConnectivity([wireWithId, wireNoId]),
      makeTopology(),
    );

    const entry1234 = result.byOriginalId.get('1234');
    assert.ok(entry1234, 'should have entry for wireId "1234"');
    assert.equal(entry1234!.customerWireId, '1234');
    assert.ok(entry1234!.internalWireId.startsWith('W'));

    const entryEmpty = result.byOriginalId.get('');
    assert.ok(entryEmpty, 'should have entry for empty wireId');
    assert.equal(entryEmpty!.customerWireId, undefined);
    assert.ok(entryEmpty!.internalWireId.startsWith('W'));

    // Internal IDs must differ
    assert.notEqual(entry1234!.internalWireId, entryEmpty!.internalWireId);
  });
});
