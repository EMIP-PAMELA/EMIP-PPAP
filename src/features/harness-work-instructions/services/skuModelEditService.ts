/**
 * SKU Model Edit Service — Phase T12
 *
 * Provides a SKU-level authoritative editing layer over extracted harness
 * connectivity data. Operator additions, edits, and deletions form the
 * highest-authority source (OPERATOR_MODEL > OPERATOR_DRAWING > OCR/VISION).
 *
 * Governance:
 *   - Pure functions. No I/O, no DB calls, no side effects. Never throws.
 *   - DOES NOT mutate original extracted connectivity.
 *   - Operator provenance is always preserved (source: 'OPERATOR_MODEL').
 *   - All outputs are new objects; originals are unchanged.
 *   - Effective model is rebuilt each time from extracted + operator layers.
 */

import type {
  HarnessConnectivityResult,
  WireConnectivity,
  WireEndpoint,
} from './harnessConnectivityService';
import { endpointHasAuthoritativeTermination } from './harnessConnectivityService';
import { validateHarness } from './harnessValidationService';
import { adjustHarnessConfidence } from './harnessConfidenceService';
import { evaluateHarnessDecision } from './harnessDecisionService';
import type { HarnessValidationResult } from './harnessValidationService';
import type { HarnessConfidenceResult } from './harnessConfidenceService';
import type { HarnessDecisionResult } from './harnessDecisionService';
import type { HarnessReconciliationResult } from './harnessReconciliationService';

// ---------------------------------------------------------------------------
// OperatorWireModel — SKU-level authoritative wire record
// ---------------------------------------------------------------------------

export type WireTopology =
  | 'LINEAR'
  | 'BRANCH_DOUBLE_CRIMP'
  | 'GROUND'
  | 'SPLICE'
  | 'FLOATING';

export interface OperatorWireBranch {
  sharedSourceComponent?: string | null;
  sharedSourceCavity?: string | null;
  secondaryCavity?: string | null;
  ferrulePartNumber?: string | null;
  terminalPartNumber?: string | null;
}

