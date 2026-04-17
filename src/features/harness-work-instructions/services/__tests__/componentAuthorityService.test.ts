import { describe, it } from 'node:test';
import assert from 'assert/strict';

import type { HarnessConnectivityResult } from '../harnessConnectivityService';
import {
  buildComponentAuthorityOptions,
  isComponentAuthoritySelectionValid,
  mergeComponentAuthorityOptions,
  getCavityAuthority,
} from '../componentAuthorityService';

function makeConnectivity(): HarnessConnectivityResult {
  return {
    wires: [
      {
        wireId: 'W1',
        length: 3,
        lengthUnit: 'in',
        lengthInches: 3,
        gauge: '18',
        color: 'BRN',
        confidence: 0.95,
        unresolved: false,
        sourceRowIndex: 0,
        rawText: '[EXTRACTED] W1',
        from: {
          component: 'PHOENIX 1700443',
          cavity: '2',
          terminationType: 'CONNECTOR_PIN',
          treatment: null,
        },
        to: {
          component: 'TB1',
          cavity: null,
          terminationType: 'TERMINAL',
          treatment: null,
        },
      },
      {
        wireId: 'W2',
        length: 3,
        lengthUnit: 'in',
        lengthInches: 3,
        gauge: '18',
        color: 'BRN',
        confidence: 0.95,
        unresolved: false,
        sourceRowIndex: 1,
        rawText: '[EXTRACTED] W2',
        from: {
          component: 'PHOENIX #: 1700443',
          cavity: '5',
          terminationType: 'CONNECTOR_PIN',
          treatment: null,
        },
        to: {
          component: 'TB1',
          cavity: null,
          terminationType: 'TERMINAL',
          treatment: null,
        },
      },
    ],
    unresolvedWires: [],
    confidenceSummary: { total: 2, resolved: 2, partial: 0, unresolved: 0 },
  };
}

describe('componentAuthorityService', () => {
  it('builds canonical connector options with merged cavities', () => {
    const connectivity = makeConnectivity();
    const options = buildComponentAuthorityOptions(connectivity);
    const phoenix = options.find(opt => opt.canonicalId === 'phoenix:1700443');
    assert.ok(phoenix, 'Phoenix connector should be discovered');
    assert.equal(phoenix!.displayName, 'PHOENIX 1700443');
    assert.deepEqual(phoenix!.cavities, ['2', '5']);
    assert.equal(phoenix!.kind, 'CONNECTOR');
  });

  it('validates selected component canonical IDs against authority set', () => {
    const connectivity = makeConnectivity();
    const options = buildComponentAuthorityOptions(connectivity);
    assert.equal(isComponentAuthoritySelectionValid('phoenix:1700443', options), true);
    assert.equal(isComponentAuthoritySelectionValid('pheonix:1700443', options), false);
  });

  it('merges component options from multiple sources and de-dupes cavities', () => {
    const connectivity = makeConnectivity();
    const optionsA = buildComponentAuthorityOptions(connectivity);
    const optionsB = [{
      canonicalId: 'phoenix:1700443',
      displayName: 'PHOENIX CONTACT 1700443',
      cavities: ['7'],
      kind: 'CONNECTOR' as const,
    }];
    const merged = mergeComponentAuthorityOptions(optionsA, optionsB);
    const phoenix = merged.find(opt => opt.canonicalId === 'phoenix:1700443');
    assert.ok(phoenix, 'Merged connector should remain');
    assert.deepEqual(phoenix!.cavities, ['2', '5', '7']);
  });

  // T23.6.10: Cavity authority tests
  describe('getCavityAuthority', () => {
    it('Phoenix 1700443 gets full 6-cavity authority from fallback', () => {
      const auth = getCavityAuthority('phoenix:1700443', []);
      assert.equal(auth.source, 'FALLBACK_RULE');
      assert.deepEqual(auth.cavities, ['1', '2', '3', '4', '5', '6']);
    });

    it('Phoenix fallback merges with observed cavities (no duplicates)', () => {
      const auth = getCavityAuthority('phoenix:1700443', ['2', '4']);
      assert.equal(auth.source, 'FALLBACK_RULE');
      assert.deepEqual(auth.cavities, ['1', '2', '3', '4', '5', '6']);
    });

    it('observed pins 1,2,3,4,6 still produce dropdown with pin 5 via fallback', () => {
      const observedOnly = ['1', '2', '3', '4', '6'];
      const auth = getCavityAuthority('phoenix:1700443', observedOnly);
      assert.ok(auth.cavities.includes('5'), 'Pin 5 must be reachable even when absent from observed pins');
      assert.deepEqual(auth.cavities, ['1', '2', '3', '4', '5', '6']);
    });

    it('unknown connector returns OBSERVED_ONLY with exactly the observed cavities', () => {
      const auth = getCavityAuthority('j1:j1', ['1', '3']);
      assert.equal(auth.source, 'OBSERVED_ONLY');
      assert.deepEqual(auth.cavities, ['1', '3']);
    });

    it('unknown connector with no observed cavities returns empty list (free-text fallback)', () => {
      const auth = getCavityAuthority('j-unknown:junk', []);
      assert.equal(auth.source, 'OBSERVED_ONLY');
      assert.deepEqual(auth.cavities, []);
    });

    it('haunted case: authoritative option from extracted wires (pins 2 only) still yields full 6', () => {
      const connectivity = {
        wires: [{
          wireId: 'W-haunted',
          length: 3, lengthUnit: 'in' as const, lengthInches: 3,
          gauge: '18', color: 'BRN',
          confidence: 0.95, unresolved: false, sourceRowIndex: 0, rawText: 'W-haunted',
          from: { component: 'PHOENIX 1700443', cavity: '2', terminationType: 'CONNECTOR_PIN' as const, treatment: null },
          to:   { component: 'TB1', cavity: null, terminationType: 'TERMINAL' as const, treatment: null },
        }],
        unresolvedWires: [],
        confidenceSummary: { total: 1, resolved: 1, partial: 0, unresolved: 0 },
      };
      const options = buildComponentAuthorityOptions(connectivity);
      const phoenix = options.find(opt => opt.canonicalId === 'phoenix:1700443')!;
      assert.ok(phoenix, 'Phoenix must appear in authority options');
      assert.deepEqual(phoenix.cavities, ['2'], 'Observed cavities = only 2 (extracted)');

      const auth = getCavityAuthority(phoenix.canonicalId, phoenix.cavities);
      assert.equal(auth.source, 'FALLBACK_RULE');
      assert.deepEqual(auth.cavities, ['1', '2', '3', '4', '5', '6'], 'Full capacity from fallback');
      assert.ok(auth.cavities.includes('5'), 'Pin 5 selectable after fix');
    });
  });
});
