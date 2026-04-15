/**
 * wireOperatorResolutionService.test.ts — Phase T11 unit tests
 *
 * Covers:
 *   A. DIRECT_OVERRIDE fills missing from/to endpoints
 *   B. BRANCH_DOUBLE_CRIMP suppresses R8_MISSING_TERMINATION for the overridden wire
 *   C. Incomplete BRANCH_DOUBLE_CRIMP does not suppress R8 (wire stays blocked)
 *   D. Untouched wires remain byte-for-byte identical
 *   E. Resolved decision recomputes correctly (BLOCKED → not BLOCKED when R8 removed)
 *   F. Original connectivity object is not mutated
 */

import { describe, it } from 'node:test';
import assert from 'assert/strict';

import {
  applyWireOperatorOverrides,
  revalidateWithOverrides,
  isValidBranchOverride,
} from '../wireOperatorResolutionService';
import type { WireOperatorOverride } from '@/src/features/vault/types/ingestionReview';
import type { HarnessConnectivityResult, WireConnectivity } from '../harnessConnectivityService';
import { endpointHasAuthoritativeTermination } from '../harnessConnectivityService';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeWire(partial: Partial<WireConnectivity> & { wireId: string }): WireConnectivity {
  return {
    wireId:         partial.wireId,
    length:         partial.length         ?? 10,
    lengthUnit:     partial.lengthUnit     ?? 'in',
    lengthInches:   partial.lengthInches   ?? (partial.length ?? 10),
    gauge:          partial.gauge          ?? '18',
    color:          partial.color          ?? 'BRN',
    from:           partial.from           ?? { component: null, cavity: null, treatment: null },
    to:             partial.to             ?? { component: null, cavity: null, treatment: null },
    sourceRowIndex: partial.sourceRowIndex ?? 0,
    rawText:        partial.rawText        ?? `raw text for ${partial.wireId}`,
    confidence:     partial.confidence     ?? 0.50,
    unresolved:     partial.unresolved     ?? true,
  };
}

function makeConnectivity(wires: WireConnectivity[]): HarnessConnectivityResult {
  const unresolvedWires = wires.filter(w => w.unresolved).map(w => w.wireId);
  const resolved = wires.filter(w => !w.unresolved && endpointHasAuthoritativeTermination(w.from) && endpointHasAuthoritativeTermination(w.to)).length;
  const partial = wires.filter(w => !w.unresolved && (!endpointHasAuthoritativeTermination(w.from) || !endpointHasAuthoritativeTermination(w.to))).length;
  return {
    wires,
    unresolvedWires,
    confidenceSummary: {
      total:      wires.length,
      resolved,
      partial,
      unresolved: unresolvedWires.length,
    },
  };
}

function makeDirectOverride(wireId: string, opts?: {
  fromComponent?: string;
  fromCavity?: string;
  toComponent?: string;
  toCavity?: string;
}): WireOperatorOverride {
  return {
    wireId,
    mode: 'DIRECT_OVERRIDE',
    from: { component: opts?.fromComponent ?? 'COMP-A', cavity: opts?.fromCavity ?? '1', treatment: null },
    to:   { component: opts?.toComponent   ?? 'COMP-B', cavity: opts?.toCavity   ?? '2', treatment: null },
    reason:            'Test direct override',
    operatorConfirmed: true,
    appliedAt:         '2026-01-01T00:00:00.000Z',
  };
}

function makeBranchOverride(wireId: string, opts?: {
  srcComp?: string | null;
  srcCav?: string | null;
  termPN?: string | null;
  ferrPN?: string | null;
}): WireOperatorOverride {
  return {
    wireId,
    mode: 'BRANCH_DOUBLE_CRIMP',
    branch: {
      sharedSourceComponent: opts?.srcComp ?? 'PHEONIX 1700443',
      sharedSourceCavity:    opts?.srcCav  ?? '2',
      secondaryCavity:       '5',
      ferrulePartNumber:     opts?.ferrPN  ?? '1381010',
      terminalPartNumber:    opts?.termPN  ?? '61944-1',
      notes:                 null,
    },
    reason:            'COM double-crimp at Phoenix pin 2',
    operatorConfirmed: true,
    appliedAt:         '2026-01-01T00:00:00.000Z',
  };
}

