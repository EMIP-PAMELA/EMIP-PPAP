/**
 * Tests for komaxProgramService — Phase T18
 *
 * Covers:
 *   A. deriveEndpointProcessType — all EndpointTerminationType values
 *   B. deriveProgramReadiness   — BLOCKED / PARTIAL / READY transitions
 *   C. summarizeMissingProgramFields — strip lengths and part numbers
 *   D. buildWireProgram
 *      D1. simple cut-strip wire (STRIP_ONLY + STRIP_ONLY)
 *      D2. terminal / ferrule mix (CONNECTOR_PIN + FERRULE)
 *      D3. print-required wire (customerWireId present)
 *      D4. branch wire warnings (topology BRANCH_DOUBLE_CRIMP)
 *      D5. BLOCKED readiness — missing length
 *      D6. BLOCKED readiness — missing gauge
 *      D7. BLOCKED readiness — missing process type (UNKNOWN termination)
 *      D8. BLOCKED readiness — crimp end with null part number
 *      D9. stable / deterministic output
 *   E. buildBatchProgram
 *      E1. all-READY batch
 *      E2. any-BLOCKED wire → batch BLOCKED
 *      E3. any-PARTIAL wire → batch PARTIAL (no BLOCKED)
 *      E4. batch with branch wires → batch warning
 *      E5. aggregated missingFields
 *   F. buildKomaxProgramCsv — non-empty string output
 *   G. new audit event types are valid SkuAuditEventType values
 *
 * No effectiveState / Supabase dependencies — tests operate on mock
 * KomaxCutSheetRow and KomaxBatch objects directly.
 */

import { describe, it } from 'node:test';
import assert from 'assert/strict';

import {
  deriveEndpointProcessType,
  deriveProgramReadiness,
  summarizeMissingProgramFields,
  buildWireProgram,
  buildBatchProgram,
  buildKomaxProgramWireCsv,
  buildKomaxProgramBatchCsv,
} from '../komaxProgramService';
import type { KomaxCutSheetRow, KomaxBatch } from '../komaxCutSheetService';
import type { KomaxWireProgram } from '../../types/komaxProgram';
import type { SkuAuditEventType } from '../../types/skuAudit';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeRow(overrides: Partial<KomaxCutSheetRow> = {}): KomaxCutSheetRow {
  return {
    internalWireId:      overrides.internalWireId ?? 'W1',
    customerWireId:      overrides.customerWireId,
    // Use 'in' guard so explicit null/undefined values are preserved (not swapped by ??)
    lengthInches:        'lengthInches' in overrides ? (overrides.lengthInches as number | null) : 10.5,
    wireColor:           overrides.wireColor ?? 'BLACK',
    wireGauge:           'wireGauge' in overrides ? overrides.wireGauge : '20 AWG',
    fromComponent:       overrides.fromComponent       ?? 'C1',
    fromCavity:          overrides.fromCavity          ?? '1',
    fromTerminationType: overrides.fromTerminationType,
    toComponent:         overrides.toComponent        ?? 'C2',
    toCavity:            overrides.toCavity           ?? '2',
    toTerminationType:   overrides.toTerminationType,
    topology:            overrides.topology            ?? 'NORMAL',
    notes:               overrides.notes              ?? [],
  };
}

function makeBatch(overrides: Partial<KomaxBatch> & { wireIds?: string[]; wires?: KomaxCutSheetRow[] } = {}): KomaxBatch {
  const wireIds = overrides.wireIds ?? ['W1'];
  const wires   = overrides.wires   ?? wireIds.map(id => makeRow({ internalWireId: id }));
  return {
    batchId:          overrides.batchId          ?? 'B01',
    key:              overrides.key              ?? '20 AWG|BLACK|NO_PRINT|STRIP|STRIP',
    wireIds,
    wires,
    totalWires:       wires.length,
    requiresPrinting: overrides.requiresPrinting ?? false,
    hasBranchWires:   overrides.hasBranchWires   ?? false,
    setupSignature:   overrides.setupSignature   ?? '20 AWG | BLACK | NO_PRINT | STRIP → STRIP',
  };
}

const SKU = 'PN-001';

// ---------------------------------------------------------------------------
// A. deriveEndpointProcessType
// ---------------------------------------------------------------------------

