/**
 * Template System Types - Document Engine
 * 
 * Defines the contract for document templates and their inputs/outputs.
 * Templates are declarative and consume NormalizedBOM + optional external data.
 * 
 * Architecture layer: Template System
 */

import { NormalizedBOM } from '../types/bomTypes';

// Phase 29: Support dynamic template IDs from ingested templates
export type TemplateId = 'PSW' | 'PROCESS_FLOW' | 'PFMEA' | 'CONTROL_PLAN' | string;

// Phase V2.6X: Field Certainty Model
export type FieldCertainty = 'system' | 'suggested' | 'required';
export type FieldSource = 'bom' | 'rule' | 'user' | 'unknown';
export type ChangeTrackingMode = 'log-on-change' | 'normal-edit' | 'required-input';

export interface FieldMetadata {
  certainty: FieldCertainty;
  source: FieldSource;
  originalValue?: any;
  changeTrackingMode: ChangeTrackingMode;
  autofillReason?: string;
  // V2.6Z: Optional dropdown options for suggested/required fields (inline)
  options?: string[];
  // V2.7A: Optional reference to centralized option registry
  optionsKey?: string;
  // V2.7E: Optional field-level context explanation
  description?: string;
}

export interface TemplateInputField {
  key: string;
  label: string;
  required: boolean;
}

export interface TemplateInput {
  bom: NormalizedBOM;
  externalData?: Record<string, any>;
}

export interface DocumentDraft {
  templateId: TemplateId;
  metadata: Record<string, any>;
  fields: Record<string, any>;
  // Phase V2.6X: Field-level certainty and change tracking
  fieldMetadata?: Record<string, FieldMetadata>;
  fieldChanges?: Array<{
    fieldPath: string;
    originalValue: any;
    newValue: any;
    timestamp: string;
  }>;
}

export interface DocumentSection {
  id: string;
  title: string;
  fields: string[];
}

export interface DocumentLayout {
  sections: DocumentSection[];
}

export type FieldType = 'text' | 'number' | 'select' | 'table';

export interface FieldDefinition {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  editable: boolean;
  options?: string[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
  rowFields?: FieldDefinition[];
  derivedProduct?: string[];
}

export interface TemplateDefinition {
  id: TemplateId;
  name: string;
  description: string;
  requiredInputs: TemplateInputField[];
  fieldDefinitions: FieldDefinition[];
  layout: DocumentLayout;
  generate: (input: TemplateInput) => DocumentDraft;
}
