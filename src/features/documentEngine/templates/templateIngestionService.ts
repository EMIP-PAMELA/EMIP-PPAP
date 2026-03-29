/**
 * Phase 29: Template Ingestion Service
 * 
 * Converts external template definitions (JSON-based) into TemplateDefinition objects
 * that can be used by the document engine.
 */

import { TemplateDefinition, TemplateId, FieldDefinition, DocumentDraft, TemplateInput, DocumentLayout } from './types';
import { IngestedTemplate, IngestedFieldDefinition, validateIngestedTemplate } from './templateSchema';

/**
 * Convert ingested field definition to full FieldDefinition
 */
function convertFieldDefinition(ingestedField: IngestedFieldDefinition): FieldDefinition {
  const fieldDef: FieldDefinition = {
    key: ingestedField.key,
    label: ingestedField.label,
    type: ingestedField.type,
    required: ingestedField.required ?? false,
    editable: ingestedField.editable ?? true,
  };

  if (ingestedField.options) {
    fieldDef.options = ingestedField.options;
  }

  if (ingestedField.validation) {
    fieldDef.validation = ingestedField.validation;
  }

  // Handle table fields (columns)
  if (ingestedField.type === 'table' && ingestedField.columns) {
    fieldDef.rowFields = ingestedField.columns.map(convertFieldDefinition);
  }

  return fieldDef;
}

/**
 * Generate default metadata for ingested template
 */
function generateDefaultMetadata(templateId: string): Record<string, any> {
  return {
    generatedBy: 'EMIP PPAP System',
    generatedAt: new Date().toISOString(),
    templateId: templateId,
    revision: '1.0',
  };
}

/**
 * Default generate function for ingested templates
 * Initializes fields with empty values
 */
function createDefaultGenerateFunction(
  templateId: string,
  fieldDefinitions: FieldDefinition[],
  metadataFields?: string[]
): (input: TemplateInput) => DocumentDraft {
  return (input: TemplateInput) => {
    const fields: Record<string, any> = {};

    // Initialize all fields with appropriate empty values
    for (const fieldDef of fieldDefinitions) {
      if (fieldDef.type === 'table') {
        fields[fieldDef.key] = [];
      } else if (fieldDef.type === 'number') {
        fields[fieldDef.key] = 0;
      } else {
        fields[fieldDef.key] = '';
      }
    }

    // Generate metadata
    const metadata = generateDefaultMetadata(templateId);

    // Add custom metadata fields from BOM if specified
    if (metadataFields && input.bom) {
      for (const metaKey of metadataFields) {
        if (metaKey in input.bom) {
          metadata[metaKey] = (input.bom as any)[metaKey];
        }
      }
    }

    return {
      templateId: templateId as TemplateId,
      metadata,
      fields,
    };
  };
}

/**
 * Convert ingested template to full TemplateDefinition
 */
export function convertToTemplateDefinition(ingested: IngestedTemplate): TemplateDefinition {
  // Validate input
  if (!validateIngestedTemplate(ingested)) {
    throw new Error(`Invalid ingested template structure`);
  }

  // Flatten all fields from all sections
  const allFieldDefinitions: FieldDefinition[] = [];
  for (const section of ingested.sections) {
    for (const field of section.fields) {
      allFieldDefinitions.push(convertFieldDefinition(field));
    }
  }

  // Create layout from sections
  const layout: DocumentLayout = {
    sections: ingested.sections.map(section => ({
      id: section.id,
      title: section.title,
      fields: section.fields.map(f => f.key),
    })),
  };

  // Create template definition
  const templateDef: TemplateDefinition = {
    id: ingested.id as TemplateId,
    name: ingested.name,
    description: ingested.description || `Ingested template: ${ingested.name}`,
    requiredInputs: [
      { key: 'bom', label: 'Bill of Materials', required: true }
    ],
    fieldDefinitions: allFieldDefinitions,
    layout: layout,
    generate: createDefaultGenerateFunction(
      ingested.id,
      allFieldDefinitions,
      ingested.metadataFields
    ),
  };

  return templateDef;
}

/**
 * Parse JSON string or object into IngestedTemplate
 */
export function parseWorkbookTemplate(source: string | object): IngestedTemplate {
  let parsed: any;

  if (typeof source === 'string') {
    try {
      parsed = JSON.parse(source);
    } catch (err) {
      throw new Error(`Failed to parse template JSON: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  } else {
    parsed = source;
  }

  if (!validateIngestedTemplate(parsed)) {
    throw new Error('Invalid template structure');
  }

  return parsed as IngestedTemplate;
}

/**
 * Load template from JSON file content
 */
export async function loadTemplateFromJSON(jsonContent: string): Promise<TemplateDefinition> {
  const ingested = parseWorkbookTemplate(jsonContent);
  return convertToTemplateDefinition(ingested);
}
