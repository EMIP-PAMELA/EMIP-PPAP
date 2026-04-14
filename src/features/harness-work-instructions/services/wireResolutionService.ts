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
import type { HarnessInstructionJob, WireInstance } from '../types/harnessInstruction.schema';

// ---------------------------------------------------------------------------
// Output Model
// ---------------------------------------------------------------------------

export interface ResolvedWire {
  wireId: string;
  length: number | null;
  gauge: string | null;
  color: string | null;
  /** Phase 3H.44 C4.2: Terminal part number resolved from drawing pin map. */
  terminal: string | null;
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
// Type guard
// ---------------------------------------------------------------------------

/**
 * Phase 3H.44 C2: Type guard to verify structuredData is a RheemDrawingModel
 * before passing it to the wire resolution engine.
 */
export function isRheemDrawingModel(data: unknown): data is RheemDrawingModel {
  return (
    typeof data === 'object' &&
    data !== null &&
    'wires' in data &&
    Array.isArray((data as RheemDrawingModel).wires) &&
    'titleBlock' in data
  );
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
// Phase 3H.44 C4.2: Terminal map
// ---------------------------------------------------------------------------

/**
 * Build a pin → terminal part number map from wire rows classified as ROW-aligned.
 *
 * Phase 3H.44 C4.3: Only ROW-classified terminals are pin-mapped.
 * COLUMN terminals (same value repeated across rows — likely OCR artifact) and UNKNOWN
 * terminals are excluded from pin lookup to prevent cross-wire mis-assignment.
 * Those terminals are still accessible via row.terminal for direct row assignment.
 */
export function buildTerminalMap(model: RheemDrawingModel): Map<number, string> {
  const map = new Map<number, string>();
  for (const row of model.wires) {
    if (row.pin !== null && row.terminal && row.terminalSource === 'ROW') {
      map.set(row.pin, row.terminal);
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// Drawing wire lookup maps
// ---------------------------------------------------------------------------

interface DrawingLookupMaps {
  byWireId:    Map<string, ResolvedWire>;
  byGaugeColor: Map<string, ResolvedWire>;
}

/**
 * Build two lookup maps from resolved drawing wires for efficient BOM matching.
 *
 * byWireId:    keyed by normalized wireId (strips leading W, tries both forms).
 * byGaugeColor: keyed by "GAUGE|COLOR" — fallback when ID-based match fails.
 *               First wire of each gauge+color pair wins (stable ordering assumed).
 */
function buildDrawingLookupMaps(resolvedWires: ResolvedWire[]): DrawingLookupMaps {
  const byWireId     = new Map<string, ResolvedWire>();
  const byGaugeColor = new Map<string, ResolvedWire>();

  for (const dw of resolvedWires) {
    const rawId      = dw.wireId.trim().toUpperCase();
    const strippedId = rawId.replace(/^W/, '');       // "W1" → "1"
    const paddedId   = strippedId.match(/^\d+$/)      // "1"  → "W1"
      ? `W${strippedId}`
      : null;

    byWireId.set(rawId, dw);
    byWireId.set(strippedId, dw);
    if (paddedId) byWireId.set(paddedId, dw);

    if (dw.gauge && dw.color) {
      const key = `${dw.gauge.toUpperCase()}|${dw.color.toUpperCase()}`;
      if (!byGaugeColor.has(key)) byGaugeColor.set(key, dw);
    }
  }

  return { byWireId, byGaugeColor };
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

  // Phase 3H.44 C4.2: Build terminal map once for the whole model
  const terminalMap = buildTerminalMap(structuredData);
  let terminalAssigned = 0;
  let terminalMissing  = 0;

  for (const row of structuredData.wires) {
    if (!row.id || row.id.trim().length === 0) continue;

    const length = normalizeLength(row.length);
    const gauge  = normalizeGauge(row.gauge);
    const color  = row.color?.trim() || null;

    let baseConfidence = computeConfidence(row);

    // Phase 3H.44 C4.2: Resolve terminal via pin map, boost confidence if found
    let terminal: string | null = null;
    if (row.pin !== null) {
      terminal = terminalMap.get(row.pin) ?? row.terminal ?? null;
      if (terminal) {
        baseConfidence = Math.min(baseConfidence + 0.05, 1.0);
        terminalAssigned++;
      } else {
        terminalMissing++;
      }
    } else if (row.terminal) {
      terminal = row.terminal;
      terminalAssigned++;
    } else {
      terminalMissing++;
    }

    const wire: ResolvedWire = {
      wireId:     row.id.trim(),
      length,
      gauge,
      color,
      terminal,
      source:     'DRAWING',
      confidence: baseConfidence,
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

  console.log('[TERMINAL RESOLUTION]', {
    assigned: terminalAssigned,
    missing:  terminalMissing,
    total:    resolved.length,
  });

  return resolved;
}

// ---------------------------------------------------------------------------
// Merge Layer — Phase 3H.44 C2
// ---------------------------------------------------------------------------

/**
 * Merge drawing-derived wire data into an existing BOM-built HarnessInstructionJob.
 *
 * Matching strategy (in priority order):
 *   1. Wire ID match — normalizes BOM "W1" vs drawing "1" (both forms tried)
 *   2. Gauge + color match — fallback when IDs don't align
 *
 * Override rules:
 *   - cut_length  ← drawing value ONLY if not null (drawing is truth for geometry)
 *   - gauge       ← drawing value ONLY if not null
 *   - color       ← drawing value ONLY if not null
 *   - source      changes to 'DRAWING_SPEC' when cut_length is resolved
 *
 * BOM wires with no drawing match are returned unchanged (source stays BOM).
 */
export function mergeDrawingWiresIntoJob(
  job: HarnessInstructionJob,
  resolvedWires: ResolvedWire[],
): HarnessInstructionJob {
  if (resolvedWires.length === 0) return job;

  const { byWireId, byGaugeColor } = buildDrawingLookupMaps(resolvedWires);
  const usedDrawingIds = new Set<string>();
  let mergedCount = 0;
  const unmatchedBOM: string[] = [];

  const mergedWireInstances: WireInstance[] = job.wire_instances.map(wire => {
    const normalizedId = wire.wire_id.trim().toUpperCase();
    let match = byWireId.get(normalizedId);

    if (!match && wire.gauge !== undefined && wire.color) {
      const gaugeStr = typeof wire.gauge === 'number' ? String(wire.gauge) : wire.gauge;
      const gcKey = `${gaugeStr.toUpperCase()}|${wire.color.toUpperCase()}`;
      match = byGaugeColor.get(gcKey);
    }

    if (!match) {
      unmatchedBOM.push(wire.wire_id);
      return wire;
    }

    mergedCount++;
    usedDrawingIds.add(match.wireId);

    const overriddenCutLength = match.length !== null ? match.length : wire.cut_length ?? null;
    const cutLengthSource = match.length !== null
      ? ('DRAWING_SPEC' as const)
      : (wire.cut_length_source ?? 'UNKNOWN');

    // Phase 3H.44 C4.2: Apply terminal to end_a only if drawing has one and BOM slot is empty.
    // Preserves existing BOM terminal attribution — never overwrites.
    const endA = (match.terminal && wire.end_a.terminal_part_number === null)
      ? { ...wire.end_a, terminal_part_number: match.terminal }
      : wire.end_a;

    return {
      ...wire,
      cut_length:        overriddenCutLength,
      cut_length_source: cutLengthSource,
      gauge:             match.gauge ?? wire.gauge,
      color:             match.color ?? wire.color,
      end_a:             endA,
    };
  });

  const unmatchedDrawing = resolvedWires
    .filter(dw => !usedDrawingIds.has(dw.wireId))
    .map(dw => dw.wireId);

  console.log('[WIRE MERGE RESULT]', {
    bomCount:        job.wire_instances.length,
    drawingCount:    resolvedWires.length,
    mergedCount,
    unmatchedBOM:    unmatchedBOM.length > 0 ? unmatchedBOM : 'none',
    unmatchedDrawing: unmatchedDrawing.length > 0 ? unmatchedDrawing : 'none',
  });

  return { ...job, wire_instances: mergedWireInstances };
}
