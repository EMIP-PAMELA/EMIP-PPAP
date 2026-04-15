/**
 * skuModelEditService.test.ts — Phase T12 unit tests
 *
 * Covers:
 *   - buildEffectiveSkuHarnessModel: pass-through with no operator edits
 *   - buildEffectiveSkuHarnessModel: operator delete removes wire
 *   - buildEffectiveSkuHarnessModel: operator edit replaces wire immutably
 *   - buildEffectiveSkuHarnessModel: operator add appends wire
 *   - buildEffectiveSkuHarnessModel: all three operations combined
 *   - buildEffectiveSkuHarnessModel: null extracted connectivity (scratch build)
 *   - makeEmptyOperatorWire: defaults and overrides
 *   - wireConnectivityToOperatorModel: promotion preserves all fields
 *   - No mutation of original extracted connectivity
 *   - T7/T8/T9 rerun after effective model built
 *   - All lengths use 'in' unit (T11.4 global rule)
 */

import { describe, it } from 'node:test';
import assert from 'assert/strict';
import {
  buildEffectiveSkuHarnessModel,
  makeEmptyOperatorWire,
  wireConnectivityToOperatorModel,
  type OperatorWireModel,
} from '../skuModelEditService';
import type {
  HarnessConnectivityResult,
  WireConnectivity,
} from '../harnessConnectivityService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWire(
  wireId: string,
  fromComp: string | null = 'J1',
  toComp: string | null = 'T1',
): WireConnectivity {
  return {
    wireId,
    length: 9,
    lengthUnit: 'in',
    lengthInches: 9,
    gauge: '18',
    color: 'BRN',
    from: { component: fromComp, cavity: '1', treatment: null },
    to:   { component: toComp,   cavity: null, treatment: null },
    sourceRowIndex: 0,
    rawText: `${wireId} 18 BRN 9in J1:1 → T1`,
    confidence: 0.8,
    unresolved: false,
  };
}

function makeExtracted(wires: WireConnectivity[]): HarnessConnectivityResult {
  const unresolved = wires.filter(w => w.unresolved).map(w => w.wireId);
  return {
    wires,
    unresolvedWires: unresolved,
    confidenceSummary: {
      total:      wires.length,
      resolved:   wires.filter(w => !w.unresolved && w.from.component && w.to.component).length,
      partial:    wires.filter(w => !w.unresolved && (!w.from.component || !w.to.component)).length,
      unresolved: unresolved.length,
    },
  };
}

