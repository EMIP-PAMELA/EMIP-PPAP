/**
 * Phase 32: Template Mapping Service
 * Phase 33: Template Mapping Visibility and Debug Layer
 * 
 * Applies field mappings to auto-populate dynamic templates from process model outputs.
 * All mapping is deterministic and key-based - no inference or fuzzy matching.
 * 
 * Phase 33: Enhanced with mapping metadata for visibility and debugging.
 * 
 * Architecture:
 * - Takes a template with fieldMappings defined
 * - Takes source data (ProcessFlowModel, PFMEAModel, ControlPlanModel)
 * - Returns populated DocumentDraft + mapping metadata
 * 
 * Rules:
 * - Exact key matching only
 * - Missing source fields result in empty values
 * - Unmapped fields remain empty
 * - Table mappings copy entire row structures
 */

import { DocumentDraft, TemplateId } from './types';
import { FieldMapping, SourceModel } from './templateSchema';
import { ProcessFlowModel } from '../models/processFlow';
import { PFMEAModel } from '../models/pfmea';
import { ControlPlanModel } from '../models/controlPlan';
import { NormalizedBOM } from '../types/bomTypes';

/**
 * Phase 33: Mapping metadata for a single field
 * Provides visibility into where field values came from
 */
export interface FieldMappingMeta {
  sourceModel: SourceModel;
  sourceField: string;
  success: boolean;
  error?: string;
  isTableMapping?: boolean;
}

/**
 * Phase 33: Complete mapping metadata for a document
 * Maps field keys to their mapping metadata
 */
export interface MappingMetadata {
  [fieldKey: string]: FieldMappingMeta;
}

/**
 * Phase 33: Mapping result with metadata
 */
export interface MappingResult {
  draft: DocumentDraft;
  mappingMeta: MappingMetadata;
}

/**
 * Source data container for mapping
 */
export interface MappingSourceData {
  bom?: NormalizedBOM;
  processFlow?: ProcessFlowModel;
  pfmea?: PFMEAModel;
  controlPlan?: ControlPlanModel;
}

/**
 * Get value from source model by key path
 * Supports dot notation for nested access (e.g., "metadata.partNumber")
 */
function getSourceValue(sourceModel: any, fieldPath: string): any {
  if (!sourceModel) return undefined;
  
  const keys = fieldPath.split('.');
  let value = sourceModel;
  
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return undefined;
    }
  }
  
  return value;
}

/**
 * Get source model object from source data
 */
function getSourceModel(sourceData: MappingSourceData, modelType: SourceModel): any {
  switch (modelType) {
    case 'bom':
      return sourceData.bom;
    case 'processFlow':
      return sourceData.processFlow;
    case 'pfmea':
      return sourceData.pfmea;
    case 'controlPlan':
      return sourceData.controlPlan;
    default:
      return undefined;
  }
}

/**
 * Apply a single field mapping
 * Phase 33: Returns mapping metadata
 */
function applyFieldMapping(
  mapping: FieldMapping,
  sourceData: MappingSourceData,
  fields: Record<string, any>,
  mappingMeta: MappingMetadata
): void {
  const sourceModel = getSourceModel(sourceData, mapping.sourceModel);
  
  if (!sourceModel) {
    const error = `Source model '${mapping.sourceModel}' not available`;
    console.warn(`[TemplateMappingService] ${error} for mapping '${mapping.targetField}'`);
    mappingMeta[mapping.targetField] = {
      sourceModel: mapping.sourceModel,
      sourceField: mapping.sourceField,
      success: false,
      error,
    };
    return;
  }
  
  // Handle table mappings
  if (mapping.isTableMapping && mapping.columnMappings) {
    applyTableMapping(mapping, sourceModel, fields, mappingMeta);
    return;
  }
  
  // Handle simple field mappings
  const sourceValue = getSourceValue(sourceModel, mapping.sourceField);
  
  if (sourceValue !== undefined) {
    fields[mapping.targetField] = sourceValue;
    console.log(`[TemplateMappingService] Mapped ${mapping.sourceModel}.${mapping.sourceField} → ${mapping.targetField}`);
    mappingMeta[mapping.targetField] = {
      sourceModel: mapping.sourceModel,
      sourceField: mapping.sourceField,
      success: true,
    };
  } else {
    const error = `Source field '${mapping.sourceField}' not found`;
    console.warn(`[TemplateMappingService] ${error} in ${mapping.sourceModel}`);
    mappingMeta[mapping.targetField] = {
      sourceModel: mapping.sourceModel,
      sourceField: mapping.sourceField,
      success: false,
      error,
    };
  }
}

