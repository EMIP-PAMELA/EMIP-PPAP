import { describe, it } from 'node:test';
import assert from 'assert/strict';

import type { HarnessConnectivityResult } from '../harnessConnectivityService';
import {
  buildComponentAuthorityOptions,
  isComponentAuthoritySelectionValid,
  mergeComponentAuthorityOptions,
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
});
