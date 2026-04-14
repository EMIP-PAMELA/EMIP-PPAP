/**
 * diagramExtractor.test.ts — Phase T4 unit tests
 *
 * Tests for the diagram region extractor: line isolation, deterministic
 * component/callout detection, deduplication, unresolved callouts, and
 * AI merge behavior (mocked DiagramVisionResult — no real API calls).
 */

import { describe, it } from 'node:test';
import assert from 'assert/strict';
import {
  isolateDiagramLines,
  extractDiagramComponents,
  mergeWithVisionResult,
  type DiagramVisionResult,
} from '../diagramExtractor';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function lines(...strs: string[]): string[] {
  return strs.map(s => s.trim()).filter(Boolean);
}

// ---------------------------------------------------------------------------
// isolateDiagramLines
// ---------------------------------------------------------------------------

describe('T4 isolateDiagramLines', () => {
  it('returns all lines when wireTableHeaderIdx is null', () => {
    const all = lines('HARNESS DIAGRAM', 'PHOENIX CONTACT', 'ACI01960');
    const result = isolateDiagramLines(all, null);
    assert.deepEqual(result, all);
  });

  it('slices lines before wire table header', () => {
    const all = lines(
      'HARNESS DIAGRAM',
      'ACI01960',
      'I.D.  LENGTH  GAUGE  COLOR',  // wire table header at index 2
      'W1  100  20AWG  BK',
    );
    const result = isolateDiagramLines(all, 2);
    assert.equal(result.length, 2);
    assert.equal(result[0], 'HARNESS DIAGRAM');
    assert.equal(result[1], 'ACI01960');
  });

  it('excludes title block lines', () => {
    const all = lines(
      'HARNESS DIAGRAM',
      'DRAWN BY: JD',         // title block line
      'APPROVED BY: MR',      // title block line
      'ACI01960',
    );
    const result = isolateDiagramLines(all, null);
    assert.equal(result.length, 2);
    assert.ok(!result.includes('DRAWN BY: JD'));
  });

  it('excludes Apogee DRN lines', () => {
    const all = lines('ACI01960', '527-1234-010', 'PHOENIX CONTACT');
    const result = isolateDiagramLines(all, null);
    assert.equal(result.length, 2);
    assert.ok(!result.includes('527-1234-010'));
  });

  it('filters lines shorter than 2 characters', () => {
    const all = lines('A', 'ACI01960', 'B');
    const result = isolateDiagramLines(all, null);
    assert.equal(result.length, 1);
    assert.equal(result[0], 'ACI01960');
  });

  it('returns empty array when wireTableHeaderIdx is 0', () => {
    const all = lines('I.D.  LENGTH  GAUGE  COLOR', 'W1  100  20AWG  BK');
    const result = isolateDiagramLines(all, 0);
    assert.equal(result.length, 0);
  });
});

// ---------------------------------------------------------------------------
// extractDiagramComponents — Phoenix detection
// ---------------------------------------------------------------------------

describe('T4 extractDiagramComponents: Phoenix detection', () => {
  it('detects PHOENIX keyword as CONNECTOR with locationHint LEFT', () => {
    const result = extractDiagramComponents(lines('PHOENIX CONTACT BLOCK'));
    assert.equal(result.components.length, 1);
    const comp = result.components[0];
    assert.equal(comp.type, 'CONNECTOR');
    assert.equal(comp.locationHint, 'LEFT');
    assert.equal(comp.label, 'PHOENIX CONTACT');
    assert.equal(comp.source, 'OCR');
  });

  it('extracts Phoenix PN from keyword line', () => {
    const result = extractDiagramComponents(lines('PHOENIX CONTACT 1700443'));
    const comp = result.components[0];
    assert.equal(comp.normalizedPartNumber, '1700443');
    assert.equal(comp.label, 'PHOENIX 1700443');
  });

  it('detects Phoenix PN standalone (no keyword)', () => {
    const result = extractDiagramComponents(lines('1700443'));
    assert.equal(result.components.length, 1);
    assert.equal(result.components[0].normalizedPartNumber, '1700443');
    assert.equal(result.components[0].locationHint, 'LEFT');
    assert.equal(result.components[0].confidence, 0.70);
  });

  it('deduplicates Phoenix CONTACT across multiple lines', () => {
    const result = extractDiagramComponents(lines(
      'PHOENIX CONTACT',
      'PHOENIX CONTACT',
    ));
    assert.equal(result.components.length, 1);
  });

  it('deduplicates Phoenix PN across multiple lines', () => {
    const result = extractDiagramComponents(lines('PHOENIX 1700443', '1700443'));
    // First line adds PHOENIX 1700443; second line would re-add same PN but dedup catches it
    const connectors = result.components.filter(c => c.normalizedPartNumber === '1700443');
    assert.equal(connectors.length, 1);
  });
});

