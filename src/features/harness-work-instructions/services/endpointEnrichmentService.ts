/**
 * Endpoint Enrichment Service — Phase T18.5
 *
 * Applies ACI-derived machine process data (partNumber, stripLength) to wire
 * endpoints in the effective connectivity model.  This is the only place where
 * ACI lookups are applied — downstream consumers read the already-enriched model.
 *
 * Authority precedence (per §6.6):
 *   1. OPERATOR  — explicit values set by the operator in SkuModelEditorPanel.
 *                  Never overridden.  ACI can still fill stripLength if the
 *                  operator provided a partNumber but no stripLength.
 *   2. ACI_TABLE — resolved from aciLookupService using endpoint.partNumber.
 *                  Applied when processSource is not OPERATOR.
 *   3. EXTRACTED — raw extraction; no enrichment available.
 *
 * Rules:
 *   - NEVER guess.  If ACI table has no entry → leave null.
 *   - NEVER overwrite an explicit OPERATOR stripLength.
 *   - Strip length is resolved as a formatted string: "<value> mm".
 *   - Enrichment is idempotent: calling twice returns the same result.
 *
 * Governance:
 *   - Pure functions. No I/O, no DB, no side effects. Never throws.
 *   - Never mutates the input connectivity object.
 *   - Deterministic: same input → same output.
 */

import type { WireEndpoint, WireConnectivity } from './harnessConnectivityService';
import type { HarnessConnectivityResult } from './harnessConnectivityService';
import { getStripLengthByPartNumber, getAciByPartNumber } from './aciLookupService';

// ---------------------------------------------------------------------------
// Enrichment metadata (returned for audit logging)
// ---------------------------------------------------------------------------

export interface EndpointEnrichmentSummary {
  /** Number of endpoints where ACI_TABLE filled a strip length. */
  aciStripLengthFilled: number;
  /** Part numbers that were looked up but found no ACI match. */
  unresolvedPartNumbers: string[];
}

// ---------------------------------------------------------------------------
// Single-endpoint enrichment
// ---------------------------------------------------------------------------

/**
 * Enrich a single WireEndpoint with ACI-derived process data.
 *
 * Logic:
 *   processSource === 'OPERATOR':
 *     - Operator values are authoritative.
 *     - If operator set partNumber but not stripLength: fill stripLength from ACI.
 *     - processSource stays 'OPERATOR'.
 *   processSource !== 'OPERATOR' AND partNumber present:
 *     - Run ACI lookup by partNumber.
 *     - If found: set stripLength (if absent), set processSource = 'ACI_TABLE'.
 *   No partNumber → no enrichment. Return unchanged.
 */
export function enrichEndpoint(endpoint: WireEndpoint): {
  enriched: WireEndpoint;
  aciFound: boolean;
} {
  // ── Case 1: Operator authority ────────────────────────────────────────────
  if (endpoint.processSource === 'OPERATOR') {
    if (endpoint.partNumber && !endpoint.stripLength) {
      const aciStrip = getStripLengthByPartNumber(endpoint.partNumber);
      if (aciStrip) {
        return {
          enriched: { ...endpoint, stripLength: aciStrip },
          // processSource stays OPERATOR (operator provided the partNumber)
          aciFound: true,
        };
      }
    }
    return { enriched: endpoint, aciFound: false };
  }

  // ── Case 2: ACI enrichment ────────────────────────────────────────────────
  if (!endpoint.partNumber) {
    return { enriched: endpoint, aciFound: false };
  }

  const aciStrip = getStripLengthByPartNumber(endpoint.partNumber);
  const aciId    = getAciByPartNumber(endpoint.partNumber);

  if (!aciStrip) {
    return { enriched: endpoint, aciFound: false };
  }

  return {
    enriched: {
      ...endpoint,
      stripLength:   endpoint.stripLength ?? aciStrip,
      processSource: 'ACI_TABLE',
    },
    aciFound: Boolean(aciId),
  };
}

// ---------------------------------------------------------------------------
// Full connectivity enrichment
// ---------------------------------------------------------------------------

/**
 * Enrich all wire endpoints in a connectivity result.
 * Returns a new HarnessConnectivityResult — never mutates the input.
 * Also returns an EndpointEnrichmentSummary for audit logging.
 */
export function enrichConnectivity(connectivity: HarnessConnectivityResult): {
  enriched: HarnessConnectivityResult;
  summary:  EndpointEnrichmentSummary;
} {
  let aciStripLengthFilled  = 0;
  const unresolvedPartNumbers: string[] = [];

  const enrichedWires: WireConnectivity[] = connectivity.wires.map(wire => {
    const { enriched: enrichedFrom, aciFound: fromFound } = enrichEndpoint(wire.from);
    const { enriched: enrichedTo,   aciFound: toFound   } = enrichEndpoint(wire.to);

    if (fromFound) aciStripLengthFilled++;
    if (toFound)   aciStripLengthFilled++;

    // Collect unresolved part numbers (present but not in ACI table)
    if (wire.from.partNumber && !fromFound && wire.from.processSource !== 'OPERATOR') {
      unresolvedPartNumbers.push(wire.from.partNumber);
    }
    if (wire.to.partNumber && !toFound && wire.to.processSource !== 'OPERATOR') {
      unresolvedPartNumbers.push(wire.to.partNumber);
    }

    return { ...wire, from: enrichedFrom, to: enrichedTo };
  });

  const enriched: HarnessConnectivityResult = {
    ...connectivity,
    wires: enrichedWires,
  };

  const summary: EndpointEnrichmentSummary = {
    aciStripLengthFilled,
    unresolvedPartNumbers: [...new Set(unresolvedPartNumbers)], // de-dup
  };

  return { enriched, summary };
}
