/**
 * PFMEA → Control Plan Mapping Layer - Document Engine
 *
 * Transforms a PFMEAModel into a ControlPlanModel.
 * Pure data transformation — no UI logic, no template logic.
 *
 * Mapping rules:
 * - One ControlPlanRow per PFMEARow
 * - Structural and risk context carried forward from PFMEA for traceability:
 *     stepNumber, operation, characteristic (← output), failureMode, cause
 * - Control fields initialized to null — user fills them in:
 *     preventionControl, detectionControl, measurementMethod,
 *     sampleSize, frequency, reactionPlan
 * - Row id is stable: "<stepNumber>-<rowIndex>"
 * - Original row order preserved
 *
 * Architecture layer: Mapping
 */

import { PFMEAModel } from '../models/pfmea';
import { ControlPlanModel, ControlPlanRow } from '../models/controlPlan';

/**
 * Map a PFMEAModel to a ControlPlanModel.
 * Deterministic: does not infer controls or auto-fill measurement logic.
 */
export function mapPFMEAToControlPlan(pfmea: PFMEAModel): ControlPlanModel {
  const rows: ControlPlanRow[] = pfmea.rows.map((pfmeaRow, index) => ({
    id: `${pfmeaRow.stepNumber}-${index}`,
    stepNumber: pfmeaRow.stepNumber,
    operation: pfmeaRow.operation,
    characteristic: pfmeaRow.output,
    failureMode: pfmeaRow.failureMode,
    cause: pfmeaRow.cause,
    preventionControl: null,
    detectionControl: null,
    measurementMethod: null,
    sampleSize: null,
    frequency: null,
    reactionPlan: null,
  }));

  return {
    partNumber: pfmea.partNumber,
    rows,
  };
}
