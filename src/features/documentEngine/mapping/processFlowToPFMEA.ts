/**
 * ProcessFlow → PFMEA Mapping Layer - Document Engine
 *
 * Transforms a ProcessFlowModel into a PFMEAModel.
 * Pure data transformation — no UI logic, no template logic.
 *
 * Mapping rules:
 * - One PFMEARow per output per ProcessStep
 * - Steps with no outputs produce zero rows (not one row with empty output)
 * - Risk fields (failureMode, effect, cause, severity, occurrence, detection, rpn)
 *   are left null — user fills them in via the editor
 * - Original step order preserved; output order within each step preserved
 *
 * Architecture layer: Mapping
 */

import { ProcessFlowModel } from '../models/processFlow';
import { PFMEAModel, PFMEARow } from '../models/pfmea';

/**
 * Map a ProcessFlowModel to a PFMEAModel.
 * Deterministic: does not infer failure modes or assign default risk scores.
 */
export function mapProcessFlowToPFMEA(processFlow: ProcessFlowModel): PFMEAModel {
  const rows: PFMEARow[] = [];

  for (const step of processFlow.steps) {
    for (const output of step.outputs) {
      rows.push({
        stepNumber: step.stepNumber,
        operation: step.operation,
        output,
        failureMode: null,
        effect: null,
        cause: null,
        severity: null,
        occurrence: null,
        detection: null,
        rpn: null,
      });
    }
  }

  return {
    partNumber: processFlow.partNumber,
    rows,
  };
}