// ---------------------------------------------------------------------------
// extractDiagramComponents — ACI callout detection
// ---------------------------------------------------------------------------

describe('T4 extractDiagramComponents: ACI callout detection', () => {
  it('detects ACI callout token as a Callout', () => {
    const result = extractDiagramComponents(lines('ACI01960'));
    assert.equal(result.components.length, 0);
    assert.equal(result.callouts.length, 1);
    assert.equal(result.callouts[0].text, 'ACI01960');
    assert.equal(result.callouts[0].source, 'OCR');
    assert.equal(result.callouts[0].normalizedPartNumber, null); // ACI is label, not PN
  });

  it('detects multiple ACI callouts on the same line', () => {
    const result = extractDiagramComponents(lines('ACI01960 ACI10898'));
    assert.equal(result.callouts.length, 2);
  });

  it('deduplicates ACI callouts across lines', () => {
    const result = extractDiagramComponents(lines('ACI01960', 'ACI01960'));
    assert.equal(result.callouts.length, 1);
  });

  it('ACI callout is unresolved when no component is nearby', () => {
    const result = extractDiagramComponents(lines('ACI01960'));
    assert.equal(result.unresolvedCallouts.length, 1);
    assert.equal(result.unresolvedCallouts[0], 'ACI01960');
  });
});

// ---------------------------------------------------------------------------
// extractDiagramComponents — connector ref detection
// ---------------------------------------------------------------------------

describe('T4 extractDiagramComponents: connector ref detection', () => {
  it('detects J-prefix connector reference', () => {
    const result = extractDiagramComponents(lines('J1 CONNECTOR'));
    const j1 = result.components.find(c => c.label === 'J1');
    assert.ok(j1, 'J1 connector not found');
    assert.equal(j1.type, 'CONNECTOR');
    assert.equal(j1.locationHint, null);
  });

  it('detects P-prefix and X-prefix connector refs', () => {
    const result = extractDiagramComponents(lines('P2 X3'));
    const labels = result.components.map(c => c.label);
    assert.ok(labels.includes('P2'));
    assert.ok(labels.includes('X3'));
  });

  it('deduplicates connector refs', () => {
    const result = extractDiagramComponents(lines('J1', 'J1 HOUSING'));
    const j1s = result.components.filter(c => c.label === 'J1');
    assert.equal(j1s.length, 1);
  });
});

// ---------------------------------------------------------------------------
// extractDiagramComponents — terminal PN callout detection
// ---------------------------------------------------------------------------

describe('T4 extractDiagramComponents: terminal PN callout detection', () => {
  it('detects terminal PN as a Callout with normalizedPartNumber', () => {
    const result = extractDiagramComponents(lines('929504-1'));
    assert.equal(result.callouts.length, 1);
    assert.equal(result.callouts[0].text, '929504-1');
    assert.equal(result.callouts[0].normalizedPartNumber, '929504-1');
  });

  it('deduplicates terminal PNs', () => {
    const result = extractDiagramComponents(lines('929504-1', '929504-1'));
    assert.equal(result.callouts.length, 1);
  });
});