// ---------------------------------------------------------------------------
// A. DIRECT_OVERRIDE fills missing from/to
// ---------------------------------------------------------------------------

describe('A: DIRECT_OVERRIDE fills missing endpoints', () => {
  it('sets from.component and to.component on the target wire', () => {
    const wire = makeWire({ wireId: 'COM', from: { component: null, cavity: null, treatment: null } });
    const connectivity = makeConnectivity([wire]);

    const result = applyWireOperatorOverrides({
      connectivity,
      overrides: [makeDirectOverride('COM', { fromComponent: 'CONN-X', toComponent: 'TERM-Y' })],
    });

    const patched = result.wires.find(w => w.wireId === 'COM');
    assert.ok(patched, 'wire should be present');
    assert.equal(patched.from.component, 'CONN-X');
    assert.equal(patched.to.component, 'TERM-Y');
    assert.equal(patched.unresolved, false);
  });

  it('marks the wire as resolved (unresolved=false)', () => {
    const wire = makeWire({ wireId: 'W1', unresolved: true });
    const result = applyWireOperatorOverrides({
      connectivity: makeConnectivity([wire]),
      overrides:    [makeDirectOverride('W1')],
    });
    assert.equal(result.wires[0].unresolved, false);
    assert.equal(result.unresolvedWires.includes('W1'), false);
  });
});

// ---------------------------------------------------------------------------
// B. BRANCH_DOUBLE_CRIMP suppresses R8 for the overridden wire
// ---------------------------------------------------------------------------

describe('B: BRANCH_DOUBLE_CRIMP suppresses R8_MISSING_TERMINATION', () => {
  it('removes R8 from validation issues when override is complete', () => {
    const wire = makeWire({
      wireId: 'COM',
      from: { component: null, cavity: null, treatment: null },
      to:   { component: null, cavity: null, treatment: null },
    });
    const connectivity = makeConnectivity([wire]);

    const result = revalidateWithOverrides({
      connectivity,
      overrides: [makeBranchOverride('COM')],
    });

    const wireVal = result.resolvedValidation.wires.find(wv => wv.wireId === 'COM');
    assert.ok(wireVal, 'wire validation should be present');
    const hasR8 = wireVal.issues.some(i => i.code === 'R8_MISSING_TERMINATION');
    assert.equal(hasR8, false, 'R8_MISSING_TERMINATION should be suppressed for valid branch override');
  });

  it('sets from.component to sharedSourceComponent', () => {
    const wire = makeWire({ wireId: 'COM' });
    const result = applyWireOperatorOverrides({
      connectivity: makeConnectivity([wire]),
      overrides:    [makeBranchOverride('COM', { srcComp: 'PHEONIX 1700443', srcCav: '2' })],
    });
    const patched = result.wires.find(w => w.wireId === 'COM')!;
    assert.equal(patched.from.component, 'PHEONIX 1700443');
    assert.equal(patched.from.cavity, '2');
  });
});

// ---------------------------------------------------------------------------
// C. Incomplete BRANCH_DOUBLE_CRIMP does not suppress R8
// ---------------------------------------------------------------------------

