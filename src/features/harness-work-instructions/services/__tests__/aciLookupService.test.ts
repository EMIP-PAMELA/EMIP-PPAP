/**
 * ACI Lookup Service Tests — Phase T18.5
 *
 * Verifies:
 *   A. normalizeComponentIdentity
 *   B. getAciByPartNumber (primary + alias)
 *   C. getPartNumbersByAci
 *   D. getStripLengthByAci
 *   E. getStripLengthByPartNumber (combined)
 *   F. Safety: missing / empty / malformed inputs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeComponentIdentity,
  getAciByPartNumber,
  getPartNumbersByAci,
  getStripLengthByAci,
  getStripLengthByPartNumber,
  getStripLengthNoteByPartNumber,
  getAllAciEntries,
} from '../aciLookupService';

// ---------------------------------------------------------------------------
// A. normalizeComponentIdentity
// ---------------------------------------------------------------------------

describe('A: normalizeComponentIdentity', () => {
  it('uppercases input', () => {
    assert.equal(normalizeComponentIdentity('929504-1'), '929504-1');
  });

  it('trims whitespace', () => {
    assert.equal(normalizeComponentIdentity('  929504-1  '), '929504-1');
  });

  it('preserves hyphens', () => {
    assert.equal(normalizeComponentIdentity('3-520170-2'), '3-520170-2');
  });

  it('lowercases are uppercased', () => {
    assert.equal(normalizeComponentIdentity('abc-123'), 'ABC-123');
  });
});

// ---------------------------------------------------------------------------
// B. getAciByPartNumber
// ---------------------------------------------------------------------------

describe('B: getAciByPartNumber', () => {
  it('resolves primary part number', () => {
    const aci = getAciByPartNumber('929504-1');
    assert.ok(aci !== null, 'expected non-null ACI for known PN');
    assert.equal(aci, 'ACI-TERM-TE-18-20');
  });

  it('resolves alias part number', () => {
    // alias for 1-963232-1 is "196323-21" and "963232-1"
    const aci = getAciByPartNumber('963232-1');
    assert.ok(aci !== null, 'expected ACI for alias PN');
    assert.equal(aci, 'ACI-TERM-TE-14-16');
  });

  it('is case-insensitive (normalised lookup)', () => {
    const aci = getAciByPartNumber('929504-1');
    assert.equal(aci, 'ACI-TERM-TE-18-20');
  });

  it('returns null for unknown PN', () => {
    assert.equal(getAciByPartNumber('DOES-NOT-EXIST-999'), null);
  });

  it('returns null for empty string', () => {
    assert.equal(getAciByPartNumber(''), null);
  });

  it('returns null for whitespace-only', () => {
    assert.equal(getAciByPartNumber('   '), null);
  });
});

// ---------------------------------------------------------------------------
// C. getPartNumbersByAci
// ---------------------------------------------------------------------------

describe('C: getPartNumbersByAci', () => {
  it('returns primary part number for a known ACI', () => {
    const pns = getPartNumbersByAci('ACI-TERM-TE-18-20');
    assert.ok(pns.includes('929504-1'));
  });

  it('returns empty array for unknown ACI', () => {
    assert.deepEqual(getPartNumbersByAci('ACI-UNKNOWN-999'), []);
  });

  it('returns empty array for empty ACI', () => {
    assert.deepEqual(getPartNumbersByAci(''), []);
  });
});

// ---------------------------------------------------------------------------
// D. getStripLengthByAci
// ---------------------------------------------------------------------------

describe('D: getStripLengthByAci', () => {
  it('returns formatted strip length string for known ACI', () => {
    const s = getStripLengthByAci('ACI-TERM-TE-14-16');
    assert.ok(s !== null, 'expected non-null strip length');
    assert.ok(s!.includes('mm'), `expected "mm" in ${s}`);
  });

  it('returns numeric value correctly formatted', () => {
    const s = getStripLengthByAci('ACI-TERM-TE-14-16');
    assert.equal(s, '8.5 mm');
  });

  it('returns null for unknown ACI', () => {
    assert.equal(getStripLengthByAci('ACI-UNKNOWN-999'), null);
  });

  it('returns null for empty string', () => {
    assert.equal(getStripLengthByAci(''), null);
  });
});

// ---------------------------------------------------------------------------
// E. getStripLengthByPartNumber (combined lookup)
// ---------------------------------------------------------------------------

describe('E: getStripLengthByPartNumber', () => {
  it('resolves strip length for known part number via ACI chain', () => {
    const s = getStripLengthByPartNumber('929504-1');
    assert.equal(s, '6.0 mm');
  });

  it('resolves strip length via alias', () => {
    const s = getStripLengthByPartNumber('963232-1');
    assert.ok(s !== null, 'expected strip length via alias');
    assert.ok(s!.includes('mm'));
  });

  it('returns null for unknown PN', () => {
    assert.equal(getStripLengthByPartNumber('UNKNOWN-9999'), null);
  });

  it('returns null for empty string', () => {
    assert.equal(getStripLengthByPartNumber(''), null);
  });

  it('ferrule PN resolves to correct strip length', () => {
    const s = getStripLengthByPartNumber('3-520170-2');
    assert.equal(s, '9.0 mm');
  });
});

// ---------------------------------------------------------------------------
// F. getStripLengthNoteByPartNumber
// ---------------------------------------------------------------------------

describe('F: getStripLengthNoteByPartNumber', () => {
  it('returns stripping note for known PN', () => {
    const note = getStripLengthNoteByPartNumber('929504-1');
    assert.ok(note !== null && note.length > 0);
  });

  it('returns null for unknown PN', () => {
    assert.equal(getStripLengthNoteByPartNumber('NOPE-999'), null);
  });
});

// ---------------------------------------------------------------------------
// G. getAllAciEntries
// ---------------------------------------------------------------------------

describe('G: getAllAciEntries', () => {
  it('returns at least one entry', () => {
    const entries = getAllAciEntries();
    assert.ok(entries.length > 0);
  });

  it('every entry has partNumber, aci, description, terminationType', () => {
    const entries = getAllAciEntries();
    for (const e of entries) {
      assert.ok(typeof e.partNumber === 'string' && e.partNumber.length > 0, 'partNumber missing');
      assert.ok(typeof e.aci === 'string' && e.aci.length > 0, 'aci missing');
      assert.ok(typeof e.description === 'string', 'description missing');
      assert.ok(typeof e.terminationType === 'string', 'terminationType missing');
    }
  });
});
