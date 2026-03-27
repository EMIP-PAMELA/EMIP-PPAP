/**
 * BOM → Process Flow Mapping Layer - Document Engine
 *
 * Transforms NormalizedBOM into a ProcessFlowModel.
 * This is a pure data transformation - no UI logic, no template logic.
 *
 * Mapping rules:
 * - One ProcessStep per NormalizedOperation (preserves original order)
 * - stepNumber  ← operation.step
 * - operation   ← operation.resourceId
 * - description ← operation.description
 * - outputs     ← component partIds in this step (filtered for non-null)
 * - inputs      ← outputs of the immediately preceding step (if any)
 *
 * Architecture layer: Mapping
 */

import { NormalizedBOM } from '../types/bomTypes';
import { ProcessFlowModel, ProcessStep } from '../models/processFlow';

/**
 * Map a NormalizedBOM to a ProcessFlowModel.
 * Deterministic: preserves operation order, does not infer missing data.
 */
export function mapBOMToProcessFlow(bom: NormalizedBOM): ProcessFlowModel {
  // First pass: build outputs for every operation
  const operationOutputs: string[][] = bom.operations.map((op) =>
    op.components
      .map((c) => c.partId)
      .filter((id): id is string => id != null && id.trim() !== '')
  );

  // Second pass: build ProcessStep array
  const steps: ProcessStep[] = bom.operations.map((op, index) => {
    const inputs = index > 0 ? operationOutputs[index - 1] : [];
    const outputs = operationOutputs[index];

    return {
      stepNumber: op.step,
      operation: op.resourceId,
      description: op.description,
      inputs,
      outputs,
    };
  });

  return {
    partNumber: bom.masterPartNumber,
    steps,
  };
}
