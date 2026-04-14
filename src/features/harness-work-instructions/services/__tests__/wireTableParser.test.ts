/**
 * T1 — Unit tests for wireTableParser and wireTableRegionExtractor
 *
 * Tests deterministic header detection, structured row parsing, multi-line
 * continuation, noise filtering, and edge cases.
 *
 * Run with:
 *   node --experimental-strip-types src/features/harness-work-instructions/services/__tests__/wireTableParser.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWireTableRows } from '../wireTableParser';
import { detectWireTableRegion } from '../wireTableRegionExtractor';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function lines(...args: string[]): string[] {
  return args;
}

// ---------------------------------------------------------------------------
// Region detection
// ---------------------------------------------------------------------------

test('T1 region: detects header with I.D. + LENGTH pattern', () => {
  const allLines = lines(
    'I.D.  LENGTH  GAUGE  COLOR  CONN  PIN  TERMINAL',
    'W1    12.5  20AWG  WHT  J1  3  929504-1',
    'W2    8.0   18AWG  RED  J2  1  929504-1',
    'DRAWN BY: J.DOE',
    '527-5236-010',
  );
  const result = detectWireTableRegion(allLines);
  assert.ok(result !== null, 'should detect wire table');
  assert.equal(result.headerLineIdx, 0);
  assert.ok(result.confidence >= 0.88, `confidence too low: ${result.confidence}`);
  assert.ok(result.bodyLines.length >= 2, 'should have at least 2 body lines');
  assert.equal(result.candidateRowCount, 2);
});

test('T1 region: stops body collection at DRAWN keyword', () => {
  const allLines = lines(
    'I.D.  LENGTH  GAUGE  COLOR',
    'W1  12.5  20AWG  WHT',
    'W2  8.0   18AWG  RED',
    'DRAWN BY: J.DOE',            // stop here
    'W3  5.0   20AWG  BLK',       // should NOT be in body
  );
  const result = detectWireTableRegion(allLines);
  assert.ok(result !== null, 'should detect wire table');
  const bodyHasW3 = result.bodyLines.some(l => l.includes('W3'));
  assert.equal(bodyHasW3, false, 'body should not contain lines past DRAWN');
});

test('T1 region: stops body collection at Apogee DRN anchor', () => {
  const allLines = lines(
    'I.D.  LENGTH  GAUGE  COLOR',
    'W1  12.5  20AWG  WHT',
    '527-5236-010',               // DRN anchor — stop
    'W2  8.0   18AWG  RED',       // should NOT be in body
  );
  const result = detectWireTableRegion(allLines);
  assert.ok(result !== null, 'should detect wire table');
  const bodyHasDRN = result.bodyLines.some(l => l.includes('527-'));
  assert.equal(bodyHasDRN, false, 'body should not contain DRN line');
  const bodyHasW2  = result.bodyLines.some(l => l.includes('W2'));
  assert.equal(bodyHasW2, false, 'body should not contain lines past DRN');
});

test('T1 region: returns null when no header found', () => {
  const allLines = lines(
    '45-110858-10',
    '527-5236-010',
    'DRAWN BY: J.DOE',
    'DATE 10/20/25',
  );
  const result = detectWireTableRegion(allLines);
  assert.equal(result, null, 'should return null when no wire table header');
});

test('T1 region: limits header search to first 65% of lines', () => {
  // Put a valid header far down (past 65%) — should NOT be detected
  const topNoise = Array.from({ length: 20 }, (_, i) => `NOISE LINE ${i}`);
  const header   = 'I.D.  LENGTH  GAUGE  COLOR';
  const body     = ['W1  12.5  20AWG  WHT'];
  const allLines = [...topNoise, ...Array.from({ length: 12 }, (_, i) => `FILLER ${i}`), header, ...body];
  // header is at index 32 out of 34 total lines = 94% — past the 65% limit
  const result = detectWireTableRegion(allLines);
  assert.equal(result, null, 'header past 65% threshold should not be detected');
});

// ---------------------------------------------------------------------------
// Row parsing
// ---------------------------------------------------------------------------

test('T1 parser: parses a complete wire row', () => {
  const body = lines('W1  12.5  20AWG  WHT  J1  3  929504-1');
  const result = parseWireTableRows(body);
  assert.equal(result.rowCount, 1);
  const row = result.rows[0];
  assert.equal(row.wireId,  'W1');
  assert.ok(row.length !== null, 'length should be parsed');
  assert.equal(row.gauge, '20');
  assert.equal(row.color, 'WHT');
  assert.equal(row.connectorRef, 'J1');
  assert.equal(row.terminal, '929504-1');
  assert.equal(row.rawText, 'W1  12.5  20AWG  WHT  J1  3  929504-1');
});

test('T1 parser: handles COM and GND as valid wire IDs', () => {
  const body = lines(
    'COM  6.0  20AWG  BLK  J3  6',
    'GND  3.0  18AWG  BLK  J1  1',
  );
  const result = parseWireTableRows(body);
  assert.equal(result.rowCount, 2);
  assert.equal(result.rows[0].wireId, 'COM');
  assert.equal(result.rows[1].wireId, 'GND');
});

test('T1 parser: handles Y-prefix wire IDs', () => {
  const body = lines('Y1  8.0  20AWG  YEL  P2  4');
  const result = parseWireTableRows(body);
  assert.equal(result.rowCount, 1);
  assert.equal(result.rows[0].wireId, 'Y1');
  assert.equal(result.rows[0].color, 'YEL');
});

test('T1 parser: multi-line row continuation fills missing fields', () => {
  const body = lines(
    'W1  12.5  20AWG  WHT',     // first line — no connector or terminal
    '    J1  3  929504-1',      // continuation — fills connectorRef + terminal
  );
  const result = parseWireTableRows(body);
  assert.equal(result.rowCount, 1, 'two physical lines should merge into one row');
  const row = result.rows[0];
  assert.equal(row.wireId,       'W1');
  assert.equal(row.gauge,        '20');
  assert.equal(row.connectorRef, 'J1');
  assert.equal(row.terminal,     '929504-1');
  assert.ok(row.rawText.includes('\n'), 'rawText should contain newline for multi-line row');
});

test('T1 parser: SPLICE treatment is captured', () => {
  const body = lines('W3  8.0  20AWG  RED  SPLICE');
  const result = parseWireTableRows(body);
  assert.equal(result.rowCount, 1);
  assert.equal(result.rows[0].treatment, 'SPLICE');
});

test('T1 parser: HEAT SHRINK treatment is captured', () => {
  const body = lines('W4  5.0  18AWG  BLK  HEAT SHRINK');
  const result = parseWireTableRows(body);
  assert.equal(result.rowCount, 1);
  assert.equal(result.rows[0].treatment, 'HEAT_SHRINK');
});

test('T1 parser: noise lines are excluded from rows', () => {
  const body = lines(
    'I.D.  LENGTH  GAUGE',       // header-only noise
    '--------------------',      // separator
    'DRAWN BY: J.DOE',           // annotation noise
    'W1  12.5  20AWG  WHT',      // valid row
  );
  const result = parseWireTableRows(body);
  assert.equal(result.rowCount, 1, 'only 1 real wire row');
  assert.ok(result.noiseLines >= 3, `noiseLines should be ≥3, got ${result.noiseLines}`);
});

test('T1 parser: empty input returns POOR quality with zero rows', () => {
  const result = parseWireTableRows([]);
  assert.equal(result.rowCount, 0);
  assert.equal(result.parseQuality, 'POOR');
  assert.equal(result.linesConsumed, 0);
});

test('T1 parser: parseQuality GOOD when majority of rows have gauge', () => {
  const body = lines(
    'W1  12.5  20AWG  WHT',
    'W2  8.0   18AWG  RED',
    'W3  5.0   20AWG  BLK',
    'W4  3.0   22AWG  GRN',
  );
  const result = parseWireTableRows(body);
  assert.equal(result.parseQuality, 'GOOD');
});

test('T1 parser: parseQuality POOR when no gauge fields present', () => {
  const body = lines(
    'W1  J1  3',
    'W2  J2  1',
  );
  const result = parseWireTableRows(body);
  // These lines have no AWG so gauge is null → POOR
  assert.equal(result.parseQuality, 'POOR');
});

test('T1 parser: multiple rows from realistic OCR snippet', () => {
  const body = lines(
    'W1   12.5  20AWG  WHT  J1  3  929504-1',
    'W2   8.0   20AWG  RED  J1  1  929504-1',
    'W3   6.0   20AWG  BLK  J2  4  929504-1',
    'W4   5.0   18AWG  GRN  J2  2  929504-1',
    'COM  4.0   20AWG  BLK  J3  6  929504-1',
  );
  const result = parseWireTableRows(body);
  assert.equal(result.rowCount, 5);
  assert.equal(result.parseQuality, 'GOOD');
  assert.equal(result.rows[4].wireId, 'COM');
  for (const row of result.rows) {
    assert.ok(row.rawText.length > 0, 'each row must have rawText');
    assert.ok(row.gauge !== null, `row ${row.wireId ?? '?'} should have gauge`);
  }
});
