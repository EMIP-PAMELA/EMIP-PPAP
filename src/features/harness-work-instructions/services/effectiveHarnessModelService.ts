/**
 * Effective Harness Model Service — Phase T12.4
 *
 * Single source of truth for the authoritative harness model.
 * All UI, commit gating, decision display, and question cards must derive
 * their state from this service — never directly from raw analysis objects.
 *
 * Authority precedence:
 *   A. Doc type:    operator-selected > analysis-inferred > UNKNOWN
 *   B. Connectivity: SKU model edits (T12) > wire overrides (T11) > extracted
 *   C. Decision:    always recomputed from the effective connectivity
 *
 * Governance:
 *   - Pure function. No I/O, no DB, no side effects. Never throws.
 *   - Original extracted analysis is NEVER mutated.
 *   - Operator authority layers are additive — each layer is explicit.
 *   - All outputs are new objects; inputs are read-only.
 */

import type {
  IngestionAnalysisResult,
  UnresolvedQuestion,
  WireOperatorOverride,
} from '@/src/features/vault/types/ingestionReview';
import type { HarnessConnectivityResult } from './harnessConnectivityService';
import type { HarnessValidationResult } from './harnessValidationService';
import type { HarnessConfidenceResult } from './harnessConfidenceService';
import type { HarnessDecisionResult } from './harnessDecisionService';
import type { OperatorWireModel } from './skuModelEditService';
import { revalidateWithOverrides } from './wireOperatorResolutionService';
import { buildEffectiveSkuHarnessModel } from './skuModelEditService';

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export interface EffectiveHarnessState {
  /** Effective connectivity after T11 overrides and T12 SKU edits. */
  effectiveConnectivity: HarnessConnectivityResult | null;
  /** Validation recomputed from effectiveConnectivity. */
  effectiveValidation: HarnessValidationResult | null;
  /** Confidence recomputed from effectiveConnectivity. */
  effectiveConfidence: HarnessConfidenceResult | null;
  /** Decision recomputed from effectiveConnectivity. */
  effectiveDecision: HarnessDecisionResult | null;
  /** Authority-resolved document type. */
  effectiveDocumentType: string | null;
  /** Which authority level supplied the effective document type. */
  effectiveDocTypeSource: 'OPERATOR' | 'INFERRED' | 'UNKNOWN';
  effectivePartNumber: string | null;
  effectiveRevision: string | null;
  effectiveDrawingNumber: string | null;
  /**
   * Unresolved questions after filtering questions for operator-confirmed
   * fields. DOC_TYPE_UNCERTAIN is absent when operatorDocType is set.
   */
  unresolvedQuestions: UnresolvedQuestion[];
  /**
   * True when no blocking unresolved questions remain.
   * Does NOT check required document fields — callers must combine with
   * presence of confirmedDocumentType, confirmedPartNumber, etc.
   */
  readyToCommit: boolean;
}

// ---------------------------------------------------------------------------
// Primary export
// ---------------------------------------------------------------------------

/**
 * Build the authoritative effective harness state for a given item.
 *
 * Call this once per render cycle (e.g. via useMemo) and distribute the
 * result to all consumers. Never call raw analysis.harnessConnectivity
 * in UI components — use effectiveState.effectiveConnectivity instead.
 */
