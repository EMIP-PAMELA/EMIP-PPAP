/**
 * V5.2 EMIP Core - BOM Ingestion Pipeline (Active Version Control)
 * 
 * FOUNDATION LAYER - BOM Data Ingestion and Normalization
 * 
 * Responsibilities:
 * - Accept BOM input from various sources (Visual export, Engineering Master, manual entry)
 * - Transform raw parsed data using parserService
 * - Normalize and enrich records
 * - Store in canonical format with full traceability
 * - Track source, version, timestamp
 * - Enforce active version control (one active BOM per part)
 * 
 * V5.2 Enhancements:
 * - Generate ingestion batch IDs for version tracking
 * - Deactivate previous active BOM before inserting new version
 * - Prevent duplicate active BOMs
 * - Enhanced data integrity validation
 * 
 * Architecture:
 * - Uses core/parser/parserService for parsing
 * - Uses core/services/bomService for storage
 * - Produces normalized BOMRecord[] in canonical format
 */

import { BOMRecord, RawBOMData, ParseResult, RawComponent, RawOperation } from './types';
import { parseBOMText, parseBOMWithValidation, PARSER_VERSION } from '../../parser/parserService';
import { storeBOM, getBOM } from '../../services/bomService';
import { supabase } from '@/src/lib/supabaseClient';
import { 
  normalizeRevision, 
  determineRevisionAction, 
  extractRevisionFromRecords,
  type NormalizedRevision 
} from '../../services/revisionService';

// ============================================================
// INGESTION SOURCE TYPES
// ============================================================

export type IngestionSourceType = 'visual_export' | 'engineering_master' | 'manual_entry' | 'system_import';

export interface IngestionMetadata {
  sourceReference: string;
  sourceType: IngestionSourceType;
  revision?: string | null;
  partNumber?: string; // V5.7.2: Filename-derived part number (canonical source)
  
  /** V5.3: Optional artifact URL and path (linked after PDF upload) */
  artifactUrl?: string | null;
  artifactPath?: string | null;
  uploadedBy?: string;
  notes?: string;
}

// ============================================================
// INGESTION RESULT
// ============================================================

