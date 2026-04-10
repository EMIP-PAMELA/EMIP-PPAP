/**
 * Harness Work Instruction Generator — Drawing Fusion Service
 * Phase HWI.9 — Drawing-Driven Wire Expansion + BOM Attribution
 *
 * Responsibilities:
 *   1. Accept CanonicalDrawingDraft + HarnessInstructionJob (BOM-derived)
 *   2. Build wire_instances from drawing wire_rows (real geometry)
 *   3. Index BOM wire types by gauge + color
 *   4. Match each drawing wire to the best BOM type via scoring
 *   5. Apply BOM attribution (gauge, color, ACI part number)
 *   6. Validate quantity distribution vs BOM
 *   7. Replace job.wire_instances with fused wires
 *   8. Append fusion flags to job.engineering_flags
 *
 * Governance:
 *   - Drawing is source of truth for geometry (cut_length, wire_id)
 *   - BOM is source of truth for material (gauge, color, ACI PN)
 *   - BOM ingestion untouched
 *   - Drawing ingestion untouched
 *   - Returns a new job object — original is not mutated
 *   - If drawing has no wire rows, returns original job unchanged
 */

import type {
  HarnessInstructionJob,
  WireInstance,
  EngineeringFlag,
  EndTerminal,
} from '../types/harnessInstruction.schema';
import type { CanonicalDrawingDraft, DraftWireRow } from '../types/drawingDraft';
import type { FusionHints, WireMatchDecision } from './learningSignatures';
import { buildWireMatchSignature } from './learningSignatures';

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

export type MatchConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

interface BomWireType {
  key:                  string;
  gauge:                string;
  color:                string;
  aci_wire_part_number: string;
  qty:                  number;
  assigned:             number;
}

interface MatchResult {
  bomType:    BomWireType | null;
  score:      number;
  confidence: MatchConfidence;
}

// ---------------------------------------------------------------------------
// Null terminal constant
// ---------------------------------------------------------------------------

const NULL_TERMINAL: EndTerminal = {
  connector_id:         null,
  cavity:               null,
  terminal_part_number: null,
  seal_part_number:     null,
};

// ---------------------------------------------------------------------------
// Flag factory (produces EngineeringFlag compatible with HWI schema)
// ---------------------------------------------------------------------------

let flagSeq = 0;

function mkJobFlag(
  flag_type: EngineeringFlag['flag_type'],
  message: string,
  field_ref: string | null = null,
): EngineeringFlag {
  return {
    flag_id:   `FF${String(++flagSeq).padStart(3, '0')}`,
    flag_type,
    field_ref,
    message,
    resolved:  false,
  };
}

// ---------------------------------------------------------------------------
// Step 3: Build BOM type index (deduped by gauge + color)
// ---------------------------------------------------------------------------

function normalizeToken(value: string | number | null | undefined): string | null {
  if (value == null) return null;
  const str = String(value).trim();
  return str.length === 0 ? null : str.toUpperCase();
}

function buildBomTypeIndex(wires: WireInstance[]): BomWireType[] {
  const map = new Map<string, BomWireType>();

  for (const wire of wires) {
    const gauge = normalizeToken(wire.gauge) ?? 'UNKNOWN';
    const color = normalizeToken(wire.color) ?? 'UNKNOWN';
    const key = `${gauge}|${color}`;
    const existing = map.get(key);

    if (existing) {
      existing.qty += 1;
      continue;
    }

    map.set(key, {
      key,
      gauge,
      color,
      aci_wire_part_number: wire.aci_wire_part_number,
      qty: 1,
      assigned: 0,
    });
  }

  return [...map.values()];
}

// ---------------------------------------------------------------------------
// Step 4: Score a drawing row against a single BOM type
// ---------------------------------------------------------------------------

function scoreMatch(row: DraftWireRow, bom: BomWireType): number {
  let score = 0;
  const drawingGauge = normalizeToken(row.gauge);
  const drawingColor = normalizeToken(row.color);

  if (drawingGauge && drawingGauge !== 'UNKNOWN') {
    if (drawingGauge === bom.gauge) score += 2;
  }

  if (!drawingColor || drawingColor === 'UNKNOWN') {
    score += 1; // color absent from drawing — weak match
  } else if (drawingColor === bom.color) {
    score += 2;
  }

  return score;
}

function confidenceFromScore(score: number): MatchConfidence {
  if (score >= 4) return 'HIGH';
  if (score >= 2) return 'MEDIUM';
  return 'LOW';
}

// ---------------------------------------------------------------------------
// Match one drawing row to the best available BOM type
// ---------------------------------------------------------------------------

