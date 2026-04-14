/**
 * C12.1 — Unit tests for scanForApogeePN45
 *
 * Tests the zone-priority, proximity-anchored 45-PN cluster search exported
 * from titleBlockRegionExtractor. These are pure function tests with no DB
 * or Next.js dependencies.
 *
 * Run with:
 *   npx tsx src/features/harness-work-instructions/services/__tests__/apogeeExtractor.test.ts
 *
 * Or with Node 22+ strip-types:
 *   node --experimental-strip-types src/features/harness-work-instructions/services/__tests__/apogeeExtractor.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanForApogeePN45 } from '../titleBlockRegionExtractor';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function lines(...args: string[]): string[] {
  return args;
}

// ---------------------------------------------------------------------------
// Strategy 1: DRN proximity — 45-PN within ±20 lines of DRN
// ---------------------------------------------------------------------------

test('finds 45-PN co-located with DRN (drn-proximity)', () => {
  const allLines = lines(
    'WIRE TABLE',
    '45-16851-08 20AWG WHT 2.5 J1/1',       // wire table row — noise word AWG
    '527-5236-010',                           // DRN at index 2
    'PART NO: 45-110858-10',                  // PN near DRN at index 3
    'SCALE 1:1',
  );
  const result = scanForApogeePN45(allLines, 2); // drnLineIdx = 2
  assert.equal(result.value, '45-110858-10');
  assert.equal(result.source, 'drn-proximity');
});

test('rejects wire-table 45-PN (AWG noise) and finds title block PN in proximity', () => {
  const allLines = lines(
    '45-16851-08 20AWG WHT',        // noise — AWG present, should be rejected
    '527-5236-010',                  // DRN at index 1
    'CUSTOMER PN: 45-110858-10',     // clean PN near DRN at index 2
  );
  const result = scanForApogeePN45(allLines, 1);
  assert.equal(result.value, '45-110858-10');
  assert.equal(result.source, 'drn-proximity');
});

test('rejects all wire-table hits (SPLICE noise), returns null when no clean PN exists', () => {
  const allLines = lines(
    '45-16851-08 SPLICE WHT',   // noise
    '527-5236-010',              // DRN at index 1
    '45-22345-02 SPLICE BLK',   // noise
  );
  const result = scanForApogeePN45(allLines, 1);
  assert.equal(result.value, null);
  assert.equal(result.source, null);
});

// ---------------------------------------------------------------------------
// Strategy 2: Last-40 zone (drnLineIdx = -1 → skip proximity)
// ---------------------------------------------------------------------------

test('falls back to last-40 zone when no DRN index provided', () => {
  // Build a 50-line array; put PN in the last 40
  const allLines: string[] = Array.from({ length: 12 }, (_, i) => `WIRE ${i}`);
  allLines.push('527-5236-010');      // index 12 — in the "first 13 lines"
  allLines.push('SCALE 1:1');
  // pad to 50 lines
  while (allLines.length < 48) allLines.push('FILLER');
  allLines.push('45-110858-10');      // index 48 — in last-40 range of 50 lines
  allLines.push('DRAWN BY JD');

  const result = scanForApogeePN45(allLines, -1); // no DRN proximity
  assert.equal(result.value, '45-110858-10');
  assert.equal(result.source, 'last40-zone');
});

// ---------------------------------------------------------------------------
// Strategy 3: First-40 zone fallback
// ---------------------------------------------------------------------------

test('falls back to first-40 when PN not in last-40', () => {
  // PN appears only in first 5 lines, not in last 40 of a 60-line array
  const allLines: string[] = ['45-110858-10'];    // index 0 — in first 40
  while (allLines.length < 60) allLines.push('FILLER');

  const result = scanForApogeePN45(allLines, -1);
  assert.equal(result.value, '45-110858-10');
  assert.equal(result.source, 'first40-zone');
});

// ---------------------------------------------------------------------------
// Strategy 4: Full-text fallback
// ---------------------------------------------------------------------------

test('falls back to full-text when PN only in the middle of a large document', () => {
  const allLines: string[] = Array.from({ length: 80 }, (_, i) => `FILLER ${i}`);
  allLines[40] = '45-110858-10'; // index 40 — not in first-40 or last-40 of 80

  const result = scanForApogeePN45(allLines, -1);
  assert.equal(result.value, '45-110858-10');
  assert.equal(result.source, 'full-text');
});

// ---------------------------------------------------------------------------
// Role preservation: 527 DRN must never be returned as 45 PN
// ---------------------------------------------------------------------------

test('527-pattern DRN is never matched by scanForApogeePN45', () => {
  const allLines = lines(
    '527-5236-010',     // DRN — must not match RHEEM_PN_IN_APOGEE_RE (different pattern)
    'SCALE 1:2',
  );
  const result = scanForApogeePN45(allLines, 0);
  assert.equal(result.value, null, '527 drawing number must never be returned as PN');
});

// ---------------------------------------------------------------------------
// Regression: Rheem customer drawing flow must not be affected
// ---------------------------------------------------------------------------

test('returns null for empty line set', () => {
  const result = scanForApogeePN45([], -1);
  assert.equal(result.value, null);
  assert.equal(result.source, null);
});

test('returns null when only HEAT SHRINK noise lines contain 45-pattern', () => {
  const allLines = lines(
    '45-16851-08 HEAT SHRINK 4.0 J2/3',
    '527-5236-010',
  );
  const result = scanForApogeePN45(allLines, 1);
  assert.equal(result.value, null);
});

// ---------------------------------------------------------------------------
// Live failing case: 527-5236-010 / 45-110858-10 / REV 00
// ---------------------------------------------------------------------------

test('live failing case: 45-110858-10 co-located with 527-5236-010', () => {
  // Simulate the realistic Apogee title block text cluster (bottom-right of PDF)
  const titleBlockLines = lines(
    'DATE     REV',
    '10/20/25  00',
    'DRAWN BY: J.DOE',
    'SCALE: 1:1',
    'CUSTOMER: RHEEM',
    '45-110858-10',      // customer PN
    '527-5236-010',      // drawing number — DRN
    'SHEET 1 OF 1',
  );
  const drnIdx = titleBlockLines.indexOf('527-5236-010'); // 6
  const result = scanForApogeePN45(titleBlockLines, drnIdx);
  assert.equal(result.value, '45-110858-10');
  assert.equal(result.source, 'drn-proximity');
});

// ---------------------------------------------------------------------------
// C12.2 — Coordinate-filtered crop OCR path
// ---------------------------------------------------------------------------

test('C12.2: OCR miss on full text — PN only visible in crop region text', () => {
  // Simulates the scenario where full-page OCR doesn't include the title block
  // (e.g. PDF renders the area as a graphical bitmap), but extractPDFRegionText
  // retrieves it via coordinate-filtered pdfjs text items.
  // The cropLines are what extractPDFRegionText would return for the title block.
  const cropLines = lines(
    '527-5236-010',     // DRN in the crop — acts as anchor (index -1 since no DRN index known at crop time)
    'CUSTOMER PN',
    '45-110858-10',     // PN only present in the crop
  );
  // drnLineIdx = -1: no DRN index pre-computed — falls through to zone strategies
  const result = scanForApogeePN45(cropLines, -1);
  assert.ok(result.value === '45-110858-10', `expected 45-110858-10, got ${result.value}`);
  assert.ok(result.source !== null, 'source must not be null for a successful match');
});

test('C12.2: crop region with only noise lines returns null', () => {
  // Wire table BOM lines should not yield a PN even in a crop
  const cropLines = lines(
    '45-16851-08 20AWG WHT J1/1',
    '45-22345-02 SPLICE BLK',
    '45-11011-01 HEAT SHRINK 4.0',
  );
  const result = scanForApogeePN45(cropLines, -1);
  assert.equal(result.value, null);
  assert.equal(result.source, null);
});

test('C12.2: empty crop region returns null safely', () => {
  const result = scanForApogeePN45([], -1);
  assert.equal(result.value, null);
  assert.equal(result.source, null);
});

test('C12.2: crop region with DRN proximity gives best result (drn-proximity preferred)', () => {
  // When DRN IS found in the crop at a known index, proximity beats zone strategies
  const cropLines = lines(
    '45-16851-08 20AWG RED',   // noise, should be rejected
    '527-5236-010',             // DRN at index 1
    '45-110858-10',             // PN adjacent to DRN — should be picked by proximity
  );
  const drnIdx = 1;
  const result = scanForApogeePN45(cropLines, drnIdx);
  assert.equal(result.value, '45-110858-10');
  assert.equal(result.source, 'drn-proximity');
});
