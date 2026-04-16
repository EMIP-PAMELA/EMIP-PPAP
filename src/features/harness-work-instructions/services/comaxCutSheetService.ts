/**
 * Comax Cut Sheet Service — Phase T16
 *
 * Generates a production-ready cut sheet from the effective harness model.
 * Output is deterministic: same effectiveState → same rows, same order, every run.
 *
 * Data source hierarchy (read-only, never mutated):
 *   effectiveConnectivity  → wire geometry, endpoints, terminations
 *   effectiveWireIdentities → stable W1/W4A/W4B labels
 *
 * Governance:
 *   - Pure function. No I/O, no DB, no side effects. Never throws.
 *   - Uses effectiveState only — never raw extraction.
 *   - Does NOT introduce heuristics or guessing.
 *   - Deterministic: same input → identical output across recomputes.
 *   - Non-breaking: T11–T15 logic is untouched.
 */

import type { EffectiveHarnessState } from './effectiveHarnessModelService';
import type { WireConnectivity } from './harnessConnectivityService';

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface ComaxCutSheetRow {
  internalWireId:      string;
  customerWireId?:     string;

  /** Wire length in inches. Null when no length data is available. */
  lengthInches:        number | null;
  wireColor?:          string;
  wireGauge?:          string;

  fromComponent?:      string;
  fromCavity?:         string;
  /**
   * Termination type at the FROM end.
   * STRIP_ONLY is mapped to 'STRIP' for operator readability.
   */
  fromTerminationType?: string;

  toComponent?:        string;
  toCavity?:           string;
  toTerminationType?:  string;

  /** Wire-level topology classification. */
  topology:            'NORMAL' | 'BRANCH_DOUBLE_CRIMP' | 'SPLICE';

  /** Human-readable notes for the operator. May be empty. */
  notes:               string[];
}

