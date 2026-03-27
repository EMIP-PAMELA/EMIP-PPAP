/**
 * Core BOM Data Types for Document Engine
 * 
 * These types define the raw parsed output from BOM parsers.
 * They are PURE data structures with no business logic or side effects.
 * 
 * Architecture layer: Core Engine - Data Contracts
 */

export interface RawComponent {
  rawLine: string;
  candidateIds: string[];
  detectedPartId?: string;
  detectedAci?: string | null;
  detectedQty?: number;
  detectedUom?: string | null;
}

export interface RawOperation {
  step: string;
  resourceId: string;
  description: string;
  rawLines: string[];
  components: RawComponent[];
}

export interface RawBOMData {
  masterPartNumber: string;
  operations: RawOperation[];
  rawText: string;
  pageLogs: PageLog[];
}

export interface PageLog {
  pageNumber: number;
  hasText: boolean;
  componentCount: number;
  operationCount: number;
  warning: string | null;
}

export interface ProcessInstruction {
  step: string;
  instruction: string;
}

/**
 * Normalized BOM Data Types
 * 
 * These types represent the output of the normalization layer.
 * They contain interpreted, classified, and enriched data ready for template mapping.
 * 
 * Architecture layer: Normalization Output
 */

export type ComponentType = 'wire' | 'terminal' | 'hardware' | 'unknown';

export interface NormalizedComponent {
  partId: string;
  aciCode: string | null;
  description: string | null;

  quantity: number;
  uom: string | null;

  componentType: ComponentType;

  source: {
    rawLine: string;
    trailingLines: string[];
  };
}

export interface NormalizedOperation {
  step: string;
  resourceId: string;
  description: string;

  components: NormalizedComponent[];
  processLines: string[];
  metadataLines: string[];
}

export interface BOMSummary {
  totalComponents: number;
  totalOperations: number;
  wires: number;
  terminals: number;
  hardware: number;
}

export interface NormalizedBOM {
  masterPartNumber: string;
  operations: NormalizedOperation[];
  summary: BOMSummary;
}