/** SKU-level operator-authoritative wire model record. */
export interface OperatorWireModel {
  /** Stable client-side record id (uuid). */
  id: string;
  /** Display label; optional for unlabeled additions. */
  wireId?: string | null;
  /** When editing extracted wires, preserves original target wireId. */
  targetWireId?: string | null;
  length: number | null;
  /** Always 'in' — T11.4 global drawing rule. */
  lengthUnit: 'in';
  gauge: string | null;
  color: string | null;
  from: WireEndpoint;
  to: WireEndpoint;
  topology: WireTopology | null;
  branch: OperatorWireBranch | null;
  /** Required — operator must supply a reason for every edit. */
  reason: string;
  source: 'OPERATOR_MODEL';
  authoritative: true;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Effective model merge result
// ---------------------------------------------------------------------------

export interface EffectiveSkuHarnessModel {
  connectivity: HarnessConnectivityResult;
  validation: HarnessValidationResult;
  confidence: HarnessConfidenceResult;
  decision: HarnessDecisionResult;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function operatorWireToConnectivity(
  op: OperatorWireModel,
  sourceRowIndex: number,
): WireConnectivity {
  const trimmedWireId = op.wireId?.trim();
  const effectiveWireId = trimmedWireId && trimmedWireId.length > 0 ? trimmedWireId : op.id;
  const fromComplete = endpointHasAuthoritativeTermination(op.from);
  const toComplete   = endpointHasAuthoritativeTermination(op.to);

  return {
    wireId:       effectiveWireId,
    length:       op.length,
    lengthUnit:   'in',
    lengthInches: op.length,
    gauge:        op.gauge,
    color:        op.color,
    from:         { ...op.from },
    to:           { ...op.to },
    sourceRowIndex,
    rawText:      `[OPERATOR_MODEL:${op.topology ?? 'LINEAR'}] reason="${op.reason}" id=${op.id}`,
    confidence:   fromComplete && toComplete ? 0.95 : 0.60,
    unresolved:   !fromComplete || !toComplete,
  };
}

function recomputeSummary(wires: WireConnectivity[]): HarnessConnectivityResult['confidenceSummary'] {
  let resolved = 0, partial = 0, unresolved = 0;
  for (const w of wires) {
    if (w.unresolved) unresolved++;
    else if (endpointHasAuthoritativeTermination(w.from) && endpointHasAuthoritativeTermination(w.to)) resolved++;
    else partial++;
  }
  return { total: wires.length, resolved, partial, unresolved };
}

// ---------------------------------------------------------------------------
// Primary export — effective model builder
// ---------------------------------------------------------------------------

/**
 * Build the effective SKU harness model by merging extracted connectivity
 * with operator-level additions, edits, and deletions.
 *
 * Priority: OPERATOR_MODEL > extracted
 *
 * Steps:
 *   1. Start from extracted connectivity (copied, not mutated).
 *   2. Remove wires whose IDs appear in operatorDeletedWireIds.
 *   3. Apply operator edits: replace matching extracted wire with operator version.
 *   4. Append operator-added wires (IDs not present in extracted set).
 *   5. Recompute confidence summary.
 *   6. Rerun T7 → T8 → T9.
 */
export function buildEffectiveSkuHarnessModel(args: {
  extractedConnectivity: HarnessConnectivityResult | null;
  operatorAddedWires: OperatorWireModel[];
  operatorEditedWires: OperatorWireModel[];
  operatorDeletedWireIds: string[];
  /** T5 reconciliation — passed through to validateHarness so R7/R10/H2 remain active after SKU edits. */
  reconciliation?: HarnessReconciliationResult | null;
}): EffectiveSkuHarnessModel {
  const {
    extractedConnectivity,
    operatorAddedWires,
    operatorEditedWires,
    operatorDeletedWireIds,
  } = args;

  const deletedSet  = new Set(operatorDeletedWireIds);
  const editedMap   = new Map<string, OperatorWireModel>();
  for (const edit of operatorEditedWires) {
    const key = edit.targetWireId ?? edit.wireId ?? null;
    if (!key) continue;
    editedMap.set(key, edit);
  }

  const base = extractedConnectivity?.wires ?? [];
  let nextIdx = base.length;

  const merged: WireConnectivity[] = [];

  for (const wire of base) {
    if (deletedSet.has(wire.wireId)) continue;
    const edit = editedMap.get(wire.wireId);
    if (edit) {
      merged.push(operatorWireToConnectivity(edit, wire.sourceRowIndex));
    } else {
      merged.push({ ...wire });
    }
  }

  for (const added of operatorAddedWires) {
    const hasTargetEdit = added.targetWireId ? editedMap.has(added.targetWireId) : false;
    if (hasTargetEdit) continue;
    merged.push(operatorWireToConnectivity(added, nextIdx++));
  }

  const unresolvedWires = merged.filter(w => w.unresolved).map(w => w.wireId);
  const connectivity: HarnessConnectivityResult = {
    wires: merged,
    unresolvedWires,
    confidenceSummary: recomputeSummary(merged),
  };

  const validation = validateHarness({ connectivity, reconciliation: args.reconciliation ?? undefined });
  const confidence = adjustHarnessConfidence({ connectivity, validation });
  const decision   = evaluateHarnessDecision({ connectivity, validation, confidence });

  console.log('[T12 EFFECTIVE MODEL]', {
    extractedWires:    base.length,
    deleted:           deletedSet.size,
    edited:            editedMap.size,
    added:             operatorAddedWires.length,
    effectiveTotal:    merged.length,
    unresolvedAfter:   unresolvedWires.length,
    decision:          decision.overallDecision,
  });

  return { connectivity, validation, confidence, decision };
}

// ---------------------------------------------------------------------------
// Utility — generate a new OperatorWireModel skeleton
// ---------------------------------------------------------------------------

export function makeEmptyOperatorWire(overrides?: Partial<Omit<OperatorWireModel, 'source' | 'authoritative'>>): OperatorWireModel {
  const now = new Date().toISOString();
  return {
    id:          overrides?.id ?? `op-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    wireId:      overrides?.wireId ?? null,
    targetWireId: overrides?.targetWireId ?? null,
    length:      overrides?.length ?? null,
    lengthUnit:  'in',
    gauge:       overrides?.gauge ?? null,
    color:       overrides?.color ?? null,
    from:        overrides?.from ?? { component: null, cavity: null, treatment: null, terminationType: null },
    to:          overrides?.to   ?? { component: null, cavity: null, treatment: null, terminationType: null },
    topology:    overrides?.topology ?? null,
    branch:      overrides?.branch  ?? null,
    reason:      overrides?.reason  ?? '',
    source:      'OPERATOR_MODEL',
    authoritative: true,
    createdAt:   overrides?.createdAt ?? now,
    updatedAt:   overrides?.updatedAt ?? now,
  };
}

/**
 * Promote an extracted WireConnectivity to an OperatorWireModel so it can
 * be pre-populated into an edit form.
 */
export function wireConnectivityToOperatorModel(
  wire: WireConnectivity,
  reason = '',
): OperatorWireModel {
  const now = new Date().toISOString();
  return {
    id:          `op-${wire.wireId}-${Date.now()}`,
    wireId:      wire.wireId,
    targetWireId: wire.wireId,
    length:      wire.length,
    lengthUnit:  'in',
    gauge:       wire.gauge,
    color:       wire.color,
    from:        { ...wire.from },
    to:          { ...wire.to },
    topology:    null,
    branch:      null,
    reason,
    source:      'OPERATOR_MODEL',
    authoritative: true,
    createdAt:   now,
    updatedAt:   now,
  };
}
