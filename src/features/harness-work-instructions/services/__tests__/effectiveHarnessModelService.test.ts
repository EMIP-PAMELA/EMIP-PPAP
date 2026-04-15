/**
 * Tests for effectiveHarnessModelService — Phase T12.4
 *
 * Verifies that the single authoritative effective harness state:
 *   A. Operator-selected doc type suppresses DOC_TYPE_UNCERTAIN
 *   B. Effective connectivity uses T11 override values, not extracted blanks
 *   C. Effective decision updates after wire override
 *   D. SKU add/edit/delete changes are reflected in effective connectivity
 *   E. Original extracted model is never mutated
 *   F. Commit readiness derives from effective unresolved questions
 */

import { describe, it } from 'node:test';
import assert from 'assert/strict';

import { buildEffectiveHarnessState } from '../effectiveHarnessModelService';
import type { IngestionAnalysisResult, UnresolvedQuestion, WireOperatorOverride } from '@/src/features/vault/types/ingestionReview';
import type { HarnessConnectivityResult } from '../harnessConnectivityService';
import type { HarnessDecisionResult } from '../harnessDecisionService';
import type { HarnessValidationResult } from '../harnessValidationService';
import type { HarnessConfidenceResult } from '../harnessConfidenceService';
import type { OperatorWireModel } from '../skuModelEditService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQuestion(partial: Partial<UnresolvedQuestion> & { issueCode?: UnresolvedQuestion['issueCode'] } = {}): UnresolvedQuestion {
  return {
    id:             partial.id             ?? 'q1',
    issueCode:      partial.issueCode      ?? 'DOC_TYPE_UNCERTAIN',
    severity:       partial.severity       ?? 'BLOCKING',
    blocksCommit:   partial.blocksCommit   ?? true,
    promptText:     partial.promptText     ?? 'Document type uncertain',
    suggestedValue: partial.suggestedValue ?? null,
    fieldToResolve: partial.fieldToResolve ?? 'documentType',
  };
}

function makeWireConnectivity(wireId: string, fromComponent: string | null = null): HarnessConnectivityResult['wires'][0] {
  return {
    wireId,
    length:          1.5,
    lengthUnit:      'in' as const,
    lengthInches:    1.5,
    gauge:           '18',
    color:           'RED',
    from:            { component: fromComponent, cavity: null, treatment: null, terminationType: null },
    to:              { component: 'J2', cavity: '3', treatment: null, terminationType: 'CONNECTOR_PIN' },
    sourceRowIndex:  0,
    rawText:         'raw text for wire ' + wireId,
    confidence:      0.5,
    unresolved:      fromComponent === null,
  };
}

function makeConnectivity(wires: HarnessConnectivityResult['wires']): HarnessConnectivityResult {
  const unresolved = wires.filter(w => w.unresolved).map(w => w.wireId);
  return {
    wires,
    unresolvedWires: unresolved,
    confidenceSummary: {
      total:      wires.length,
      resolved:   wires.filter(w => !w.unresolved).length,
      partial:    0,
      unresolved: unresolved.length,
    },
  };
}

function makeDecision(overallDecision: HarnessDecisionResult['overallDecision'] = 'BLOCKED'): HarnessDecisionResult {
  return {
    overallDecision,
    wires:          [],
    blockedWires:   [],
    reviewRequired: [],
    topIssues:      [],
    readinessScore: overallDecision === 'SAFE' ? 100 : 40,
    summary:        { total: 0, safe: 0, review: 0, blocked: 0 },
  };
}

function makeValidation(): HarnessValidationResult {
  return {
    wires:        [],
    harnessIssues: [],
    summary:      { total: 0, valid: 0, warnings: 0, errors: 0 },
  };
}

function makeConfidence(): HarnessConfidenceResult {
  return {
    wires:   [],
    summary: { avgConfidence: 0.8, high: 0, medium: 0, low: 0, untrusted: 0 },
  };
}

function makeAnalysis(overrides?: {
  unresolvedQuestions?: UnresolvedQuestion[];
  proposedDocumentType?: IngestionAnalysisResult['proposedDocumentType'];
  connectivity?: HarnessConnectivityResult;
  decision?: HarnessDecisionResult;
}): IngestionAnalysisResult {
  const conn = overrides?.connectivity ?? makeConnectivity([makeWireConnectivity('W1', null)]);
  return {
    fileName:               'test.pdf',
    fileSize:               1024,
    analyzedAt:             '2024-01-01T00:00:00.000Z',
    proposedDocumentType:   overrides?.proposedDocumentType ?? 'UNKNOWN',
    docTypeConfidence:      0.3,
    docTypeSignals:         [],
    proposedPartNumber:     '12345',
    partNumberIsProvisional: false,
    partNumberConfidence:   0.8,
    proposedRevision:       'A',
    revisionConfidence:     0.8,
    revisionSource:         null,
    proposedDrawingNumber:  null,
    harnessConnectivity:    conn,
    harnessValidation:      makeValidation(),
    harnessConfidence:      makeConfidence(),
    harnessDecision:        overrides?.decision ?? makeDecision('BLOCKED'),
    unresolvedQuestions:    overrides?.unresolvedQuestions ?? [makeQuestion()],
    readyToCommit:          false,
  } as unknown as IngestionAnalysisResult;
}

