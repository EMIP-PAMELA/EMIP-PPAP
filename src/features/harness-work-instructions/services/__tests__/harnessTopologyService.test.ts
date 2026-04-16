import { describe, it } from 'node:test';
import assert from 'assert/strict';

import { analyzeHarnessTopology } from '../harnessTopologyService';
import type { HarnessConnectivityResult, WireConnectivity, WireEndpoint, EndpointTerminationType } from '../harnessConnectivityService';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeEndpoint(
  component: string | null,
  cavity: string | null = null,
  terminationType: EndpointTerminationType | null = null,
  treatment: string | null = null,
): WireEndpoint {
  return { component, cavity, treatment, terminationType };
}

function makeWire(
  wireId: string,
  from: WireEndpoint,
  to: WireEndpoint,
  rawText = '',
): WireConnectivity {
  return {
    wireId,
    length: 3,
    lengthUnit: 'in',
    lengthInches: 3,
    gauge: '18',
    color: 'BRN',
    from,
    to,
    sourceRowIndex: 0,
    rawText,
    confidence: 0.9,
    unresolved: false,
  };
}

function makeConnectivity(wires: WireConnectivity[]): HarnessConnectivityResult {
  return {
    wires,
    unresolvedWires: wires.filter(w => w.unresolved).map(w => w.wireId),
    confidenceSummary: {
      total:      wires.length,
      resolved:   wires.filter(w => !w.unresolved).length,
      partial:    0,
      unresolved: wires.filter(w => w.unresolved).length,
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('analyzeHarnessTopology', () => {

  // A. Complete connector — all pins 1–4 present, no gaps
  it('A: complete connector generates no missing-wire warnings', () => {
    const from1 = makeEndpoint('J1', '1', 'CONNECTOR_PIN');
    const from2 = makeEndpoint('J1', '2', 'CONNECTOR_PIN');
    const from3 = makeEndpoint('J1', '3', 'CONNECTOR_PIN');
    const from4 = makeEndpoint('J1', '4', 'CONNECTOR_PIN');
    const terminal = makeEndpoint('929504-1', null, 'TERMINAL');

    const wires = [
      makeWire('W1', from1, terminal),
      makeWire('W2', from2, terminal),
      makeWire('W3', from3, terminal),
      makeWire('W4', from4, terminal),
    ];

    const result = analyzeHarnessTopology({ connectivity: makeConnectivity(wires) });

    assert.strictEqual(result.missingWireCandidates.length, 0, 'No missing wire candidates expected');
    const missingWarnings = result.warnings.filter(w => w.code === 'MISSING_WIRE');
    assert.strictEqual(missingWarnings.length, 0, 'No MISSING_WIRE warnings expected');
  });

  // B. Missing pin 4 in sequence 1,2,3,5 → detected as HIGH confidence
  it('B: missing pin in connector sequence is detected', () => {
    const terminal = makeEndpoint('929504-1', null, 'TERMINAL');

    const wires = [
      makeWire('W1', makeEndpoint('J1', '1', 'CONNECTOR_PIN'), terminal),
      makeWire('W2', makeEndpoint('J1', '2', 'CONNECTOR_PIN'), terminal),
      makeWire('W3', makeEndpoint('J1', '3', 'CONNECTOR_PIN'), terminal),
      makeWire('W5', makeEndpoint('J1', '5', 'CONNECTOR_PIN'), terminal),
    ];

    const result = analyzeHarnessTopology({ connectivity: makeConnectivity(wires) });

    assert.strictEqual(result.missingWireCandidates.length, 1, 'Exactly one missing wire candidate');
    const candidate = result.missingWireCandidates[0];
    assert.strictEqual(candidate.missingCavity, '4', 'Pin 4 is the missing cavity');
    assert.strictEqual(candidate.confidence, 'HIGH', 'Single-gap sequences are HIGH confidence');
    assert.ok(candidate.knownCavities.includes('1'), 'Known cavities include pin 1');
    assert.ok(candidate.knownCavities.includes('5'), 'Known cavities include pin 5');

    const missingWarnings = result.warnings.filter(w => w.code === 'MISSING_WIRE');
    assert.strictEqual(missingWarnings.length, 1);
    assert.strictEqual(missingWarnings[0].blocksCommit, true, 'HIGH confidence MISSING_WIRE blocks commit');
  });

  // C. Double crimp with declared BRANCH_DOUBLE_CRIMP — no UNDECLARED_BRANCH warning
  it('C: declared double-crimp endpoint generates no undeclared-branch warning', () => {
    const fromPin = makeEndpoint('J1', '1', 'CONNECTOR_PIN');

    const wires = [
      makeWire('W1', fromPin, makeEndpoint('T1', null, 'TERMINAL'), '[OPERATOR_MODEL:BRANCH_DOUBLE_CRIMP] wire 1'),
      makeWire('W2', fromPin, makeEndpoint('T2', null, 'TERMINAL'), '[OPERATOR_MODEL:BRANCH_DOUBLE_CRIMP] wire 2'),
    ];

    const result = analyzeHarnessTopology({ connectivity: makeConnectivity(wires) });

    const branchWarnings = result.warnings.filter(w => w.code === 'UNDECLARED_BRANCH');
    assert.strictEqual(branchWarnings.length, 0, 'No UNDECLARED_BRANCH warning when branch is declared');
    assert.strictEqual(result.multiWireEndpoints.length, 1, 'Node J1:1 is still a multi-wire endpoint');
  });

  // D. Two wires share the same CONNECTOR_PIN without any declaration → UNDECLARED_BRANCH
  it('D: undeclared double-crimp generates UNDECLARED_BRANCH warning', () => {
    const fromPin = makeEndpoint('J1', '1', 'CONNECTOR_PIN');

    const wires = [
      makeWire('W1', fromPin, makeEndpoint('T1', null, 'TERMINAL')),
      makeWire('W2', fromPin, makeEndpoint('T2', null, 'TERMINAL')),
    ];

    const result = analyzeHarnessTopology({ connectivity: makeConnectivity(wires) });

    const branchWarnings = result.warnings.filter(w => w.code === 'UNDECLARED_BRANCH');
    assert.strictEqual(branchWarnings.length, 1, 'One UNDECLARED_BRANCH warning expected');
    assert.strictEqual(branchWarnings[0].confidence, 'HIGH');
    assert.strictEqual(branchWarnings[0].blocksCommit, true);
    assert.ok(branchWarnings[0].affectedNodeIds.some(id => id.includes('j1:1')), 'Affected node is j1:1');
  });

  // E. Two isolated wire groups with no shared component → ISOLATED_SUBGRAPH
  it('E: disconnected wire groups are detected as isolated subgraphs', () => {
    const wires = [
      makeWire('W1', makeEndpoint('J1', '1', 'CONNECTOR_PIN'), makeEndpoint('T1', null, 'TERMINAL')),
      makeWire('W2', makeEndpoint('J2', '1', 'CONNECTOR_PIN'), makeEndpoint('T2', null, 'TERMINAL')),
    ];

    const result = analyzeHarnessTopology({ connectivity: makeConnectivity(wires) });

    assert.strictEqual(result.isolatedSubgraphs.length, 2, 'Two isolated subgraphs detected');
    assert.ok(result.isolatedSubgraphs.every(sg => sg.isIsolated), 'All subgraphs marked isIsolated');

    const isolatedWarnings = result.warnings.filter(w => w.code === 'ISOLATED_SUBGRAPH');
    assert.strictEqual(isolatedWarnings.length, 2, 'One warning per isolated subgraph');
    assert.ok(isolatedWarnings.every(w => !w.blocksCommit), 'ISOLATED_SUBGRAPH never blocks commit');
    assert.ok(isolatedWarnings.every(w => w.confidence === 'MEDIUM'), 'ISOLATED_SUBGRAPH is MEDIUM confidence');
  });

  // F. Strip-only open end is a valid termination — no DANGLING_ENDPOINT
  it('F: strip-only wire end does not generate dangling-endpoint warning', () => {
    const wires = [
      makeWire(
        'W1',
        makeEndpoint('J1', '1', 'CONNECTOR_PIN'),
        makeEndpoint(null, null, 'STRIP_ONLY'),
      ),
    ];

    const result = analyzeHarnessTopology({ connectivity: makeConnectivity(wires) });

    const danglingWarnings = result.warnings.filter(w => w.code === 'DANGLING_ENDPOINT');
    assert.strictEqual(danglingWarnings.length, 0, 'STRIP_ONLY end must not be flagged as dangling');
    assert.strictEqual(result.danglingEndpoints.length, 0);
  });

});
