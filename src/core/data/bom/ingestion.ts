/**
 * V5.0 EMIP Core - BOM Ingestion Pipeline
 * 
 * FOUNDATION LAYER - BOM Data Ingestion and Normalization
 * 
 * Responsibilities:
 * - Accept BOM input from various sources (Visual export, Engineering Master, manual entry)
 * - Transform raw parsed data using parserService
 * - Normalize and enrich records
 * - Store in canonical format with full traceability
 * - Track source, version, timestamp
 * 
 * Architecture:
 * - Uses core/parser/parserService for parsing
 * - Uses core/services/bomService for storage
 * - Produces normalized BOMRecord[] in canonical format
 */

import { BOMRecord, RawBOMData, ParseResult, RawComponent, RawOperation } from './types';
import { parseBOMText, parseBOMWithValidation, PARSER_VERSION } from '../../parser/parserService';
import { storeBOM } from '../../services/bomService';

// ============================================================
// INGESTION SOURCE TYPES
// ============================================================

export type IngestionSourceType = 'visual_export' | 'engineering_master' | 'manual_entry' | 'system_import';

export interface IngestionMetadata {
  sourceReference: string;
  sourceType: IngestionSourceType;
  revision?: string;
  uploadedBy?: string;
  notes?: string;
}

// ============================================================
// INGESTION RESULT
// ============================================================

export interface IngestionResult {
  success: boolean;
  masterPartNumber: string;
  recordsCreated: number;
  errors: string[];
  warnings: string[];
  metadata: {
    sourceReference: string;
    parserVersion: string;
    ingestionTimestamp: string;
    totalOperations: number;
    totalComponents: number;
  };
}

// ============================================================
// WIRE DETECTION (Simplified - V5.0)
// ============================================================

/**
 * Detect if a component is a wire/cable
 * 
 * V5.0: Simple pattern matching
 * V5.1: Will use advanced wire detection service
 * 
 * @param component Raw component data
 * @returns Wire detection result with length/gauge if found
 */
function detectWire(component: RawComponent): {
  isWire: boolean;
  gauge?: string;
  length?: number;
  lengthUnit?: string;
} {
  const line = component.rawLine.toLowerCase();
  
  // Check for wire indicators
  const isWire = line.includes('wire') || 
                 line.includes('cable') || 
                 line.includes('awg') || 
                 line.includes('gauge');
  
  if (!isWire) {
    return { isWire: false };
  }
  
  // Extract gauge (e.g., "18 AWG", "22AWG", "18GA")
  const gaugeMatch = line.match(/(\d{1,2})\s*(?:awg|ga|gauge)/i);
  const gauge = gaugeMatch ? gaugeMatch[1] : undefined;
  
  // Extract length (e.g., "12 IN", "24 INCH", "2 FT")
  const lengthMatch = line.match(/(\d+(?:\.\d+)?)\s*(in|inch|inches|ft|feet|foot)/i);
  const length = lengthMatch ? parseFloat(lengthMatch[1]) : undefined;
  const lengthUnit = lengthMatch ? lengthMatch[2].toUpperCase() : undefined;
  
  return {
    isWire: true,
    gauge,
    length,
    lengthUnit
  };
}

// ============================================================
// NORMALIZATION
// ============================================================

/**
 * Normalize raw component to canonical BOM record
 * 
 * Converts raw parser output to normalized database format.
 * 
 * @param component Raw component from parser
 * @param operation Raw operation data
 * @param masterPartNumber Parent part number
 * @param metadata Ingestion metadata
 * @returns Normalized BOM record
 */
