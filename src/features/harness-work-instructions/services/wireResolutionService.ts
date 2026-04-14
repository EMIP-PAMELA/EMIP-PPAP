/**
 * Wire Resolution Engine — Phase 3H.44 C1
 *
 * Converts structured Rheem drawing wire rows into a canonical resolved wire model.
 *
 * Governance:
 *   - ADDITIVE ONLY. Does not modify any existing service.
 *   - No BOM dependency. No DB writes. No side effects. Pure transformation.
 *   - Pin-to-connector mapping is deferred to Phase 3H.44.2.
 *   - Source is always 'DRAWING' in this phase. 'BOM' and 'MERGED' reserved.
 */

import type { RheemDrawingModel, RheemWireRow } from './rheemDrawingParser';

// ---------------------------------------------------------------------------
// Output Model
// ---------------------------------------------------------------------------

export interface ResolvedWire {
  wireId: string;
  length: number | null;
  gauge: string | null;
  color: string | null;
  from?: {
    connector?: string;
    pin?: string | number;
  };
  to?: {
    connector?: string;
    pin?: string | number;
  };
  source: 'DRAWING' | 'BOM' | 'MERGED';
  confidence: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Validate and normalize a length value.
 * Accepts the already-parsed number from RheemWireRow.length (which is number | null).
 * Rejects negative, zero, or implausibly large values (> 9999 inches).
 */
function normalizeLength(raw: number | null): number | null {
  if (raw === null || !Number.isFinite(raw)) return null;
  if (raw <= 0 || raw > 9999) return null;
  return raw;
}

/**
 * Normalize gauge: strip redundant AWG/GA suffix if present, trim whitespace.
 * Returns null for empty or unparseable strings.
 */
function normalizeGauge(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/\s*(?:AWG|GA(?:UGE)?)\s*$/i, '').trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Compute a baseline confidence score based on field completeness.
 * Starts at 0.90 and deducts for missing critical fields.
 */
function computeConfidence(wire: RheemWireRow): number {
  let score = 0.90;
  if (wire.length === null) score -= 0.10;
  if (!wire.gauge)          score -= 0.05;
  if (!wire.color)          score -= 0.05;
  return Math.max(score, 0.50);
}

/**
 * Sort comparator: numeric wire IDs first (ascending), then lexicographic.
 * e.g. "1", "2", "10", "A1", "B2"
 */
function wireIdComparator(a: ResolvedWire, b: ResolvedWire): number {
  const numA = parseInt(a.wireId, 10);
  const numB = parseInt(b.wireId, 10);
  if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
  if (!isNaN(numA)) return -1;
  if (!isNaN(numB)) return 1;
  return a.wireId.localeCompare(b.wireId);
}

// ---------------------------------------------------------------------------
// Core Resolution Function
// ---------------------------------------------------------------------------

/**
 * Resolve all wires from a parsed Rheem drawing model into canonical ResolvedWire objects.
 *
 * Phase 3H.44 C1: Basic field mapping (id, length, gauge, color, pin → from.pin).
 * Connector assignment is deferred to Phase 3H.44.2.
 */
export function resolveWiresFromDrawing(structuredData: RheemDrawingModel): ResolvedWire[] {
  const resolved: ResolvedWire[] = [];

  for (const row of structuredData.wires) {
    if (!row.id || row.id.trim().length === 0) continue;

    const length = normalizeLength(row.length);
    const gauge  = normalizeGauge(row.gauge);
    const color  = row.color?.trim() || null;

    const wire: ResolvedWire = {
      wireId:     row.id.trim(),
      length,
      gauge,
      color,
      source:     'DRAWING',
      confidence: computeConfidence(row),
    };

    if (row.pin !== null) {
      wire.from = { pin: row.pin };
    }

    resolved.push(wire);
  }

  resolved.sort(wireIdComparator);

  console.log('[WIRE RESOLUTION]', {
    inputWireCount:    structuredData.wires.length,
    resolvedWireCount: resolved.length,
    skippedCount:      structuredData.wires.length - resolved.length,
    withLength:        resolved.filter(w => w.length !== null).length,
    withGauge:         resolved.filter(w => w.gauge !== null).length,
    withColor:         resolved.filter(w => w.color !== null).length,
    withPin:           resolved.filter(w => w.from?.pin !== undefined).length,
  });

  return resolved;
}
