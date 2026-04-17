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
  partNumber: string | null = null,
): WireEndpoint {
  return { component, cavity, treatment, terminationType, partNumber };
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
    assert.ok(branchWarnings[0].affectedNodeIds.includes('j:1:1'), 'Affected node uses canonical ID j:1:1');
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

  // G. T23.5 / T23.6.1: Two operator-added FERRULE wires sharing a FROM endpoint — no UNDECLARED_BRANCH.
  // T23.6.1: FERRULE anchor is normalized to CONNECTOR_PIN at graph construction time,
  // so the shared node IS in multiWireEndpoints. anyDeclared suppresses UNDECLARED_BRANCH
  // because both wires carry [OPERATOR_MODEL:BRANCH_DOUBLE_CRIMP].
  it('G: operator FERRULE double-crimp wires share a physical node without UNDECLARED_BRANCH', () => {
    const ferruleEndpoint = makeEndpoint('PHOENIX_1700443', '5', 'FERRULE');

    const wires = [
      makeWire('op-abc', ferruleEndpoint, makeEndpoint('J1', '1', 'CONNECTOR_PIN'), '[OPERATOR_MODEL:BRANCH_DOUBLE_CRIMP]'),
      makeWire('op-def', ferruleEndpoint, makeEndpoint('J1', '2', 'CONNECTOR_PIN'), '[OPERATOR_MODEL:BRANCH_DOUBLE_CRIMP]'),
    ];

    const result = analyzeHarnessTopology({ connectivity: makeConnectivity(wires) });

    const branchWarnings = result.warnings.filter(w => w.code === 'UNDECLARED_BRANCH');
    assert.strictEqual(branchWarnings.length, 0, 'FERRULE shared node must not trigger UNDECLARED_BRANCH');

    // T23.6.4: FERRULE endpoint creates a distinct ferrule node; cavity node also exists.
    const ferruleNode = result.nodes.find(n => n.id === 'phoenix:1700443:5:ferrule');
    assert.ok(ferruleNode, 'T23.6.4: explicit ferrule node must exist at phoenix:1700443:5:ferrule');
    assert.ok(ferruleNode!.isSharedFerrule, 'Ferrule node must be flagged as shared ferrule');
    assert.strictEqual(ferruleNode!.wireIds.length, 2, 'Both wires must reference the shared ferrule node');

    const cavityNode = result.nodes.find(n => n.id === 'phoenix:1700443:5');
    assert.ok(cavityNode, 'Mounting cavity node must also exist at phoenix:1700443:5');
    assert.strictEqual(cavityNode!.terminationType, 'CONNECTOR_PIN', 'Cavity node must be CONNECTOR_PIN type');
  });

  // H. T23.5: Mixed extracted wire + operator BRANCH_DOUBLE_CRIMP wire at the same CONNECTOR_PIN.
  // The extracted wire has no [OPERATOR_MODEL:] tag, but the operator wire declares the branch.
  // anyDeclared fix: if ANY wire on the shared node declares a branch, no UNDECLARED_BRANCH fires.
  it('H: extracted wire + operator branch wire at same CONNECTOR_PIN — anyDeclared suppresses warning', () => {
    const sharedPin = makeEndpoint('J1', '5', 'CONNECTOR_PIN');

    const wires = [
      makeWire('W-extracted', sharedPin, makeEndpoint('T1', null, 'TERMINAL')),
      makeWire('op-branch',   sharedPin, makeEndpoint('T2', null, 'TERMINAL'), '[OPERATOR_MODEL:BRANCH_DOUBLE_CRIMP]'),
    ];

    const result = analyzeHarnessTopology({ connectivity: makeConnectivity(wires) });

    const branchWarnings = result.warnings.filter(w => w.code === 'UNDECLARED_BRANCH');
    assert.strictEqual(
      branchWarnings.length, 0,
      'Extracted wire at operator-declared branch node must NOT trigger UNDECLARED_BRANCH',
    );
    assert.strictEqual(result.multiWireEndpoints.length, 1, 'Canonical J connector pin 5 remains multi-wire');
  });

  // J. T23.6: FERRULE-anchor branch wire satisfies the anchor cavity in missing-pin detection.
  // Before fix: FERRULE node excluded from pin-sequence analysis → cavity 2 shown as MISSING.
  // After fix:  FERRULE counts as occupied → no MISSING_WIRE for cavity 2.
  it('J: FERRULE anchor at cavity 2 suppresses MISSING_WIRE for that cavity', () => {
    // Phoenix has cavities 1, 3, 4 wired directly; cavity 2 only via the FERRULE branch wire.
    const wires = [
      makeWire('W1', makeEndpoint('J1', '1', 'CONNECTOR_PIN'), makeEndpoint('PHOENIX', '1', 'CONNECTOR_PIN')),
      makeWire('W2', makeEndpoint('J2', '1', 'CONNECTOR_PIN'), makeEndpoint('PHOENIX', '3', 'CONNECTOR_PIN')),
      makeWire('W3', makeEndpoint('J3', '1', 'CONNECTOR_PIN'), makeEndpoint('PHOENIX', '4', 'CONNECTOR_PIN')),
      makeWire(
        'op-branch',
        makeEndpoint('PHOENIX', '2', 'FERRULE'),
        makeEndpoint('PHOENIX', '5', 'CONNECTOR_PIN'),
        '[OPERATOR_MODEL:BRANCH_DOUBLE_CRIMP]',
      ),
    ];

    const result = analyzeHarnessTopology({ connectivity: makeConnectivity(wires) });

    const missingWarnings = result.warnings.filter(w => w.code === 'MISSING_WIRE');
    const cavity2Missing  = missingWarnings.some(w =>
      w.affectedNodeIds.some(id => id.toLowerCase().includes(':2')),
    );
    assert.ok(!cavity2Missing,
      'FERRULE anchor at Phoenix cavity 2 must NOT be reported as MISSING_WIRE',
    );

    // T23.6.4: FERRULE endpoint produces distinct ferrule node; cavity node carries CONNECTOR_PIN.
    const cavityNode = result.nodes.find(n => n.id === 'phoenix:2');
    assert.ok(cavityNode, 'Phoenix cavity 2 node must exist in the topology graph');
    assert.strictEqual(cavityNode!.terminationType, 'CONNECTOR_PIN',
      'T23.6.4: mounting cavity node must have CONNECTOR_PIN type');

    const ferruleNode = result.nodes.find(n => n.id === 'phoenix:2:ferrule');
    assert.ok(ferruleNode, 'T23.6.4: explicit ferrule node must exist at phoenix:2:ferrule');
    assert.ok(ferruleNode!.isSharedFerrule, 'Ferrule node must be flagged as shared ferrule');
    assert.ok(ferruleNode!.wireIds.includes('op-branch'), 'Branch wire is attached to the ferrule node');
  });

  // K. T23.6: An intra-connector branch wire (Phoenix:2 FERRULE → Phoenix:5) that is connected
  // to the main harness via another wire must NOT produce an ISOLATED_SUBGRAPH warning.
  it('K: intra-connector branch wire connected to main harness — no ISOLATED_SUBGRAPH', () => {
    const wires = [
      makeWire('W-9in',  makeEndpoint('J1', '1', 'CONNECTOR_PIN'), makeEndpoint('PHOENIX', '2', 'CONNECTOR_PIN')),
      makeWire('op-3in',
        makeEndpoint('PHOENIX', '2', 'FERRULE'),
        makeEndpoint('PHOENIX', '5', 'CONNECTOR_PIN'),
        '[OPERATOR_MODEL:BRANCH_DOUBLE_CRIMP]',
      ),
    ];

    const result = analyzeHarnessTopology({ connectivity: makeConnectivity(wires) });

    const isoWarnings = result.warnings.filter(w => w.code === 'ISOLATED_SUBGRAPH');
    assert.strictEqual(isoWarnings.length, 0,
      'Branch wire that merges into main harness must not produce ISOLATED_SUBGRAPH',
    );
    assert.strictEqual(result.isolatedSubgraphs.filter(sg => sg.isIsolated).length, 0,
      'No isolated subgraphs expected when all wires are transitively connected',
    );
  });

  // L. T23.6: Simple non-branch wires must be unaffected by shared-node merge logic.
  it('L: simple A→B wires are unaffected by shared-node merge logic', () => {
    const terminal = makeEndpoint('929504-1', null, 'TERMINAL');
    const wires = [
      makeWire('W1', makeEndpoint('J1', '1', 'CONNECTOR_PIN'), terminal),
      makeWire('W2', makeEndpoint('J1', '2', 'CONNECTOR_PIN'), terminal),
      makeWire('W3', makeEndpoint('J1', '3', 'CONNECTOR_PIN'), terminal),
    ];

    const result = analyzeHarnessTopology({ connectivity: makeConnectivity(wires) });

    assert.strictEqual(result.warnings.filter(w => w.blocksCommit).length, 0,
      'Simple wires must have no blocking warnings',
    );
    assert.strictEqual(result.missingWireCandidates.length, 0,
      'Complete connector (pins 1-3) must have no missing-wire candidates',
    );
    assert.strictEqual(result.edges.length, 3, 'Three edges for three wires');
    assert.strictEqual(result.isolatedSubgraphs.filter(sg => sg.isIsolated).length, 0,
      'All simple wires share a terminal node — one connected component',
    );
  });

  // M. T23.6.1: A declared branch wire with a FERRULE anchor must produce a CONNECTOR_PIN
  // node at graph construction time, not a FERRULE pseudo-node. This is the core
  // construction fix: validation derives pin occupancy from the merged graph itself.
  it('M: declared FERRULE anchor is promoted to CONNECTOR_PIN at graph construction time', () => {
    const wires = [
      makeWire(
        'op-branch',
        makeEndpoint('PHOENIX', '2', 'FERRULE'),
        makeEndpoint('PHOENIX', '5', 'CONNECTOR_PIN'),
        '[OPERATOR_MODEL:BRANCH_DOUBLE_CRIMP]',
      ),
    ];

    const result = analyzeHarnessTopology({ connectivity: makeConnectivity(wires) });

    // T23.6.4: FERRULE endpoint creates an explicit ferrule node; cavity node carries CONNECTOR_PIN.
    const cavityNode = result.nodes.find(n => n.id === 'phoenix:2');
    assert.ok(cavityNode, 'Cavity node must be present in the graph');
    assert.strictEqual(cavityNode!.terminationType, 'CONNECTOR_PIN',
      'T23.6.4: mounting cavity node must have CONNECTOR_PIN type');

    const ferruleNode = result.nodes.find(n => n.id === 'phoenix:2:ferrule');
    assert.ok(ferruleNode, 'T23.6.4: FERRULE endpoint must produce an explicit ferrule node');
    assert.ok(ferruleNode!.isSharedFerrule, 'Ferrule node must be flagged as shared ferrule');
    assert.ok(ferruleNode!.wireIds.includes('op-branch'),
      'Branch wire must be registered at the ferrule node');
  });

  // N. T23.6.1: The 9" wire and the 3" branch wire must both converge at one canonical
  // anchor node (phoenix:2). This proves shared-node merge is built into the graph
  // rather than compensated for in validation.
  it('N: 9" and 3" branch wires converge at the canonical shared anchor node', () => {
    const wires = [
      makeWire('W-9in', makeEndpoint('J1', '1', 'CONNECTOR_PIN'), makeEndpoint('PHOENIX', '2', 'CONNECTOR_PIN')),
      makeWire('op-3in',
        makeEndpoint('PHOENIX', '2', 'FERRULE'),
        makeEndpoint('PHOENIX', '5', 'CONNECTOR_PIN'),
        '[OPERATOR_MODEL:BRANCH_DOUBLE_CRIMP]',
      ),
    ];

    const result = analyzeHarnessTopology({ connectivity: makeConnectivity(wires) });

    // T23.6.4: 9" wire attaches to cavity node; 3" branch attaches to ferrule node.
    // Both nodes are unioned — one connected component.
    const cavityNode = result.nodes.find(n => n.id === 'phoenix:2');
    assert.ok(cavityNode, 'Cavity node must exist at phoenix:2');
    assert.ok(cavityNode!.wireIds.includes('W-9in'),
      '9" wire must attach to the cavity node');
    assert.ok(!cavityNode!.wireIds.includes('op-3in'),
      '3" branch wire must NOT be on the cavity node (it is on the ferrule node)');
    assert.strictEqual(cavityNode!.terminationType, 'CONNECTOR_PIN',
      'Cavity node must have CONNECTOR_PIN type');

    const ferruleNode = result.nodes.find(n => n.id === 'phoenix:2:ferrule');
    assert.ok(ferruleNode, 'T23.6.4: ferrule node must exist at phoenix:2:ferrule');
    assert.ok(ferruleNode!.isSharedFerrule, 'Ferrule node must be flagged as shared ferrule');
    assert.ok(ferruleNode!.wireIds.includes('op-3in'),
      '3" branch wire must attach to the ferrule node');

    const isoWarnings = result.warnings.filter(w => w.code === 'ISOLATED_SUBGRAPH');
    assert.strictEqual(isoWarnings.length, 0,
      'No isolated subgraph when ferrule node is unioned with cavity node connected to main harness');
  });

  // O. T23.6.4: known brown-wire case — ferrule 1381010 at Phoenix 1700443 pin 2 is the shared
  // crimp node for W1A (9 in) and W1B (3 in). W1A remote end is terminal 61944-1; W1B remote
  // end returns to Phoenix 1700443 pin 5. Pin 2 and pin 5 must not be reported missing.
  it('O: T23.6.4 — ferrule shared node with partNumber satisfies pin 2 and pin 5 occupancy', () => {
    const ferruleAt2 = makeEndpoint('PHOENIX_1700443', '2', 'FERRULE', null, '1381010');
    const wires = [
      makeWire('W-9in',  makeEndpoint('J1', '1', 'CONNECTOR_PIN'), makeEndpoint('PHOENIX_1700443', '2', 'CONNECTOR_PIN')),
      makeWire('W1A',    ferruleAt2,                                makeEndpoint('61944-1', null, 'TERMINAL')),
      makeWire('W1B',    ferruleAt2,                                makeEndpoint('PHOENIX_1700443', '5', 'CONNECTOR_PIN')),
    ];

    const result = analyzeHarnessTopology({ connectivity: makeConnectivity(wires) });

    const ferruleNode = result.nodes.find(n => n.id === 'phoenix:1700443:2:ferrule:1381010');
    assert.ok(ferruleNode, 'Ferrule node must exist at phoenix:1700443:2:ferrule:1381010');
    assert.ok(ferruleNode!.isSharedFerrule, 'Node must be flagged as shared ferrule');
    assert.strictEqual(ferruleNode!.ferrulePartNumber, '1381010', 'Ferrule PN must be stored on node');
    assert.ok(ferruleNode!.wireIds.includes('W1A'), 'W1A must attach to ferrule node');
    assert.ok(ferruleNode!.wireIds.includes('W1B'), 'W1B must attach to ferrule node');
    assert.strictEqual(ferruleNode!.wireIds.length, 2, 'Exactly two wires share the ferrule node');

    const cavityNode = result.nodes.find(n => n.id === 'phoenix:1700443:2');
    assert.ok(cavityNode, 'Mounting cavity node must exist at phoenix:1700443:2');
    assert.strictEqual(cavityNode!.terminationType, 'CONNECTOR_PIN', 'Cavity node is CONNECTOR_PIN');
    assert.ok(cavityNode!.wireIds.includes('W-9in'), 'W-9in attaches to cavity node');

    const missingWarnings = result.warnings.filter(w => w.code === 'MISSING_WIRE');
    const pin2Missing = missingWarnings.some(w => w.affectedNodeIds.some(id => id.endsWith(':2')));
    const pin5Missing = missingWarnings.some(w => w.affectedNodeIds.some(id => id.endsWith(':5')));
    assert.ok(!pin2Missing, 'Pin 2 must NOT be flagged missing — occupied by ferrule node');
    assert.ok(!pin5Missing, 'Pin 5 must NOT be flagged missing — occupied by W1B TO endpoint');

    assert.strictEqual(
      result.warnings.filter(w => w.code === 'UNDECLARED_BRANCH').length, 0,
      'No UNDECLARED_BRANCH: ferrule node carries the shared crimp, not the raw connector pin',
    );

    const isoWarnings = result.warnings.filter(w => w.code === 'ISOLATED_SUBGRAPH');
    assert.strictEqual(isoWarnings.length, 0,
      'No isolated subgraph: ferrule node unioned with cavity node connects all wires',
    );
  });

  // P. T23.6.4: ferrule without explicit partNumber uses generic :ferrule suffix.
  it('P: T23.6.4 — FERRULE endpoint without partNumber gets generic ferrule node key', () => {
    const ferruleAt2 = makeEndpoint('PHOENIX', '2', 'FERRULE');
    const wires = [
      makeWire('Wa', ferruleAt2, makeEndpoint('T1', null, 'TERMINAL'), '[OPERATOR_MODEL:BRANCH_DOUBLE_CRIMP]'),
      makeWire('Wb', ferruleAt2, makeEndpoint('T2', null, 'TERMINAL'), '[OPERATOR_MODEL:BRANCH_DOUBLE_CRIMP]'),
    ];

    const result = analyzeHarnessTopology({ connectivity: makeConnectivity(wires) });

    const ferruleNode = result.nodes.find(n => n.id === 'phoenix:2:ferrule');
    assert.ok(ferruleNode, 'Generic ferrule node must exist at phoenix:2:ferrule');
    assert.ok(ferruleNode!.isSharedFerrule, 'Node must be flagged as shared ferrule');
    assert.strictEqual(ferruleNode!.ferrulePartNumber, null, 'No ferrule PN stored when none supplied');
    assert.ok(ferruleNode!.wireIds.includes('Wa'), 'Wa attaches to ferrule node');
    assert.ok(ferruleNode!.wireIds.includes('Wb'), 'Wb attaches to ferrule node');

    const branchWarnings = result.warnings.filter(w => w.code === 'UNDECLARED_BRANCH');
    assert.strictEqual(branchWarnings.length, 0, 'No UNDECLARED_BRANCH for ferrule-shared wires');
  });

  // Q. T23.6.6: Intra-component wire (same connector, different cavities) must preserve both nodes.
  it('Q: same connector cavities build distinct nodes and edges', () => {
    const wires = [
      makeWire('W-pin1', makeEndpoint('J1', '1', 'CONNECTOR_PIN'), makeEndpoint('PHOENIX 1700443', '1', 'CONNECTOR_PIN')),
      makeWire('W-pin3', makeEndpoint('J2', '1', 'CONNECTOR_PIN'), makeEndpoint('PHOENIX 1700443', '3', 'CONNECTOR_PIN')),
      makeWire('W-pin4', makeEndpoint('J3', '1', 'CONNECTOR_PIN'), makeEndpoint('PHOENIX 1700443', '4', 'CONNECTOR_PIN')),
      makeWire('W-same',
        makeEndpoint('PHOENIX 1700443', '2', 'CONNECTOR_PIN'),
        makeEndpoint('PHOENIX 1700443', '5', 'CONNECTOR_PIN'),
      ),
    ];

    const result = analyzeHarnessTopology({ connectivity: makeConnectivity(wires) });

    assert.ok(result.nodes.some(n => n.id === 'phoenix:1700443:2'), 'Pin 2 node must exist');
    assert.ok(result.nodes.some(n => n.id === 'phoenix:1700443:5'), 'Pin 5 node must exist');

    const sameEdge = result.edges.find(e => e.wireId === 'W-same');
    assert.ok(sameEdge, 'Edge for intra-component wire must exist');
    assert.equal(sameEdge!.fromNodeId, 'phoenix:1700443:2', 'FROM node must stay at cavity 2');
    assert.equal(sameEdge!.toNodeId, 'phoenix:1700443:5', 'TO node must stay at cavity 5');

    assert.equal(result.missingWireCandidates.length, 0, 'No missing-pin candidates expected for occupied pins');
    const missingPin5 = result.warnings
      .filter(w => w.code === 'MISSING_WIRE')
      .some(w => w.affectedNodeIds.some(id => id.endsWith(':5')));
    assert.equal(missingPin5, false, 'Pin 5 must not be flagged missing');
  });

  // R. T23.6.6: Degenerate same-component/same-cavity wire collapses safely without duplicate nodes.
  it('R: same connector and cavity does not create duplicate nodes', () => {
    const loopWire = makeWire(
      'W-loop',
      makeEndpoint('PHOENIX 1700443', '2', 'CONNECTOR_PIN'),
      makeEndpoint('PHOENIX 1700443', '2', 'CONNECTOR_PIN'),
    );

    const result = analyzeHarnessTopology({ connectivity: makeConnectivity([loopWire]) });

    const node = result.nodes.find(n => n.id === 'phoenix:1700443:2');
    assert.ok(node, 'Cavity node must exist even for degenerate wires');
    assert.ok(node!.wireIds.includes('W-loop'), 'Wire must attach to the cavity node');

    const edge = result.edges.find(e => e.wireId === 'W-loop');
    assert.ok(edge, 'Edge must be present for degenerate wire');
    assert.equal(edge!.fromNodeId, 'phoenix:1700443:2');
    assert.equal(edge!.toNodeId, 'phoenix:1700443:2');
  });

  // S. T23.6.8: Canonicalization must collapse spelling variants into the same connector identity.
  it('S: canonical component variants merge into one connector family', () => {
    const wires = [
      makeWire('W-authoritative',
        makeEndpoint('PHOENIX 1700443', '2', 'CONNECTOR_PIN'),
        makeEndpoint('J1', '1', 'CONNECTOR_PIN'),
      ),
      makeWire('W-variant',
        makeEndpoint('PHOENIX #: 1700443', '5', 'CONNECTOR_PIN'),
        makeEndpoint('J2', '1', 'CONNECTOR_PIN'),
      ),
    ];

    const result = analyzeHarnessTopology({ connectivity: makeConnectivity(wires) });
    const phoenixNodes = result.nodes.filter(n => n.canonicalComponent === 'phoenix:1700443');
    assert.ok(phoenixNodes.some(n => n.cavity === '2'), 'Canonical node must include cavity 2');
    assert.ok(phoenixNodes.some(n => n.cavity === '5'), 'Canonical node must include cavity 5');
    assert.equal(result.missingWireCandidates.length, 0, 'No missing pins after canonical merge');
    const edgeVariant = result.edges.find(e => e.wireId === 'W-variant');
    assert.equal(edgeVariant?.fromNodeId, 'phoenix:1700443:5');
  });

  // I. T23.5: ISOLATED_SUBGRAPH warning message must use node IDs (component:cavity),
  // not customer wire labels, so the report is label-agnostic.
  it('I: ISOLATED_SUBGRAPH warning message uses node IDs not wire labels', () => {
    const wires = [
      makeWire('CUSTOMER-LABEL-A', makeEndpoint('J1', '1', 'CONNECTOR_PIN'), makeEndpoint('T1', null, 'TERMINAL')),
      makeWire('CUSTOMER-LABEL-B', makeEndpoint('J2', '1', 'CONNECTOR_PIN'), makeEndpoint('T2', null, 'TERMINAL')),
    ];

    const result = analyzeHarnessTopology({ connectivity: makeConnectivity(wires) });

    const isoWarnings = result.warnings.filter(w => w.code === 'ISOLATED_SUBGRAPH');
    assert.strictEqual(isoWarnings.length, 2, 'Two isolated subgraphs expected');

    for (const w of isoWarnings) {
      assert.ok(
        !w.message.includes('CUSTOMER-LABEL-A') && !w.message.includes('CUSTOMER-LABEL-B'),
        'ISOLATED_SUBGRAPH message must not contain customer wire labels',
      );
      assert.ok(
        w.message.startsWith('Isolated subgraph:'),
        'ISOLATED_SUBGRAPH message must start with "Isolated subgraph:"',
      );
    }
  });

});