// ---------------------------------------------------------------------------
// A. Operator doc type suppresses DOC_TYPE_UNCERTAIN
// ---------------------------------------------------------------------------

describe('A: document type authority', () => {
  it('suppresses DOC_TYPE_UNCERTAIN when operator selects a doc type', () => {
    const analysis = makeAnalysis({
      unresolvedQuestions: [
        makeQuestion({ id: 'q1', issueCode: 'DOC_TYPE_UNCERTAIN', fieldToResolve: 'documentType', blocksCommit: true }),
      ],
    });

    const state = buildEffectiveHarnessState({
      analysis,
      operatorDocType: 'CUSTOMER_DRAWING',
    });

    assert.strictEqual(state.effectiveDocumentType, 'CUSTOMER_DRAWING');
    assert.strictEqual(state.effectiveDocTypeSource, 'OPERATOR');
    assert.strictEqual(state.unresolvedQuestions.length, 0);
  });

  it('preserves DOC_TYPE_UNCERTAIN when no operator doc type is set', () => {
    const analysis = makeAnalysis({
      unresolvedQuestions: [makeQuestion()],
    });

    const state = buildEffectiveHarnessState({ analysis });

    assert.strictEqual(state.effectiveDocTypeSource, 'UNKNOWN');
    assert.strictEqual(state.unresolvedQuestions.length, 1);
    assert.strictEqual(state.unresolvedQuestions[0].issueCode, 'DOC_TYPE_UNCERTAIN');
  });

  it('uses analysis proposed type when operator has not selected', () => {
    const analysis = makeAnalysis({
      proposedDocumentType: 'INTERNAL_DRAWING',
      unresolvedQuestions:  [],
    });

    const state = buildEffectiveHarnessState({ analysis });

    assert.strictEqual(state.effectiveDocumentType, 'INTERNAL_DRAWING');
    assert.strictEqual(state.effectiveDocTypeSource, 'INFERRED');
  });

  it('suppresses part number questions when operator has confirmed part number', () => {
    const analysis = makeAnalysis({
      unresolvedQuestions: [
        makeQuestion({ id: 'q2', issueCode: 'PART_NUMBER_UNCERTAIN', fieldToResolve: 'partNumber', blocksCommit: true }),
      ],
    });

    const state = buildEffectiveHarnessState({
      analysis,
      operatorConfirmed: { partNumber: true },
    });

    assert.strictEqual(state.unresolvedQuestions.length, 0);
  });
});

// ---------------------------------------------------------------------------
// B. Effective connectivity uses T11 override values
// ---------------------------------------------------------------------------

describe('B: T11 wire override reflected in effective connectivity', () => {
  it('populates a blank FROM component after a DIRECT_OVERRIDE', () => {
    const wire = makeWireConnectivity('W5', null); // blank FROM
    const analysis = makeAnalysis({ connectivity: makeConnectivity([wire]) });

    const override: WireOperatorOverride = {
      wireId:            'W5',
      mode:              'DIRECT_OVERRIDE',
      from:              { component: 'J1', cavity: '2', treatment: null },
      to:                { component: 'J2', cavity: '3', treatment: null },
      reason:            'Operator verified from drawing',
      operatorConfirmed: true,
      appliedAt:         '2024-01-01T00:00:01.000Z',
    };

    const state = buildEffectiveHarnessState({
      analysis,
      wireOperatorOverrides: [override],
    });

    const w5 = state.effectiveConnectivity?.wires.find(w => w.wireId === 'W5');
    assert.ok(w5 !== undefined, 'expected W5 to be present in effective wires');
    assert.strictEqual(w5.from.component, 'J1');
    assert.strictEqual(w5.unresolved, false);
  });

  it('does not modify the original extracted connectivity', () => {
    const wire = makeWireConnectivity('W5', null);
    const connectivity = makeConnectivity([wire]);
    const analysis = makeAnalysis({ connectivity });

    const override: WireOperatorOverride = {
      wireId:            'W5',
      mode:              'DIRECT_OVERRIDE',
      from:              { component: 'J1', cavity: '2', treatment: null },
      to:                { component: 'J2', cavity: '3', treatment: null },
      reason:            'Override',
      operatorConfirmed: true,
      appliedAt:         '2024-01-01T00:00:01.000Z',
    };

    buildEffectiveHarnessState({ analysis, wireOperatorOverrides: [override] });

    // Original must be unchanged (E: immutability)
    assert.strictEqual(connectivity.wires[0].from.component, null);
    assert.strictEqual(connectivity.wires[0].unresolved, true);
  });
});

