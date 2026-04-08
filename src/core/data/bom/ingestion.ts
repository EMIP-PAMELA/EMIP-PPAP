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
 * V5.9.1: Use parser-extracted wire metadata from V5.9 type-aware parsing
 * 
 * Parser now handles wire detection and metadata extraction.
 * This function consolidates parser output for normalization.
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
  // V5.9.1: Check if parser detected wire (W-prefix part number)
  const partId = component.detectedPartId || '';
  const isWire = /^W\d+/.test(partId);
  
  if (!isWire) {
    // Fallback: text-based detection for non-W-prefix wires
    const line = component.rawLine.toLowerCase();
    const hasWireKeyword = line.includes('wire') || 
                           line.includes('cable') || 
                           line.includes('awg') || 
                           line.includes('gauge');
    
    if (!hasWireKeyword) {
      return { isWire: false };
    }
    
    // Extract gauge from text
    const gaugeMatch = line.match(/(\d{1,2})\s*(?:awg|ga|gauge)/i);
    const gauge = gaugeMatch ? gaugeMatch[1] : undefined;
    
    // Extract length from text
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
  
  // V5.9.1: Extract gauge from W-prefix part number (e.g., W8BK1028 → gauge 8)
  const gaugeMatch = partId.match(/^W(\d+)/);
  const gauge = gaugeMatch ? gaugeMatch[1] : undefined;
  
  // V5.9.1: Extract color from W-prefix part number (e.g., W8BK1028 → BK)
  const colorMatch = partId.match(/^W\d+([A-Z]{2})/);
  const colorCode = colorMatch ? colorMatch[1] : undefined;
  
  // V5.9.1: CRITICAL FIX - Use parser-extracted length from numeric value at line end
  // Parser V5.9 already extracted this and stored it in detectedQty for wires
  // For wires, the numeric value is LENGTH, not quantity
  const line = component.rawLine;
  const lengthMatch = line.match(/(\d+\.?\d*)\s*$/);
  const length = lengthMatch ? parseFloat(lengthMatch[1]) : undefined;
  
  return {
    isWire: true,
    gauge,
    length,
    lengthUnit: undefined // V5.9.1: Unit not yet extracted from line
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
  
  // V5.9.1: Extract color from wire part number
  let wireColor: string | null = null;
  if (wireDetection.isWire) {
    const partId = component.detectedPartId || '';
    const colorMatch = partId.match(/^W\d+([A-Z]{2})/);
    if (colorMatch) {
      const colorCode = colorMatch[1];
      const colorMap: Record<string, string> = {
        'BK': 'BLACK',
        'RD': 'RED',
        'BL': 'BLUE',
        'YE': 'YELLOW',
        'GN': 'GREEN',
        'WH': 'WHITE',
        'OR': 'ORANGE',
        'BR': 'BROWN',
        'GY': 'GRAY',
        'VT': 'VIOLET'
      };
      wireColor = colorMap[colorCode] || colorCode;
    }
  }
  
  // V5.6.4: Align with LIVE database schema
  const record: BOMRecord = {
    parent_part_number: masterPartNumber,
    component_part_number: component.detectedPartId, // V5.6.4: Renamed from child_part_number
    quantity: component.detectedQty || 1,
    unit: component.detectedUom,
    description: null, // V5.0: Description extraction in V5.1
    
    // V5.9.1: Wire-specific fields with parser-extracted values
    length: wireDetection.isWire ? wireDetection.length : null,
    gauge: wireDetection.gauge || null, // V5.6.4: Required by live schema
    color: wireColor, // V5.9.1: Extracted from wire part number
    
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
    
    // V6.0.2: Step 1.5 - Canonicalize Part Number
    // metadata.partNumber contains the already-resolved canonical part number from bomIngestionService
    // Trust hierarchy: user_input → parsed_text → filename (resolved upstream)
    const masterPartNumber = metadata.partNumber || rawData.masterPartNumber;
    
    console.log('🧠 V6.0.2 PART NUMBER CANONICALIZATION', {
      resolvedPartNumber: metadata.partNumber,
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
    
    // V6.0.5: STEP 1 - SMART REVISION ACTIVATION DECISION
    // Determine whether to activate based on revision comparison
    let shouldActivate = false;
    let activationAction = '';
    
    // Handle UNKNOWN revisions safely
    const hasValidIncomingRevision = incomingRevision.order > 0;
    const hasExistingActiveRevision = existingRevision && existingRevision.order > 0;
    
    if (!hasExistingActiveRevision) {
      // CASE A: No existing active revision - activate first upload
      shouldActivate = true;
      activationAction = 'ACTIVATE_FIRST';
    } else if (!hasValidIncomingRevision) {
      // CASE: UNKNOWN incoming revision with valid active existing - archive to be safe
      shouldActivate = false;
      activationAction = 'ARCHIVE_UNKNOWN';
      warnings.push(`Incoming revision (${incomingRevision.revision}) could not be validated. Storing as inactive archive while preserving active revision ${existingRevision.revision}.`);
    } else if (incomingRevision.order > existingRevision.order) {
      // CASE B: Incoming revision is newer - activate
      shouldActivate = true;
      activationAction = 'ACTIVATE_NEWER';
    } else if (incomingRevision.order === existingRevision.order) {
      // CASE C: Same revision - replace active batch
      shouldActivate = true;
      activationAction = 'REPLACE_SAME';
    } else {
      // CASE D: Incoming revision is older - archive as inactive history
      shouldActivate = false;
      activationAction = 'ARCHIVE_OLDER';
      warnings.push(`Incoming revision (${incomingRevision.revision}) is older than active revision (${existingRevision.revision}). Storing as inactive historical archive.`);
    }
    
    console.log(`🧠 V6.0.5 REVISION ACTIVATION DECISION`, {
      partNumber: masterPartNumber,
      incomingRevision: incomingRevision.revision,
      incomingOrder: incomingRevision.order,
      existingRevision: existingRevision?.revision || 'none',
      existingOrder: existingRevision?.order || 0,
      shouldActivate,
      action: activationAction,
      timestamp: new Date().toISOString(),
    });
    
    // V6.0.5: STEP 2 - CONDITIONAL DEACTIVATION (Only when activating)
    // Only deactivate existing active records if we're activating the new upload
    let deactivatedCount = 0;
    
    if (shouldActivate) {
      console.log(`🛡 V6.0.5 [CONDITIONAL DEACTIVATION] Deactivating previous active records for ${masterPartNumber}`);
      
      const { data: deactivatedRecords, error: deactivateError } = await supabase
        .from('bom_records')
        .update({ is_active: false })
        .eq('parent_part_number', masterPartNumber)
        .eq('is_active', true)
        .select('id');
      
      if (deactivateError) {
        console.error(`🚨 V6.0.5 DEACTIVATION ERROR:`, deactivateError);
        errors.push(`Failed to deactivate previous BOM: ${deactivateError.message}`);
        throw new Error(`Active BOM deactivation failed: ${deactivateError.message}`);
      }
      
      deactivatedCount = deactivatedRecords?.length || 0;
      console.log(`🛡 V6.0.5 [CONDITIONAL DEACTIVATION] Deactivated ${deactivatedCount} records`);
    } else {
      console.log(`📚 V6.0.5 [ARCHIVE MODE] Preserving existing active revision, storing incoming as inactive history`);
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
    
    // V6.0.5: STEP 3 - Verify Active BOM State (Revision-Aware Validation)
    const { data: activeRecords, error: verifyError } = await supabase
      .from('bom_records')
      .select('id, revision, ingestion_batch_id')
      .eq('parent_part_number', masterPartNumber)
      .eq('is_active', true);
    
    if (verifyError) {
      console.error(`🚨 V6.0.5 VERIFICATION ERROR:`, verifyError);
      throw new Error(`Post-insert verification failed: ${verifyError.message}`);
    }
    
    const activeCount = activeRecords?.length || 0;
    const uniqueBatches = new Set(activeRecords?.map(r => r.ingestion_batch_id) || []);
    const uniqueRevisions = new Set(activeRecords?.map(r => r.revision) || []);
    
    // V6.0.5: Validation rules depend on activation decision
    if (shouldActivate) {
      // When we activated: ensure exactly one active batch exists
      if (activeCount === 0) {
        console.error(`🚨 V6.0.5 CRITICAL ERROR: NO ACTIVE RECORDS after activating insert for ${masterPartNumber}`);
        throw new Error(`Data integrity violation: No active BOM records exist after activation`);
      }
      
      if (uniqueBatches.size > 1) {
        console.error(`🚨 V6.0.5 DATA INTEGRITY VIOLATION: Multiple active batches for ${masterPartNumber}`);
        throw new Error(`Data integrity violation: Multiple active batches exist`);
      }
      
      if (uniqueRevisions.size > 1) {
        console.error(`🚨 V6.0.5 DATA INTEGRITY VIOLATION: Multiple active revisions for ${masterPartNumber}`);
        throw new Error(`Data integrity violation: Multiple active revisions exist`);
      }
      
      console.log(`🔥 V6.0.5 BOM ACTIVATED`, {
        partNumber: masterPartNumber,
        revision: incomingRevision.revision,
        insertedCount: normalizedRecords.length,
        activeRecordsAfterInsert: activeCount,
        expectedActiveRecords: normalizedRecords.length,
        uniqueBatches: uniqueBatches.size,
        uniqueRevisions: Array.from(uniqueRevisions),
        action: activationAction,
        isActive: true,
        isValid: activeCount === normalizedRecords.length && uniqueBatches.size === 1,
        timestamp: new Date().toISOString(),
      });
    } else {
      // When we archived: ensure previous active revision still exists
      if (activeCount === 0 && hasExistingActiveRevision) {
        console.error(`🚨 V6.0.5 CRITICAL ERROR: Previous active revision lost during archive operation for ${masterPartNumber}`);
        throw new Error(`Data integrity violation: Previous active revision disappeared during archive`);
      }
      
      console.log(`� V6.0.5 BOM ARCHIVED`, {
        partNumber: masterPartNumber,
        archivedRevision: incomingRevision.revision,
        insertedCount: normalizedRecords.length,
        activeRevisionPreserved: existingRevision?.revision || 'none',
        activeRecordsRemaining: activeCount,
        action: activationAction,
        isActive: false,
        timestamp: new Date().toISOString(),
      });
    }
    
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