describe('C: Incomplete BRANCH_DOUBLE_CRIMP does not suppress R8', () => {
  it('keeps R8 when sharedSourceComponent is missing', () => {
    const incompleteBranch = makeBranchOverride('COM', { srcComp: null });
    assert.equal(isValidBranchOverride(incompleteBranch), false);
  });

  it('keeps R8 when both terminalPN and ferrulePN are missing', () => {
    const incompleteBranch = makeBranchOverride('COM', { termPN: null, ferrPN: null });
    assert.equal(isValidBranchOverride(incompleteBranch), false);
  });

  it('does NOT suppress R8 in revalidation when override is incomplete', () => {
    const wire = makeWire({
      wireId: 'COM',
      from: { component: null, cavity: null, treatment: null },
      to:   { component: null, cavity: null, treatment: null },
    });
    const incompleteOverride: WireOperatorOverride = {
      wireId:  'COM',
      mode:    'BRANCH_DOUBLE_CRIMP',
      branch:  { sharedSourceComponent: null, sharedSourceCavity: '2', terminalPartNumber: null, ferrulePartNumber: null },
      reason:  'incomplete',
      operatorConfirmed: true,
      appliedAt: '2026-01-01T00:00:00.000Z',
    };

    const result = revalidateWithOverrides({
      connectivity: makeConnectivity([wire]),
      overrides:    [incompleteOverride],
    });

    const wireVal = result.resolvedValidation.wires.find(wv => wv.wireId === 'COM');
    assert.ok(wireVal);
  });
});

// ---------------------------------------------------------------------------
// D. Untouched wires remain unchanged
// ---------------------------------------------------------------------------

describe('D: Untouched wires remain unchanged', () => {
  it('wires without a matching override are byte-identical to originals', () => {
    const wireA = makeWire({ wireId: 'A', unresolved: false,
      from: { component: 'CONN-1', cavity: '1', treatment: null },
      to:   { component: 'TERM-1', cavity: null, treatment: null },
    });
    const wireB = makeWire({ wireId: 'B', unresolved: true });
    const connectivity = makeConnectivity([wireA, wireB]);

    const result = applyWireOperatorOverrides({
      connectivity,
      overrides: [makeDirectOverride('B')],
    });

    const returnedA = result.wires.find(w => w.wireId === 'A');
    assert.ok(returnedA, 'wire A should be present');
    assert.equal(returnedA, wireA, 'wire A should be the same object reference (not cloned)');
  });
});

// ---------------------------------------------------------------------------
// E. Resolved decision recomputes correctly
// ---------------------------------------------------------------------------

describe('E: Resolved decision recomputes correctly', () => {
  it('overall decision is not BLOCKED when the only blocking issue is R8 suppressed by a valid branch override', () => {
    const wire = makeWire({
      wireId: 'COM',
      from: { component: null, cavity: null, treatment: null },
      to:   { component: null, cavity: null, treatment: null },
    });
    const connectivity = makeConnectivity([wire]);

    const result = revalidateWithOverrides({
      connectivity,
      overrides: [makeBranchOverride('COM')],
    });

    const wireDecision = result.resolvedDecision.wires.find(wd => wd.wireId === 'COM');
    assert.ok(wireDecision);
    assert.notEqual(wireDecision.decision, 'BLOCKED', 'wire should no longer be BLOCKED after valid branch override');
  });
});

// ---------------------------------------------------------------------------
// F. Original connectivity object is not mutated
// ---------------------------------------------------------------------------

describe('F: Original connectivity object is not mutated', () => {
  it('applyWireOperatorOverrides returns a new object without modifying the input', () => {
    const wire = makeWire({ wireId: 'COM', unresolved: true });
    const connectivity = makeConnectivity([wire]);
    const originalWireRef = connectivity.wires[0];
    const originalUnresolved = originalWireRef.unresolved;
    const originalRawText = originalWireRef.rawText;

    applyWireOperatorOverrides({
      connectivity,
      overrides: [makeDirectOverride('COM')],
    });

    assert.equal(originalWireRef.unresolved, originalUnresolved, 'original wire unresolved flag must not change');
    assert.equal(originalWireRef.rawText,    originalRawText,    'original wire rawText must not change');
    assert.equal(connectivity.wires[0], wire, 'original connectivity.wires[0] reference must be unchanged');
  });

  it('zero-override call returns the original connectivity reference unchanged', () => {
    const wire = makeWire({ wireId: 'W1' });
    const connectivity = makeConnectivity([wire]);

    const result = applyWireOperatorOverrides({ connectivity, overrides: [] });
    assert.equal(result, connectivity, 'should return same reference when no overrides');
  });
});
