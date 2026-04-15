/**
 * T10 — Unit tests for visionConnectivityBridge.buildHarnessConnectivityFromVision
 *
 * Covers:
 *   A. Single-connector fallback (null connectorId + sole connector → assigned)
 *   B. Explicit connector IDs on wires
 *   C. Missing TO terminal → unresolved
 *   D. No wires → returns null
 *   E. Multi-connector → no fallback, null connectorId stays unresolved
 *   F. Confidence preservation (conservative, never inflated)
 *   G. Summary counts (resolved/partial/unresolved)
 *
 * Run with:
 *   node --experimental-strip-types src/features/harness-work-instructions/services/__tests__/visionConnectivityBridge.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildHarnessConnectivityFromVision } from '../visionConnectivityBridge';
import type { VisionParsedDrawingResult, VisionParsedWire, VisionParsedConnector } from '../aiDrawingVisionService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeVision(
  wires: VisionParsedWire[],
  connectors: VisionParsedConnector[] = [],
): VisionParsedDrawingResult {
  return {
    metadata:   { partNumber: null, drawingNumber: null, revision: null },
    wires,
    connectors,
    notes:      [],
    confidence: 0.8,
  };
}

function wire(overrides: Partial<VisionParsedWire> & { wireId: string }): VisionParsedWire {
  return {
    wireId:     overrides.wireId,
    length:     overrides.length   ?? null,
    gauge:      overrides.gauge    ?? null,
    color:      overrides.color    ?? null,
    from:       overrides.from     ?? {},
    to:         overrides.to       ?? {},
    confidence: overrides.confidence ?? 0.8,
    evidence:   overrides.evidence ?? [],
  };
}

function connector(id: string, pn?: string): VisionParsedConnector {
  return { id, partNumber: pn ?? null, confidence: 0.9 };
}

// ---------------------------------------------------------------------------
// A. Single-connector fallback
// ---------------------------------------------------------------------------

test('T10-A: single connector assigned when connectorId null but pin present', () => {
  const result = buildHarnessConnectivityFromVision(makeVision(
    [
      wire({ wireId: 'W1', from: { connectorId: null, pin: '3' }, to: { terminalPartNumber: '929504-1' }, confidence: 0.85 }),
      wire({ wireId: 'W2', from: { connectorId: null, pin: '7' }, to: { terminalPartNumber: '929504-2' }, confidence: 0.80 }),
    ],
    [connector('J1')],
  ));

  assert.ok(result, 'should produce a result');
  assert.equal(result!.wires.length, 2);

  const w1 = result!.wires[0];
  assert.equal(w1.from.component, 'J1',       'W1 from.component should be sole connector id');
  assert.equal(w1.from.cavity, '3',            'W1 cavity should be pin');
  assert.equal(w1.to.component, '929504-1',    'W1 to.component should be terminal PN');
  assert.equal(w1.unresolved, false,           'W1 should be resolved with both endpoints');

  const w2 = result!.wires[1];
  assert.equal(w2.from.component, 'J1',        'W2 from.component should be sole connector id');
  assert.equal(w2.from.cavity, '7',            'W2 cavity should be pin');
  assert.equal(w2.unresolved, false);
});

test('T10-A: single-connector fallback does NOT apply when pin is null', () => {
  const result = buildHarnessConnectivityFromVision(makeVision(
    [wire({ wireId: 'W1', from: { connectorId: null, pin: null }, to: { terminalPartNumber: '929504-1' } })],
    [connector('J1')],
  ));

  assert.ok(result);
  const w = result!.wires[0];
  assert.equal(w.from.component, null, 'no fallback when pin is null');
  assert.equal(w.unresolved, true,     'unresolved because from.component is null');
});

// ---------------------------------------------------------------------------
// B. Explicit connector IDs
// ---------------------------------------------------------------------------

test('T10-B: explicit connectorId maps directly to from.component', () => {
  const result = buildHarnessConnectivityFromVision(makeVision(
    [
      wire({ wireId: 'W1', from: { connectorId: 'J2', pin: '1' }, to: { terminalPartNumber: '12345-67' } }),
      wire({ wireId: 'W2', from: { connectorId: 'J3', pin: '2' }, to: { terminalPartNumber: '99999-00' } }),
    ],
    [connector('J2'), connector('J3')],    // multiple connectors — fallback disabled
  ));

  assert.ok(result);
  assert.equal(result!.wires[0].from.component, 'J2');
  assert.equal(result!.wires[1].from.component, 'J3');
  assert.equal(result!.confidenceSummary.resolved, 2);
});

test('T10-B: pin number is normalized to string cavity', () => {
  const result = buildHarnessConnectivityFromVision(makeVision(
    [wire({ wireId: 'W1', from: { connectorId: 'J1', pin: 42 }, to: { terminalPartNumber: '929504-1' } })],
  ));
  assert.ok(result);
  assert.equal(result!.wires[0].from.cavity, '42');
});

// ---------------------------------------------------------------------------
// C. Missing TO terminal → unresolved
// ---------------------------------------------------------------------------

test('T10-C: wire with null terminalPartNumber is unresolved', () => {
  const result = buildHarnessConnectivityFromVision(makeVision(
    [wire({ wireId: 'W1', from: { connectorId: 'J1', pin: '1' }, to: { terminalPartNumber: null } })],
  ));

  assert.ok(result);
  const w = result!.wires[0];
  assert.equal(w.to.component, null);
  assert.equal(w.unresolved, true);
  assert.deepEqual(result!.unresolvedWires, ['W1']);
});

test('T10-C: wire with absent to object is unresolved', () => {
  const result = buildHarnessConnectivityFromVision(makeVision(
    [wire({ wireId: 'W1', from: { connectorId: 'J1', pin: '1' }, to: {} })],
  ));

  assert.ok(result);
  assert.equal(result!.wires[0].unresolved, true);
});

// ---------------------------------------------------------------------------
// D. No wires → returns null
// ---------------------------------------------------------------------------

test('T10-D: empty wires array returns null', () => {
  const result = buildHarnessConnectivityFromVision(makeVision([]));
  assert.equal(result, null);
});

test('T10-D: vision result with no wires property returns null', () => {
  const vision = makeVision([]);
  // @ts-expect-error deliberately remove wires
  delete vision.wires;
  const result = buildHarnessConnectivityFromVision(vision);
  assert.equal(result, null);
});

// ---------------------------------------------------------------------------
// E. Multi-connector → no single-connector fallback
// ---------------------------------------------------------------------------

test('T10-E: multi-connector input — null connectorId stays unresolved', () => {
  const result = buildHarnessConnectivityFromVision(makeVision(
    [wire({ wireId: 'W1', from: { connectorId: null, pin: '3' }, to: { terminalPartNumber: '929504-1' } })],
    [connector('J1'), connector('J2')],
  ));

  assert.ok(result);
  const w = result!.wires[0];
  assert.equal(w.from.component, null, 'no fallback when more than 1 connector');
  assert.equal(w.unresolved, true);
});

// ---------------------------------------------------------------------------
// F. Confidence preservation — never inflated, conservative penalties applied
// ---------------------------------------------------------------------------

test('T10-F: confidence starts from vision wire confidence', () => {
  const result = buildHarnessConnectivityFromVision(makeVision(
    [wire({ wireId: 'W1', from: { connectorId: 'J1', pin: '1' }, to: { terminalPartNumber: '929504-1' }, confidence: 0.9 })],
  ));

  assert.ok(result);
  // Both endpoints present so no field-missing penalty; unresolved=false so no unresolved penalty.
  // from.component = 'J1' (no penalty), from.cavity = '1' (no penalty), to.component = '929504-1' (no penalty)
  // Expected: 0.9 − 0 = 0.9
  assert.equal(result!.wires[0].confidence, 0.9);
});

test('T10-F: missing from.component applies penalty (confidence reduced)', () => {
  const result = buildHarnessConnectivityFromVision(makeVision(
    [wire({ wireId: 'W1', from: {}, to: { terminalPartNumber: '929504-1' }, confidence: 0.8 })],
  ));

  assert.ok(result);
  const w = result!.wires[0];
  // missing from.component (−0.15), no cavity (−0.10), unresolved (−0.10) = 0.80 − 0.35 = 0.45
  assert.ok(w.confidence < 0.8, 'confidence must be reduced from vision baseline');
  assert.ok(w.confidence >= 0,  'confidence must not go below 0');
});

test('T10-F: vision confidence clamped to [0, 1]', () => {
  const result = buildHarnessConnectivityFromVision(makeVision(
    [wire({ wireId: 'W1', from: { connectorId: 'J1', pin: '1' }, to: { terminalPartNumber: '929504-1' }, confidence: 1.5 })],
  ));

  assert.ok(result);
  assert.ok(result!.wires[0].confidence <= 1.0);
});

test('T10-F: negative vision confidence clamped to 0', () => {
  const result = buildHarnessConnectivityFromVision(makeVision(
    [wire({ wireId: 'W1', from: {}, to: {}, confidence: -0.5 })],
  ));

  assert.ok(result);
  assert.ok(result!.wires[0].confidence >= 0);
});

// ---------------------------------------------------------------------------
// G. Summary counts
// ---------------------------------------------------------------------------

test('T10-G: summary resolved/partial/unresolved computed correctly', () => {
  const result = buildHarnessConnectivityFromVision(makeVision(
    [
      // resolved: both endpoints
      wire({ wireId: 'W1', from: { connectorId: 'J1', pin: '1' }, to: { terminalPartNumber: '929504-1' } }),
      // unresolved: missing to
      wire({ wireId: 'W2', from: { connectorId: 'J1', pin: '2' }, to: {} }),
      // partial: connector present but no terminal (unresolved=true via null to.component — same as above)
      // Let's add a wire where from is null too → unresolved
      wire({ wireId: 'W3', from: {}, to: {} }),
    ],
    [],
  ));

  assert.ok(result);
  const s = result!.confidenceSummary;
  assert.equal(s.total, 3);
  assert.equal(s.resolved, 1,   'only W1 is fully resolved');
  assert.equal(s.unresolved, 2, 'W2 and W3 are unresolved');
  assert.equal(s.partial, 0,    'partial only when unresolved=false and one endpoint null');
});

test('T10-G: partial wire (from resolved, to null, not flagged ambiguous)', () => {
  // Build a wire where from.component is present via explicit connectorId,
  // to.component is null — this should be unresolved (from the bridge logic).
  // Note: "partial" in T2 means unresolved=false + one endpoint null.
  // Since bridge sets unresolved=true whenever any endpoint is null, partial should be 0.
  const result = buildHarnessConnectivityFromVision(makeVision(
    [wire({ wireId: 'W1', from: { connectorId: 'J1', pin: '3' }, to: { terminalPartNumber: null } })],
  ));

  assert.ok(result);
  const w = result!.wires[0];
  assert.equal(w.unresolved, true, 'bridge marks as unresolved when to.component null');
  assert.equal(result!.confidenceSummary.unresolved, 1);
  assert.equal(result!.confidenceSummary.partial, 0);
});

test('T10-G: unresolvedWires list contains all unresolved wire IDs', () => {
  const result = buildHarnessConnectivityFromVision(makeVision(
    [
      wire({ wireId: 'W1', from: { connectorId: 'J1', pin: '1' }, to: { terminalPartNumber: '929504-1' } }),
      wire({ wireId: 'W2', from: { connectorId: 'J1', pin: '2' }, to: {} }),
      wire({ wireId: 'W3', from: {}, to: {} }),
    ],
  ));

  assert.ok(result);
  assert.deepEqual(result!.unresolvedWires.sort(), ['W2', 'W3']);
});

test('T10-G: wireId fallback uses VIS_N when wireId is blank', () => {
  const result = buildHarnessConnectivityFromVision(makeVision(
    [wire({ wireId: '' })],
  ));

  assert.ok(result);
  assert.equal(result!.wires[0].wireId, 'VIS_1');
});

// ---------------------------------------------------------------------------
// H. sourceRowIndex reflects original order
// ---------------------------------------------------------------------------

test('T10-H: sourceRowIndex matches original wire position', () => {
  const result = buildHarnessConnectivityFromVision(makeVision(
    [
      wire({ wireId: 'W1', from: { connectorId: 'J1', pin: '1' }, to: { terminalPartNumber: 'T1' } }),
      wire({ wireId: 'W2', from: { connectorId: 'J1', pin: '2' }, to: { terminalPartNumber: 'T2' } }),
    ],
  ));

  assert.ok(result);
  assert.equal(result!.wires[0].sourceRowIndex, 0);
  assert.equal(result!.wires[1].sourceRowIndex, 1);
});