function normalizeComponent(
  component: RawComponent,
  operation: RawOperation,
  masterPartNumber: string,
  metadata: IngestionMetadata
): BOMRecord {
  const wireDetection = detectWire(component);
  
  const record: BOMRecord = {
    parent_part_number: masterPartNumber,
    child_part_number: component.detectedPartId,
    quantity: component.detectedQty || 1,
    unit: component.detectedUom,
    description: null, // V5.0: Description extraction in V5.1
    aci_code: component.detectedAci,
    operation_step: operation.step,
    resource_id: operation.resourceId,
    
    // Wire-specific fields
    length: wireDetection.isWire ? wireDetection.length : null,
    
    // Metadata
    metadata: {
      rawLine: component.rawLine,
      candidateIds: component.candidateIds,
      isWire: wireDetection.isWire,
      gauge: wireDetection.gauge,
      lengthUnit: wireDetection.lengthUnit,
    },
    
    // Traceability
    source_reference: metadata.sourceReference,
    source_type: metadata.sourceType,
    ingestion_timestamp: new Date().toISOString(),
    parser_version: PARSER_VERSION,
    revision: metadata.revision,
    
    // Timestamps
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  
  return record;
}

// ============================================================
// MAIN INGESTION PIPELINE
// ============================================================

/**
 * Ingest BOM from raw text
 * 
 * Full pipeline: Parse → Normalize → Store
 * 
 * @param text Raw BOM text
 * @param metadata Ingestion metadata
 * @returns Ingestion result with success status and stats
 */
export async function ingestBOMFromText(
  text: string,
  metadata: IngestionMetadata
): Promise<IngestionResult> {
  console.log(`🧠 [BOM Ingestion] Starting ingestion from ${metadata.sourceType}: ${metadata.sourceReference}`);
  
  const errors: string[] = [];
  const warnings: string[] = [];
  
  try {
    // Step 1: Parse
    const parseResult: ParseResult = parseBOMWithValidation(text);
    
    if (!parseResult.success || !parseResult.data) {
      parseResult.errors.forEach(err => errors.push(err.message));
      
      return {
        success: false,
        masterPartNumber: 'UNKNOWN',
        recordsCreated: 0,
        errors,
        warnings,
        metadata: {
          sourceReference: metadata.sourceReference,
          parserVersion: PARSER_VERSION,
          ingestionTimestamp: new Date().toISOString(),
          totalOperations: 0,
          totalComponents: 0,
        }
      };
    }
    
    const rawData: RawBOMData = parseResult.data;
    
    // Collect warnings from parser
    parseResult.warnings.forEach(warn => warnings.push(warn.message));
    
    // Step 2: Normalize
    const normalizedRecords: BOMRecord[] = [];
    
    for (const operation of rawData.operations) {
      for (const component of operation.components) {
        const normalized = normalizeComponent(
          component,
          operation,
          rawData.masterPartNumber,
          metadata
        );
        normalizedRecords.push(normalized);
      }
    }
    
    console.log(`🧠 [BOM Ingestion] Normalized ${normalizedRecords.length} components`);
    
    // Step 3: Store
    await storeBOM(rawData.masterPartNumber, normalizedRecords);
    
    console.log(`🧠 [BOM Ingestion] Stored BOM for ${rawData.masterPartNumber}`);
    
    // Step 4: Return result
    return {
      success: true,
      masterPartNumber: rawData.masterPartNumber,
      recordsCreated: normalizedRecords.length,
      errors,
      warnings,
      metadata: {
        sourceReference: metadata.sourceReference,
        parserVersion: PARSER_VERSION,
        ingestionTimestamp: new Date().toISOString(),
        totalOperations: rawData.operations.length,
        totalComponents: normalizedRecords.length,
      }
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown ingestion error';
    errors.push(errorMessage);
    
    console.error(`🧠 [BOM Ingestion] Failed: ${errorMessage}`);
    
    return {
      success: false,
      masterPartNumber: 'UNKNOWN',
      recordsCreated: 0,
      errors,
      warnings,
      metadata: {
        sourceReference: metadata.sourceReference,
        parserVersion: PARSER_VERSION,
        ingestionTimestamp: new Date().toISOString(),
        totalOperations: 0,
        totalComponents: 0,
      }
    };
  }
}

/**
 * Ingest BOM from file upload
 * 
 * Convenience method for browser file uploads.
 * 
 * @param file File object from browser
 * @param metadata Ingestion metadata (sourceReference will be file.name if not provided)
 * @returns Ingestion result
 */
export async function ingestBOMFromFile(
  file: File,
  metadata?: Partial<IngestionMetadata>
): Promise<IngestionResult> {
  const text = await file.text();
  
  const fullMetadata: IngestionMetadata = {
    sourceReference: metadata?.sourceReference || file.name,
    sourceType: metadata?.sourceType || 'visual_export',
    revision: metadata?.revision,
    uploadedBy: metadata?.uploadedBy,
    notes: metadata?.notes,
  };
  
  return ingestBOMFromText(text, fullMetadata);
}

/**
 * Validate BOM data before ingestion
 * 
 * Pre-flight validation to catch issues early.
 * 
 * @param text Raw BOM text
 * @returns Validation result with issues found
 */
export function validateBOMBeforeIngestion(text: string): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  
  // Check minimum length
  if (text.length < 100) {
    issues.push('BOM text too short - may be incomplete');
  }
  
  // Check for master part number
  const hasMasterPN = /(?:M\s+)?(?:NH)?(\d{12})/.test(text);
  if (!hasMasterPN) {
    issues.push('No master part number detected');
  }
  
  // Check for operations
  const hasOperations = /[-]{2,}\d{2}/.test(text);
  if (!hasOperations) {
    issues.push('No operation steps detected');
  }
  
  // Check for components
  const hasComponents = /[-]{4,}[A-Z0-9]/.test(text);
  if (!hasComponents) {
    issues.push('No component lines detected');
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}
