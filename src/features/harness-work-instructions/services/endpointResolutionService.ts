/**
 * Harness Work Instruction Generator — Endpoint Resolution Service
 * Phase HWI.10 — Endpoint + Pin Map Resolution
 *
 * Responsibilities:
 *   1. Correlate fused wire_instances back to drawing wire_rows (by ID, then positionally)
 *   2. Build a BOM terminal index from job.press_rows
 *   3. Populate wire end_a / end_b from drawing-extracted endpoint fields
 *   4. Generate pin_map_rows for wires with sufficient connector + cavity data
 *   5. Add review_required flags for partial or unresolved endpoints
 *
 * Governance:
 *   - Drawing is source of truth for endpoint geometry
 *   - BOM press_rows supply terminal part numbers where available
 *   - Never invent connector IDs, cavities, or terminal PNs
 *   - Partial data is kept and flagged — not discarded
 *   - Returns new job object — input is not mutated
 */

import type {
  HarnessInstructionJob,
  WireInstance,
  PinMapRow,
  EngineeringFlag,
  EndTerminal,
  Provenance,
} from '../types/harnessInstruction.schema';
import type { CanonicalDrawingDraft, DraftWireRow } from '../types/drawingDraft';
import type { FusionHints, EndpointDecision, LearnedDecision } from './learningSignatures';
import { buildEndpointSignature, trackLearningEvent } from './learningSignatures';

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type EndpointResolutionLevel = 'FULL' | 'PARTIAL_A' | 'PARTIAL_B' | 'NONE';

interface ResolvedEndpoints {
  end_a:      EndTerminal;
  end_b:      EndTerminal;
  level:      EndpointResolutionLevel;
  confidence: number; // 0–1
  usedLearned: boolean;
}

// ---------------------------------------------------------------------------
// Flag factory
// ---------------------------------------------------------------------------

let flagSeq = 0;
function mkFlag(
  flag_type: EngineeringFlag['flag_type'],
  message: string,
  field_ref: string | null = null,
): EngineeringFlag {
  return {
    flag_id:   `EP${String(++flagSeq).padStart(3, '0')}`,
    flag_type,
    field_ref,
    message,
    resolved:  false,
  };
}

// ---------------------------------------------------------------------------
// Step 1: Build drawing row index
// ---------------------------------------------------------------------------

interface DrawingRowIndex {
  byWireId:   Map<string, DraftWireRow>;
  byPosition: DraftWireRow[];
}

function buildDrawingRowIndex(drawing: CanonicalDrawingDraft): DrawingRowIndex {
  const byWireId = new Map<string, DraftWireRow>();
  for (const row of drawing.wire_rows) {
    if (row.wire_id) byWireId.set(row.wire_id, row);
  }
  return { byWireId, byPosition: drawing.wire_rows };
}

function findDrawingRow(
  wire: WireInstance,
  idx:  number,
  index: DrawingRowIndex,
): DraftWireRow | null {
  return index.byWireId.get(wire.wire_id) ?? index.byPosition[idx] ?? null;
}

// ---------------------------------------------------------------------------
// Step 2: BOM terminal index (press_rows wire_id → terminal PNs)
//
// Note: after fusion, wire IDs are drawing-derived; BOM press_row wire_ids
// may not match. The index is built anyway for single-terminal harnesses
// where one terminal PN applies to all wires.
// ---------------------------------------------------------------------------

interface TerminalIndex {
  byWireId:  Map<string, string>;
  allUnique: string[];          // deduplicated list of all terminal PNs in BOM
}

function buildTerminalIndex(job: HarnessInstructionJob): TerminalIndex {
  const byWireId = new Map<string, string>();
  const seen = new Set<string>();

  for (const row of job.press_rows) {
    if (!row.terminal_part_number) continue;
    seen.add(row.terminal_part_number);
    if (row.wire_id && row.wire_id !== 'TBD') {
      byWireId.set(row.wire_id, row.terminal_part_number);
    }
  }

  return { byWireId, allUnique: [...seen] };
}

function pickTerminalForWire(
  wire:     WireInstance,
  termIdx:  TerminalIndex,
): string | null {
  const direct = termIdx.byWireId.get(wire.wire_id);
  if (direct) return direct;
  if (termIdx.allUnique.length === 1) return termIdx.allUnique[0];
  return null;
}

