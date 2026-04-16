/**
 * Wire Identity Service — Phase T15
 *
 * Assigns deterministic, stable internal wire identifiers (W1, W2, W4A, W4B…)
 * as a purely derived layer over effective connectivity.
 *
 * Rules:
 *   - Sort wires deterministically: from.component → from.cavity (numeric) →
 *     to.component → to.cavity (numeric) → original index (stable tiebreaker).
 *   - Detect branch groups from topology.multiWireEndpoints (nodes with ≥2 wires).
 *   - Branch group wires share a base number: W4A, W4B, W4C…
 *   - Non-branch wires: W1, W2, W3…
 *   - customerWireId = original wireId when non-empty (never overwritten).
 *
 * Governance:
 *   - Pure function. No I/O, no DB, no side effects. Never throws.
 *   - Does NOT mutate connectivity or topology data.
 *   - Does NOT overwrite customer-provided wire IDs.
 *   - Deterministic: same input → same IDs across every recompute.
 */

import type { HarnessConnectivityResult } from './harnessConnectivityService';
import type { HarnessTopologyResult } from './harnessTopologyService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WireIdentityEntry {
  /** Original wireId from WireConnectivity (may be empty string for unlabeled wires). */
  originalWireId: string;
  /** Deterministic internal label — always present. W1, W4A, W4B, etc. */
  internalWireId: string;
  /**
   * Customer-visible label from the drawing / extraction.
   * Present only when the original wireId is non-empty.
   * Never modified — read-only passthrough.
   */
  customerWireId?: string;
}

export interface WireIdentityResult {
  /** Entries in assignment order (mirrors sort order). */
  wires: WireIdentityEntry[];
  /** O(1) lookup by original wireId string. */
  byOriginalId: Map<string, WireIdentityEntry>;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function numericValue(s: string | null | undefined): number {
  if (!s) return Infinity;
  const n = parseInt(s, 10);
  return isNaN(n) ? Infinity : n;
}

function cmpStr(a: string, b: string): -1 | 0 | 1 {
  return a < b ? -1 : a > b ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Assign deterministic internal wire identifiers to all wires in the
 * effective connectivity model.
 *
 * Call once per render cycle (inside useMemo) and distribute the result
 * via effectiveState. Do not call inside individual component renders.
 */
export function assignWireIdentities(
  connectivity: HarnessConnectivityResult,
  topology: HarnessTopologyResult,
): WireIdentityResult {
  const wires = connectivity.wires;

  // ── 1. Build branch groups from topology multiWireEndpoints ─────────────
  // A "multi-wire endpoint" is a physical node (connector cavity) that
  // appears as FROM or TO on ≥2 different wires → those wires form a branch.
  // A wire is assigned to at most one group (first encountered wins).

  const wireGroupKey = new Map<string, string>();   // wireId → canonical group key
  const groups       = new Map<string, string[]>(); // group key → member wireIds (sorted)

  for (const node of topology.multiWireEndpoints) {
    if (node.wireIds.length < 2) continue;
    const sorted = [...node.wireIds].sort();
    const key = sorted.join('\0');
    if (!groups.has(key)) groups.set(key, sorted);
    for (const wid of sorted) {
      if (!wireGroupKey.has(wid)) wireGroupKey.set(wid, key);
    }
  }

  // ── 2. Deterministic sort of wires ──────────────────────────────────────
  const indexed = wires.map((w, i) => ({ w, i }));
  indexed.sort((a, b) => {
    const c1 = cmpStr(
      a.w.from.component?.toLowerCase() ?? '',
      b.w.from.component?.toLowerCase() ?? '',
    );
    if (c1 !== 0) return c1;

    const cv1 = numericValue(a.w.from.cavity) - numericValue(b.w.from.cavity);
    if (cv1 !== 0) return cv1;

    const c2 = cmpStr(
      a.w.to.component?.toLowerCase() ?? '',
      b.w.to.component?.toLowerCase() ?? '',
    );
    if (c2 !== 0) return c2;

    const cv2 = numericValue(a.w.to.cavity) - numericValue(b.w.to.cavity);
    if (cv2 !== 0) return cv2;

    return a.i - b.i; // stable tiebreaker: preserve original array order
  });

  // ── 3. Position map for intra-group ordering ────────────────────────────
  const sortedPosition = new Map<string, number>();
  indexed.forEach(({ w }, pos) => sortedPosition.set(w.wireId, pos));

  // ── 4. Assign IDs in sorted order ───────────────────────────────────────
  const entries: WireIdentityEntry[] = [];
  const byOriginalId = new Map<string, WireIdentityEntry>();
  const assigned = new Set<string>();
  let seq = 1;

  for (const { w } of indexed) {
    if (assigned.has(w.wireId)) continue;

    const groupKey = wireGroupKey.get(w.wireId);

    if (groupKey) {
      // Branch group — assign WN with A/B/C… suffixes
      const group = groups.get(groupKey)!;
      // Sort group members by their position in the main wire sort
      const orderedGroup = [...group].sort(
        (a, b) => (sortedPosition.get(a) ?? Infinity) - (sortedPosition.get(b) ?? Infinity),
      );
      const base = `W${seq++}`;

      orderedGroup.forEach((wid, i) => {
        if (assigned.has(wid)) return;
        const internalWireId = `${base}${String.fromCharCode(65 + i)}`; // A, B, C…
        const customerWireId = wid.trim() || undefined;
        const entry: WireIdentityEntry = { originalWireId: wid, internalWireId, customerWireId };
        entries.push(entry);
        byOriginalId.set(wid, entry);
        assigned.add(wid);
      });
    } else {
      // Non-branch wire
      const internalWireId = `W${seq++}`;
      const customerWireId = w.wireId.trim() || undefined;
      const entry: WireIdentityEntry = { originalWireId: w.wireId, internalWireId, customerWireId };
      entries.push(entry);
      byOriginalId.set(w.wireId, entry);
      assigned.add(w.wireId);
    }
  }

  console.log('[T15 IDENTITY]', {
    total:            entries.length,
    branchGroups:     groups.size,
    withCustomerId:   entries.filter(e => e.customerWireId).length,
  });

  return { wires: entries, byOriginalId };
}