/**
 * Apply table mapping (row-by-row with column mappings)
 * Phase 33: Returns mapping metadata
 */
function applyTableMapping(
  mapping: FieldMapping,
  sourceModel: any,
  fields: Record<string, any>,
  mappingMeta: MappingMetadata
): void {
  const sourceTable = getSourceValue(sourceModel, mapping.sourceField);
  
  if (!Array.isArray(sourceTable)) {
    const error = `Source field '${mapping.sourceField}' is not an array`;
    console.warn(`[TemplateMappingService] ${error}`);
    mappingMeta[mapping.targetField] = {
      sourceModel: mapping.sourceModel,
      sourceField: mapping.sourceField,
      success: false,
      error,
      isTableMapping: true,
    };
    return;
  }
  
  // Map each row
  const mappedRows = sourceTable.map(sourceRow => {
    const targetRow: Record<string, any> = {};
    
    // Apply column mappings
    for (const colMapping of mapping.columnMappings || []) {
      const sourceValue = sourceRow[colMapping.sourceColumn];
      if (sourceValue !== undefined) {
        targetRow[colMapping.targetColumn] = sourceValue;
      } else {
        // Initialize with appropriate empty value
        targetRow[colMapping.targetColumn] = '';
      }
    }
    
    return targetRow;
  });
  
  fields[mapping.targetField] = mappedRows;
  console.log(`[TemplateMappingService] Mapped table ${mapping.sourceModel}.${mapping.sourceField} → ${mapping.targetField} (${mappedRows.length} rows)`);
  mappingMeta[mapping.targetField] = {
    sourceModel: mapping.sourceModel,
    sourceField: mapping.sourceField,
    success: true,
    isTableMapping: true,
  };
}

/**
 * Apply all field mappings to generate a populated DocumentDraft
 * Phase 33: Returns MappingResult with metadata
 * 
 * @param templateId - Template identifier
 * @param fieldMappings - Array of field mapping definitions
 * @param sourceData - Source data from process models
 * @param baseFields - Base fields to start with (default empty)
 * @returns MappingResult with draft and metadata
 */
export function applyTemplateMappings(
  templateId: TemplateId,
  fieldMappings: FieldMapping[],
  sourceData: MappingSourceData,
  baseFields: Record<string, any> = {}
): MappingResult {
  console.log(`[TemplateMappingService] Applying ${fieldMappings.length} mappings for template '${templateId}'`);
  
  // Start with base fields (usually empty from default generator)
  const fields = { ...baseFields };
  
  // Phase 33: Track mapping metadata
  const mappingMeta: MappingMetadata = {};
  
  // Apply each mapping
  for (const mapping of fieldMappings) {
    applyFieldMapping(mapping, sourceData, fields, mappingMeta);
  }
  
  // Generate metadata
  const metadata: Record<string, any> = {
    generatedBy: 'EMIP PPAP System (Auto-Mapped)',
    generatedAt: new Date().toISOString(),
    templateId: templateId,
    revision: '1.0',
  };
  
  // Add part number from any available source
  if (sourceData.bom?.masterPartNumber) {
    metadata.partNumber = sourceData.bom.masterPartNumber;
  } else if (sourceData.processFlow?.partNumber) {
    metadata.partNumber = sourceData.processFlow.partNumber;
  } else if (sourceData.pfmea?.partNumber) {
    metadata.partNumber = sourceData.pfmea.partNumber;
  } else if (sourceData.controlPlan?.partNumber) {
    metadata.partNumber = sourceData.controlPlan.partNumber;
  }
  
  const draft: DocumentDraft = {
    templateId,
    metadata,
    fields,
  };
  
  return {
    draft,
    mappingMeta,
  };
}

/**
 * Check if a template has field mappings defined
 */
export function hasFieldMappings(fieldMappings?: FieldMapping[]): boolean {
  return Array.isArray(fieldMappings) && fieldMappings.length > 0;
}