function matchDrawingRow(row: DraftWireRow, bomTypes: BomWireType[]): MatchResult {
  if (bomTypes.length === 0) {
    return { bomType: null, score: 0, confidence: 'LOW' };
  }

  const scored = bomTypes
    .map(bt => ({ bt, score: scoreMatch(row, bt) }))
    .sort((a, b) => b.score - a.score);

  for (const { bt, score } of scored) {
    if (bt.assigned >= bt.qty) continue;
    bt.assigned += 1;
    return {
      bomType:    bt,
      score,
      confidence: confidenceFromScore(score),
    };
  }

  return { bomType: null, score: 0, confidence: 'LOW' };
}

// ---------------------------------------------------------------------------
// Step 2 + 5: Build fused wire instances
// ---------------------------------------------------------------------------

function buildFusedWireInstances(
  wire_rows:          DraftWireRow[],
  bomTypes:           BomWireType[],
  flags:              EngineeringFlag[],
  wireMatchOverrides?: Map<string, WireMatchDecision>,
): WireInstance[] {
  const wires: WireInstance[] = [];

  for (let idx = 0; idx < wire_rows.length; idx++) {
    const row    = wire_rows[idx];

    // Compute wireId first so it is available for learning log
    const wireId = row.wire_id
      ? String(row.wire_id)
      : `DW${String(idx + 1).padStart(3, '0')}`;

    // Apply wire-match learning override if available (before normal scoring)
    let match: MatchResult;
    if (wireMatchOverrides && wireMatchOverrides.size > 0) {
      const sig     = buildWireMatchSignature(row.gauge, row.color, row.length);
      const learned = wireMatchOverrides.get(sig);
      if (learned) {
        const bt = bomTypes.find(
          b => b.gauge === learned.gauge && b.color === learned.color && b.assigned < b.qty
        );
        if (bt) {
          bt.assigned += 1;
          match = { bomType: bt, score: 4, confidence: 'HIGH' };
          console.log('[HWI LEARNING APPLIED]', { context_type: 'WIRE_MATCH', signature: sig, wire_id: wireId });
        } else {
          console.log('[HWI LEARNING SKIPPED]', { reason: 'learned_bom_type_exhausted', signature: sig, wire_id: wireId });
          match = matchDrawingRow(row, bomTypes);
        }
      } else {
        match = matchDrawingRow(row, bomTypes);
      }
    } else {
      match = matchDrawingRow(row, bomTypes);
    }

    const bom    = match.bomType;

    const resolvedGauge = bom?.gauge
      ?? normalizeToken(row.gauge)
      ?? 'UNKNOWN';

    const resolvedColor = bom?.color
      ?? normalizeToken(row.color)
      ?? 'UNKNOWN';

    const resolvedACI = bom?.aci_wire_part_number
      ?? row.aci_part_number
      ?? 'UNKNOWN';

    console.log('[FUSION MATCH]', {
      wire_id:       wireId,
      drawing_gauge: row.gauge,
      drawing_color: row.color,
      assigned_type: bom ? `${bom.gauge}/${bom.color}` : 'UNMATCHED',
      confidence:    match.confidence,
      score:         match.score,
      assigned_count: bom?.assigned ?? 0,
      remaining_capacity: bom ? Math.max(bom.qty - bom.assigned, 0) : 0,
    });

    wires.push({
      wire_id:              wireId,
      aci_wire_part_number: resolvedACI,
      gauge:                resolvedGauge,
      color:                resolvedColor,
      cut_length:           row.length ?? null,
      cut_length_source:    'DRAWING',
      strip_end_a:          null,
      strip_end_b:          null,
      end_a:                NULL_TERMINAL,
      end_b:                NULL_TERMINAL,
      match_confidence:     match.confidence,
      provenance: {
        source_type: 'drawing',
        confidence:  Math.min(match.score / 4, 1),
        note: bom
          ? `BOM match: ${bom.gauge}AWG ${bom.color} → ${bom.aci_wire_part_number}`
          : 'No BOM type matched — manual attribution required',
      },
    });

    if (!bom) {
      flags.push(mkJobFlag(
        'review_required',
        `Wire ${wireId}: unable to assign BOM wire type — manual selection required`,
        `wire_instances.${idx}`,
      ));
    }

    // Step 9: flags for low-confidence or incomplete rows
    if (match.confidence === 'LOW') {
      flags.push(mkJobFlag(
        'review_required',
        `Wire ${wireId}: low-confidence BOM match (score ${match.score}) — verify gauge/color attribution`,
        `wire_instances.${idx}.match_confidence`,
      ));
    }
    if (!row.gauge || row.gauge.toUpperCase() === 'UNKNOWN') {
      flags.push(mkJobFlag(
        'review_required',
        `Wire ${wireId}: gauge not present in drawing — attributed from BOM type (${bom?.gauge ?? 'UNKNOWN'})`,
        `wire_instances.${idx}.gauge`,
      ));
    }
    if (!row.color || row.color.toUpperCase() === 'UNKNOWN') {
      flags.push(mkJobFlag(
        'review_required',
        `Wire ${wireId}: color not present in drawing — attributed from BOM type (${bom?.color ?? 'UNKNOWN'})`,
        `wire_instances.${idx}.color`,
      ));
    }
    if (row.length === null) {
      flags.push(mkJobFlag(
        'review_required',
        `Wire ${wireId}: cut length not extracted from drawing — add manually`,
        `wire_instances.${idx}.cut_length`,
      ));
    }

    if (bom && bom.assigned > bom.qty) {
      flags.push(mkJobFlag(
        'error',
        `Wire ${wireId}: wire assignment exceeded BOM quantity constraint (${bom.assigned}/${bom.qty})`,
        `wire_instances.${idx}`,
      ));
    }
  }

  return wires;
}