// ---------------------------------------------------------------------------
// Step 5: Compute endpoint terminals from drawing row + terminal index
// ---------------------------------------------------------------------------

function computeWireEndpoints(
  wire:              WireInstance,
  row:               DraftWireRow | null,
  termIdx:           TerminalIndex,
  endpointOverride?: LearnedDecision<EndpointDecision>,
  hints?:            FusionHints,
  signature?:        string,
): ResolvedEndpoints {
  const NULL_END: EndTerminal = {
    connector_id:         null,
    cavity:               null,
    terminal_part_number: null,
    seal_part_number:     null,
  };

  // Apply learned endpoint override if available (replaces missing drawing data)
  if (endpointOverride && !row?.connector_a) {
    const decision = endpointOverride.decision;
    const end_a: EndTerminal = {
      connector_id:         decision.connector_id,
      cavity:               decision.cavity,
      terminal_part_number: decision.terminal_part_number,
      seal_part_number:     null,
    };
    const aScore = (end_a.connector_id ? 3 : 0) + (end_a.cavity ? 2 : 0) + (end_a.terminal_part_number ? 1 : 0);
    const confidence = Math.min(aScore / 6, 1);
    const level: EndpointResolutionLevel = aScore >= 3 ? 'PARTIAL_A' : 'NONE';
    if (signature) trackLearningEvent(hints, { context_type: 'ENDPOINT', signature, outcome: 'USED' });
    console.log('[HWI LEARNING APPLIED]', {
      context_type: 'ENDPOINT',
      wire_id:      wire.wire_id,
      connector:    end_a.connector_id,
      cavity:       end_a.cavity,
    });
    return { end_a, end_b: NULL_END, level, confidence, usedLearned: true };
  }

  if (!row) {
    return { end_a: NULL_END, end_b: NULL_END, level: 'NONE', confidence: 0, usedLearned: false };
  }

  const fallbackTerminal = pickTerminalForWire(wire, termIdx);

  const end_a: EndTerminal = {
    connector_id:         row.connector_a,
    cavity:               row.cavity_a ?? row.pin_a,
    terminal_part_number: row.terminal_a ?? fallbackTerminal,
    seal_part_number:     null,
  };

  const end_b: EndTerminal = {
    connector_id:         row.connector_b,
    cavity:               row.cavity_b ?? row.pin_b,
    terminal_part_number: row.terminal_b ?? fallbackTerminal,
    seal_part_number:     null,
  };

  const aHasConn = !!end_a.connector_id;
  const bHasConn = !!end_b.connector_id;
  const aHasCav  = !!(end_a.cavity);
  const bHasCav  = !!(end_b.cavity);

  const aScore = (aHasConn ? 3 : 0) + (aHasCav ? 2 : 0) + (end_a.terminal_part_number ? 1 : 0);
  const bScore = (bHasConn ? 3 : 0) + (bHasCav ? 2 : 0) + (end_b.terminal_part_number ? 1 : 0);

  let level: EndpointResolutionLevel = 'NONE';
  if (aScore >= 3 && bScore >= 3) level = 'FULL';
  else if (aScore >= 3)            level = 'PARTIAL_A';
  else if (bScore >= 3)            level = 'PARTIAL_B';
  else if (aScore > 0 || bScore > 0) level = 'PARTIAL_A'; // minimal resolution
  else level = 'NONE';

  const confidence = Math.min((aScore + bScore) / 12, 1);

  return { end_a, end_b, level, confidence, usedLearned: false };
}

// ---------------------------------------------------------------------------
// Step 6: Generate pin_map_rows for a single wire
// Only creates rows when connector_id + cavity are both non-empty (schema req)
// ---------------------------------------------------------------------------

let pinMapSeq = 0;

