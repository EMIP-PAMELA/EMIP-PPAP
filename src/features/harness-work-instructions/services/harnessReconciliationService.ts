/**
 * Harness Reconciliation Service — Phase T5
 *
 * Reconciles HC-BOM endpoint labels (T2) against diagram-extracted
 * ComponentNodes and Callouts (T4), promoting string-based endpoints into
 * structured component references and reporting match quality, ambiguity,
 * and gaps.
 *
 * Governance:
 *   - Pure function. No I/O, no DB calls, no side effects. Never throws.
 *   - DOES NOT modify HC-BOM or diagram extraction outputs.
 *   - DOES NOT force matches when ambiguous.
 *   - Ambiguous and unmatched states are preserved, never collapsed.
 *   - Deterministic-first: no AI in the matching path.
 *   - All outputs are INTERMEDIATE structured signals — not authoritative.
 *   - Original endpoint labels are always preserved in ReconciledEndpoint.
 */

import type { HarnessConnectivityResult } from './harnessConnectivityService';
import type { DiagramExtractionResult } from './diagramExtractor';

// ---------------------------------------------------------------------------
// Data Model
// ---------------------------------------------------------------------------

export type MatchType = 'EXACT' | 'FUZZY' | 'PN_MATCH' | 'NONE' | 'AMBIGUOUS';

export interface ReconciledEndpoint {
  /** Original string label from HC-BOM — never overwritten. */
  originalLabel: string | null;
  /** ID of the matched ComponentNode or synthetic callout ID, or null. */
  matchedComponentId: string | null;
  /** Label of the matched item, for display convenience. */
  matchedLabel: string | null;
  matchType: MatchType;
  confidence: number;
  /** Populated only when matchType === 'AMBIGUOUS'. */
  candidateComponentIds?: string[];
}

export interface ReconciledWire {
  wireId: string;
  from: ReconciledEndpoint;
  to: ReconciledEndpoint;
  /**
   * True when either endpoint is not EXACT or PN_MATCH.
   * Independent of HC-BOM wire.unresolved (which reflects T2 ambiguity).
   */
  unresolved: boolean;
}