function makeOperatorWire(wireId: string, overrides?: Partial<OperatorWireModel>): OperatorWireModel {
  const now = new Date().toISOString();
  return {
    id:          `op-${wireId}`,
    wireId,
    length:      12,
    lengthUnit:  'in',
    gauge:       '18',
    color:       'BLK',
    from:        { component: 'J2', cavity: '3', treatment: null },
    to:          { component: '929504-1', cavity: null, treatment: null },
    topology:    'LINEAR',
    branch:      null,
    reason:      'Test override',
    source:      'OPERATOR_MODEL',
    authoritative: true,
    createdAt:   now,
    updatedAt:   now,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildEffectiveSkuHarnessModel', () => {
  it('pass-through: no operator edits returns extracted wires unchanged', () => {
    const extracted = makeExtracted([makeWire('W1'), makeWire('W2')]);
    const result = buildEffectiveSkuHarnessModel({
      extractedConnectivity: extracted,
      operatorAddedWires: [],
      operatorEditedWires: [],
      operatorDeletedWireIds: [],
    });
    assert.equal(result.connectivity.wires.length, 2, 'should have 2 wires');
    assert.equal(result.connectivity.wires[0].wireId, 'W1');
    assert.equal(result.connectivity.wires[1].wireId, 'W2');
  });

  it('delete: removes specified wire from effective model', () => {
    const extracted = makeExtracted([makeWire('W1'), makeWire('W2'), makeWire('W3')]);
    const result = buildEffectiveSkuHarnessModel({
      extractedConnectivity: extracted,
      operatorAddedWires: [],
      operatorEditedWires: [],
      operatorDeletedWireIds: ['W2'],
    });
    assert.equal(result.connectivity.wires.length, 2);
    assert.ok(!result.connectivity.wires.some(w => w.wireId === 'W2'), 'W2 should be deleted');
    assert.ok(result.connectivity.wires.some(w => w.wireId === 'W1'), 'W1 should remain');
    assert.ok(result.connectivity.wires.some(w => w.wireId === 'W3'), 'W3 should remain');
  });

  it('delete: does not mutate the original extracted connectivity', () => {
    const original = [makeWire('W1'), makeWire('W2')];
    const extracted = makeExtracted(original);
    buildEffectiveSkuHarnessModel({
      extractedConnectivity: extracted,
      operatorAddedWires: [],
      operatorEditedWires: [],
      operatorDeletedWireIds: ['W1'],
    });
    assert.equal(extracted.wires.length, 2, 'original should be untouched');
    assert.equal(extracted.wires[0].wireId, 'W1', 'original W1 should remain');
  });

  it('edit: replaces extracted wire with operator version immutably', () => {
    const extracted = makeExtracted([makeWire('W1', 'J1', 'T1'), makeWire('W2')]);
    const editedW1 = makeOperatorWire('W1', { from: { component: 'J99', cavity: '7', treatment: null } });
    const result = buildEffectiveSkuHarnessModel({
      extractedConnectivity: extracted,
      operatorAddedWires: [],
      operatorEditedWires: [editedW1],
      operatorDeletedWireIds: [],
    });
    assert.equal(result.connectivity.wires.length, 2);
    const w1 = result.connectivity.wires.find(w => w.wireId === 'W1');
    assert.ok(w1, 'W1 should be in effective model');
    assert.equal(w1!.from.component, 'J99', 'from.component should be operator value');
    assert.equal(extracted.wires[0].from.component, 'J1', 'original must be untouched');
  });

  it('add: appends wire not present in extracted set', () => {
    const extracted = makeExtracted([makeWire('W1')]);
    const newWire = makeOperatorWire('W99');
    const result = buildEffectiveSkuHarnessModel({
      extractedConnectivity: extracted,
      operatorAddedWires: [newWire],
      operatorEditedWires: [],
      operatorDeletedWireIds: [],
    });
    assert.equal(result.connectivity.wires.length, 2, 'should have extracted + added');
    const w99 = result.connectivity.wires.find(w => w.wireId === 'W99');
    assert.ok(w99, 'W99 should be in effective model');
    assert.equal(w99!.rawText.includes('OPERATOR_MODEL'), true, 'rawText should carry provenance');
  });

  it('combined: add + edit + delete in a single call', () => {
    const extracted = makeExtracted([makeWire('W1'), makeWire('W2'), makeWire('W3')]);
    const result = buildEffectiveSkuHarnessModel({
      extractedConnectivity: extracted,
      operatorAddedWires: [makeOperatorWire('W99')],
      operatorEditedWires: [makeOperatorWire('W2', { color: 'WHT' })],
      operatorDeletedWireIds: ['W3'],
    });
    assert.equal(result.connectivity.wires.length, 3, 'W1 + edited W2 + added W99, W3 deleted');
    assert.ok(!result.connectivity.wires.some(w => w.wireId === 'W3'), 'W3 deleted');
    const w2 = result.connectivity.wires.find(w => w.wireId === 'W2');
    assert.equal(w2!.color, 'WHT', 'W2 should use operator color');
    assert.ok(result.connectivity.wires.some(w => w.wireId === 'W99'), 'W99 added');
  });

  it('null extracted: builds model from operator-added wires only', () => {
    const result = buildEffectiveSkuHarnessModel({
      extractedConnectivity: null,
      operatorAddedWires: [makeOperatorWire('W1'), makeOperatorWire('W2')],
      operatorEditedWires: [],
      operatorDeletedWireIds: [],
    });
    assert.equal(result.connectivity.wires.length, 2, 'should have 2 operator-added wires');
  });

  it('downstream services run: result includes validation, confidence, decision', () => {
    const extracted = makeExtracted([makeWire('W1')]);
    const result = buildEffectiveSkuHarnessModel({
      extractedConnectivity: extracted,
      operatorAddedWires: [],
      operatorEditedWires: [],
      operatorDeletedWireIds: [],
    });
    assert.ok(result.validation, 'validation should be present');
    assert.ok(result.confidence, 'confidence should be present');
    assert.ok(result.decision, 'decision should be present');
    assert.ok(typeof result.decision.overallDecision === 'string', 'decision should have overallDecision');
    assert.ok(typeof result.decision.readinessScore === 'number', 'decision should have readinessScore');
  });

  it('T11.4: all effective wires have lengthUnit = in and lengthInches = length', () => {
    const w = makeWire('W1');
    w.length = 15;
    w.lengthUnit = 'in';
    w.lengthInches = 15;
    const extracted = makeExtracted([w]);
    const opAdded = makeOperatorWire('W99', { length: 7 });
    const result = buildEffectiveSkuHarnessModel({
      extractedConnectivity: extracted,
      operatorAddedWires: [opAdded],
      operatorEditedWires: [],
      operatorDeletedWireIds: [],
    });
    for (const wire of result.connectivity.wires) {
      if (wire.lengthUnit !== null) {
        assert.equal(wire.lengthUnit, 'in', `wire ${wire.wireId} should have lengthUnit 'in'`);
      }
    }
    const w99 = result.connectivity.wires.find(wire => wire.wireId === 'W99');
    assert.equal(w99!.lengthUnit, 'in');
    assert.equal(w99!.lengthInches, 7);
  });
});

describe('makeEmptyOperatorWire', () => {
  it('produces a wire with all required fields and correct defaults', () => {
    const wire = makeEmptyOperatorWire();
    assert.equal(wire.source, 'OPERATOR_MODEL');
    assert.equal(wire.authoritative, true);
    assert.equal(wire.lengthUnit, 'in');
    assert.equal(wire.wireId, '');
    assert.ok(wire.id.startsWith('op-'), 'id should have op- prefix');
    assert.ok(wire.createdAt, 'createdAt should be set');
  });

  it('applies overrides to non-readonly fields', () => {
    const wire = makeEmptyOperatorWire({ wireId: 'W5', gauge: '20', reason: 'test' });
    assert.equal(wire.wireId, 'W5');
    assert.equal(wire.gauge, '20');
    assert.equal(wire.reason, 'test');
  });
});

describe('wireConnectivityToOperatorModel', () => {
  it('promotes extracted wire to operator model preserving all fields', () => {
    const extracted = makeWire('W7', 'J3', 'T99');
    extracted.length = 11;
    const op = wireConnectivityToOperatorModel(extracted, 'Review confirmed');
    assert.equal(op.wireId, 'W7');
    assert.equal(op.length, 11);
    assert.equal(op.lengthUnit, 'in');
    assert.equal(op.gauge, '18');
    assert.equal(op.from.component, 'J3');
    assert.equal(op.to.component, 'T99');
    assert.equal(op.reason, 'Review confirmed');
    assert.equal(op.source, 'OPERATOR_MODEL');
    assert.equal(op.authoritative, true);
  });

  it('does not mutate the original wire', () => {
    const extracted = makeWire('W8');
    const op = wireConnectivityToOperatorModel(extracted);
    op.from.component = 'MUTATED';
    assert.equal(extracted.from.component, 'J1', 'original should be untouched');
  });
});