function buildPinMapRows(
  wire:      WireInstance,
  endpoints: ResolvedEndpoints,
): PinMapRow[] {
  const rows: PinMapRow[] = [];
  const prov: Provenance = {
    source_type: endpoints.usedLearned ? 'learned' : 'drawing',
    confidence:  endpoints.confidence,
    note:        'Resolved from drawing wire row endpoint fields',
  };

  if (endpoints.end_a.connector_id && endpoints.end_a.cavity) {
    pinMapSeq++;
    rows.push({
      pin_map_id:           `PM${String(pinMapSeq).padStart(3, '0')}`,
      connector_id:         endpoints.end_a.connector_id,
      cavity:               endpoints.end_a.cavity,
      wire_id:              wire.wire_id,
      terminal_part_number: endpoints.end_a.terminal_part_number,
      provenance:           prov,
    });
  }

  if (endpoints.end_b.connector_id && endpoints.end_b.cavity) {
    pinMapSeq++;
    rows.push({
      pin_map_id:           `PM${String(pinMapSeq).padStart(3, '0')}`,
      connector_id:         endpoints.end_b.connector_id,
      cavity:               endpoints.end_b.cavity,
      wire_id:              wire.wire_id,
      terminal_part_number: endpoints.end_b.terminal_part_number,
      provenance:           prov,
    });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Step 7: Flagging for partial/ambiguous endpoints
// ---------------------------------------------------------------------------

function addEndpointFlags(
  wire:      WireInstance,
  idx:       number,
  row:       DraftWireRow | null,
  endpoints: ResolvedEndpoints,
  drawingType: string,
  flags:     EngineeringFlag[],
): void {
  const wireRef = `wire_instances.${idx}`;

  if (endpoints.level === 'NONE') {
    const msgType = drawingType === 'HARNESS_LAYOUT' ? 'info' : 'review_required';
    flags.push(mkFlag(
      msgType,
      `Wire ${wire.wire_id}: no endpoint data resolved from drawing — assign connector/cavity manually`,
      wireRef,
    ));
    return;
  }

  if (endpoints.level === 'PARTIAL_A' || endpoints.level === 'PARTIAL_B') {
    flags.push(mkFlag(
      'review_required',
      `Wire ${wire.wire_id}: only one endpoint resolved — verify connector/cavity for ${
        endpoints.level === 'PARTIAL_A' ? 'End B' : 'End A'
      }`,
      wireRef,
    ));
  }

  const { end_a, end_b } = endpoints;

  if (end_a.connector_id && !end_a.cavity) {
    flags.push(mkFlag(
      'review_required',
      `Wire ${wire.wire_id}: End A connector ${end_a.connector_id} detected but cavity/pin is missing`,
      `${wireRef}.end_a`,
    ));
  }
  if (end_b.connector_id && !end_b.cavity) {
    flags.push(mkFlag(
      'review_required',
      `Wire ${wire.wire_id}: End B connector ${end_b.connector_id} detected but cavity/pin is missing`,
      `${wireRef}.end_b`,
    ));
  }
  if (end_a.cavity && !end_a.terminal_part_number) {
    flags.push(mkFlag(
      'info',
      `Wire ${wire.wire_id}: End A cavity resolved but terminal PN not detected — verify against crimp spec`,
      `${wireRef}.end_a`,
    ));
  }
  if (end_b.cavity && !end_b.terminal_part_number) {
    flags.push(mkFlag(
      'info',
      `Wire ${wire.wire_id}: End B cavity resolved but terminal PN not detected — verify against crimp spec`,
      `${wireRef}.end_b`,
    ));
  }
}

// ---------------------------------------------------------------------------
// Main entry point: resolveEndpoints(job, drawing)
// ---------------------------------------------------------------------------

export function resolveEndpoints(
  job:     HarnessInstructionJob,
  drawing: CanonicalDrawingDraft,
  hints?:  FusionHints,
): HarnessInstructionJob {
  flagSeq   = 0;
  pinMapSeq = 0;

  console.log('[HWI ENDPOINT RESOLUTION]', {
    wire_instances:  job.wire_instances.length,
    drawing_rows:    drawing.wire_rows.length,
    drawing_type:    drawing.drawing_type,
    timestamp:       new Date().toISOString(),
  });

  const rowIndex  = buildDrawingRowIndex(drawing);
  const termIndex = buildTerminalIndex(job);
  const newFlags: EngineeringFlag[] = [];
  const newPinMapRows: PinMapRow[] = [];

  const endpointOverrides = hints?.endpointOverrides;

  const resolvedWires: WireInstance[] = job.wire_instances.map((wire, idx) => {
    const row = findDrawingRow(wire, idx, rowIndex);

    // Build endpoint signature to look up learned override
    const drawingRow   = row;
    const connHint     = drawingRow?.connector_a ?? null;
    const labelHint    = drawingRow?.wire_label ?? wire.wire_id;
    const sig         = buildEndpointSignature(labelHint, connHint);
    const learnedEndpt = endpointOverrides?.get(sig);

    let endpoints: ResolvedEndpoints;
    if (learnedEndpt) {
      let conflict = false;
      if (row?.connector_a && learnedEndpt.decision.connector_id && row.connector_a !== learnedEndpt.decision.connector_id) {
        conflict = true;
      }
      if (!conflict && row?.cavity_a && learnedEndpt.decision.cavity && row.cavity_a !== learnedEndpt.decision.cavity) {
        conflict = true;
      }
      const nextConflictCount = (learnedEndpt.conflict_count ?? 0) + 1;

      if (conflict) {
        trackLearningEvent(hints, { context_type: 'ENDPOINT', signature: sig, outcome: 'CONFLICT' });
        newFlags.push(mkFlag(
          'review_required',
          `Wire ${wire.wire_id}: learned endpoint ${sig} conflicts with drawing data — verify connector/cavity`,
          `wire_instances.${idx}`,
        ));
        if (nextConflictCount > 3) {
          newFlags.push(mkFlag(
            'review_required',
            `Wire ${wire.wire_id}: learned endpoint ${sig} repeatedly conflicted — treat as LOW confidence`,
            `wire_instances.${idx}`,
          ));
          console.warn('[HWI LEARNING DEGRADED]', { context_type: 'ENDPOINT', signature: sig, wire_id: wire.wire_id });
        }
        if (nextConflictCount > (learnedEndpt.usage_count ?? 0)) {
          newFlags.push(mkFlag(
            'warning',
            `Wire ${wire.wire_id}: learned endpoint ${sig} appears unstable — review recommended`,
            `wire_instances.${idx}`,
          ));
        }
        endpoints = computeWireEndpoints(wire, row, termIndex, undefined, hints);
      } else {
        endpoints = computeWireEndpoints(wire, row, termIndex, learnedEndpt, hints, sig);
      }
    } else {
      endpoints = computeWireEndpoints(wire, row, termIndex, undefined, hints);
    }

    const pinRows   = buildPinMapRows(wire, endpoints);

    newPinMapRows.push(...pinRows);
    addEndpointFlags(wire, idx, row, endpoints, drawing.drawing_type, newFlags);

    console.log('[HWI ENDPOINT RESOLUTION]', {
      wire_id:           wire.wire_id,
      endpointAResolved: !!endpoints.end_a.connector_id,
      endpointBResolved: !!endpoints.end_b.connector_id,
      connectorA:        endpoints.end_a.connector_id,
      connectorB:        endpoints.end_b.connector_id,
      confidence:        endpoints.confidence,
    });

    const provenance = {
      ...wire.provenance,
      confidence: Math.max(wire.provenance.confidence, endpoints.confidence),
    };
    if (endpoints.usedLearned) {
      provenance.source_type = 'learned';
      provenance.note = 'Learned endpoint applied';
    }

    return {
      ...wire,
      end_a: endpoints.end_a,
      end_b: endpoints.end_b,
      provenance,
    };
  });

  const resolvedCount = resolvedWires.filter(
    w => w.end_a.connector_id || w.end_b.connector_id
  ).length;

  const fullCount = resolvedWires.filter(
    w => w.end_a.connector_id && w.end_b.connector_id
  ).length;

  if (newPinMapRows.length > 0) {
    newFlags.push(mkFlag(
      'info',
      `Endpoint resolution complete — ${resolvedCount}/${resolvedWires.length} wire(s) have at least one endpoint; ${fullCount} fully resolved; ${newPinMapRows.length} pin map rows generated`,
      'wire_instances',
    ));
  }

  console.log('[HWI PIN MAP GENERATED]', {
    rows:          newPinMapRows.length,
    resolved:      resolvedCount,
    fully_resolved: fullCount,
    flags:         newFlags.length,
  });

  return {
    ...job,
    wire_instances:    resolvedWires,
    pin_map_rows:      [...job.pin_map_rows, ...newPinMapRows],
    engineering_flags: [...job.engineering_flags, ...newFlags],
  };
}