// ---------------------------------------------------------------------------
// extractDiagramComponents — callout→component proximity association
// ---------------------------------------------------------------------------

describe('T4 extractDiagramComponents: callout association', () => {
  it('associates callout to nearby component within line proximity', () => {
    const result = extractDiagramComponents(lines(
      'PHOENIX CONTACT',   // line 0: CONNECTOR detected
      'ACI01960',          // line 1: Callout — distance 1 from PHOENIX → associated
    ));
    const callout = result.callouts.find(c => c.text === 'ACI01960');
    assert.ok(callout, 'ACI01960 callout not found');
    assert.ok(callout.associatedComponentId !== null, 'callout should be associated');
    assert.equal(result.unresolvedCallouts.length, 0);
  });

  it('leaves callout unresolved when no component is within proximity', () => {
    const diagramLines = [
      'PHOENIX CONTACT',   // line 0
      'some text line 1',
      'some text line 2',
      'some text line 3',
      'some text line 4',
      'some text line 5',
      'some text line 6',  // 6 lines away from Phoenix
      'ACI01960',          // line 7: distance > 6 from PHOENIX
    ];
    const result = extractDiagramComponents(diagramLines);
    const callout = result.callouts.find(c => c.text === 'ACI01960');
    assert.ok(callout);
    assert.equal(callout.associatedComponentId, null);
    assert.ok(result.unresolvedCallouts.includes('ACI01960'));
  });
});

// ---------------------------------------------------------------------------
// extractDiagramComponents — mixed OCR noise
// ---------------------------------------------------------------------------

describe('T4 extractDiagramComponents: OCR noise handling', () => {
  it('ignores lines with no detectable pattern', () => {
    const result = extractDiagramComponents(lines(
      'SOME RANDOM TEXT',
      'PAGE 1 OF 2',
      'SEE TABLE BELOW',
    ));
    assert.equal(result.components.length, 0);
    assert.equal(result.callouts.length, 0);
  });

  it('handles empty input gracefully', () => {
    const result = extractDiagramComponents([]);
    assert.equal(result.components.length, 0);
    assert.equal(result.callouts.length, 0);
    assert.equal(result.unresolvedCallouts.length, 0);
  });

  it('handles mixed signal and noise lines', () => {
    const result = extractDiagramComponents(lines(
      'PAGE HEADER',
      'PHOENIX CONTACT 1700443',
      'RANDOM ANNOTATION',
      'ACI01960',
      'SEE NOTES',
    ));
    assert.equal(result.components.length, 1);
    assert.equal(result.callouts.length, 1);
  });
});

// ---------------------------------------------------------------------------
// mergeWithVisionResult — AI additive-only merge
// ---------------------------------------------------------------------------

