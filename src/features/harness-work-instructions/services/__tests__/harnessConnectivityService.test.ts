/**
 * T2 — Unit tests for harnessConnectivityService.buildHarnessConnectivity
 *
 * Tests from/to endpoint mapping, ambiguity detection, confidence scoring,
 * summary computation, and edge cases.
 *
 * Run with:
 *   node --experimental-strip-types src/features/harness-work-instructions/services/__tests__/harnessConnectivityService.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildHarnessConnectivity } from '../harnessConnectivityService';
import type { WireRow } from '../wireTableParser';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function row(overrides: Partial<WireRow> & { wireId: string }): WireRow {
  return {
    wireId:       overrides.wireId,
    length:       overrides.length ?? null,
    gauge:        overrides.gauge ?? null,
    color:        overrides.color ?? null,
    connectorRef: overrides.connectorRef ?? null,
    pin:          overrides.pin ?? null,
    treatment:    overrides.treatment ?? null,
    terminal:     overrides.terminal ?? null,
    rawText:      overrides.rawText ?? `${overrides.wireId} raw`,
  };
}

// ---------------------------------------------------------------------------
// Basic from/to mapping
// ---------------------------------------------------------------------------

test('T2: simple row maps connectorRef → from.component, terminal → to.component', () => {
  const result = buildHarnessConnectivity([
    row({ wireId: 'W1', length: 12.5, gauge: '20', color: 'WHT', connectorRef: 'J1', pin: '3', terminal: '929504-1', rawText: 'W1 12.5 20AWG WHT J1 PIN 3 929504-1' }),
  ]);

  assert.equal(result.wires.length, 1);
  const w = result.wires[0];
  assert.equal(w.wireId, 'W1');
  assert.equal(w.from.component, 'J1');
  assert.equal(w.from.cavity, '3');
  assert.equal(w.to.component, '929504-1');
  assert.equal(w.unresolved, false);
  assert.equal(result.confidenceSummary.resolved, 1);
});

test('T2: two simple wires both resolve', () => {
  const result = buildHarnessConnectivity([
    row({ wireId: 'W1', gauge: '20', connectorRef: 'J1', pin: '1', terminal: '929504-1', rawText: 'W1 20AWG J1 PIN 1 929504-1' }),
    row({ wireId: 'W2', gauge: '18', connectorRef: 'J2', pin: '2', terminal: '929504-1', rawText: 'W2 18AWG J2 PIN 2 929504-1' }),
  ]);

  assert.equal(result.confidenceSummary.total, 2);
  assert.equal(result.confidenceSummary.resolved, 2);
  assert.equal(result.confidenceSummary.unresolved, 0);
});

// ---------------------------------------------------------------------------
// Missing fields → partial
// ---------------------------------------------------------------------------

test('T2: missing terminal → partial, confidence reduced', () => {
  const result = buildHarnessConnectivity([
    row({ wireId: 'W1', gauge: '20', connectorRef: 'J1', pin: '3', rawText: 'W1 20AWG J1 PIN 3' }),
  ]);

  const w = result.wires[0];
  assert.equal(w.to.component, null);
  assert.equal(w.unresolved, false);
  assert.equal(result.confidenceSummary.partial, 1);
  // missing terminal = −0.3 → confidence 0.7
  assert.ok(w.confidence <= 0.71 && w.confidence >= 0.69, `confidence should be ~0.7, got ${w.confidence}`);
});

test('T2: missing gauge reduces confidence by 0.1', () => {
  const result = buildHarnessConnectivity([
    row({ wireId: 'W1', connectorRef: 'J1', pin: '1', terminal: '929504-1', rawText: 'W1 J1 PIN 1 929504-1' }),
  ]);

  const w = result.wires[0];
  assert.ok(w.confidence <= 0.91 && w.confidence >= 0.89, `confidence should be ~0.9, got ${w.confidence}`);
});

test('T2: missing pin reduces confidence by 0.2', () => {
  const result = buildHarnessConnectivity([
    row({ wireId: 'W1', gauge: '20', connectorRef: 'J1', terminal: '929504-1', rawText: 'W1 20AWG J1 929504-1' }),
  ]);

  const w = result.wires[0];
  // missing pin = −0.2 → 0.8
  assert.ok(w.confidence <= 0.81 && w.confidence >= 0.79, `confidence should be ~0.8, got ${w.confidence}`);
});

// ---------------------------------------------------------------------------
// Ambiguity / unresolved
// ---------------------------------------------------------------------------

test('T2: COM wire → unresolved', () => {
  const result = buildHarnessConnectivity([
    row({ wireId: 'COM', gauge: '20', color: 'BLK', connectorRef: 'J3', pin: '6', rawText: 'COM 20AWG BLK J3 6' }),
  ]);

  const w = result.wires[0];
  assert.equal(w.unresolved, true);
  assert.equal(result.confidenceSummary.unresolved, 1);
  assert.ok(result.unresolvedWires.includes('COM'));
});

test('T2: GND wire → unresolved', () => {
  const result = buildHarnessConnectivity([
    row({ wireId: 'GND', gauge: '18', color: 'BLK', rawText: 'GND 18AWG BLK' }),
  ]);

  assert.equal(result.wires[0].unresolved, true);
  assert.ok(result.unresolvedWires.includes('GND'));
});

test('T2: SHLD wire → unresolved', () => {
  const result = buildHarnessConnectivity([
    row({ wireId: 'SHLD', gauge: '22', rawText: 'SHLD 22AWG' }),
  ]);

  assert.equal(result.wires[0].unresolved, true);
});

test('T2: SPLICE treatment → unresolved', () => {
  const result = buildHarnessConnectivity([
    row({ wireId: 'W3', gauge: '20', treatment: 'SPLICE', connectorRef: 'J1', pin: '4', rawText: 'W3 20AWG J1 PIN 4 SPLICE' }),
  ]);

  assert.equal(result.wires[0].unresolved, true);
  assert.equal(result.wires[0].from.treatment, 'SPLICE');
});

test('T2: HEAT_SHRINK treatment → unresolved', () => {
  const result = buildHarnessConnectivity([
    row({ wireId: 'W4', gauge: '18', treatment: 'HEAT_SHRINK', connectorRef: 'J2', rawText: 'W4 18AWG J2 HEAT SHRINK' }),
  ]);

  assert.equal(result.wires[0].unresolved, true);
});

test('T2: multiple terminals in rawText → unresolved', () => {
  const result = buildHarnessConnectivity([
    row({
      wireId: 'W5',
      gauge: '20',
      connectorRef: 'J1',
      pin: '1',
      terminal: '929504-1',
      rawText: 'W5 20AWG J1 PIN 1 929504-1 1-1293578-4',
    }),
  ]);

  const w = result.wires[0];
  assert.equal(w.unresolved, true, 'multiple terminals should flag unresolved');
  assert.ok(result.unresolvedWires.includes('W5'));
});

// ---------------------------------------------------------------------------
// Phoenix detection
// ---------------------------------------------------------------------------

test('T2: Phoenix keyword in rawText → from.component', () => {
  const result = buildHarnessConnectivity([
    row({ wireId: 'W6', gauge: '20', terminal: '929504-1', rawText: 'W6 20AWG PHOENIX 929504-1' }),
  ]);

  assert.equal(result.wires[0].from.component, 'PHOENIX');
});

test('T2: Phoenix PN (17xxxxx) in rawText → from.component', () => {
  const result = buildHarnessConnectivity([
    row({ wireId: 'W7', gauge: '20', terminal: '929504-1', rawText: 'W7 20AWG 1700443 929504-1' }),
  ]);

  assert.equal(result.wires[0].from.component, 'PHOENIX_1700443');
});

test('T2: connectorRef takes priority over Phoenix detection', () => {
  const result = buildHarnessConnectivity([
    row({ wireId: 'W8', gauge: '20', connectorRef: 'J1', terminal: '929504-1', rawText: 'W8 20AWG J1 PHOENIX 929504-1' }),
  ]);

  // connectorRef J1 is explicit → from.component = J1, not Phoenix
  assert.equal(result.wires[0].from.component, 'J1');
});

// ---------------------------------------------------------------------------
// Confidence scoring
// ---------------------------------------------------------------------------

test('T2: fully complete row → confidence 1.0', () => {
  const result = buildHarnessConnectivity([
    row({ wireId: 'W1', gauge: '20', connectorRef: 'J1', pin: '1', terminal: '929504-1', rawText: 'W1 20AWG J1 PIN 1 929504-1' }),
  ]);

  assert.equal(result.wires[0].confidence, 1.0);
});

test('T2: all fields missing except wireId → confidence clamped at 0.0', () => {
  const result = buildHarnessConnectivity([
    row({ wireId: 'COM', rawText: 'COM' }),
  ]);

  // missing gauge −0.1, missing pin −0.2, missing terminal −0.3, unresolved(COM) −0.4 = −1.0 → clamped 0.0
  assert.equal(result.wires[0].confidence, 0.0);
});

// ---------------------------------------------------------------------------
// Summary computation
// ---------------------------------------------------------------------------

test('T2: mixed rows produce correct summary', () => {
  const result = buildHarnessConnectivity([
    row({ wireId: 'W1', gauge: '20', connectorRef: 'J1', pin: '1', terminal: '929504-1', rawText: 'W1 20AWG J1 PIN 1 929504-1' }),
    row({ wireId: 'W2', gauge: '18', connectorRef: 'J2', pin: '2', rawText: 'W2 18AWG J2 PIN 2' }),
    row({ wireId: 'COM', gauge: '20', color: 'BLK', rawText: 'COM 20AWG BLK' }),
  ]);

  assert.equal(result.confidenceSummary.total, 3);
  assert.equal(result.confidenceSummary.resolved, 1);    // W1
  assert.equal(result.confidenceSummary.partial, 1);      // W2 (missing terminal)
  assert.equal(result.confidenceSummary.unresolved, 1);   // COM
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

test('T2: empty input → empty result', () => {
  const result = buildHarnessConnectivity([]);

  assert.equal(result.wires.length, 0);
  assert.equal(result.unresolvedWires.length, 0);
  assert.equal(result.confidenceSummary.total, 0);
  assert.equal(result.confidenceSummary.resolved, 0);
});

test('T2: row with null wireId gets synthetic ID', () => {
  const result = buildHarnessConnectivity([
    row({ wireId: null as unknown as string, gauge: '20', rawText: '20AWG WHT' }),
  ]);

  assert.equal(result.wires[0].wireId, 'UNK_1');
});

test('T2: sourceRowIndex preserved for each wire', () => {
  const result = buildHarnessConnectivity([
    row({ wireId: 'W1', rawText: 'W1' }),
    row({ wireId: 'W2', rawText: 'W2' }),
    row({ wireId: 'W3', rawText: 'W3' }),
  ]);

  assert.equal(result.wires[0].sourceRowIndex, 0);
  assert.equal(result.wires[1].sourceRowIndex, 1);
  assert.equal(result.wires[2].sourceRowIndex, 2);
});

test('T2: rawText is preserved for evidence', () => {
  const rawInput = 'W1  12.5  20AWG  WHT  J1  PIN 3  929504-1';
  const result = buildHarnessConnectivity([
    row({ wireId: 'W1', rawText: rawInput }),
  ]);

  assert.equal(result.wires[0].rawText, rawInput);
});

test('T2: realistic 5-wire table', () => {
  const result = buildHarnessConnectivity([
    row({ wireId: 'W1', length: 12.5, gauge: '20', color: 'WHT', connectorRef: 'J1', pin: '3', terminal: '929504-1', rawText: 'W1 12.5 20AWG WHT J1 PIN 3 929504-1' }),
    row({ wireId: 'W2', length: 8.0, gauge: '20', color: 'RED', connectorRef: 'J1', pin: '1', terminal: '929504-1', rawText: 'W2 8.0 20AWG RED J1 PIN 1 929504-1' }),
    row({ wireId: 'W3', length: 6.0, gauge: '20', color: 'BLK', connectorRef: 'J2', pin: '4', terminal: '929504-1', rawText: 'W3 6.0 20AWG BLK J2 PIN 4 929504-1' }),
    row({ wireId: 'W4', length: 5.0, gauge: '18', color: 'GRN', connectorRef: 'J2', pin: '2', terminal: '929504-1', rawText: 'W4 5.0 18AWG GRN J2 PIN 2 929504-1' }),
    row({ wireId: 'COM', length: 4.0, gauge: '20', color: 'BLK', connectorRef: 'J3', pin: '6', terminal: '929504-1', rawText: 'COM 4.0 20AWG BLK J3 PIN 6 929504-1' }),
  ]);

  assert.equal(result.wires.length, 5);
  assert.equal(result.confidenceSummary.resolved, 4);    // W1–W4
  assert.equal(result.confidenceSummary.unresolved, 1);   // COM
  assert.ok(result.unresolvedWires.includes('COM'));

  for (const w of result.wires) {
    assert.ok(w.rawText.length > 0, `wire ${w.wireId} must have rawText`);
    assert.ok(typeof w.sourceRowIndex === 'number');
  }
});