export interface HarnessReconciliationResult {
  wires: ReconciledWire[];
  summary: {
    total: number;
    /** Both endpoints are EXACT or PN_MATCH. */
    fullyMatched: number;
    /** Exactly one endpoint is EXACT or PN_MATCH. */
    partialMatched: number;
    /** Both endpoints are NONE (no candidate found). */
    unmatched: number;
    /** Any endpoint is AMBIGUOUS (multiple candidates, not resolved). */
    ambiguous: number;
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MATCH_CONFIDENCE: Record<MatchType, number> = {
  EXACT:     0.95,
  PN_MATCH:  0.90,
  FUZZY:     0.75,
  AMBIGUOUS: 0.50,
  NONE:      0.00,
};

const STRONG_MATCH_TYPES = new Set<MatchType>(['EXACT', 'PN_MATCH']);

// ---------------------------------------------------------------------------
// Internal: Matchable items index
// ---------------------------------------------------------------------------

/**
 * A flat matchable item derived from either a ComponentNode or a Callout.
 * Terminal PNs live in T4 callouts, so we index callouts too.
 */
interface MatchableItem {
  /** ComponentNode.id or "CALLOUT_<text>" for callout-derived items. */
  id: string;
  label: string;
  normalizedPartNumber: string | null;
}

interface MatchIndexes {
  byLabel: Map<string, MatchableItem[]>;
  byPN:    Map<string, MatchableItem[]>;
  all:     MatchableItem[];
}

function buildMatchIndexes(diagramExtraction: DiagramExtractionResult): MatchIndexes {
  const items: MatchableItem[] = [
    ...diagramExtraction.components.map(c => ({
      id:                  c.id,
      label:               c.label,
      normalizedPartNumber: c.normalizedPartNumber,
    })),
    ...diagramExtraction.callouts.map(co => ({
      id:                  `CALLOUT_${co.text}`,
      label:               co.text,
      normalizedPartNumber: co.normalizedPartNumber,
    })),
  ];

  const byLabel = new Map<string, MatchableItem[]>();
  const byPN    = new Map<string, MatchableItem[]>();

  for (const item of items) {
    const lk = item.label.toLowerCase().trim();
    if (!byLabel.has(lk)) byLabel.set(lk, []);
    byLabel.get(lk)!.push(item);

    if (item.normalizedPartNumber) {
      const pk = item.normalizedPartNumber.toLowerCase();
      if (!byPN.has(pk)) byPN.set(pk, []);
      byPN.get(pk)!.push(item);
    }
  }

  return { byLabel, byPN, all: items };
}

// ---------------------------------------------------------------------------
// Internal: Fuzzy matching
// ---------------------------------------------------------------------------

/**
 * Tokenize a string into lowercase words of length >= 3.
 * Splitting on spaces, hyphens, underscores, and slashes.
 * Minimum length 3 prevents short IDs (J1, P2) from fuzzy-matching.
 */
function tokenize(s: string): Set<string> {
  return new Set(
    s.toLowerCase().split(/[\s\-_/\\]+/).filter(t => t.length >= 3),
  );
}

function fuzzySearchItems(query: string, items: MatchableItem[]): MatchableItem[] {
  const qNorm   = query.toLowerCase().trim();
  const qTokens = tokenize(query);
  if (qNorm.length < 3) return []; // too short to fuzzy-match safely

  return items.filter(item => {
    const iNorm = item.label.toLowerCase().trim();

    // Whole-string containment (longer absorbs shorter)
    if (iNorm.includes(qNorm) || qNorm.includes(iNorm)) return true;

    // Token overlap (at least one shared token of length >= 3)
    const iTokens = tokenize(item.label);
    for (const qt of qTokens) {
      if (iTokens.has(qt)) return true;
    }

    // PN substring containment
    if (item.normalizedPartNumber) {
      const pnNorm = item.normalizedPartNumber.toLowerCase();
      if (pnNorm.includes(qNorm) || qNorm.includes(pnNorm)) return true;
    }

    return false;
  });
}

// ---------------------------------------------------------------------------
// Internal: Single endpoint matching
// ---------------------------------------------------------------------------

function matchEndpoint(
  label: string | null,
  indexes: MatchIndexes,
): ReconciledEndpoint {
  // Null / blank label — nothing to match
  if (!label || !label.trim()) {
    return {
      originalLabel:      label,
      matchedComponentId: null,
      matchedLabel:       null,
      matchType:          'NONE',
      confidence:         0.0,
    };
  }

  const lk = label.toLowerCase().trim();

  // 1. Exact label match (case-insensitive)
  const exactMatches = indexes.byLabel.get(lk) ?? [];
  if (exactMatches.length === 1) {
    return {
      originalLabel:      label,
      matchedComponentId: exactMatches[0].id,
      matchedLabel:       exactMatches[0].label,
      matchType:          'EXACT',
      confidence:         MATCH_CONFIDENCE.EXACT,
    };
  }
  if (exactMatches.length > 1) {
    return {
      originalLabel:        label,
      matchedComponentId:   null,
      matchedLabel:         null,
      matchType:            'AMBIGUOUS',
      confidence:           MATCH_CONFIDENCE.AMBIGUOUS,
      candidateComponentIds: exactMatches.map(m => m.id),
    };
  }

  // 2. Normalized PN match (endpoint label treated as PN key)
  const pnMatches = indexes.byPN.get(lk) ?? [];
  if (pnMatches.length === 1) {
    return {
      originalLabel:      label,
      matchedComponentId: pnMatches[0].id,
      matchedLabel:       pnMatches[0].label,
      matchType:          'PN_MATCH',
      confidence:         MATCH_CONFIDENCE.PN_MATCH,
    };
  }
  if (pnMatches.length > 1) {
    return {
      originalLabel:        label,
      matchedComponentId:   null,
      matchedLabel:         null,
      matchType:            'AMBIGUOUS',
      confidence:           MATCH_CONFIDENCE.AMBIGUOUS,
      candidateComponentIds: pnMatches.map(m => m.id),
    };
  }

  // 3. Fuzzy match (token overlap / contains — only for labels >= 3 chars)
  const fuzzyMatches = fuzzySearchItems(label, indexes.all);
  if (fuzzyMatches.length === 1) {
    return {
      originalLabel:      label,
      matchedComponentId: fuzzyMatches[0].id,
      matchedLabel:       fuzzyMatches[0].label,
      matchType:          'FUZZY',
      confidence:         MATCH_CONFIDENCE.FUZZY,
    };
  }
  if (fuzzyMatches.length > 1) {
    return {
      originalLabel:        label,
      matchedComponentId:   null,
      matchedLabel:         null,
      matchType:            'AMBIGUOUS',
      confidence:           MATCH_CONFIDENCE.AMBIGUOUS,
      candidateComponentIds: fuzzyMatches.map(m => m.id),
    };
  }

  // 4. No match
  return {
    originalLabel:      label,
    matchedComponentId: null,
    matchedLabel:       null,
    matchType:          'NONE',
    confidence:         0.0,
  };
}

// ---------------------------------------------------------------------------
// Internal: Summary computation
// ---------------------------------------------------------------------------

function computeSummary(
  wires: ReconciledWire[],
): HarnessReconciliationResult['summary'] {
  let fullyMatched  = 0;
  let partialMatched = 0;
  let unmatched     = 0;
  let ambiguous     = 0;

  for (const rw of wires) {
    const fromStrong = STRONG_MATCH_TYPES.has(rw.from.matchType);
    const toStrong   = STRONG_MATCH_TYPES.has(rw.to.matchType);
    const fromNone   = rw.from.matchType === 'NONE';
    const toNone     = rw.to.matchType   === 'NONE';
    const anyAmbig   = rw.from.matchType === 'AMBIGUOUS' || rw.to.matchType === 'AMBIGUOUS';

    if (fromStrong && toStrong)       fullyMatched++;
    else if (fromStrong || toStrong)  partialMatched++;
    else if (fromNone && toNone)      unmatched++;

    if (anyAmbig) ambiguous++;
  }

  return {
    total: wires.length,
    fullyMatched,
    partialMatched,
    unmatched,
    ambiguous,
  };
}

// ---------------------------------------------------------------------------
// Primary export
// ---------------------------------------------------------------------------

/**
 * Reconcile HC-BOM endpoint labels with diagram-extracted ComponentNodes.
 *
 * For each wire's from/to.component string, attempts (in order):
 *   1. Exact case-insensitive label match
 *   2. Normalized PN match
 *   3. Fuzzy token-overlap match (labels >= 3 chars only)
 *
 * Ambiguous (multiple candidates) and unmatched states are preserved.
 * Original endpoint labels are never overwritten.
 *
 * @param harnessConnectivity  T2 HC-BOM result
 * @param diagramExtraction    T4 diagram extraction result
 */
export function reconcileHarnessConnectivity(args: {
  harnessConnectivity: HarnessConnectivityResult;
  diagramExtraction:   DiagramExtractionResult;
}): HarnessReconciliationResult {
  const { harnessConnectivity, diagramExtraction } = args;
  const indexes = buildMatchIndexes(diagramExtraction);

  const wires: ReconciledWire[] = harnessConnectivity.wires.map(wire => {
    const from = matchEndpoint(wire.from.component, indexes);
    const to   = matchEndpoint(wire.to.component,   indexes);
    const unresolved = !STRONG_MATCH_TYPES.has(from.matchType) ||
                       !STRONG_MATCH_TYPES.has(to.matchType);

    return { wireId: wire.wireId, from, to, unresolved };
  });

  const summary = computeSummary(wires);

  console.log('[T5 RECONCILIATION]', {
    total:        summary.total,
    fullyMatched: summary.fullyMatched,
    partialMatched: summary.partialMatched,
    unmatched:    summary.unmatched,
    ambiguous:    summary.ambiguous,
  });

  return { wires, summary };
}
