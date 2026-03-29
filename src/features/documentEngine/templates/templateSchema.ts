/**
 * Phase 29: Template Ingestion Engine
 * Phase 32: Intelligent Template Mapping Layer
 * 
 * Schema definition for ingested templates (e.g., from OEM workbooks).
 * Provides a simplified, JSON-friendly format that can be converted to TemplateDefinition.
 */

import { FieldType } from './types';

/**
 * Phase 32: Field mapping definition for auto-population
 * Maps template fields to source model fields
 */
export type SourceModel = 'processFlow' | 'pfmea' | 'controlPlan' | 'bom';

export interface FieldMapping {
  targetField: string;           // Field key in template
  sourceField: string;            // Field key in source model
  sourceModel: SourceModel;       // Which model to pull from
  isTableMapping?: boolean;       // True if mapping entire table rows
  columnMappings?: ColumnMapping[]; // For table fields: map specific columns
}

export interface ColumnMapping {
  targetColumn: string;           // Column key in template table
  sourceColumn: string;            // Column key in source model table
}

/**
 * Simplified field definition for ingested templates
 */
export interface IngestedFieldDefinition {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  editable?: boolean;
  options?: string[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
  // For table fields
  columns?: IngestedFieldDefinition[];
}

/**
 * Simplified section definition for ingested templates
 */
export interface IngestedSection {
  id: string;
  title: string;
  fields: IngestedFieldDefinition[];
}

/**
 * Complete ingested template structure
 * This is the format expected from external template definitions (JSON files)
 */
export interface IngestedTemplate {
  id: string;
  name: string;
  description: string;
  sections: IngestedSection[];
  // Optional metadata generation function (as string to be evaluated)
  metadataFields?: string[];
  // Phase 32: Optional field mappings for auto-population
  fieldMappings?: FieldMapping[];
}

/**
 * Validate ingested template structure
 */
export function validateIngestedTemplate(template: any): template is IngestedTemplate {
  if (!template || typeof template !== 'object') {
    return false;
  }

  if (!template.id || typeof template.id !== 'string') {
    return false;
  }

  if (!template.name || typeof template.name !== 'string') {
    return false;
  }

  if (!Array.isArray(template.sections)) {
    return false;
  }

  // Validate sections
  for (const section of template.sections) {
    if (!section.id || !section.title || !Array.isArray(section.fields)) {
      return false;
    }

    // Validate fields
    for (const field of section.fields) {
      if (!field.key || !field.label || !field.type) {
        return false;
      }

      const validTypes: FieldType[] = ['text', 'number', 'select', 'table'];
      if (!validTypes.includes(field.type)) {
        return false;
      }
    }
  }

  return true;
}