export interface ComaxCutSheetResult {
  rows: ComaxCutSheetRow[];
  summary: {
    totalWires:    number;
    branchCount:   number;
    stripOnlyCount: number;
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Natural-order sort key for internal wire IDs: W1, W2, W3, W4A, W4B, W10…
 * Parsed as [baseNumber, letterSuffix].
 */
function wireIdSortKey(id: string): [number, string] {
  const m = id.match(/^W(\d+)([A-Z]*)$/);
  if (!m) return [Infinity, id];
  return [parseInt(m[1], 10), m[2]];
}

function compareWireIds(a: string, b: string): number {
  const [an, al] = wireIdSortKey(a);
  const [bn, bl] = wireIdSortKey(b);
  if (an !== bn) return an - bn;
  return al < bl ? -1 : al > bl ? 1 : 0;
}

/**
 * Map EndpointTerminationType to the operator-facing label used in the cut sheet.
 * STRIP_ONLY → 'STRIP' (never treated as missing).
 */
function mapTermType(t: string | null | undefined): string | undefined {
  if (!t) return undefined;
  if (t === 'STRIP_ONLY') return 'STRIP';
  return t;
}

/**
 * Determine topology classification for a single wire.
 *   BRANCH_DOUBLE_CRIMP: internalWireId ends with an uppercase letter (W4A, W4B…)
 *   SPLICE: any endpoint is explicitly typed as SPLICE
 *   NORMAL: everything else
 */
function classifyTopology(
  wire: WireConnectivity,
  internalWireId: string,
): ComaxCutSheetRow['topology'] {
  if (/[A-Z]$/.test(internalWireId)) return 'BRANCH_DOUBLE_CRIMP';
  if (
    wire.from.terminationType === 'SPLICE' ||
    wire.to.terminationType   === 'SPLICE'
  ) return 'SPLICE';
  return 'NORMAL';
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Build a Comax cut sheet from the current effective harness state.
 *
 * Call from a useMemo or render cycle — result is not cached internally.
 * Returns an empty result (no rows) when connectivity or identity data is absent.
 */
export function buildComaxCutSheet(
  effectiveState: EffectiveHarnessState,
): ComaxCutSheetResult {
  const connectivity  = effectiveState.effectiveConnectivity;
  const wireIdentities = effectiveState.effectiveWireIdentities;

  if (!connectivity || !wireIdentities) {
    return {
      rows: [],
      summary: { totalWires: 0, branchCount: 0, stripOnlyCount: 0 },
    };
  }

  // ── Build wire lookup ────────────────────────────────────────────────────
  // T16.5: keyed by stable mapKey (mirrors wireIdentityService formula) so that
  // wires with blank or duplicate wireIds are never silently lost.
  const wireMap = new Map<string, WireConnectivity>();
  connectivity.wires.forEach((w, idx) => {
    const key = w.wireId && w.wireId.trim() ? w.wireId : `_anon_${w.sourceRowIndex ?? idx}`;
    if (wireMap.has(key)) {
      console.warn('[T16.5] Duplicate wire key detected — second wire dropped from cut sheet', { key, wireId: w.wireId });
    } else {
      wireMap.set(key, w);
    }
  });

  // ── Pre-compute branch sibling labels ────────────────────────────────────
  // Branch wires share the same base number: W4A and W4B both have base "W4".
  const baseToInternalIds = new Map<string, string[]>();
  for (const entry of wireIdentities.wires) {
    const m = entry.internalWireId.match(/^(W\d+)([A-Z]+)$/);
    if (m) {
      const base = m[1];
      const group = baseToInternalIds.get(base) ?? [];
      group.push(entry.internalWireId);
      baseToInternalIds.set(base, group);
    }
  }

  // ── Build rows ───────────────────────────────────────────────────────────
  const rows: ComaxCutSheetRow[] = [];

  for (const entry of wireIdentities.wires) {
    const wire = wireMap.get(entry.mapKey);
    if (!wire) continue; // identity entry exists but wire was removed — skip

    const topology = classifyTopology(wire, entry.internalWireId);
    const notes: string[] = [];

    // Branch note: list sibling IDs
    const baseMatch = entry.internalWireId.match(/^(W\d+)([A-Z]+)$/);
    if (baseMatch) {
      const siblings = (baseToInternalIds.get(baseMatch[1]) ?? [])
        .filter(id => id !== entry.internalWireId);
      if (siblings.length > 0) {
        notes.push(`Shares crimp with ${siblings.join(', ')}`);
      }
    }

    // Strip-only notes
    if (wire.from.terminationType === 'STRIP_ONLY') notes.push('FROM end: bare strip');
    if (wire.to.terminationType   === 'STRIP_ONLY') notes.push('TO end: bare strip');

    // Unresolved wire warning
    if (wire.unresolved) notes.push('Unresolved — verify before production');

    rows.push({
      internalWireId:      entry.internalWireId,
      customerWireId:      entry.customerWireId,
      lengthInches:        wire.lengthInches ?? null,
      wireColor:           wire.color        ?? undefined,
      wireGauge:           wire.gauge        ?? undefined,
      fromComponent:       wire.from.component    ?? undefined,
      fromCavity:          wire.from.cavity       ?? undefined,
      fromTerminationType: mapTermType(wire.from.terminationType),
      toComponent:         wire.to.component      ?? undefined,
      toCavity:            wire.to.cavity         ?? undefined,
      toTerminationType:   mapTermType(wire.to.terminationType),
      topology,
      notes,
    });
  }

  // ── Sort by internalWireId (natural: W1, W2, W4A, W4B, W10) ─────────────
  rows.sort((a, b) => compareWireIds(a.internalWireId, b.internalWireId));

  // ── Summary ──────────────────────────────────────────────────────────────
  const branchCount    = rows.filter(r => r.topology === 'BRANCH_DOUBLE_CRIMP').length;
  const stripOnlyCount = rows.filter(r =>
    r.fromTerminationType === 'STRIP' || r.toTerminationType === 'STRIP',
  ).length;

  const result: ComaxCutSheetResult = {
    rows,
    summary: {
      totalWires:    rows.length,
      branchCount,
      stripOnlyCount,
    },
  };

  console.log('[T16 CUT SHEET]', {
    totalWires:    result.summary.totalWires,
    branchCount:   result.summary.branchCount,
    stripOnlyCount: result.summary.stripOnlyCount,
  });

  return result;
}

// ---------------------------------------------------------------------------
// CSV utilities (used by UI export buttons)
// ---------------------------------------------------------------------------

const CSV_HEADERS = [
  'Wire', 'Cust ID', 'Length (in)', 'Color', 'Gauge',
  'From Comp', 'From Pin', 'From Term',
  'To Comp', 'To Pin', 'To Term',
  'Topology', 'Notes',
] as const;

function csvEscape(v: string | number | null | undefined): string {
  if (v == null) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function buildCsvString(result: ComaxCutSheetResult): string {
  const header = CSV_HEADERS.join(',');
  const dataRows = result.rows.map(r => [
    r.internalWireId,
    r.customerWireId,
    r.lengthInches,
    r.wireColor,
    r.wireGauge,
    r.fromComponent,
    r.fromCavity,
    r.fromTerminationType,
    r.toComponent,
    r.toCavity,
    r.toTerminationType,
    r.topology,
    r.notes.join('; '),
  ].map(csvEscape).join(','));
  return [header, ...dataRows].join('\r\n');
}
