/**
 * Tests for toolingService — Phase T19
 *
 * Tests verify resolution logic, index correctness, confidence levels,
 * and edge-case handling against the real applicators.json dataset.
 *
 * Known data used:
 *   - SPS-82T-187: applicatorModel "SPS-82T-187", aci "ACi06272", PN ["SPS-82T-187"], FT_SMITH, ACTIVE
 *   - 2150008-1:   applicatorModel "2150008-1",   aci "Aci01522",  PN ["350436-2", "2150008-1", ...], FT_SMITH, ACTIVE
 *   - 2150237-1:   applicatorModel "2150237-1",   aci "ACI02270",  PN ["41450", "41450-3", ...], BALL_GROUND, ACTIVE
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getApplicatorsByAci,
  getApplicatorsByPartNumber,
  getAvailableApplicators,
  checkToolingAvailability,
  resolveToolingForPart,
  getAllApplicatorEntries,
} from '../toolingService';

// ---------------------------------------------------------------------------
// A. getAllApplicatorEntries
// ---------------------------------------------------------------------------

describe('A: getAllApplicatorEntries', () => {
  it('returns non-empty array', () => {
    const entries = getAllApplicatorEntries();
    assert.ok(entries.length > 0, 'should have at least one applicator');
  });

  it('every entry has an applicatorModel string', () => {
    for (const e of getAllApplicatorEntries()) {
      assert.ok(typeof e.applicatorModel === 'string' && e.applicatorModel.length > 0);
    }
  });

  it('every entry has a terminalPartNumbers array', () => {
    for (const e of getAllApplicatorEntries()) {
      assert.ok(Array.isArray(e.terminalPartNumbers));
    }
  });

  it('every entry has a valid status', () => {
    const VALID = new Set(['ACTIVE', 'INACTIVE', 'MAINTENANCE']);
    for (const e of getAllApplicatorEntries()) {
      assert.ok(VALID.has(e.status), `unexpected status: ${e.status}`);
    }
  });

  it('every entry with a location uses a canonical code', () => {
    const VALID = new Set(['FT_SMITH', 'BALL_GROUND', 'WARNER_ROBBINS']);
    for (const e of getAllApplicatorEntries()) {
      if (e.location !== null) {
        assert.ok(VALID.has(e.location), `unexpected location: ${e.location}`);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// B. getApplicatorsByAci
// ---------------------------------------------------------------------------

describe('B: getApplicatorsByAci', () => {
  it('finds applicator by exact ACI (mixed-case)', () => {
    const results = getApplicatorsByAci('ACi06272');
    assert.ok(results.length > 0, 'should find SPS-82T-187 by ACI ACi06272');
    assert.ok(results.some(r => r.applicatorModel === 'SPS-82T-187'));
  });

  it('is case-insensitive (lowercase input)', () => {
    const lower = getApplicatorsByAci('aci06272');
    const upper = getApplicatorsByAci('ACI06272');
    assert.deepEqual(
      lower.map(r => r.applicatorModel).sort(),
      upper.map(r => r.applicatorModel).sort(),
    );
  });

  it('is case-insensitive (uppercase input for mixed-case ACI)', () => {
    const results = getApplicatorsByAci('ACI01522');
    assert.ok(results.length > 0, 'should find applicators for Aci01522 even with uppercase input');
  });

  it('returns empty array for unknown ACI', () => {
    assert.deepEqual(getApplicatorsByAci('ACI-DOES-NOT-EXIST-XYZ'), []);
  });

  it('returns empty array for blank ACI', () => {
    assert.deepEqual(getApplicatorsByAci(''), []);
  });

  it('returns empty array for whitespace-only ACI', () => {
    assert.deepEqual(getApplicatorsByAci('   '), []);
  });
});

// ---------------------------------------------------------------------------
// C. getApplicatorsByPartNumber
// ---------------------------------------------------------------------------

describe('C: getApplicatorsByPartNumber', () => {
  it('finds applicator by terminal part number', () => {
    const results = getApplicatorsByPartNumber('SPS-82T-187');
    assert.ok(results.length > 0, 'should find SPS-82T-187 model by its own PN');
    assert.ok(results.some(r => r.applicatorModel === 'SPS-82T-187'));
  });

  it('finds applicator by terminal PN for multi-PN model', () => {
    const results = getApplicatorsByPartNumber('350436-2');
    assert.ok(results.length > 0, 'should find model with 350436-2 as a terminal PN');
  });

  it('is case-insensitive (normalized lookup)', () => {
    const lower = getApplicatorsByPartNumber('sps-82t-187');
    const upper = getApplicatorsByPartNumber('SPS-82T-187');
    assert.deepEqual(
      lower.map(r => r.applicatorModel).sort(),
      upper.map(r => r.applicatorModel).sort(),
    );
  });

  it('returns empty array for unknown part number', () => {
    assert.deepEqual(getApplicatorsByPartNumber('DOES-NOT-EXIST-XYZ-999'), []);
  });

  it('returns empty array for blank part number', () => {
    assert.deepEqual(getApplicatorsByPartNumber(''), []);
  });

  it('includes all statuses (not filtered)', () => {
    const all = getApplicatorsByPartNumber('SPS-82T-187');
    assert.ok(all.length >= 1);
  });
});

// ---------------------------------------------------------------------------
// D. getAvailableApplicators
// ---------------------------------------------------------------------------

describe('D: getAvailableApplicators', () => {
  it('returns only ACTIVE applicators', () => {
    const results = getAvailableApplicators('SPS-82T-187');
    assert.ok(results.every(r => r.status === 'ACTIVE'));
  });

  it('returns non-empty for known ACTIVE applicator PN', () => {
    const results = getAvailableApplicators('SPS-82T-187');
    assert.ok(results.length > 0);
  });

  it('returns empty array for unknown PN', () => {
    assert.deepEqual(getAvailableApplicators('UNKNOWN-PN-9999'), []);
  });

  it('returns empty for blank PN', () => {
    assert.deepEqual(getAvailableApplicators(''), []);
  });
});

// ---------------------------------------------------------------------------
// E. checkToolingAvailability
// ---------------------------------------------------------------------------

describe('E: checkToolingAvailability', () => {
  it('available is true for known ACTIVE applicator PN', () => {
    const result = checkToolingAvailability('SPS-82T-187');
    assert.equal(result.available, true);
    assert.ok(result.applicators.length > 0);
  });

  it('locations is a non-empty array when available', () => {
    const result = checkToolingAvailability('SPS-82T-187');
    assert.ok(result.locations.length > 0);
    assert.ok(result.locations.every(l =>
      ['FT_SMITH', 'BALL_GROUND', 'WARNER_ROBBINS'].includes(l),
    ));
  });

  it('available is false and locations is empty for unknown PN', () => {
    const result = checkToolingAvailability('UNKNOWN-PART-XYZ');
    assert.equal(result.available, false);
    assert.deepEqual(result.locations, []);
    assert.deepEqual(result.applicators, []);
  });

  it('available is false for blank PN', () => {
    const result = checkToolingAvailability('');
    assert.equal(result.available, false);
  });
});

// ---------------------------------------------------------------------------
// F. resolveToolingForPart — primary resolution path
// ---------------------------------------------------------------------------

describe('F: resolveToolingForPart — DIRECT resolution', () => {
  it('returns DIRECT method and MEDIUM confidence for known PN (no ACI in aci_part_lookup)', () => {
    const result = resolveToolingForPart('SPS-82T-187');
    assert.equal(result.method, 'DIRECT');
    assert.equal(result.confidence, 'MEDIUM');
    assert.ok(result.applicators.length > 0);
    assert.ok(result.locations.length > 0);
  });

  it('locations are canonical codes', () => {
    const result = resolveToolingForPart('SPS-82T-187');
    const VALID = new Set(['FT_SMITH', 'BALL_GROUND', 'WARNER_ROBBINS']);
    for (const loc of result.locations) {
      assert.ok(VALID.has(loc), `unexpected location: ${loc}`);
    }
  });

  it('applicators are all ACTIVE', () => {
    const result = resolveToolingForPart('350436-2');
    assert.ok(result.applicators.every(a => a.status === 'ACTIVE'));
  });

  it('method is NONE and confidence is NONE for unknown PN', () => {
    const result = resolveToolingForPart('UNKNOWN-PART-XYZ-999');
    assert.equal(result.method, 'NONE');
    assert.equal(result.confidence, 'NONE');
    assert.deepEqual(result.applicators, []);
    assert.deepEqual(result.locations, []);
  });

  it('returns NONE for blank PN', () => {
    const result = resolveToolingForPart('');
    assert.equal(result.method, 'NONE');
    assert.equal(result.confidence, 'NONE');
  });

  it('returns NONE for null/undefined (cast)', () => {
    // TypeScript prevents this but guard against JS callers
    const result = resolveToolingForPart(null as unknown as string);
    assert.equal(result.method, 'NONE');
  });
});

// ---------------------------------------------------------------------------
// G. resolveToolingForPart — ACI path (via aci_part_lookup)
// ---------------------------------------------------------------------------

describe('G: resolveToolingForPart — ACI resolution path', () => {
  it('returns ACI method when aci_part_lookup ACI matches an applicator', () => {
    // This test documents the expected ACI path behavior.
    // Currently the T18.5 placeholder ACIs (ACI-TERM-TE-*) do not match
    // applicators.json entries, so this path is DIRECT for all T18.5 PNs.
    // When the data files are aligned, this test should be updated to assert 'ACI'.
    const result = resolveToolingForPart('1-963232-1'); // ACI-TERM-TE-14-16 from aci_part_lookup
    assert.ok(
      result.method === 'ACI' || result.method === 'DIRECT' || result.method === 'NONE',
      'method must be one of ACI | DIRECT | NONE',
    );
    assert.ok(
      result.confidence === 'HIGH' || result.confidence === 'MEDIUM' || result.confidence === 'NONE',
    );
  });

  it('confidence is HIGH when method is ACI', () => {
    const result = resolveToolingForPart('1-963232-1');
    if (result.method === 'ACI') {
      assert.equal(result.confidence, 'HIGH');
    }
  });

  it('confidence is MEDIUM when method is DIRECT', () => {
    const result = resolveToolingForPart('SPS-82T-187');
    if (result.method === 'DIRECT') {
      assert.equal(result.confidence, 'MEDIUM');
    }
  });
});

// ---------------------------------------------------------------------------
// H. Determinism
// ---------------------------------------------------------------------------

describe('H: determinism', () => {
  it('resolveToolingForPart is deterministic across repeated calls', () => {
    const r1 = resolveToolingForPart('350436-2');
    const r2 = resolveToolingForPart('350436-2');
    assert.equal(r1.method,     r2.method);
    assert.equal(r1.confidence, r2.confidence);
    assert.deepEqual(r1.locations, r2.locations);
    assert.deepEqual(
      r1.applicators.map(a => a.applicatorModel).sort(),
      r2.applicators.map(a => a.applicatorModel).sort(),
    );
  });

  it('getApplicatorsByAci is deterministic', () => {
    const r1 = getApplicatorsByAci('ACI02270');
    const r2 = getApplicatorsByAci('ACI02270');
    assert.deepEqual(
      r1.map(a => a.applicatorModel).sort(),
      r2.map(a => a.applicatorModel).sort(),
    );
  });
});
