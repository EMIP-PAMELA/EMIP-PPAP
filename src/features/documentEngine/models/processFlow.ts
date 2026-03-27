/**
 * Process Flow Data Model - Document Engine
 *
 * Defines the data structure for a Process Flow document.
 * This model is produced by the mapping layer from NormalizedBOM.
 *
 * Architecture layer: Model (between Normalization and Template)
 */

export interface ProcessStep {
  stepNumber: string;
  operation: string;
  description: string;
  inputs: string[];
  outputs: string[];
}

export interface ProcessFlowModel {
  partNumber: string;
  steps: ProcessStep[];
}
