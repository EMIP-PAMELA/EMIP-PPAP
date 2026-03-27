/**
 * Template System Types - Document Engine
 * 
 * Defines the contract for document templates and their inputs/outputs.
 * Templates are declarative and consume NormalizedBOM + optional external data.
 * 
 * Architecture layer: Template System
 */

import { NormalizedBOM } from '../types/bomTypes';

export type TemplateId = 'PSW' | 'PROCESS_FLOW' | 'PFMEA';

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
