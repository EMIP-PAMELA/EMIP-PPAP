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
  /**
   * T16.5: Collision-safe map key for O(1) wire lookup.
   * Equals wireId when wireId is non-empty; falls back to '_anon_N' where N
   * is the wire's sourceRowIndex (or array index) for unlabeled wires.
   * Use this key — never raw wireId — when building Maps over wire lists.
   */
  mapKey: string;
}

export interface WireIdentityResult {
  /** Entries in assignment order (mirrors sort order). */
  wires: WireIdentityEntry[];
  /** O(1) lookup by original wireId string (mapKey). For wires with duplicate customer labels,
   *  maps to the first occurrence. Use bySourceRowIndex for accurate per-physical-wire lookup. */
  byOriginalId: Map<string, WireIdentityEntry>;
  /**
   * T23.3: O(1) lookup by WireConnectivity.sourceRowIndex — always accurate even when multiple
   * physical wires share the same customer label. Prefer this over byOriginalId in any context
   * where the WireConnectivity object is available.
   */
  bySourceRowIndex: Map<number, WireIdentityEntry>;
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

  // T23.3: Auto-generated internal IDs (harnessConnectivityService fallback for rows whose
  // source drawing had no wire label) must NOT be treated as customer-visible wire labels.
  const AUTO_ID_RE = /^UNK_\d+$/;

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
  const byOriginalId    = new Map<string, WireIdentityEntry>();
  const bySourceRowIndex = new Map<number, WireIdentityEntry>(); // T23.3
  const assigned = new Set<string>();
  let seq = 1;

  for (const { w, i } of indexed) {
    // T16.5: stable dedup key — blank wireIds fall back to '_anon_N' so that
    // multiple unlabeled wires are never silently collapsed into one.
    const mapKey = w.wireId && w.wireId.trim()
      ? w.wireId
      : `_anon_${w.sourceRowIndex ?? i}`;

    // T23.3: Skip only branch-group members already processed during group expansion.
    // Duplicate-label non-branch wires are NOT skipped here — they are disambiguated
    // in the else block below so each physical wire gets its own identity entry.
    if (assigned.has(mapKey) && wireGroupKey.has(w.wireId)) continue;

    const groupKey = wireGroupKey.get(w.wireId);

    if (groupKey) {
      // Branch group — assign WN with A/B/C… suffixes
      const group = groups.get(groupKey)!;
      // Sort group members by their position in the main wire sort
      const orderedGroup = [...group].sort(
        (a, b) => (sortedPosition.get(a) ?? Infinity) - (sortedPosition.get(b) ?? Infinity),
      );
      const base = `W${seq++}`;

      orderedGroup.forEach((wid, branchIdx) => {
        // Find the source wire to compute a stable key for this group member.
        const memberWire = indexed.find(({ w: mw }) => mw.wireId === wid);
        const memberRowIdx = memberWire?.w.sourceRowIndex ?? branchIdx;
        const memberKey = wid && wid.trim()
          ? wid
          : `_anon_${memberRowIdx}`;
        if (assigned.has(memberKey)) return;
        const internalWireId = `${base}${String.fromCharCode(65 + branchIdx)}`; // A, B, C…
        // T23.3: Don't expose auto-generated UNK_ fallback IDs as customer-visible labels.
        const customerWireId = (wid.trim() && !AUTO_ID_RE.test(wid.trim())) ? wid.trim() : undefined;
        const entry: WireIdentityEntry = { originalWireId: wid, internalWireId, customerWireId, mapKey: memberKey };
        entries.push(entry);
        byOriginalId.set(memberKey, entry);
        if (memberWire) bySourceRowIndex.set(memberRowIdx, entry); // T23.3
        assigned.add(memberKey);
      });
    } else {
      // Non-branch wire.
      // T23.3: Two physical wires may legitimately share a customer label (e.g. a branch pair
      // where the drawing only labels one end). Rather than collapsing them, assign a compound
      // mapKey using sourceRowIndex as a disambiguator so each instance gets its own entry.
      let finalMapKey = mapKey;
      if (assigned.has(finalMapKey)) {
        finalMapKey = `${finalMapKey}_row${w.sourceRowIndex ?? i}`;
        if (assigned.has(finalMapKey)) continue; // truly identical physical row — skip
      }
      const internalWireId = `W${seq++}`;
      // T23.3: Don't expose auto-generated UNK_ fallback IDs as customer-visible labels.
      const customerWireId = (w.wireId.trim() && !AUTO_ID_RE.test(w.wireId.trim())) ? w.wireId.trim() : undefined;
      const entry: WireIdentityEntry = { originalWireId: w.wireId, internalWireId, customerWireId, mapKey: finalMapKey };
      entries.push(entry);
      byOriginalId.set(finalMapKey, entry);
      bySourceRowIndex.set(w.sourceRowIndex ?? i, entry); // T23.3
      assigned.add(finalMapKey);
    }
  }

  console.log('[T15 IDENTITY]', {
    total:            entries.length,
    branchGroups:     groups.size,
    withCustomerId:   entries.filter(e => e.customerWireId).length,
    unlabeled:        entries.filter(e => !e.customerWireId).length,
  });

  return { wires: entries, byOriginalId, bySourceRowIndex };
}
