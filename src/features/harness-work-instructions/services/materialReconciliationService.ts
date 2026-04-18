import type { CanonicalDrawingDraft } from '../types/drawingDraft';
import type { HarnessInstructionJob, WireInstance, KomaxRow } from '../types/harnessInstruction.schema';
import { normalizeWireMaterialKey } from '@/src/utils/normalizeWireMaterialKey';
import { normalizeToInches } from '@/src/utils/normalizeLength';

export type MaterialReconciliationStatus = 'MATCH' | 'UNDER_IN_BOM' | 'OVER_IN_BOM';

export interface MaterialReconciliationEntry {
  drawingTotalInches: number;
  bomTotalInches: number;
  deltaInches: number;
  status: MaterialReconciliationStatus;
}

export interface MaterialReconciliationResult {
  drawingAggregation: Record<string, number>;
  bomAggregation: Record<string, number>;
  reconciliation: Record<string, MaterialReconciliationEntry>;
}

interface AggregateParams {
  drawing?: CanonicalDrawingDraft | null;
  bomJob?: HarnessInstructionJob | null;
}

export function reconcileDrawingAndBOMMaterials({ drawing, bomJob }: AggregateParams): MaterialReconciliationResult | null {
  if (!drawing || !bomJob) {
    console.log('[T23.6.53 RECON]', { skipped: true, reason: 'missing_inputs' });
    return null;
  }

  const drawingAggregation = aggregateDrawing(drawing);
  const bomAggregation = aggregateBOM(bomJob);

  console.log('[T23.6.53 DRAWING AGGREGATE]', {
    keys: Object.keys(drawingAggregation),
    totals: drawingAggregation,
  });

  console.log('[T23.6.53 BOM AGGREGATE]', {
    keys: Object.keys(bomAggregation),
    totals: bomAggregation,
  });

  const reconciliation = buildReconciliation(drawingAggregation, bomAggregation);

  console.log('[T23.6.53 RECONCILIATION]', reconciliation);

  return { drawingAggregation, bomAggregation, reconciliation };
}

function aggregateDrawing(drawing: CanonicalDrawingDraft): Record<string, number> {
  const map: Record<string, number> = {};
  for (const row of drawing.wire_rows ?? []) {
    const length = normalizeToInches(row.length ?? 0, 'in');
    if (!length) continue;
    const key = normalizeWireMaterialKey({ gauge: row.gauge, color: row.color, type: row.aci_part_number });
    map[key] = (map[key] ?? 0) + length;
  }
  return map;
}

function aggregateBOM(bomJob: HarnessInstructionJob): Record<string, number> {
  const map: Record<string, number> = {};
  const wireIndex = new Map<string, WireInstance>();
  for (const wire of bomJob.wire_instances ?? []) {
    wireIndex.set(wire.wire_id, wire);
  }

  const bomMaterials: KomaxRow[] = bomJob.komax_rows ?? [];
  for (const row of bomMaterials) {
    const wire = wireIndex.get(row.wire_id);
    const key = normalizeWireMaterialKey({
      gauge: wire?.gauge,
      color: wire?.color,
      type: wire?.aci_wire_part_number,
    });
    const unit = inferBOMUnit(row);
    const length = normalizeToInches(row.cut_length, unit);
    if (!length) continue;
    map[key] = (map[key] ?? 0) + length;
  }

  return map;
}

function inferBOMUnit(row: KomaxRow): string {
  const note = row.provenance?.note?.toLowerCase() ?? '';
  if (note.includes('inch')) return 'in';
  if (note.includes('mm')) return 'mm';
  return 'ft';
}

function buildReconciliation(
  drawing: Record<string, number>,
  bom: Record<string, number>,
): Record<string, MaterialReconciliationEntry> {
  const reconciliation: Record<string, MaterialReconciliationEntry> = {};
  const allKeys = new Set([...Object.keys(drawing), ...Object.keys(bom)]);

  for (const key of allKeys) {
    const drawingTotal = roundInches(drawing[key] ?? 0);
    const bomTotal = roundInches(bom[key] ?? 0);
    const delta = roundInches(drawingTotal - bomTotal);
    let status: MaterialReconciliationStatus = 'MATCH';
    if (delta > 0.01) {
      status = 'UNDER_IN_BOM';
    } else if (delta < -0.01) {
      status = 'OVER_IN_BOM';
    }
    reconciliation[key] = {
      drawingTotalInches: drawingTotal,
      bomTotalInches: bomTotal,
      deltaInches: delta,
      status,
    };
  }

  return reconciliation;
}

function roundInches(value: number): number {
  return Math.round(value * 100) / 100;
}