export function buildEffectiveHarnessState(args: {
  analysis: IngestionAnalysisResult;
  /** Operator-selected document type, if any. */
  operatorDocType?: string | null;
  /** Which fields the operator has explicitly confirmed. */
  operatorConfirmed?: Partial<Record<'documentType' | 'partNumber' | 'revision' | 'drawingNumber', boolean>>;
  /** T11 wire-level operator overrides. */
  wireOperatorOverrides?: WireOperatorOverride[];
  /** T12 SKU-level added wires. */
  skuAddedWires?: OperatorWireModel[];
  /** T12 SKU-level edited wires. */
  skuEditedWires?: OperatorWireModel[];
  /** T12 SKU-level deleted wire IDs. */
  skuDeletedWireIds?: string[];
}): EffectiveHarnessState {
  const {
    analysis,
    operatorDocType,
    operatorConfirmed,
    wireOperatorOverrides = [],
    skuAddedWires         = [],
    skuEditedWires        = [],
    skuDeletedWireIds     = [],
  } = args;

  // ── A. Document type authority: operator > inferred > UNKNOWN ───────────
  const effectiveDocumentType: string | null =
    operatorDocType ??
    (analysis.proposedDocumentType !== 'UNKNOWN' ? analysis.proposedDocumentType : null);

  const effectiveDocTypeSource: 'OPERATOR' | 'INFERRED' | 'UNKNOWN' =
    operatorDocType                              ? 'OPERATOR' :
    analysis.proposedDocumentType !== 'UNKNOWN' ? 'INFERRED'  :
                                                  'UNKNOWN';

  // ── Unresolved questions: remove entries for confirmed fields ────────────
  // Operator confirmations are authoritative — suppress the corresponding
  // blocking question so it no longer blocks commit readiness.
  let unresolvedQuestions: UnresolvedQuestion[] = [...analysis.unresolvedQuestions];

  if (operatorDocType) {
    unresolvedQuestions = unresolvedQuestions.filter(q => q.fieldToResolve !== 'documentType');
  }
  if (operatorConfirmed?.partNumber) {
    unresolvedQuestions = unresolvedQuestions.filter(q => q.fieldToResolve !== 'partNumber');
  }
  if (operatorConfirmed?.revision) {
    unresolvedQuestions = unresolvedQuestions.filter(q => q.fieldToResolve !== 'revision');
  }
  if (operatorConfirmed?.drawingNumber) {
    unresolvedQuestions = unresolvedQuestions.filter(q => q.fieldToResolve !== 'drawingNumber');
  }

  // ── B. Connectivity: extracted → T11 overrides → T12 SKU edits ──────────
  let effectiveConnectivity: HarnessConnectivityResult | null = analysis.harnessConnectivity ?? null;
  let effectiveValidation:   HarnessValidationResult   | null = analysis.harnessValidation   ?? null;
  let effectiveConfidence:   HarnessConfidenceResult   | null = analysis.harnessConfidence   ?? null;
  let effectiveDecision:     HarnessDecisionResult     | null = analysis.harnessDecision     ?? null;

  const hasT11 = wireOperatorOverrides.length > 0;
  const hasT12 = skuAddedWires.length > 0 || skuEditedWires.length > 0 || skuDeletedWireIds.length > 0;

  if (effectiveConnectivity && hasT11) {
    const t11 = revalidateWithOverrides({
      connectivity:   effectiveConnectivity,
      overrides:      wireOperatorOverrides,
      reconciliation: analysis.harnessReconciliation ?? null,
    });
    effectiveConnectivity = t11.resolvedConnectivity;
    effectiveValidation   = t11.resolvedValidation;
    effectiveConfidence   = t11.resolvedConfidence;
    effectiveDecision     = t11.resolvedDecision;
  }

  if (effectiveConnectivity && hasT12) {
    // T12 SKU edits are applied on top of T11-resolved connectivity so that
    // operator wire-level overrides are not lost when SKU edits are applied.
    const t12 = buildEffectiveSkuHarnessModel({
      extractedConnectivity:  effectiveConnectivity,
      operatorAddedWires:     skuAddedWires,
      operatorEditedWires:    skuEditedWires,
      operatorDeletedWireIds: skuDeletedWireIds,
    });
    effectiveConnectivity = t12.connectivity;
    effectiveValidation   = t12.validation;
    effectiveConfidence   = t12.confidence;
    effectiveDecision     = t12.decision;
  }

  // ── C. Readiness: no blocking unresolved questions remain ────────────────
  const readyToCommit = unresolvedQuestions.every(q => !q.blocksCommit);

  console.log('[T12.4 EFFECTIVE MODEL]', {
    usingEffectiveConnectivity: hasT11 || hasT12,
    usingEffectiveDecision:     hasT11 || hasT12,
    effectiveDocType:           effectiveDocumentType,
    effectiveDocTypeSource,
    t11OverrideCount:           wireOperatorOverrides.length,
    t12AddCount:                skuAddedWires.length,
    t12EditCount:               skuEditedWires.length,
    t12DeleteCount:             skuDeletedWireIds.length,
    unresolvedQuestionCount:    unresolvedQuestions.length,
    blockingCount:              unresolvedQuestions.filter(q => q.blocksCommit).length,
    readyToCommit,
  });

  return {
    effectiveConnectivity,
    effectiveValidation,
    effectiveConfidence,
    effectiveDecision,
    effectiveDocumentType,
    effectiveDocTypeSource,
    effectivePartNumber:    analysis.proposedPartNumber    ?? null,
    effectiveRevision:      analysis.proposedRevision      ?? null,
    effectiveDrawingNumber: analysis.proposedDrawingNumber ?? null,
    unresolvedQuestions,
    readyToCommit,
  };
}
