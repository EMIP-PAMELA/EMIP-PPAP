/**
 * Template System Types - Document Engine
 * 
 * Defines the contract for document templates and their inputs/outputs.
 * Templates are declarative and consume NormalizedBOM + optional external data.
 * 
 * Architecture layer: Template System
 */

import { NormalizedBOM } from '../types/bomTypes';

export type TemplateId = 'PSW';

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

export interface TemplateDefinition {
  id: TemplateId;
  name: string;
  description: string;
  requiredInputs: TemplateInputField[];
  generate: (input: TemplateInput) => DocumentDraft;
}
