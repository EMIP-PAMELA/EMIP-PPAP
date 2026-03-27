/**
 * Control Plan Data Model - Document Engine
 *
 * Defines the data structure for a Control Plan document.
 * Produced by the mapping layer from a PFMEAModel.
 *
 * Structural fields (stepNumber, operation, characteristic, failureMode, cause)
 * are carried forward from PFMEA for traceability.
 * Control fields are initialized to null and completed by the user.
 *
 * Architecture layer: Model (between PFMEA and Template)
 */

export interface ControlPlanRow {
  id: string;

  stepNumber: string;
  operation: string;

  characteristic: string;

  failureMode: string | null;
  cause: string | null;

  preventionControl: string | null;
  detectionControl: string | null;

  measurementMethod: string | null;
  sampleSize: string | null;
  frequency: string | null;

  reactionPlan: string | null;
}

export interface ControlPlanModel {
  partNumber: string;
  rows: ControlPlanRow[];
}