describe('komaxProgramService', () => {
  describe('A: deriveEndpointProcessType', () => {
    it('CONNECTOR_PIN → CRIMP_FOR_INSERTION', () => {
      assert.equal(deriveEndpointProcessType('CONNECTOR_PIN'), 'CRIMP_FOR_INSERTION');
    });
    it('TERMINAL → CRIMP', () => {
      assert.equal(deriveEndpointProcessType('TERMINAL'), 'CRIMP');
    });
    it('FERRULE → FERRULE_CRIMP', () => {
      assert.equal(deriveEndpointProcessType('FERRULE'), 'FERRULE_CRIMP');
    });
    it('STRIP_ONLY → CUT_STRIP', () => {
      assert.equal(deriveEndpointProcessType('STRIP_ONLY'), 'CUT_STRIP');
    });
    it('GROUND → CRIMP', () => {
      assert.equal(deriveEndpointProcessType('GROUND'), 'CRIMP');
    });
    it('RING → CRIMP', () => {
      assert.equal(deriveEndpointProcessType('RING'), 'CRIMP');
    });
    it('SPADE → CRIMP', () => {
      assert.equal(deriveEndpointProcessType('SPADE'), 'CRIMP');
    });
    it('RECEPTACLE → CRIMP', () => {
      assert.equal(deriveEndpointProcessType('RECEPTACLE'), 'CRIMP');
    });
    it('SPLICE → SPLICE', () => {
      assert.equal(deriveEndpointProcessType('SPLICE'), 'SPLICE');
    });
    it('UNKNOWN → null', () => {
      assert.equal(deriveEndpointProcessType('UNKNOWN'), null);
    });
    it('OTHER_TREATMENT → null', () => {
      assert.equal(deriveEndpointProcessType('OTHER_TREATMENT'), null);
    });
    it('null → null', () => {
      assert.equal(deriveEndpointProcessType(null), null);
    });
    it('undefined → null', () => {
      assert.equal(deriveEndpointProcessType(undefined), null);
    });
    it('empty string → null', () => {
      assert.equal(deriveEndpointProcessType(''), null);
    });
  });

  // -------------------------------------------------------------------------
  // B. deriveProgramReadiness
  // -------------------------------------------------------------------------

  describe('B: deriveProgramReadiness', () => {
    const base = {
      lengthInches:     10,
      wireGauge:        '20 AWG',
      leftProcessType:  'CUT_STRIP',
      rightProcessType: 'CUT_STRIP',
      leftPartNumber:   null,
      rightPartNumber:  null,
      missingFields:    [] as string[],
      warnings:         [] as string[],
    };

    it('READY when all fields present and no missing/warnings', () => {
      assert.equal(deriveProgramReadiness(base), 'READY');
    });

    it('PARTIAL when missingFields is non-empty', () => {
      assert.equal(deriveProgramReadiness({ ...base, missingFields: ['stripLengthLeft (operator-required)'] }), 'PARTIAL');
    });

    it('PARTIAL when warnings is non-empty', () => {
      assert.equal(deriveProgramReadiness({ ...base, warnings: ['Shared crimp group'] }), 'PARTIAL');
    });

    it('BLOCKED when lengthInches is null', () => {
      assert.equal(deriveProgramReadiness({ ...base, lengthInches: null }), 'BLOCKED');
    });

    it('BLOCKED when wireGauge is absent', () => {
      assert.equal(deriveProgramReadiness({ ...base, wireGauge: null }), 'BLOCKED');
    });

    it('BLOCKED when leftProcessType is null', () => {
      assert.equal(deriveProgramReadiness({ ...base, leftProcessType: null }), 'BLOCKED');
    });

    it('BLOCKED when rightProcessType is null', () => {
      assert.equal(deriveProgramReadiness({ ...base, rightProcessType: null }), 'BLOCKED');
    });

    it('BLOCKED when left is CRIMP and leftPartNumber is null', () => {
      assert.equal(deriveProgramReadiness({
        ...base,
        leftProcessType: 'CRIMP',
        leftPartNumber:  null,
      }), 'BLOCKED');
    });

    it('BLOCKED when right is CRIMP_FOR_INSERTION and rightPartNumber is null', () => {
      assert.equal(deriveProgramReadiness({
        ...base,
        rightProcessType: 'CRIMP_FOR_INSERTION',
        rightPartNumber:  null,
      }), 'BLOCKED');
    });

    it('BLOCKED when right is FERRULE_CRIMP and rightPartNumber is null', () => {
      assert.equal(deriveProgramReadiness({
        ...base,
        rightProcessType: 'FERRULE_CRIMP',
        rightPartNumber:  null,
      }), 'BLOCKED');
    });

    it('READY when left is SPLICE (no part number needed)', () => {
      assert.equal(deriveProgramReadiness({
        ...base,
        leftProcessType: 'SPLICE',
      }), 'READY');
    });

    it('BLOCKED takes precedence over missingFields', () => {
      assert.equal(deriveProgramReadiness({
        ...base,
        lengthInches:  null,
        missingFields: ['something'],
      }), 'BLOCKED');
    });
  });

  // -------------------------------------------------------------------------
  // C. summarizeMissingProgramFields
  // -------------------------------------------------------------------------

  describe('C: summarizeMissingProgramFields', () => {
    it('CUT_STRIP + CUT_STRIP → strip lengths only (no part numbers)', () => {
      const m = summarizeMissingProgramFields('CUT_STRIP', 'CUT_STRIP');
      assert.ok(m.some(f => f.includes('stripLengthLeft')));
      assert.ok(m.some(f => f.includes('stripLengthRight')));
      assert.ok(!m.some(f => f.includes('leftPartNumber')));
      assert.ok(!m.some(f => f.includes('rightPartNumber')));
    });

    it('CRIMP left → strip + part number for left end', () => {
      const m = summarizeMissingProgramFields('CRIMP', null);
      assert.ok(m.some(f => f.includes('stripLengthLeft')));
      assert.ok(m.some(f => f.includes('leftPartNumber')));
    });

    it('FERRULE_CRIMP right → strip + part number for right end', () => {
      const m = summarizeMissingProgramFields(null, 'FERRULE_CRIMP');
      assert.ok(m.some(f => f.includes('stripLengthRight')));
      assert.ok(m.some(f => f.includes('rightPartNumber')));
    });

    it('SPLICE → no missing fields (no strip length or part number needed)', () => {
      const m = summarizeMissingProgramFields('SPLICE', 'SPLICE');
      assert.equal(m.length, 0);
    });

    it('both null → no missing fields (unresolvable reported elsewhere)', () => {
      const m = summarizeMissingProgramFields(null, null);
      assert.equal(m.length, 0);
    });
  });

  // -------------------------------------------------------------------------
  // D. buildWireProgram
  // -------------------------------------------------------------------------

  describe('D: buildWireProgram', () => {
    describe('D1: simple cut-strip wire (STRIP_ONLY + STRIP_ONLY)', () => {
      const row  = makeRow({ fromTerminationType: 'STRIP_ONLY', toTerminationType: 'STRIP_ONLY' });
      const prog = buildWireProgram(row, SKU, 'B01');

      it('leftProcessType is CUT_STRIP', () => assert.equal(prog.leftProcessType,  'CUT_STRIP'));
      it('rightProcessType is CUT_STRIP', () => assert.equal(prog.rightProcessType, 'CUT_STRIP'));
      it('printRequired is false (no customerWireId)', () => assert.equal(prog.printRequired, false));
      it('readiness is PARTIAL (strip lengths missing)', () => assert.equal(prog.readiness, 'PARTIAL'));
      it('missingFields includes strip lengths', () => {
        assert.ok(prog.missingFields.some(f => f.includes('stripLengthLeft')));
        assert.ok(prog.missingFields.some(f => f.includes('stripLengthRight')));
      });
      it('no part-number missing fields (CUT_STRIP needs no terminal)', () => {
        assert.ok(!prog.missingFields.some(f => f.includes('PartNumber')));
      });
      it('batchId is preserved', () => assert.equal(prog.batchId, 'B01'));
      it('skuKey is preserved', () => assert.equal(prog.skuKey, SKU));
    });

    describe('D2: terminal / ferrule mix (CONNECTOR_PIN + FERRULE)', () => {
      const row  = makeRow({
        fromTerminationType: 'CONNECTOR_PIN',
        toTerminationType:   'FERRULE',
      });
      const prog = buildWireProgram(row, SKU, null);

      it('leftProcessType is CRIMP_FOR_INSERTION', () => assert.equal(prog.leftProcessType,  'CRIMP_FOR_INSERTION'));
      it('rightProcessType is FERRULE_CRIMP',       () => assert.equal(prog.rightProcessType, 'FERRULE_CRIMP'));
      it('readiness is BLOCKED (part numbers missing)', () => assert.equal(prog.readiness, 'BLOCKED'));
      it('leftPartNumber is null (not in model)',    () => assert.equal(prog.leftPartNumber,  null));
      it('rightPartNumber is null (not in model)',   () => assert.equal(prog.rightPartNumber, null));
      it('missingFields includes leftPartNumber',    () => {
        assert.ok(prog.missingFields.some(f => f.includes('leftPartNumber')));
      });
      it('missingFields includes rightPartNumber',   () => {
        assert.ok(prog.missingFields.some(f => f.includes('rightPartNumber')));
      });
    });

    describe('D3: print-required wire (customerWireId present)', () => {
      const row  = makeRow({
        customerWireId:      'CW-47',
        fromTerminationType: 'STRIP_ONLY',
        toTerminationType:   'STRIP_ONLY',
      });
      const prog = buildWireProgram(row, SKU, null);

      it('printRequired is true',         () => assert.equal(prog.printRequired, true));
      it('printText equals customerWireId', () => assert.equal(prog.printText, 'CW-47'));
      it('customerWireId is preserved',    () => assert.equal(prog.customerWireId, 'CW-47'));
    });

    describe('D4: branch wire warnings', () => {
      const row  = makeRow({
        internalWireId:      'W4A',
        topology:            'BRANCH_DOUBLE_CRIMP',
        fromTerminationType: 'CONNECTOR_PIN',
        toTerminationType:   'CONNECTOR_PIN',
        notes:               ['Shares crimp with W4B'],
      });
      const prog = buildWireProgram(row, SKU, null);

      it('warnings include "Shared crimp group"', () => {
        assert.ok(prog.warnings.includes('Shared crimp group'));
      });
      it('warnings include "Review branch setup"', () => {
        assert.ok(prog.warnings.some(w => w.includes('Review branch setup')));
      });
      it('cut-sheet notes are passed through', () => {
        assert.ok(prog.warnings.some(w => w.includes('Shares crimp with W4B')));
      });
      it('topology is BRANCH_DOUBLE_CRIMP', () => {
        assert.equal(prog.topology, 'BRANCH_DOUBLE_CRIMP');
      });
    });

    describe('D5: BLOCKED — missing length', () => {
      const row  = makeRow({ lengthInches: null, fromTerminationType: 'STRIP_ONLY', toTerminationType: 'STRIP_ONLY' });
      const prog = buildWireProgram(row, SKU, null);

      it('readiness is BLOCKED', () => assert.equal(prog.readiness, 'BLOCKED'));
      it('missingFields includes length note', () => {
        assert.ok(prog.missingFields.some(f => f.includes('stripLength')));
      });
    });

    describe('D6: BLOCKED — missing gauge', () => {
      const row  = makeRow({ wireGauge: undefined, fromTerminationType: 'STRIP_ONLY', toTerminationType: 'STRIP_ONLY' });
      const prog = buildWireProgram(row, SKU, null);
      it('readiness is BLOCKED', () => assert.equal(prog.readiness, 'BLOCKED'));
    });

    describe('D7: BLOCKED — unresolvable process type (UNKNOWN termination)', () => {
      const row  = makeRow({ fromTerminationType: 'UNKNOWN', toTerminationType: 'STRIP_ONLY' });
      const prog = buildWireProgram(row, SKU, null);

      it('leftProcessType is null',   () => assert.equal(prog.leftProcessType, null));
      it('readiness is BLOCKED',      () => assert.equal(prog.readiness,       'BLOCKED'));
      it('missingFields mentions leftProcessType', () => {
        assert.ok(prog.missingFields.some(f => f.includes('leftProcessType')));
      });
    });

    describe('D8: BLOCKED — CRIMP end with null part number', () => {
      const row  = makeRow({ fromTerminationType: 'TERMINAL', toTerminationType: 'STRIP_ONLY' });
      const prog = buildWireProgram(row, SKU, null);
      it('readiness is BLOCKED',     () => assert.equal(prog.readiness, 'BLOCKED'));
      it('leftProcessType is CRIMP', () => assert.equal(prog.leftProcessType, 'CRIMP'));
    });

    describe('D9: deterministic output across identical inputs', () => {
      const row = makeRow({ fromTerminationType: 'STRIP_ONLY', toTerminationType: 'STRIP_ONLY' });

      it('produces identical output on repeated calls', () => {
        const run1 = buildWireProgram(row, SKU, 'B01');
        const run2 = buildWireProgram(row, SKU, 'B01');
        assert.equal(run1.readiness,     run2.readiness);
        assert.equal(run1.leftProcessType,  run2.leftProcessType);
        assert.equal(run1.rightProcessType, run2.rightProcessType);
        assert.deepEqual(run1.missingFields, run2.missingFields);
        assert.deepEqual(run1.warnings,      run2.warnings);
      });
    });
  });

  // -------------------------------------------------------------------------
  // E. buildBatchProgram
  // -------------------------------------------------------------------------

  describe('E: buildBatchProgram', () => {
    function makeWireProgram(overrides: Partial<KomaxWireProgram>): KomaxWireProgram {
      return {
        skuKey:           SKU,
        internalWireId:   overrides.internalWireId  ?? 'W1',
        batchId:          'B01',
        wireGauge:        '20 AWG',
        wireColor:        'BLACK',
        lengthInches:     10,
        leftProcessType:  overrides.leftProcessType  ?? 'CUT_STRIP',
        rightProcessType: overrides.rightProcessType ?? 'CUT_STRIP',
        leftTerminationType:  'STRIP_ONLY',
        rightTerminationType: 'STRIP_ONLY',
        leftPartNumber:   null,
        rightPartNumber:  null,
        stripLengthLeft:  null,
        stripLengthRight: null,
        printRequired:    false,
        printText:        null,
        topology:         'NORMAL',
        readiness:        overrides.readiness  ?? 'PARTIAL',
        missingFields:    overrides.missingFields ?? ['stripLengthLeft (operator-required)'],
        warnings:         overrides.warnings  ?? [],
        ...overrides,
      };
    }

    describe('E1: all-PARTIAL batch → batch PARTIAL', () => {
      const wp1     = makeWireProgram({ internalWireId: 'W1', readiness: 'PARTIAL' });
      const wp2     = makeWireProgram({ internalWireId: 'W2', readiness: 'PARTIAL' });
      const batch   = makeBatch({ wireIds: ['W1', 'W2'] });
      const bProg   = buildBatchProgram(batch, [wp1, wp2], SKU);

      it('readiness is PARTIAL', () => assert.equal(bProg.readiness, 'PARTIAL'));
      it('totalWires is 2',      () => assert.equal(bProg.totalWires, 2));
      it('skuKey preserved',     () => assert.equal(bProg.skuKey, SKU));
    });

    describe('E2: any-BLOCKED wire → batch BLOCKED', () => {
      const wp1   = makeWireProgram({ readiness: 'PARTIAL' });
      const wp2   = makeWireProgram({ internalWireId: 'W2', readiness: 'BLOCKED' });
      const batch = makeBatch({ wireIds: ['W1', 'W2'] });
      const bProg = buildBatchProgram(batch, [wp1, wp2], SKU);
      it('readiness is BLOCKED', () => assert.equal(bProg.readiness, 'BLOCKED'));
    });

    describe('E3: all-READY wires → batch READY', () => {
      const wp1   = makeWireProgram({ readiness: 'READY', missingFields: [], warnings: [] });
      const batch = makeBatch({ wireIds: ['W1'] });
      const bProg = buildBatchProgram(batch, [wp1], SKU);
      it('readiness is READY', () => assert.equal(bProg.readiness, 'READY'));
    });

    describe('E4: batch with branch wires → batch warning', () => {
      const wp1   = makeWireProgram({});
      const batch = makeBatch({ hasBranchWires: true, wireIds: ['W1'] });
      const bProg = buildBatchProgram(batch, [wp1], SKU);
      it('warnings include branch message', () => {
        assert.ok(bProg.warnings.some(w => w.includes('branch wires')));
      });
    });

    describe('E5: missingFields aggregated from wires', () => {
      const wp1 = makeWireProgram({ missingFields: ['stripLengthLeft (operator-required)', 'leftPartNumber (operator-required)'] });
      const wp2 = makeWireProgram({ internalWireId: 'W2', missingFields: ['stripLengthRight (operator-required)', 'leftPartNumber (operator-required)'] });
      const batch = makeBatch({ wireIds: ['W1', 'W2'] });
      const bProg = buildBatchProgram(batch, [wp1, wp2], SKU);
      it('missingFields are unique-aggregated', () => {
        const countLeftPartNumber = bProg.missingFields.filter(f => f === 'leftPartNumber (operator-required)').length;
        assert.equal(countLeftPartNumber, 1, 'duplicate missingField strings should be deduplicated');
        assert.ok(bProg.missingFields.includes('stripLengthLeft (operator-required)'));
        assert.ok(bProg.missingFields.includes('stripLengthRight (operator-required)'));
      });
    });
  });

  // -------------------------------------------------------------------------
  // F. CSV output
  // -------------------------------------------------------------------------

  describe('F: CSV output', () => {
    it('buildKomaxProgramWireCsv returns non-empty string with header', () => {
      const wp = buildWireProgram(
        makeRow({ fromTerminationType: 'STRIP_ONLY', toTerminationType: 'STRIP_ONLY' }),
        SKU, 'B01',
      );
      const csv = buildKomaxProgramWireCsv({ wirePrograms: [wp], batchPrograms: [], summary: { readyWirePrograms: 0, partialWirePrograms: 1, blockedWirePrograms: 0, readyBatchPrograms: 0, partialBatchPrograms: 0, blockedBatchPrograms: 0 } });
      assert.ok(csv.includes('Wire'));
      assert.ok(csv.includes('Readiness'));
      assert.ok(csv.includes('W1'));
    });

    it('buildKomaxProgramBatchCsv returns non-empty string with header', () => {
      const wp    = buildWireProgram(makeRow({ fromTerminationType: 'STRIP_ONLY', toTerminationType: 'STRIP_ONLY' }), SKU, 'B01');
      const batch = makeBatch({ wireIds: ['W1'] });
      const bp    = buildBatchProgram(batch, [wp], SKU);
      const csv   = buildKomaxProgramBatchCsv({ wirePrograms: [wp], batchPrograms: [bp], summary: { readyWirePrograms: 0, partialWirePrograms: 1, blockedWirePrograms: 0, readyBatchPrograms: 0, partialBatchPrograms: 1, blockedBatchPrograms: 0 } });
      assert.ok(csv.includes('Batch'));
      assert.ok(csv.includes('Readiness'));
      assert.ok(csv.includes('B01'));
    });

    it('empty result yields header-only CSV', () => {
      const csv = buildKomaxProgramWireCsv({ wirePrograms: [], batchPrograms: [], summary: { readyWirePrograms: 0, partialWirePrograms: 0, blockedWirePrograms: 0, readyBatchPrograms: 0, partialBatchPrograms: 0, blockedBatchPrograms: 0 } });
      const lines = csv.split('\r\n');
      assert.equal(lines.length, 1, 'only header row for empty result');
    });
  });

  // -------------------------------------------------------------------------
  // G. New audit event types are valid SkuAuditEventType values
  // -------------------------------------------------------------------------

  describe('G: new audit event types', () => {
    it('KOMAX_PROGRAM_GENERATED is a valid SkuAuditEventType', () => {
      const eventType: SkuAuditEventType = 'KOMAX_PROGRAM_GENERATED';
      assert.equal(eventType, 'KOMAX_PROGRAM_GENERATED');
    });

    it('KOMAX_PROGRAM_EXPORTED is a valid SkuAuditEventType', () => {
      const eventType: SkuAuditEventType = 'KOMAX_PROGRAM_EXPORTED';
      assert.equal(eventType, 'KOMAX_PROGRAM_EXPORTED');
    });
  });
});
