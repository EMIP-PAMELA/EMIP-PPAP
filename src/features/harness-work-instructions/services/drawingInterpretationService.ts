/**
 * Drawing Interpretation Service — Phase 3H.47 C9
 *
 * Structured interpretation layer built ON TOP OF existing Rheem drawing extraction.
 * Converts raw parsed model data into a normalized, evidence-backed interpretation
 * of connectors, wires, and their relationships.
 *
 * Governance:
 *   - ADDITIVE ONLY. Does not modify parser, resolver, or pipeline.
 *   - No DB writes. No external calls. No UI dependency.
 *   - Safe fallback when model is null or weak.
 *   - Returns serializable, stable output suitable for future UI/routing consumption.
 *   - Current limitation: connector-to-wire pin mapping cannot be resolved from
 *     the Rheem model — connectors and wire rows are structurally unlinked.
 *     All connectorId fields are null in this phase; noted in unresolvedFields.
 */

import type { RheemDrawingModel } from './rheemDrawingParser';

// ---------------------------------------------------------------------------
// Output Types
// ---------------------------------------------------------------------------

export interface InterpretedConnector {
  id: string;
  pins: Array<string | number>;
  source?: string;
  confidence: number;
}

export interface InterpretedWire {
  wireId: string;
  from: {
    connectorId?: string | null;
    pin?: string | number | null;
  };
  to: {
    terminalPartNumber?: string | null;
  };
  attributes: {
    length?: number | null;
    gauge?: string | null;
    color?: string | null;
  };
  evidence: string[];
  confidence: number;
  unresolvedFields: string[];
}

export interface DrawingInterpretationResult {
  connectors: InterpretedConnector[];
  wires: InterpretedWire[];
  unresolved: string[];
  interpretationScore: number;
}

// ---------------------------------------------------------------------------
// Main Entry Point
// ---------------------------------------------------------------------------

/**
 * Interpret a parsed Rheem drawing model into a structured, normalized form.
 *
 * Safe for null input — returns empty result with a single unresolved note.
 * Does not throw; all edge cases produce a degraded-but-valid result.
 */
export function interpretRheemDrawingModel(
  model: RheemDrawingModel | null,
): DrawingInterpretationResult {
  if (!model) {
    return {
      connectors: [],
      wires: [],
      unresolved: ['No drawing model available'],
      interpretationScore: 0,
    };
  }

  const connectors = interpretConnectors(model);
  const wires      = interpretWires(model);
  const unresolved = buildUnresolvedSummary(wires);
  const interpretationScore = computeInterpretationScore(wires);

  console.log('[DRAWING INTERPRETATION]', {
    connectorCount:     connectors.length,
    wireCount:          wires.length,
    interpretationScore,
    unresolved,
  });

  return { connectors, wires, unresolved, interpretationScore };
}

// ---------------------------------------------------------------------------
// Connector Interpretation
// ---------------------------------------------------------------------------

/**
 * Map each RheemConnector into an InterpretedConnector.
 *
 * Note: pin-to-connector linking is NOT possible from the Rheem model.
 * Wire rows carry a pin field but NO connector ID. Connector table is a
 * separate structural element with no explicit wire cross-reference.
 * The `pins` array is always empty in this phase; a future phase may resolve
 * this when connector-table anchoring is implemented.
 */
function interpretConnectors(model: RheemDrawingModel): InterpretedConnector[] {
  return model.connectors.map((conn, idx) => {
    const id = conn.partNumber?.trim() ?? `C${idx + 1}`;

    let confidence = 0.40;
    if (conn.partNumber)    confidence += 0.25;
    if (conn.manufacturer)  confidence += 0.15;
    if (conn.color)         confidence += 0.10;
    if (conn.torque)        confidence += 0.10;
    confidence = Math.min(confidence, 1.0);

    return {
      id,
      pins:       [],
      source:     conn.manufacturer?.trim() ?? undefined,
      confidence,
    };
  });
}

// ---------------------------------------------------------------------------
// Wire Interpretation
// ---------------------------------------------------------------------------

/**
 * Map each RheemWireRow into a normalized InterpretedWire.
 *
 * Evidence strings are short, deterministic, and intended for debug/audit use.
 * unresolvedFields lists every field that could not be populated.
 *
 * Terminal trust rules (matching wireResolutionService):
 *   - ROW-classified terminals are trusted → populated into to.terminalPartNumber.
 *   - COLUMN/UNKNOWN terminals are excluded → listed as unresolved.
 */