describe('T4 mergeWithVisionResult', () => {
  it('returns deterministic unchanged when vision is null', () => {
    const det = extractDiagramComponents(lines('PHOENIX CONTACT'));
    const merged = mergeWithVisionResult(det, null);
    assert.deepEqual(merged, det);
  });

  it('adds novel AI components not in deterministic result', () => {
    const det = extractDiagramComponents(lines('PHOENIX CONTACT'));
    const vision: DiagramVisionResult = {
      components: [{ label: 'J1', type: 'CONNECTOR', partNumber: null, position: 'RIGHT' }],
      callouts:   [],
    };
    const merged = mergeWithVisionResult(det, vision);
    assert.equal(merged.components.length, 2);
    const j1 = merged.components.find(c => c.label === 'J1');
    assert.ok(j1);
    assert.equal(j1.source, 'VISION');
    assert.equal(j1.locationHint, 'RIGHT');
  });

  it('does NOT add AI component that duplicates existing label', () => {
    const det = extractDiagramComponents(lines('PHOENIX CONTACT'));
    const vision: DiagramVisionResult = {
      components: [{ label: 'PHOENIX CONTACT', type: 'CONNECTOR', partNumber: null, position: null }],
      callouts:   [],
    };
    const merged = mergeWithVisionResult(det, vision);
    const phoenixComps = merged.components.filter(c => c.label === 'PHOENIX CONTACT');
    assert.equal(phoenixComps.length, 1);
  });

  it('does NOT add AI component that duplicates existing normalizedPartNumber', () => {
    const det = extractDiagramComponents(lines('PHOENIX CONTACT 1700443'));
    const vision: DiagramVisionResult = {
      components: [{ label: 'PHOENIX 1700443', type: 'CONNECTOR', partNumber: '1700443', position: null }],
      callouts:   [],
    };
    const merged = mergeWithVisionResult(det, vision);
    const pn1700443 = merged.components.filter(c => c.normalizedPartNumber === '1700443');
    assert.equal(pn1700443.length, 1);
  });

  it('adds novel AI callouts', () => {
    const det = extractDiagramComponents(lines('PHOENIX CONTACT'));
    const vision: DiagramVisionResult = {
      components: [],
      callouts:   [{ text: 'ACI01960', partNumber: null, associatedComponent: null }],
    };
    const merged = mergeWithVisionResult(det, vision);
    assert.equal(merged.callouts.length, 1);
    assert.equal(merged.callouts[0].source, 'VISION');
    assert.ok(merged.unresolvedCallouts.includes('ACI01960'));
  });

  it('does NOT add AI callout that duplicates existing callout text', () => {
    const det = extractDiagramComponents(lines('ACI01960'));
    const vision: DiagramVisionResult = {
      components: [],
      callouts:   [{ text: 'ACI01960', partNumber: null, associatedComponent: null }],
    };
    const merged = mergeWithVisionResult(det, vision);
    const aciCallouts = merged.callouts.filter(c => c.text === 'ACI01960');
    assert.equal(aciCallouts.length, 1);
  });

  it('AI source markers have lower confidence than OCR base', () => {
    const det = extractDiagramComponents(lines('PHOENIX CONTACT'));
    const vision: DiagramVisionResult = {
      components: [{ label: 'J1', type: 'CONNECTOR', partNumber: null, position: null }],
      callouts:   [],
    };
    const merged = mergeWithVisionResult(det, vision);
    const j1 = merged.components.find(c => c.label === 'J1');
    const phoenix = merged.components.find(c => c.label === 'PHOENIX CONTACT');
    assert.ok(j1!.confidence < phoenix!.confidence);
  });
});

// ---------------------------------------------------------------------------
// Full pipeline: isolate + extract (integrated)
// ---------------------------------------------------------------------------

describe('T4 full pipeline integration', () => {
  it('realistic diagram snippet: Phoenix + ACI + terminal PN', () => {
    const allLines = [
      'HARNESS ASSEMBLY DRAWING',
      'PHOENIX CONTACT 1700443',
      'ACI01960',
      '929504-1',
      'I.D.  LENGTH  GAUGE  COLOR  CONN  PIN  TERMINAL',   // wire table header at idx 4
      'W1  100  20AWG  BK  J1  A  929504-1',
    ];
    const diagramLines = isolateDiagramLines(allLines, 4);
    assert.equal(diagramLines.length, 4);

    const result = extractDiagramComponents(diagramLines);
    assert.equal(result.components.length, 1);
    assert.equal(result.components[0].label, 'PHOENIX 1700443');

    const aciCallout = result.callouts.find(c => c.text === 'ACI01960');
    assert.ok(aciCallout, 'ACI01960 callout missing');

    const termCallout = result.callouts.find(c => c.text === '929504-1');
    assert.ok(termCallout, '929504-1 terminal callout missing');
  });

  it('no contamination: title block lines excluded', () => {
    const allLines = [
      'PHOENIX CONTACT',
      'DRAWN BY: JD',
      '527-1234-010',
      'ACI01960',
    ];
    const diagramLines = isolateDiagramLines(allLines, null);
    assert.equal(diagramLines.length, 2);
    const result = extractDiagramComponents(diagramLines);
    assert.equal(result.components.length, 1);
    assert.equal(result.callouts.length, 1);
  });
});
