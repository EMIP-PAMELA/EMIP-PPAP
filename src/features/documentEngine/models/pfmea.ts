/**
 * PFMEA Data Model - Document Engine
 *
 * Defines the data structure for a Process FMEA document.
 * Produced by the mapping layer from a ProcessFlowModel.
 *
 * Risk fields (failureMode, effect, cause, severity, occurrence, detection, rpn)
 * are initialized to null and filled in by the user via the document editor.
 *
 * Architecture layer: Model (between ProcessFlow and Template)
 */

export interface PFMEARow {
  stepNumber: string;
  operation: string;
  output: string;

  failureMode: string | null;
  effect: string | null;
  cause: string | null;

  severity: number | null;
  occurrence: number | null;
  detection: number | null;

  rpn: number | null;
}

export interface PFMEAModel {
  partNumber: string;
  rows: PFMEARow[];
}