function interpretWires(model: RheemDrawingModel): InterpretedWire[] {
  return model.wires
    .filter(row => row.id && row.id.trim().length > 0)
    .map(row => {
      const evidence: string[]        = ['wire row parsed'];
      const unresolvedFields: string[] = [];

      // ── connectorId ──────────────────────────────────────────────────────
      // No connector-to-wire mapping exists in the Rheem model. Always unresolved.
      unresolvedFields.push('connectorId');
      evidence.push('connector unresolved — no pin-connector mapping in drawing model');

      // ── pin ──────────────────────────────────────────────────────────────
      const pin: string | number | null = row.pin !== null ? row.pin : null;
      if (pin !== null) {
        evidence.push('pin inferred from row column');
      } else {
        unresolvedFields.push('pin');
      }

      // ── terminal ─────────────────────────────────────────────────────────
      let terminalPartNumber: string | null = null;
      if (row.terminalSource === 'ROW' && row.terminal) {
        terminalPartNumber = row.terminal.trim();
        evidence.push('terminal derived from row terminal field');
      } else if (row.terminal && row.terminalSource !== 'ROW') {
        evidence.push(`terminal present but source=${row.terminalSource} — excluded from to mapping`);
        unresolvedFields.push('terminalPartNumber');
      } else {
        unresolvedFields.push('terminalPartNumber');
      }

      // ── length ───────────────────────────────────────────────────────────
      const length: number | null = (row.length !== null && row.length > 0) ? row.length : null;
      if (length !== null) {
        evidence.push('length from wire table');
      } else {
        unresolvedFields.push('length');
      }

      // ── gauge ────────────────────────────────────────────────────────────
      const gauge: string | null = row.gauge?.trim() || null;
      if (gauge) {
        evidence.push('gauge from wire table');
      } else {
        unresolvedFields.push('gauge');
      }

      // ── color ────────────────────────────────────────────────────────────
      const color: string | null = row.color?.trim() || null;
      if (color) {
        evidence.push('color from wire table');
      } else {
        unresolvedFields.push('color');
      }

      // ── per-wire confidence ───────────────────────────────────────────────
      // Denominator: 6 resolvable fields (connectorId excluded — always 0 this phase)
      const resolved = [
        pin !== null,
        terminalPartNumber !== null,
        length !== null,
        !!gauge,
        !!color,
      ].filter(Boolean).length;
      const confidence = Math.round((resolved / 5) * 100) / 100;

      return {
        wireId: row.id.trim(),
        from: { connectorId: null, pin },
        to:   { terminalPartNumber },
        attributes: { length, gauge, color },
        evidence,
        confidence,
        unresolvedFields,
      };
    });
}

// ---------------------------------------------------------------------------
// Unresolved Summary
// ---------------------------------------------------------------------------

/**
 * Build count-based unresolved summary strings.
 * Each string is deterministic and suitable for logging / UI display.
 */
function buildUnresolvedSummary(wires: InterpretedWire[]): string[] {
  if (wires.length === 0) return ['No wires interpreted'];

  const summary: string[] = [];

  const n = (count: number, noun: string) =>
    `${count} ${noun}${count !== 1 ? 's' : ''}`;

  const missingConnector = wires.filter(w => w.unresolvedFields.includes('connectorId')).length;
  if (missingConnector > 0) {
    summary.push(`${n(missingConnector, 'wire')} missing connector assignment`);
  }

  const missingTerminal = wires.filter(w => w.unresolvedFields.includes('terminalPartNumber')).length;
  if (missingTerminal > 0) {
    summary.push(`${n(missingTerminal, 'wire')} missing terminal mapping`);
  }

  const missingLength = wires.filter(w => w.unresolvedFields.includes('length')).length;
  if (missingLength > 0) {
    summary.push(`${n(missingLength, 'wire')} missing cut length`);
  }

  const missingPin = wires.filter(w => w.unresolvedFields.includes('pin')).length;
  if (missingPin > 0) {
    summary.push(`${n(missingPin, 'wire')} missing pin`);
  }

  const missingGauge = wires.filter(w => w.unresolvedFields.includes('gauge')).length;
  if (missingGauge > 0) {
    summary.push(`${n(missingGauge, 'wire')} missing gauge`);
  }

  const missingColor = wires.filter(w => w.unresolvedFields.includes('color')).length;
  if (missingColor > 0) {
    summary.push(`${n(missingColor, 'wire')} missing color`);
  }

  return summary;
}

// ---------------------------------------------------------------------------
// Interpretation Score
// ---------------------------------------------------------------------------

/**
 * Score based on field completeness per the spec:
 *   +1 per wire for: wireId, pin, terminal, length, gauge, color, connectorId
 *   Max = 7 × wireCount. Normalized to 0–100.
 *
 * connectorId is always 0 in this phase (model limitation — not a parsing failure).
 * wireId is always 1 (rows with no id are filtered out before this stage).
 */
function computeInterpretationScore(wires: InterpretedWire[]): number {
  if (wires.length === 0) return 0;

  const MAX_PER_WIRE = 7;
  let totalPoints = 0;

  for (const wire of wires) {
    let pts = 0;
    pts += 1; // wireId — always present (empty rows are filtered)
    pts += (wire.from.pin !== null && wire.from.pin !== undefined) ? 1 : 0;
    pts += wire.to.terminalPartNumber                              ? 1 : 0;
    pts += (wire.attributes.length != null)                        ? 1 : 0;
    pts += wire.attributes.gauge                                   ? 1 : 0;
    pts += wire.attributes.color                                   ? 1 : 0;
    pts += wire.from.connectorId                                   ? 1 : 0; // always 0 this phase
    totalPoints += pts;
  }

  return Math.round((totalPoints / (wires.length * MAX_PER_WIRE)) * 100);
}
