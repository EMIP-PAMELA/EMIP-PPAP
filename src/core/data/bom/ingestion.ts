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
import { supabase } from '@/src/lib/supabaseClient';
import { parseBOMWithValidation } from '@/src/core/parser/parserService';
import { normalizeRevision, NormalizedRevision, extractRevisionFromRecords, determineRevisionAction } from '@/src/core/services/revisionService';
import { getBOM, storeBOM, compareRevision } from '@/src/core/services/bomService';
import { normalizePartNumber } from '@/src/core/utils/normalizePartNumber';
import { isValidPartNumberCandidate } from '@/src/core/utils/isValidPartNumberCandidate';
import { PARSER_VERSION } from '@/src/core/parser/parserService';
import { normalizeWireColor, classifyComponent } from '@/src/core/projections/normalizers';

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
  status?: string; // Phase 3H.14.2: CREATED | ALREADY_PROCESSED
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
  let wireColorRaw: string | null = null; // Phase 3H.14.2: Preserve true raw color
  if (wireDetection.isWire) {
    const partId = component.detectedPartId || '';
    const colorMatch = partId.match(/^W\d+([A-Z]{2})/);
    if (colorMatch) {
      const colorCode = colorMatch[1];
      wireColorRaw = colorCode; // Phase 3H.14.2: Store original abbreviation
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
  
  // V6.0.6: Validate canonical part number before record creation
  if (!masterPartNumber || !masterPartNumber.includes('-')) {
    console.error('🚨 V6.0.6 CRITICAL: Invalid part number in normalizeComponent', {
      masterPartNumber,
      componentPartId: component.detectedPartId
    });
    throw new Error(`CRITICAL: Invalid canonical part number in normalizeComponent: "${masterPartNumber}"`);
  }
  
  // Phase 3H.14.1: Apply classification and normalization
  // Phase 3H.14.2: Pass description to classifier for improved accuracy
  const category = classifyComponent(component.detectedPartId, component.rawLine);
  // Phase 3H.14.2: Preserve true raw color (pre-transformation)
  const rawColor = wireColorRaw || wireColor; // Use original abbreviation if available
  const normalizedColor = normalizeWireColor(wireColor); // Apply normalization
  
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
    
    // Phase 3H.14.1: Structured classification and normalization
    category: category,
    rawColor: rawColor,
    normalizedColor: normalizedColor,
    
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
  bomText: string,
  metadata: IngestionMetadata
): Promise<IngestionResult> {
  console.log('🚀 V6.7.1 INGEST START', {
    sourceReference: metadata.sourceReference,
    sourceType: metadata.sourceType,
    providedPartNumber: metadata.partNumber,
    providedRevision: metadata.revision,
    timestamp: new Date().toISOString()
  });
  
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
    const parseResult: ParseResult = parseBOMWithValidation(bomText);
    
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
    
    // V6.0.10: STEP 0A - VALIDITY GUARD
    // Filter out invalid parser fragments like "45" BEFORE normalization
    // Only process candidates that meet minimum part number requirements
    const metadataCandidate = isValidPartNumberCandidate(metadata.partNumber)
      ? normalizePartNumber(metadata.partNumber)
      : null;
    
    const parserCandidate = isValidPartNumberCandidate(rawData.masterPartNumber)
      ? normalizePartNumber(rawData.masterPartNumber)
      : null;
    
    // V6.0.10: STEP 0B - HEADER EXTRACTION OVERRIDE
    // Extract part number directly from BOM header as fallback
    // Prioritize header over parser to avoid invalid fragments
    let headerCandidate: string | null = null;
    if (bomText) {
      const headerMatch = bomText.match(/NH\d{2}-\d{5,6}-\d{2,3}/);
      if (headerMatch) {
        headerCandidate = normalizePartNumber(headerMatch[0]);
      }
    }
    
    // V6.9.5: STEP 0C - SOURCE PRIORITY RESOLUTION
    // Priority: metadata > header > parser
    // STRICT: Throw error if NO valid candidate found (no weak fallbacks)
    
    // V6.9.5: Debug log all candidates BEFORE selection
    console.log('🧪 V6.9.5 FINAL PART NUMBER CANDIDATES', {
      metadata: metadataCandidate,
      header: headerCandidate,
      parser: parserCandidate,
      allCandidates: [metadataCandidate, headerCandidate, parserCandidate].filter(Boolean)
    });
    
    const masterPartNumber = metadataCandidate || headerCandidate || parserCandidate;
    
    const selectedSource = metadataCandidate ? 'metadata' :
                          headerCandidate ? 'header' :
                          parserCandidate ? 'parser' :
                          'none';
    
    console.log('🧠 V6.9.5 PART NUMBER SOURCE RESOLUTION', {
      metadata: metadata.partNumber,
      metadataValid: isValidPartNumberCandidate(metadata.partNumber),
      metadataCandidate,
      header: headerCandidate,
      parser: rawData.masterPartNumber,
      parserValid: isValidPartNumberCandidate(rawData.masterPartNumber),
      parserCandidate,
      selected: masterPartNumber,
      source: selectedSource
    });
    
    // V6.9.5: STEP 1 - STRICT VALIDATION (No weak fallbacks allowed)
    // Throw error if no valid part number found - better to fail than accept "45"
    if (!masterPartNumber || masterPartNumber.length < 8) {
      console.error('❌ V6.9.5 NO VALID PART NUMBER FOUND', {
        metadata: metadata.partNumber,
        header: headerCandidate,
        parser: rawData.masterPartNumber,
        reason: 'strict_pattern_enforcement'
      });
      console.error('🚨 V6.0.6 CRITICAL: Invalid canonical part number resolved', {
        masterPartNumber,
        metadataPartNumber: metadata.partNumber,
        rawDataPartNumber: rawData.masterPartNumber
      });
      throw new Error(`CRITICAL: Invalid canonical part number resolved: "${masterPartNumber}"`);
    }
    
    // V6.0.6: Validate part number format (must contain hyphen for proper SKU format)
    if (!masterPartNumber.includes('-')) {
      console.error('🚨 V6.0.6 CRITICAL: Part number missing hyphen (likely degraded)', {
        masterPartNumber,
        expectedFormat: 'NH##-#####-##'
      });
      throw new Error(`CRITICAL: Part number format invalid: "${masterPartNumber}" (expected format with hyphens)`);
    }
    
    console.log('🔒 V6.0.6 CANONICAL PART NUMBER LOCKED', {
      masterPartNumber,
      length: masterPartNumber.length,
      format: 'validated',
      source: metadata.partNumber ? 'metadata' : 'parser'
    });
    
    // V6.0.7: CONSISTENCY ASSERTION - Ensure metadata and canonical match
    if (masterPartNumber !== metadata.partNumber && metadata.partNumber) {
      console.warn('⚠️ V6.0.7 PART NUMBER MISMATCH DETECTED', {
        canonical: masterPartNumber,
        metadata: metadata.partNumber,
        source: 'canonicalization_fallback_to_parser'
      });
    }
    
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
    
    // V6.7.1: BEFORE REVISION CHECK
    console.log('📦 V6.7.1 BEFORE REVISION CHECK', {
      masterPartNumber,
      revision: incomingRevision.revision,
      revisionOrder: incomingRevision.order
    });
    
    // V6.7: STEP 1 - REVISION INTELLIGENCE: Fetch All Existing Revisions
    console.log('🧠 V6.7 REVISION INTELLIGENCE START', {
      masterPartNumber,
      incomingRevision: incomingRevision.revision,
      timestamp: new Date().toISOString()
    });
    
    const { data: existingRevisions, error: revisionFetchError } = await supabase
      .from('bom_records')
      .select('revision, is_active')
      .eq('parent_part_number', masterPartNumber);
    
    if (revisionFetchError) {
      console.error('🚨 V6.7 Failed to fetch existing revisions', revisionFetchError);
      errors.push(`Failed to check existing revisions: ${revisionFetchError.message}`);
      throw new Error(`Revision check failed: ${revisionFetchError.message}`);
    }
    
    // V6.7.1: Log raw existing revisions
    console.log('📊 V6.7.1 EXISTING REVISIONS RAW', {
      count: existingRevisions?.length || 0,
      revisions: existingRevisions
    });
    
    // V6.7: STEP 2 - Get unique revisions from database
    const uniqueRevisions = Array.from(
      new Set((existingRevisions || []).map(r => r.revision).filter(Boolean))
    );
    
    console.log('🧠 V6.7 EXISTING REVISIONS FOUND', {
      partNumber: masterPartNumber,
      existingRevisions: uniqueRevisions,
      count: uniqueRevisions.length
    });
    
    // V6.7: STEP 3 - Determine if incoming revision is newest
    let isNewest = true;
    let hasConflict = false;
    const incomingRev = incomingRevision.revision;
    
    for (const existingRev of uniqueRevisions) {
      const comparison = compareRevision(incomingRev, existingRev);
      
      if (comparison === 0) {
        // Same revision already exists - conflict
        hasConflict = true;
        console.log('🧠 V6.7 REVISION CONFLICT DETECTED', {
          partNumber: masterPartNumber,
          incomingRevision: incomingRev,
          existingRevision: existingRev,
          decision: 'SKIP_DUPLICATE'
        });
        break;
      } else if (comparison < 0) {
        // Incoming is older than at least one existing
        isNewest = false;
      }
    }
    
    // Phase 3H.14.1: Handle Same Revision Conflict (Return status instead of throwing)
    if (hasConflict) {
      const warningMsg = `Revision ${incomingRev} already exists for ${masterPartNumber}. Already processed.`;
      warnings.push(warningMsg);
      
      console.log('🧠 Phase 3H.14.1 REVISION DECISION: ALREADY_PROCESSED', {
        partNumber: masterPartNumber,
        incomingRevision: incomingRev,
        existingRevisions: uniqueRevisions,
        decision: 'ALREADY_PROCESSED'
      });
      
      // Return success with ALREADY_PROCESSED status (do not throw)
      return {
        success: true,
        status: 'ALREADY_PROCESSED', // Phase 3H.14.2: Explicit duplicate signal
        masterPartNumber,
        revision: incomingRev,
        recordsCreated: 0,
        errors: [],
        warnings: [warningMsg],
        metadata: {
          sourceReference: metadata.sourceReference || 'unknown',
          parserVersion: PARSER_VERSION,
          ingestionTimestamp: new Date().toISOString(),
          totalOperations: 0,
          totalComponents: 0
        }
      };
    }
    
    // V6.7: STEP 5 - Handle Older Revision (Skip in Strict Mode)
    const REVISION_MODE = 'strict'; // strict = skip older, allow_older = archive inactive
    
    if (!isNewest && REVISION_MODE === 'strict') {
      const errorMsg = `Incoming revision ${incomingRev} is older than existing revisions (${uniqueRevisions.join(', ')}). Skipping older revision upload.`;
      warnings.push(errorMsg);
      
      console.log('🧠 V6.7 REVISION DECISION: SKIP_OLDER', {
        partNumber: masterPartNumber,
        incomingRevision: incomingRev,
        existingRevisions: uniqueRevisions,
        isNewest: false,
        mode: REVISION_MODE,
        decision: 'SKIP_OLDER'
      });
      
      throw new Error(errorMsg);
    }
    
    // V6.7: STEP 6 - Determine Activation (Newest = Active, First Upload = Active)
    const shouldActivate = isNewest || uniqueRevisions.length === 0;
    const activationAction = uniqueRevisions.length === 0 
      ? 'ACTIVATE_FIRST' 
      : 'ACTIVATE_NEWEST';
    
    console.log('🧠 V6.7 REVISION DECISION', {
      partNumber: masterPartNumber,
      incomingRevision: incomingRev,
      existingRevisions: uniqueRevisions,
      isNewest,
      shouldActivate,
      action: activationAction,
      timestamp: new Date().toISOString()
    });
    
    // V6.7: STEP 7 - Deactivate Older Revisions (Before Insert)
    let deactivatedCount = 0;
    
    if (shouldActivate && uniqueRevisions.length > 0) {
      console.log('🧠 V6.7 DEACTIVATING OLDER REVISIONS', {
        partNumber: masterPartNumber,
        incomingRevision: incomingRev,
        revisionsToDeactivate: uniqueRevisions
      });
      
      const { data: deactivatedRecords, error: deactivateError } = await supabase
        .from('bom_records')
        .update({ is_active: false })
        .eq('parent_part_number', masterPartNumber)
        .eq('is_active', true)
        .select('id, revision');
      
      if (deactivateError) {
        console.error('🚨 V6.7 DEACTIVATION ERROR', deactivateError);
        errors.push(`Failed to deactivate older revisions: ${deactivateError.message}`);
        throw new Error(`Revision deactivation failed: ${deactivateError.message}`);
      }
      
      deactivatedCount = deactivatedRecords?.length || 0;
      
      console.log('🧠 V6.7 DEACTIVATION COMPLETE', {
        partNumber: masterPartNumber,
        deactivatedCount,
        deactivatedRevisions: deactivatedRecords?.map(r => r.revision)
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
    
    // V6.0.6: STEP 2 - HARD FAIL ON PART NUMBER DEGRADATION
    // Final check before storage to ensure canonical part number integrity
    if (!masterPartNumber.includes('-')) {
      console.error('❌ V6.0.6 PART NUMBER DEGRADATION DETECTED', {
        masterPartNumber,
        expectedFormat: 'NH##-#####-##',
        actualValue: masterPartNumber,
        recordCount: normalizedRecords.length
      });
      throw new Error(`CRITICAL: Part number degraded before storage: "${masterPartNumber}"`);
    }
    
    // V6.7.1: Validate payload before insert
    if (!masterPartNumber || !incomingRevision.revision) {
      console.error('❌ V6.7.1 INVALID PAYLOAD', {
        partNumber: masterPartNumber,
        revision: incomingRevision.revision
      });
      throw new Error('Missing part number or revision before insert');
    }
    
    // V6.7: STEP 8 - Final Storage with Active Status
    console.log('💾 V6.7.1 ABOUT TO INSERT', {
      partNumber: masterPartNumber,
      revision: incomingRevision.revision,
      recordCount: normalizedRecords.length,
      isActive: shouldActivate,
      batchId: ingestionBatchId,
      action: activationAction,
      firstRecordSample: normalizedRecords[0] ? {
        parent_part_number: normalizedRecords[0].parent_part_number,
        component_part_number: normalizedRecords[0].component_part_number,
        revision: normalizedRecords[0].revision,
        is_active: normalizedRecords[0].is_active
      } : null
    });
    
    // Step 3: Store (records already have is_active set from normalization)
    try {
      await storeBOM(masterPartNumber, normalizedRecords);
      console.log('✅ V6.7.1 INSERT SUCCESS', {
        partNumber: masterPartNumber,
        revision: incomingRevision.revision,
        recordCount: normalizedRecords.length
      });
    } catch (insertError) {
      console.error('❌ V6.7.1 INSERT FAILED', {
        partNumber: masterPartNumber,
        revision: incomingRevision.revision,
        error: insertError
      });
      throw insertError;
    }
    
    console.log(`🧠 [BOM Ingestion] Stored BOM for ${masterPartNumber}`);
    
    // V6.7: STEP 9 - Verify Active BOM State (Single Active Revision Rule)
    const { data: activeRecords, error: verifyError } = await supabase
      .from('bom_records')
      .select('id, revision, ingestion_batch_id')
      .eq('parent_part_number', masterPartNumber)
      .eq('is_active', true);
    
    if (verifyError) {
      console.error('🚨 V6.7 VERIFICATION ERROR', verifyError);
      throw new Error(`Post-insert verification failed: ${verifyError.message}`);
    }
    
    const activeCount = activeRecords?.length || 0;
    const activeRevisions = new Set(activeRecords?.map(r => r.revision) || []);
    const activeBatches = new Set(activeRecords?.map(r => r.ingestion_batch_id) || []);
    
    // V6.7: Enforce single active revision rule
    if (activeCount === 0) {
      console.error('🚨 V6.7 CRITICAL: NO ACTIVE RECORDS after insert', {
        partNumber: masterPartNumber,
        expectedRevision: incomingRevision.revision
      });
      throw new Error('Data integrity violation: No active BOM records exist after activation');
    }
    
    if (activeRevisions.size > 1) {
      console.error('🚨 V6.7 CRITICAL: MULTIPLE ACTIVE REVISIONS', {
        partNumber: masterPartNumber,
        activeRevisions: Array.from(activeRevisions)
      });
      throw new Error('Data integrity violation: Multiple active revisions exist');
    }
    
    if (activeBatches.size > 1) {
      console.error('🚨 V6.7 CRITICAL: MULTIPLE ACTIVE BATCHES', {
        partNumber: masterPartNumber,
        activeBatches: activeBatches.size
      });
      throw new Error('Data integrity violation: Multiple active batches exist');
    }
    
    console.log('🔥 V6.7.1 REVISION ACTIVATED', {
      partNumber: masterPartNumber,
      revision: incomingRevision.revision,
      recordsInserted: normalizedRecords.length,
      activeRecordsVerified: activeCount,
      uniqueActiveRevisions: activeRevisions.size,
      activeRevision: Array.from(activeRevisions)[0],
      deactivatedOlderRevisions: deactivatedCount,
      action: activationAction,
      isValid: activeCount === normalizedRecords.length && activeRevisions.size === 1,
      timestamp: new Date().toISOString()
    });
    
    // V6.7.1: Final success confirmation
    console.log('🎯 V6.7.1 INGEST COMPLETE', {
      partNumber: masterPartNumber,
      revision: incomingRevision.revision,
      recordsCreated: normalizedRecords.length,
      isActive: shouldActivate
    });
    
    // V6.0.7: FINAL ASSERTION - Verify canonical part number integrity
    if (!masterPartNumber.includes('-')) {
      console.error('🚨 V6.0.7 CRITICAL: Part number degraded at return point', {
        masterPartNumber,
        expectedFormat: 'NH##-#####-##'
      });
      throw new Error(`CRITICAL: Part number degraded at return: "${masterPartNumber}"`);
    }
    
    console.log('✅ V6.0.7 INGESTION COMPLETE - CANONICAL PART NUMBER VERIFIED', {
      masterPartNumber,
      recordsCreated: normalizedRecords.length,
      revision: incomingRevision.revision,
      isActive: shouldActivate
    });
    
    // Step 4: Return result with canonical persisted values
    return {
      success: true,
      status: 'CREATED', // Phase 3H.14.2: Explicit new ingestion signal
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