// ---------------------------------------------------------------------------
// Step 6: Validate quantity distribution
// ---------------------------------------------------------------------------

function validateQuantities(
  fusedWires: WireInstance[],
  bomWires:   WireInstance[],
  bomTypes:   BomWireType[],
  flags:      EngineeringFlag[],
): void {
  for (const bt of bomTypes) {
    if (bt.assigned > bt.qty) {
      flags.push(mkJobFlag(
        'error',
        `BOM wire type ${bt.gauge}AWG ${bt.color} over-assigned (${bt.assigned}/${bt.qty})`,
        'wire_instances',
      ));
      continue;
    }
    if (bt.assigned === 0) {
      flags.push(mkJobFlag(
        'review_required',
        `BOM wire type ${bt.gauge}AWG ${bt.color} (${bt.aci_wire_part_number}) not used in drawing (0/${bt.qty})`,
        'wire_instances',
      ));
    } else if (bt.assigned < bt.qty) {
      flags.push(mkJobFlag(
        'review_required',
        `BOM wire type ${bt.gauge}AWG ${bt.color} under-assigned (${bt.assigned}/${bt.qty})`,
        'wire_instances',
      ));
    }
  }

  const drawingCount = fusedWires.length;
  const bomCount     = bomWires.length;
  if (Math.abs(drawingCount - bomCount) > bomCount) {
    flags.push(mkJobFlag(
      'warning',
      `Drawing wire count (${drawingCount}) differs significantly from BOM wire type count (${bomCount}) — verify drawing completeness`,
      'wire_instances',
    ));
  }
}

// ---------------------------------------------------------------------------
// Step 7: Main fusion entry point
// ---------------------------------------------------------------------------

export function fuseDrawingWithBOM(
  drawing: CanonicalDrawingDraft,
  job:     HarnessInstructionJob,
  hints?:  FusionHints,
): HarnessInstructionJob {
  flagSeq = 0;

  console.log('[HWI FUSION START]', {
    drawing_type:  drawing.drawing_type,
    drawing_rows:  drawing.wire_rows.length,
    bom_wires:     job.wire_instances.length,
    timestamp:     new Date().toISOString(),
  });

  // If no drawing rows, skip fusion — return original job with info flag
  if (drawing.wire_rows.length === 0) {
    const infoFlags: EngineeringFlag[] = [
      mkJobFlag(
        'info',
        `Drawing type "${drawing.drawing_type}" produced no extractable wire rows — BOM-derived wire instances retained`,
        'wire_instances',
      ),
    ];
    console.log('[HWI FUSION SKIPPED]', { reason: 'no_drawing_wire_rows', drawing_type: drawing.drawing_type });
    return {
      ...job,
      engineering_flags: [...job.engineering_flags, ...infoFlags],
    };
  }

  const fusionFlags: EngineeringFlag[] = [];
  const bomTypes = buildBomTypeIndex(job.wire_instances);

  const fusedWires = buildFusedWireInstances(drawing.wire_rows, bomTypes, fusionFlags, hints?.wireMatchOverrides);

  validateQuantities(fusedWires, job.wire_instances, bomTypes, fusionFlags);

  // Summarise fusion quality
  const highCount   = fusedWires.filter(w => w.match_confidence === 'HIGH').length;
  const medCount    = fusedWires.filter(w => w.match_confidence === 'MEDIUM').length;
  const lowCount    = fusedWires.filter(w => w.match_confidence === 'LOW').length;

  fusionFlags.push(mkJobFlag(
    'info',
    `Drawing fusion complete — ${fusedWires.length} wire(s) built from drawing: HIGH ${highCount} · MEDIUM ${medCount} · LOW ${lowCount}`,
    'wire_instances',
  ));

  // Remove the stale "Cut lengths not available" flag from the BOM pass
  const filteredExistingFlags = job.engineering_flags.filter(
    f => f.message !== 'Cut lengths not available from BOM — drawing required',
  );

  const updatedJob: HarnessInstructionJob = {
    ...job,
    wire_instances:    fusedWires,
    engineering_flags: [...filteredExistingFlags, ...fusionFlags],
  };

  console.log('[HWI FUSION COMPLETE]', {
    wire_instances: fusedWires.length,
    flags_added:    fusionFlags.length,
    high:  highCount,
    medium: medCount,
    low:    lowCount,
  });

  return updatedJob;
}