export interface IngestionResult {
  success: boolean;
  masterPartNumber: string;
  revision?: string; // V5.7.1: Normalized revision from ingestion (canonical truth)
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
 * V5.2: Includes batch ID and active flag for version control
 * 
 * Converts raw parser output to normalized database format.
 * 
 * @param component Raw component from parser
 * @param operation Raw operation data
 * @param masterPartNumber Parent part number
 * @param metadata Ingestion metadata
 * @param ingestionBatchId V5.2: Batch ID for this ingestion
 * @returns Normalized BOM record
 */
function normalizeComponent(
  component: RawComponent,
  operation: RawOperation,
  masterPartNumber: string,
  metadata: IngestionMetadata,
  ingestionBatchId: string,
  normalizedRevision: NormalizedRevision, // V5.2.5: Pass revision
  isActive: boolean // V5.2.5: Active flag determined by revision logic
): BOMRecord {
  const wireDetection = detectWire(component);
  
  // V5.6.4: Align with LIVE database schema
  const record: BOMRecord = {
    parent_part_number: masterPartNumber,
    component_part_number: component.detectedPartId, // V5.6.4: Renamed from child_part_number
    quantity: component.detectedQty || 1,
    unit: component.detectedUom,
    description: null, // V5.0: Description extraction in V5.1
    
    // V5.6.4: Wire-specific fields promoted to top level
    length: wireDetection.isWire ? wireDetection.length : null,
    gauge: wireDetection.gauge || null, // V5.6.4: Required by live schema
    color: null, // V5.6.4: Required by live schema (not yet extracted)
    
    // V5.6.4: operation_step as string (DB will handle conversion)
    operation_step: operation.step,
    
    // V5.2.5: Revision Intelligence
    revision: normalizedRevision.revision,
    revision_order: normalizedRevision.order,
    
    // V5.2: Version Control
    ingestion_batch_id: ingestionBatchId,
    is_active: isActive,
    
    // V5.3: Artifact Storage
    artifact_url: metadata.artifactUrl || null,
    artifact_path: metadata.artifactPath || null,
    
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
 * V5.2: Full pipeline with active version control
 * 
 * Pipeline: Parse → Validate → Deactivate Old → Normalize → Store
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
    // V5.2: Step 0 - Duplicate Protection Check
    const { data: existingRecords } = await supabase
      .from('bom_records')
      .select('id')
      .eq('source_reference', metadata.sourceReference)
      .eq('is_active', true)
      .limit(1);
    
    if (existingRecords && existingRecords.length > 0) {
      warnings.push(`BOM from source "${metadata.sourceReference}" already exists. Proceeding with re-ingestion (old version will be deactivated).`);
      console.warn(`🛡 V5.2 [BOM Ingestion] Re-ingesting existing source: ${metadata.sourceReference}`);
    }
    
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
    
    // V5.7.2: Step 1.5 - Canonicalize Part Number (prefer filename over parser)
    const masterPartNumber = metadata.partNumber || rawData.masterPartNumber;
    
    console.log('🧠 V5.7.2 PART NUMBER RESOLUTION', {
      filenamePartNumber: metadata.partNumber,
      parserPartNumber: rawData.masterPartNumber,
      finalPartNumber: masterPartNumber
    });
    
    // V5.2: Step 1.5 - Generate Ingestion Batch ID
    const ingestionBatchId = crypto.randomUUID();
    
    console.log(`🛡 V5.2 [BOM Ingestion] Generated batch ID: ${ingestionBatchId}`);
    
    // V5.2.5: Step 1.6 - Normalize Revision
    const incomingRevision = normalizeRevision(rawData.revision_raw || metadata.revision);
    
    console.log(`🧠 V5.2.5 [BOM Ingestion] Normalized revision:`, {
      raw: rawData.revision_raw || metadata.revision,
      normalized: incomingRevision.revision,
      order: incomingRevision.order
    });
    
    // V5.2.5: Step 1.7 - Fetch Existing Active BOM to Check Revision
    const existingActiveBOM = await getBOM(masterPartNumber);
    const existingRevision = extractRevisionFromRecords(existingActiveBOM);
    
    // V5.2.5: Step 1.8 - Determine Revision Action (TRUTH-BASED)
    const revisionDecision = determineRevisionAction(incomingRevision, existingRevision);
    
    console.log(`🧠 V5.2.5 REVISION DECISION`, {
      partNumber: masterPartNumber,
      incomingRevision: incomingRevision.revision,
      incomingOrder: incomingRevision.order,
      existingRevision: existingRevision?.revision || 'none',
      existingOrder: existingRevision?.order || 0,
      action: revisionDecision.action,
      reason: revisionDecision.reason,
      timestamp: new Date().toISOString(),
    });
    
    // V5.2.5: Step 1.9 - Apply Revision Action
    let shouldActivate = false;
    let deactivatedCount = 0;
    
    if (revisionDecision.action === 'ACTIVATE' || revisionDecision.action === 'REPLACE') {
      // Deactivate existing active BOM (newer or same revision)
      const { data: deactivatedRecords, error: deactivateError } = await supabase
        .from('bom_records')
        .update({ is_active: false })
        .eq('parent_part_number', masterPartNumber)
        .eq('is_active', true)
        .select('id');
      
      if (deactivateError) {
        console.error(`🚨 V5.2 BOM INTEGRITY ERROR:`, deactivateError);
        errors.push(`Failed to deactivate previous BOM: ${deactivateError.message}`);
        throw new Error(`Active BOM deactivation failed: ${deactivateError.message}`);
      }
      
      deactivatedCount = deactivatedRecords?.length || 0;
      shouldActivate = true;
      
      console.log(`🛡 V5.2.5 ACTIVE BOM CONTROL`, {
        partNumber: masterPartNumber,
        newBatchId: ingestionBatchId,
        action: revisionDecision.action,
        previousActiveDeactivated: true,
        deactivatedRecordCount: deactivatedCount,
        timestamp: new Date().toISOString(),
      });
    } else if (revisionDecision.action === 'ARCHIVE') {
      // Archive mode: DO NOT deactivate existing, insert as inactive
      shouldActivate = false;
      warnings.push(`Incoming revision (${incomingRevision.revision}) is older than existing (${existingRevision?.revision}). Storing as archived version (inactive).`);
      
      console.log(`🛡 V5.2.5 ACTIVE BOM CONTROL`, {
        partNumber: masterPartNumber,
        newBatchId: ingestionBatchId,
        action: 'ARCHIVE',
        previousActivePreserved: true,
        incomingStored: 'inactive',
        timestamp: new Date().toISOString(),
      });
    }
    
    // Step 2: Normalize with V5.2 batch ID
    const normalizedRecords: BOMRecord[] = [];
    
    for (const operation of rawData.operations) {
      for (const component of operation.components) {
        // V5.2: Validate required fields before normalization
        if (!component.detectedPartId || !operation.step) {
          console.error(`🚨 V5.2 BOM INTEGRITY ERROR`, {
            issue: 'Missing required field',
            partId: component.detectedPartId,
            operationStep: operation.step,
            rawLine: component.rawLine
          });
          errors.push(`Invalid component: missing part ID or operation step`);
          continue;
        }
        
        const normalized = normalizeComponent(
          component,
          operation,
          masterPartNumber,
          metadata,
          ingestionBatchId, // V5.2: Pass batch ID
          incomingRevision, // V5.2.5: Pass normalized revision
          shouldActivate // V5.2.5: Pass active flag from revision decision
        );
        normalizedRecords.push(normalized);
      }
    }
    
    console.log(`🧠 [BOM Ingestion] Normalized ${normalizedRecords.length} components`);
    
    // V5.2: Final validation before store
    if (normalizedRecords.length === 0) {
      errors.push('No valid records to store after normalization');
      throw new Error('Ingestion failed: no valid records');
    }
    
    // Step 3: Store
    await storeBOM(masterPartNumber, normalizedRecords);
    
    console.log(`🧠 [BOM Ingestion] Stored BOM for ${masterPartNumber}`);
    
    // Step 4: Return result with canonical persisted values
    return {
      success: true,
      masterPartNumber: masterPartNumber,
      revision: incomingRevision.revision, // V5.7.1: Return normalized revision (canonical truth)
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
