/**
 * Tests for skuAuditService — Phase T17.5
 *
 * Covers:
 *   A. normalizeSkuKey — key normalisation rules
 *   B. buildAuditEvent — event construction (id + timestamp auto-generation)
 *   C. buildAuditSnapshot — snapshot construction
 *   D. sortEventsByTimestamp — deterministic ordering
 *   E. SKU scoping — different keys produce distinct groupings
 *   F. buildWireDiffSummary — wire-level diff strings
 *   G. buildSkuAuditSummary — lifecycle summary text
 *   H. Integration shape — operator action event input is correctly formed
 *
 * NO DB calls are made. skuAuditService uses lazy Supabase import (inside
 * async functions only), so this module is safe to import in node:test.
 */

import { describe, it } from 'node:test';
import assert from 'assert/strict';

import {
  normalizeSkuKey,
  buildAuditEvent,
  buildAuditSnapshot,
  sortEventsByTimestamp,
  buildWireDiffSummary,
  buildSkuAuditSummary,
} from '../skuAuditService';
import type { SkuAuditEvent, SkuAuditEventInput } from '@/src/features/harness-work-instructions/types/skuAudit';

// ---------------------------------------------------------------------------
// A. normalizeSkuKey
// ---------------------------------------------------------------------------

describe('skuAuditService', () => {
  describe('A: normalizeSkuKey', () => {
    it('trims leading and trailing whitespace', () => {
      assert.equal(normalizeSkuKey('  PN-123  '), 'PN-123');
    });

    it('preserves inner whitespace (part numbers may contain spaces)', () => {
      assert.equal(normalizeSkuKey(' PN 123 '), 'PN 123');
    });

    it('preserves casing', () => {
      assert.equal(normalizeSkuKey('  pn-abc-XYZ  '), 'pn-abc-XYZ');
    });

    it('returns empty string for blank input', () => {
      assert.equal(normalizeSkuKey('   '), '');
    });

    it('does not mutate already-clean keys', () => {
      assert.equal(normalizeSkuKey('PN-001'), 'PN-001');
    });
  });

  // -------------------------------------------------------------------------
  // B. buildAuditEvent
  // -------------------------------------------------------------------------

  describe('B: buildAuditEvent — event construction', () => {
    const base: SkuAuditEventInput = {
      skuKey:    '  PN-001  ',
      eventType: 'SKU_WIRE_ADDED',
      actorType: 'UNKNOWN',
      actorName: 'Unknown Operator',
      summary:   'Wire added: W5',
    };

    it('normalises skuKey on construction', () => {
      const ev = buildAuditEvent(base);
      assert.equal(ev.skuKey, 'PN-001');
    });

    it('auto-generates id when not supplied', () => {
      const ev = buildAuditEvent(base);
      assert.ok(ev.id, 'id should be truthy');
      assert.match(ev.id, /^[0-9a-f-]{36}$/, 'id should look like a UUID');
    });

    it('preserves supplied id', () => {
      const ev = buildAuditEvent({ ...base, id: 'fixed-id' });
      assert.equal(ev.id, 'fixed-id');
    });

    it('auto-generates ISO timestamp when not supplied', () => {
      const before = new Date().toISOString();
      const ev = buildAuditEvent(base);
      const after = new Date().toISOString();
      assert.ok(ev.timestamp >= before, 'timestamp should be >= before');
      assert.ok(ev.timestamp <= after,  'timestamp should be <= after');
    });

    it('preserves supplied timestamp', () => {
      const ts = '2025-01-01T00:00:00.000Z';
      const ev = buildAuditEvent({ ...base, timestamp: ts });
      assert.equal(ev.timestamp, ts);
    });

    it('defaults optional fields to null', () => {
      const ev = buildAuditEvent(base);
      assert.equal(ev.reason,               null);
      assert.equal(ev.payload,              null);
      assert.equal(ev.beforeState,          null);
      assert.equal(ev.afterState,           null);
      assert.equal(ev.sourceArtifactIds,    null);
      assert.equal(ev.generatedArtifactIds, null);
    });

    it('preserves supplied optional fields', () => {
      const ev = buildAuditEvent({
        ...base,
        reason:      'Operator correction',
        payload:     { wireId: 'W5' },
        beforeState: { count: 4 },
        afterState:  { count: 5 },
      });
      assert.equal(ev.reason, 'Operator correction');
      assert.deepEqual(ev.payload, { wireId: 'W5' });
      assert.deepEqual(ev.beforeState, { count: 4 });
      assert.deepEqual(ev.afterState,  { count: 5 });
    });
  });

  // -------------------------------------------------------------------------
  // C. buildAuditSnapshot
  // -------------------------------------------------------------------------

  describe('C: buildAuditSnapshot — snapshot construction', () => {
    it('auto-generates id and timestamp', () => {
      const snap = buildAuditSnapshot({
        skuKey:         'PN-001',
        snapshotType:   'INGESTION_BASELINE',
        effectiveState: { wireCount: 3 },
        summary:        'Baseline after ingestion',
      });
      assert.ok(snap.id);
      assert.ok(snap.timestamp);
      assert.equal(snap.snapshotType, 'INGESTION_BASELINE');
      assert.equal(snap.skuKey, 'PN-001');
    });

    it('preserves supplied id and timestamp', () => {
      const snap = buildAuditSnapshot({
        skuKey:         'PN-001',
        snapshotType:   'PRE_COMMIT',
        effectiveState: {},
        summary:        'Pre-commit snapshot',
        id:             'snap-id',
        timestamp:      '2025-06-01T10:00:00.000Z',
      });
      assert.equal(snap.id, 'snap-id');
      assert.equal(snap.timestamp, '2025-06-01T10:00:00.000Z');
    });
  });

  // -------------------------------------------------------------------------
  // D. sortEventsByTimestamp
  // -------------------------------------------------------------------------

  describe('D: sortEventsByTimestamp — deterministic ordering', () => {
    function makeEvent(ts: string, eventType: SkuAuditEvent['eventType'] = 'FIELD_CONFIRMED'): SkuAuditEvent {
      return buildAuditEvent({ skuKey: 'PN', eventType, actorType: 'UNKNOWN', summary: 'x', timestamp: ts });
    }

    it('returns earliest event first', () => {
      const events = [
        makeEvent('2025-03-01T12:00:00Z'),
        makeEvent('2025-01-01T00:00:00Z'),
        makeEvent('2025-02-01T06:00:00Z'),
      ];
      const sorted = sortEventsByTimestamp(events);
      assert.equal(sorted[0].timestamp, '2025-01-01T00:00:00Z');
      assert.equal(sorted[1].timestamp, '2025-02-01T06:00:00Z');
      assert.equal(sorted[2].timestamp, '2025-03-01T12:00:00Z');
    });

    it('does not mutate the original array', () => {
      const events = [
        makeEvent('2025-03-01T00:00:00Z'),
        makeEvent('2025-01-01T00:00:00Z'),
      ];
      const original0 = events[0].timestamp;
      sortEventsByTimestamp(events);
      assert.equal(events[0].timestamp, original0, 'original array must be unchanged');
    });

    it('handles single event', () => {
      const events = [makeEvent('2025-01-01T00:00:00Z')];
      const sorted = sortEventsByTimestamp(events);
      assert.equal(sorted.length, 1);
    });

    it('handles empty array', () => {
      assert.deepEqual(sortEventsByTimestamp([]), []);
    });
  });

  // -------------------------------------------------------------------------
  // E. SKU scoping — distinct keys produce distinct groupings
  // -------------------------------------------------------------------------

  describe('E: SKU scoping', () => {
    it('different part numbers produce distinct skuKeys', () => {
      const key1 = normalizeSkuKey('PN-A');
      const key2 = normalizeSkuKey('PN-B');
      assert.notEqual(key1, key2);
    });

    it('same part number with different whitespace produces the same key', () => {
      assert.equal(normalizeSkuKey('PN-001'), normalizeSkuKey('  PN-001  '));
    });

    it('events for different SKUs can be filtered by skuKey', () => {
      const ev1 = buildAuditEvent({ skuKey: 'SKU-A', eventType: 'SKU_WIRE_ADDED',   actorType: 'UNKNOWN', summary: 'a' });
      const ev2 = buildAuditEvent({ skuKey: 'SKU-B', eventType: 'SKU_WIRE_DELETED', actorType: 'UNKNOWN', summary: 'b' });
      const ev3 = buildAuditEvent({ skuKey: 'SKU-A', eventType: 'SKU_WIRE_EDITED',  actorType: 'UNKNOWN', summary: 'c' });

      const allEvents = [ev1, ev2, ev3];
      const forA = allEvents.filter(e => e.skuKey === 'SKU-A');
      const forB = allEvents.filter(e => e.skuKey === 'SKU-B');

      assert.equal(forA.length, 2);
      assert.equal(forB.length, 1);
      assert.ok(forA.every(e => e.skuKey === 'SKU-A'), 'all A events should have skuKey SKU-A');
      assert.ok(forB.every(e => e.skuKey === 'SKU-B'), 'all B events should have skuKey SKU-B');
    });
  });

  // -------------------------------------------------------------------------
  // F. buildWireDiffSummary — wire-level diff strings
  // -------------------------------------------------------------------------

  describe('F: buildWireDiffSummary', () => {
    it('wire added', () => {
      const s = buildWireDiffSummary('SKU_WIRE_ADDED', { wireId: 'W5' });
      assert.ok(s.includes('W5'));
      assert.ok(s.toLowerCase().includes('added'));
    });

    it('wire edited with field + before/after', () => {
      const s = buildWireDiffSummary('SKU_WIRE_EDITED', { wireId: 'W3', field: 'color', before: 'BLACK', after: 'BROWN' });
      assert.ok(s.includes('W3'));
      assert.ok(s.includes('color'));
      assert.ok(s.includes('BLACK'));
      assert.ok(s.includes('BROWN'));
    });

    it('wire deleted', () => {
      const s = buildWireDiffSummary('SKU_WIRE_DELETED', { wireId: 'W2' });
      assert.ok(s.includes('W2'));
      assert.ok(s.toLowerCase().includes('deleted'));
    });

    it('wire override applied', () => {
      const s = buildWireDiffSummary('WIRE_OVERRIDE_APPLIED', { wireId: 'W1', mode: 'BRANCH_DOUBLE_CRIMP' });
      assert.ok(s.includes('W1'));
      assert.ok(s.includes('BRANCH_DOUBLE_CRIMP'));
    });

    it('unknown event type falls back gracefully', () => {
      const s = buildWireDiffSummary('DOC_TYPE_CONFIRMED', {});
      assert.ok(typeof s === 'string' && s.length > 0);
    });
  });

  // -------------------------------------------------------------------------
  // G. buildSkuAuditSummary
  // -------------------------------------------------------------------------

  describe('G: buildSkuAuditSummary', () => {
    it('returns placeholder for empty list', () => {
      assert.equal(buildSkuAuditSummary([]), 'No events recorded.');
    });

    it('mentions first and latest event types', () => {
      const events: SkuAuditEvent[] = [
        buildAuditEvent({ skuKey: 'PN', eventType: 'DRAWING_UPLOADED',  actorType: 'SYSTEM',  summary: 'x', timestamp: '2025-01-01T00:00:00Z' }),
        buildAuditEvent({ skuKey: 'PN', eventType: 'SKU_COMMITTED',      actorType: 'UNKNOWN', summary: 'y', timestamp: '2025-06-01T00:00:00Z' }),
      ];
      const s = buildSkuAuditSummary(events);
      assert.ok(s.includes('DRAWING_UPLOADED'));
      assert.ok(s.includes('SKU_COMMITTED'));
      assert.ok(s.includes('Committed:'), 'should mention committed timestamp');
    });

    it('reports not committed when no SKU_COMMITTED event', () => {
      const events: SkuAuditEvent[] = [
        buildAuditEvent({ skuKey: 'PN', eventType: 'DRAWING_UPLOADED', actorType: 'SYSTEM', summary: 'x' }),
      ];
      const s = buildSkuAuditSummary(events);
      assert.ok(s.includes('Not yet committed'));
    });
  });

  // -------------------------------------------------------------------------
  // H. Integration shape — correctly formed event inputs for operator actions
  // -------------------------------------------------------------------------

  describe('H: Integration shape — operator action events', () => {
    it('SKU_WIRE_ADDED event input has correct shape', () => {
      const input: SkuAuditEventInput = {
        skuKey:    'PN-001',
        eventType: 'SKU_WIRE_ADDED',
        actorType: 'UNKNOWN',
        actorName: 'Unknown Operator',
        summary:   'Wire added: W5',
        payload:   { wireId: 'W5' },
      };
      const ev = buildAuditEvent(input);
      assert.equal(ev.eventType, 'SKU_WIRE_ADDED');
      assert.equal(ev.actorType, 'UNKNOWN');
      assert.deepEqual(ev.payload, { wireId: 'W5' });
    });

    it('KOMAX_CUT_SHEET_GENERATED event input has correct shape', () => {
      const input: SkuAuditEventInput = {
        skuKey:              'PN-001',
        eventType:           'KOMAX_CUT_SHEET_GENERATED',
        actorType:           'USER',
        actorName:           'Unknown Operator',
        summary:             'Komax cut sheet exported (12 wires)',
        payload:             { wireCount: 12, filename: 'komax-cut-sheet-PN-001.csv' },
        generatedArtifactIds: ['komax-cut-sheet-PN-001.csv'],
      };
      const ev = buildAuditEvent(input);
      assert.equal(ev.eventType, 'KOMAX_CUT_SHEET_GENERATED');
      assert.equal(ev.generatedArtifactIds?.[0], 'komax-cut-sheet-PN-001.csv');
      assert.equal((ev.payload as Record<string, unknown>)?.wireCount, 12);
    });

    it('two events for different SKUs have distinct skuKeys after normalisation', () => {
      const ev1 = buildAuditEvent({ skuKey: '  PN-A  ', eventType: 'SKU_COMMITTED', actorType: 'UNKNOWN', summary: 'a' });
      const ev2 = buildAuditEvent({ skuKey: '  PN-B  ', eventType: 'SKU_COMMITTED', actorType: 'UNKNOWN', summary: 'b' });
      assert.notEqual(ev1.skuKey, ev2.skuKey);
      assert.equal(ev1.skuKey, 'PN-A');
      assert.equal(ev2.skuKey, 'PN-B');
    });
  });
});