// ---------------------------------------------------------------------------
// C. Effective decision updates after override
// ---------------------------------------------------------------------------

describe('C: effective decision after wire override', () => {
  it('returns effectiveDecision from T11 result rather than stale analysis decision', () => {
    const wire = makeWireConnectivity('W1', null);
    const analysis = makeAnalysis({
      connectivity: makeConnectivity([wire]),
      decision:     makeDecision('BLOCKED'),
    });

    const override: WireOperatorOverride = {
      wireId:            'W1',
      mode:              'DIRECT_OVERRIDE',
      from:              { component: 'J1', cavity: '1', treatment: null },
      to:                { component: 'J2', cavity: '2', treatment: null },
      reason:            'Operator corrected',
      operatorConfirmed: true,
      appliedAt:         '2024-01-01T00:00:01.000Z',
    };

    const state = buildEffectiveHarnessState({
      analysis,
      wireOperatorOverrides: [override],
    });

    // effective decision should have been recomputed — object reference differs
    assert.notStrictEqual(state.effectiveDecision, analysis.harnessDecision);
  });

  it('returns raw analysis decision when no overrides are applied', () => {
    const analysis = makeAnalysis({ decision: makeDecision('SAFE') });
    const state = buildEffectiveHarnessState({ analysis });

    // No overrides: decision object should match analysis object
    assert.strictEqual(state.effectiveDecision, analysis.harnessDecision);
  });
});

// ---------------------------------------------------------------------------
// D. SKU edits reflected in effective connectivity
// ---------------------------------------------------------------------------

describe('D: T12 SKU model edits', () => {
  it('appends an added wire to effective connectivity', () => {
    const analysis = makeAnalysis({ connectivity: makeConnectivity([]) });
    const now = new Date().toISOString();
    const added: OperatorWireModel = {
      id:           'op-001',
      wireId:       'W-NEW',
      targetWireId: null,
      length:       10,
      lengthUnit:   'in',
      gauge:        '20',
      color:        'BLU',
      from:         { component: 'J1', cavity: '1', treatment: null, terminationType: 'CONNECTOR_PIN' },
      to:           { component: 'J2', cavity: '2', treatment: null, terminationType: 'CONNECTOR_PIN' },
      topology:     'LINEAR',
      branch:       null,
      reason:       'Added from BOM',
      source:       'OPERATOR_MODEL',
      authoritative: true,
      createdAt:    now,
      updatedAt:    now,
    };

    const state = buildEffectiveHarnessState({
      analysis,
      skuAddedWires: [added],
    });

    const w = state.effectiveConnectivity?.wires.find(w => w.wireId === 'W-NEW');
    assert.ok(w !== undefined, 'expected W-NEW to appear in effective connectivity');
  });

  it('removes a deleted wire from effective connectivity', () => {
    const wire = makeWireConnectivity('W-DEL', 'J1');
    const analysis = makeAnalysis({ connectivity: makeConnectivity([wire]) });

    const state = buildEffectiveHarnessState({
      analysis,
      skuDeletedWireIds: ['W-DEL'],
    });

    const found = state.effectiveConnectivity?.wires.find(w => w.wireId === 'W-DEL');
    assert.strictEqual(found, undefined);
  });
});

// ---------------------------------------------------------------------------
// F. Commit readiness from effective state
// ---------------------------------------------------------------------------

describe('F: commit readiness', () => {
  it('readyToCommit is false when blocking questions remain', () => {
    const analysis = makeAnalysis({
      unresolvedQuestions: [makeQuestion({ blocksCommit: true })],
    });

    const state = buildEffectiveHarnessState({ analysis });
    assert.strictEqual(state.readyToCommit, false);
  });

  it('readyToCommit is true when operator clears the only blocking question', () => {
    const analysis = makeAnalysis({
      unresolvedQuestions: [
        makeQuestion({ issueCode: 'DOC_TYPE_UNCERTAIN', fieldToResolve: 'documentType', blocksCommit: true }),
      ],
    });

    const state = buildEffectiveHarnessState({
      analysis,
      operatorDocType: 'CUSTOMER_DRAWING',
    });

    assert.strictEqual(state.readyToCommit, true);
  });

  it('readyToCommit is true when no blocking questions exist', () => {
    const analysis = makeAnalysis({ unresolvedQuestions: [] });
    const state = buildEffectiveHarnessState({ analysis });
    assert.strictEqual(state.readyToCommit, true);
  });

  it('non-blocking questions do not prevent readyToCommit', () => {
    const analysis = makeAnalysis({
      unresolvedQuestions: [
        makeQuestion({ id: 'info', blocksCommit: false }),
      ],
    });

    const state = buildEffectiveHarnessState({ analysis });
    assert.strictEqual(state.readyToCommit, true);
  });
});
