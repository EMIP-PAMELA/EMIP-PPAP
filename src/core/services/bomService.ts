/**
 * V5.1 EMIP Core - BOM Service (Database Persistence)
 * 
 * FOUNDATION LAYER - Single Source of Truth for BOM Data Access
 * 
 * This is the ONLY entry point for BOM data across the entire application.
 * All feature modules (PPAP, Copper Index, etc.) MUST consume BOM via this service.
 * 
 * Responsibilities:
 * - Provide BOM data queries (getBOM, getFlattenedBOM, getWireLines)
 * - Abstract data source (Supabase database)
 * - Enforce data access patterns
 * - Track BOM access for debugging
 * 
 * Architecture Rules:
 * - NO feature-specific logic here
 * - PURE data access and transformation
 * - All BOM queries flow through this service
 * 
 * V5.1 Changes:
 * - Replaced in-memory cache with Supabase persistence
 * - Preserved all method signatures (backward compatible)
 * - Added database error handling
 */

import { BOMRecord, FlattenedBOM, WireBOM, RawBOMData } from '../data/bom/types';
import { parseBOMText, parseBOMWithValidation, PARSER_VERSION } from '../parser/parserService';
import { supabase } from '@/src/lib/supabaseClient';

// ============================================================
// V6.1: SKU INTELLIGENCE LAYER
// ============================================================

/**
 * V6.1: SKU Insights - Derived engineering intelligence from BOM data
 */
export interface SKUInsights {
  totalComponents: number;
  totalQuantity: number;
  wireCount: number;
  totalWireLength: number;
  avgWireLength: number;
  gaugeBreakdown: Record<string, number>;
  colorBreakdown: Record<string, number>;
  operationStepDistribution: Record<string, number>;
  estimatedCopperWeight: number;
}

/**
 * V6.1: Compute SKU-level intelligence from BOM records
 * 
 * Derives engineering-relevant metrics without modifying underlying data.
 * Provides actionable insights into material usage, wire characteristics,
 * and revision-level impact.
 * 
 * @param records BOM records for a single SKU
 * @returns Computed insights and metrics
 */
export function computeSKUInsights(records: BOMRecord[]): SKUInsights {
  // Initialize metrics
  let totalComponents = 0;
  let totalQuantity = 0;
  let wireCount = 0;
  let totalWireLength = 0;
  
  const gaugeBreakdown: Record<string, number> = {};
  const colorBreakdown: Record<string, number> = {};
  const operationStepDistribution: Record<string, number> = {};
  
  // V6.1: Copper weight estimation factors (lbs per inch for common gauges)
  const gaugeToWeightFactor: Record<string, number> = {
    '18': 0.006385,
    '20': 0.004016,
    '22': 0.002525,
    '24': 0.001588,
    '26': 0.001,
    '28': 0.00063
  };
  
  let estimatedCopperWeight = 0;
  
  // Process each record
  for (const record of records) {
    totalComponents++;
    totalQuantity += record.quantity || 0;
    
    // V6.1: Wire classification - a record is a wire if it has length or gauge
    const isWire = (record.length !== null && record.length !== undefined) || 
                   (record.gauge !== null && record.gauge !== undefined);
    
    if (isWire) {
      wireCount++;
      
      // Wire length calculation
      if (record.length !== null && record.length !== undefined) {
        const wireLength = record.length * (record.quantity || 0);
        totalWireLength += wireLength;
        
        // Copper weight estimation
        if (record.gauge && gaugeToWeightFactor[record.gauge]) {
          estimatedCopperWeight += wireLength * gaugeToWeightFactor[record.gauge];
        }
      }
      
      // Gauge distribution
      if (record.gauge) {
        gaugeBreakdown[record.gauge] = (gaugeBreakdown[record.gauge] || 0) + 1;
      }
      
      // Color distribution
      if (record.color) {
        colorBreakdown[record.color] = (colorBreakdown[record.color] || 0) + 1;
      }
    }
    
    // Operation step distribution
    if (record.operation_step) {
      operationStepDistribution[record.operation_step] = 
        (operationStepDistribution[record.operation_step] || 0) + 1;
    }
  }
  
  // Calculate average wire length (with division by zero protection)
  const avgWireLength = wireCount > 0 ? totalWireLength / wireCount : 0;
  
  return {
    totalComponents,
    totalQuantity,
    wireCount,
    totalWireLength,
    avgWireLength,
    gaugeBreakdown,
    colorBreakdown,
    operationStepDistribution,
    estimatedCopperWeight
  };
}

// ============================================================
// BOM ACCESS METHODS
// ============================================================

/**
 * V6.1: Get all active BOMs (summary view for UI listing)
 * 
 * Returns summary information for all active BOMs in the system.
 * Used by BOM repository page for listing.
 * 
 * @returns Array of active BOM summaries
 */
export async function getAllActiveBOMs(): Promise<Array<{
  partNumber: string;
  revision: string;
  revisionOrder: number;
  recordCount: number;
  ingestionBatchId: string;
  hasArtifact: boolean;
  updatedAt: string;
}>> {
  console.log('🧠 V5.7 BOM DATABASE ACCESS', {
    source: 'Supabase',
    operation: 'getAllActiveBOMs',
    timestamp: new Date().toISOString(),
  });

  // V5.7: Query only valid schema fields
  const { data, error } = await supabase
    .from('bom_records')
    .select('parent_part_number, revision, revision_order, ingestion_batch_id, artifact_url, updated_at')
    .eq('is_active', true)
    .order('parent_part_number', { ascending: true });

  if (error) {
    console.error('🧠 [BOM Service] Database error:', error);
    throw new Error(`Failed to retrieve active BOMs: ${error.message}`);
  }

  console.log('🧠 V5.7 [BOM Service] Raw query results:', {
    count: data?.length || 0,
    sample: data?.[0]
  });

  // V5.7: Group by parent_part_number + revision combination
  const bomMap = new Map<string, {
    partNumber: string;
    revision: string;
    revisionOrder: number;
    recordCount: number;
    ingestionBatchId: string;
    hasArtifact: boolean;
    updatedAt: string;
  }>();

  for (const record of (data || [])) {
    const partNumber = record.parent_part_number;
    const revision = record.revision || 'A';
    const key = `${partNumber}::${revision}`;
    
    if (!bomMap.has(key)) {
      bomMap.set(key, {
        partNumber,
        revision,
        revisionOrder: record.revision_order || 0,
        recordCount: 1,
        ingestionBatchId: record.ingestion_batch_id || '',
        hasArtifact: !!record.artifact_url,
        updatedAt: record.updated_at || new Date().toISOString()
      });
    } else {
      const existing = bomMap.get(key)!;
      existing.recordCount++;
    }
  }

  const summaries = Array.from(bomMap.values());
  console.log(`🧠 V5.7 [BOM Service] Retrieved ${summaries.length} active BOMs (grouped by part + revision)`);
  
  return summaries;
}

/**
 * Get BOM for a specific part number
 * 
 * Returns all child components for the given parent part (active version only).
 * 
 * @param partNumber Parent part number
 * @returns Array of BOM records (active version)
 */
export async function getBOM(partNumber: string): Promise<BOMRecord[]> {
  console.log(`🧠 [BOM Service] Fetching BOM for ${partNumber}`);
  
  const { data, error } = await supabase
    .from('bom_records')
    .select('*')
    .eq('parent_part_number', partNumber)
    .eq('is_active', true);
  
  if (error) {
    console.error('🧠 [BOM Service] Database error:', error);
    throw new Error(`Failed to retrieve BOM: ${error.message}`);
  }
  
  console.log(`🧠 [BOM Service] Retrieved ${data?.length || 0} records for ${partNumber}`);
  
  return (data || []) as BOMRecord[];
}

/**
 * V5.8: Get BOM by part number for detail view
 * 
 * Alias for getBOM - returns active BOM records for a specific part number
 * 
 * @param partNumber Parent part number
 * @returns Array of BOM records
 */
export async function getBOMByPartNumber(partNumber: string): Promise<BOMRecord[]> {
  return getBOM(partNumber);
}

/**
 * V6.0: Get BOM for a specific part number and revision
 * 
 * Used for revision comparison - retrieves records for ANY revision (not just active)
 * 
 * @param partNumber Parent part number
 * @param revision Specific revision to retrieve
 * @returns Array of BOM records for that part + revision
 */
export async function getBOMByPartAndRevision(partNumber: string, revision: string): Promise<BOMRecord[]> {
  console.log(`🧠 V6.0 [BOM Service] Fetching BOM for ${partNumber} revision ${revision}`);
  
  const { data, error } = await supabase
    .from('bom_records')
    .select('*')
    .eq('parent_part_number', partNumber)
    .eq('revision', revision);
  
  if (error) {
    console.error('🧠 V6.0 [BOM Service] Database error:', error);
    throw new Error(`Failed to retrieve BOM for revision ${revision}: ${error.message}`);
  }
  
  console.log(`🧠 V6.0 [BOM Service] Retrieved ${data?.length || 0} records for ${partNumber} rev ${revision}`);
  
  return (data || []) as BOMRecord[];
}

/**
 * V6.0: Get available revisions for a part number
 * 
 * Returns list of all revisions with metadata, sorted by revision_order
 * 
 * @param partNumber Parent part number
 * @returns Array of revision info objects
 */
export async function getAvailableRevisions(partNumber: string): Promise<Array<{
  revision: string;
  revisionOrder: number;
  recordCount: number;
  isActive: boolean;
  ingestionBatchId: string;
}>> {
  console.log(`🧠 V6.0 [BOM Service] Fetching available revisions for ${partNumber}`);
  
  const { data, error } = await supabase
    .from('bom_records')
    .select('revision, revision_order, is_active, ingestion_batch_id')
    .eq('parent_part_number', partNumber)
    .order('revision_order', { ascending: true });
  
  if (error) {
    console.error('🧠 V6.0 [BOM Service] Database error:', error);
    throw new Error(`Failed to retrieve revisions: ${error.message}`);
  }
  
  // Deduplicate by revision
  const revisionMap = new Map<string, {
    revision: string;
    revisionOrder: number;
    recordCount: number;
    isActive: boolean;
    ingestionBatchId: string;
  }>();
  
  for (const record of (data || [])) {
    const rev = record.revision || 'UNKNOWN';
    
    if (!revisionMap.has(rev)) {
      revisionMap.set(rev, {
        revision: rev,
        revisionOrder: record.revision_order || 0,
        recordCount: 1,
        isActive: record.is_active || false,
        ingestionBatchId: record.ingestion_batch_id || '',
      });
    } else {
      const existing = revisionMap.get(rev)!;
      existing.recordCount++;
      // If any record is active, mark this revision as active
      if (record.is_active) {
        existing.isActive = true;
      }
    }
  }
  
  const revisions = Array.from(revisionMap.values());
  
  console.log(`🧠 V6.0 [BOM Service] Found ${revisions.length} revisions for ${partNumber}`);
  
  return revisions;
}

/**
 * Get flattened BOM (multi-level explosion)
 * 
 * V5.1: Uses database queries for recursive expansion
 * 
 * Recursively explodes all subassemblies to get full component tree.
 * 
 * @param partNumber Top-level part number
 * @param maxLevels Maximum recursion depth (default: 10)
 * @returns Flattened BOM with all levels
 */
export async function getFlattenedBOM(
  partNumber: string, 
  maxLevels: number = 10
): Promise<FlattenedBOM> {
  console.log('🧠 V5.1 BOM DATABASE ACCESS', {
    partNumber,
    source: 'Supabase',
    operation: 'getFlattenedBOM',
    maxLevels,
    timestamp: new Date().toISOString(),
  });
  
  const allComponents: BOMRecord[] = [];
  const visited = new Set<string>();
  let currentLevel = 0;
  
  async function explode(parentPN: string, level: number) {
    if (level >= maxLevels || visited.has(parentPN)) {
      return;
    }
    
    visited.add(parentPN);
    const children = await getBOM(parentPN);
    
    for (const child of children) {
      allComponents.push(child);
      
      // Recursively explode subassemblies
      if (child.component_part_number) {
        await explode(child.component_part_number, level + 1);
      }
    }
    
    currentLevel = Math.max(currentLevel, level);
  }
  
  await explode(partNumber, 0);
  
  console.log(`🧠 [BOM Service] Flattened BOM: ${allComponents.length} total components, ${currentLevel} levels`);
  
  return {
    parentPartNumber: partNumber,
    components: allComponents,
    totalLevels: currentLevel
  };
}

/**
 * Get wire/cable components only
 * 
 * V5.1: Queries database and filters for wire components
 * 
 * Filters BOM to return only wire and cable items.
 * Useful for copper index calculations and wire-specific analysis.
 * 
 * @param partNumber Parent part number
 * @returns Wire-specific BOM view
 */
export async function getWireLines(partNumber: string): Promise<WireBOM> {
  console.log('🧠 V5.1 BOM DATABASE ACCESS', {
    partNumber,
    source: 'Supabase',
    operation: 'getWireLines',
    timestamp: new Date().toISOString(),
  });
  
  const allRecords = await getBOM(partNumber);
  
  // Filter for wire components
  // V5.6.4: Wire detection using gauge field and description
  const wires = allRecords.filter(record => {
    // Check if gauge field is populated (indicates wire)
    if (record.gauge) {
      return true;
    }
    
    // Fallback to description-based detection
    const desc = (record.description || '').toLowerCase();
    const componentPN = (record.component_part_number || '').toLowerCase();
    return desc.includes('wire') || 
           desc.includes('cable') || 
           desc.includes('awg') || 
           desc.includes('gauge') ||
           componentPN.includes('wire');
  });
  
  // Calculate total wire length
  const totalWireLength = wires.reduce((sum, wire) => {
    const length = wire.length || 0;
    const qty = wire.quantity || 1;
    return sum + (length * qty);
  }, 0);
  
  console.log(`🧠 [BOM Service] Found ${wires.length} wire components, total length: ${totalWireLength}`);
  
  return {
    parentPartNumber: partNumber,
    wires,
    totalWireLength
  };
}

/**
 * Get BOM history for a specific part number
 * 
 * V5.2: Returns ALL versions (active + inactive) grouped by batch
 * 
 * Useful for auditing, version comparison, and rollback scenarios.
 * 
 * @param partNumber Parent part number
 * @returns Array of all BOM records for this part (all versions)
 */
export async function getBOMHistory(partNumber: string): Promise<{
  versions: Array<{
    batchId: string;
    isActive: boolean;
    versionNumber: number | null;
    ingestionTimestamp: string;
    recordCount: number;
    records: BOMRecord[];
  }>;
}> {
  console.log('🧠 V5.2 BOM DATABASE ACCESS', {
    partNumber,
    source: 'Supabase',
    operation: 'getBOMHistory (all versions)',
    timestamp: new Date().toISOString(),
  });
  
  const { data, error } = await supabase
    .from('bom_records')
    .select('*')
    .eq('parent_part_number', partNumber)
    .order('ingestion_timestamp', { ascending: false })
    .order('operation_step', { ascending: true });
  
  if (error) {
    console.error('🧠 [BOM Service] Database error:', error);
    throw new Error(`Failed to retrieve BOM history for ${partNumber}: ${error.message}`);
  }
  
  const allRecords = (data || []) as BOMRecord[];
  
  // Group by ingestion_batch_id
  const batchMap = new Map<string, BOMRecord[]>();
  
  for (const record of allRecords) {
    const batchId = record.ingestion_batch_id || 'unknown';
    if (!batchMap.has(batchId)) {
      batchMap.set(batchId, []);
    }
    batchMap.get(batchId)!.push(record);
  }
  
  // Convert to version array
  const versions = Array.from(batchMap.entries()).map(([batchId, records]) => {
    const firstRecord = records[0];
    return {
      batchId,
      isActive: firstRecord.is_active || false,
      versionNumber: firstRecord.version_number || null,
      ingestionTimestamp: firstRecord.created_at || new Date().toISOString(), // V5.6.4: Use created_at
      recordCount: records.length,
      records
    };
  });
  
  // Sort by creation timestamp (most recent first)
  versions.sort((a, b) => 
    new Date(b.ingestionTimestamp).getTime() - new Date(a.ingestionTimestamp).getTime()
  );
  
  console.log(`🧠 [BOM Service] Retrieved ${versions.length} versions (${allRecords.length} total records) for ${partNumber}`);
  
  return { versions };
}

/**
 * Get BOM by source reference
 * 
 * V5.1: Queries database by source reference
 * 
 * Retrieve all BOM records from a specific source (file, system, etc.)
 * 
 * @param sourceReference Source identifier
 * @returns Array of BOM records from that source
 */
export async function getBOMBySource(sourceReference: string): Promise<BOMRecord[]> {
  console.log('🧠 V5.1 BOM DATABASE ACCESS', {
    sourceReference,
    source: 'Supabase',
    operation: 'getBOMBySource',
    timestamp: new Date().toISOString(),
  });
  
  const { data, error } = await supabase
    .from('bom_records')
    .select('*')
    .eq('source_reference', sourceReference)
    .order('parent_part_number', { ascending: true })
    .order('operation_step', { ascending: true });
  
  if (error) {
    console.error('🧠 [BOM Service] Database error:', error);
    throw new Error(`Failed to retrieve BOM by source ${sourceReference}: ${error.message}`);
  }
  
  const records = data || [];
  
  console.log(`🧠 [BOM Service] Found ${records.length} records from source: ${sourceReference}`);
  
  return records as BOMRecord[];
}

// ============================================================
// BOM INGESTION (Database Persistence)
// ============================================================

/**
 * Store BOM records in database
 * 
 * V5.1: Bulk insert into Supabase
 * 
 * @param partNumber Parent part number (for logging only)
 * @param records BOM records to store
 */
export async function storeBOM(partNumber: string, records: BOMRecord[]): Promise<void> {
  console.log(`🧠 V5.1 [BOM Service] Storing ${records.length} records for ${partNumber} to database`);
  
  if (records.length === 0) {
    console.warn(`🧠 [BOM Service] No records to store for ${partNumber}`);
    return;
  }
  
  // V5.6.2: Log first record payload for schema verification
  if (records.length > 0) {
    console.log('🧪 V5.6.2 SAMPLE INSERT PAYLOAD', {
      fields: Object.keys(records[0]),
      sample: records[0]
    });
  }
  
  // V5.6.4: Validate required fields before insert
  const validRecords = records.filter(record => {
    const isValid = 
      record.parent_part_number &&
      record.component_part_number && // V5.6.4: Updated field name
      typeof record.quantity === 'number';
    
    if (!isValid) {
      console.error('🧠 [BOM Service] Invalid record detected:', {
        parent: record.parent_part_number,
        component: record.component_part_number,
        quantity: record.quantity
      });
    }
    
    return isValid;
  });
  
  if (validRecords.length < records.length) {
    console.warn(`🧠 [BOM Service] Filtered out ${records.length - validRecords.length} invalid records`);
  }
  
  // V5.6.4: Clean records to match LIVE database schema
  const cleanedRecords = validRecords.map(record => {
    // V5.9.1: Explicit length handling - preserve null vs 0 distinction
    const lengthValue = record.length !== null && record.length !== undefined 
      ? Number(record.length) 
      : null;
    
    // Remove any undefined fields and ensure proper types
    const cleaned: any = {
      parent_part_number: record.parent_part_number,
      component_part_number: record.component_part_number, // V5.6.4: Renamed from child_part_number
      quantity: Number(record.quantity),
      unit: record.unit || null,
      description: record.description || null,
      length: lengthValue, // V5.9.1: Explicit length handling
      gauge: record.gauge || null, // V5.6.4: Wire gauge
      color: record.color || null, // V5.6.4: Wire color
      operation_step: record.operation_step || null,
      revision: record.revision || null,
      revision_order: record.revision_order ?? 0,
      is_active: record.is_active ?? true,
      ingestion_batch_id: record.ingestion_batch_id || null,
      artifact_url: record.artifact_url || null,
      artifact_path: record.artifact_path || null,
      created_at: record.created_at || new Date().toISOString(),
      updated_at: record.updated_at || new Date().toISOString(),
    };
    
    // V5.9.1: Debug log wire records before insert
    if (lengthValue !== null) {
      console.log('🧪 V5.9.1 WIRE RECORD BEFORE INSERT', {
        part: cleaned.component_part_number,
        length: cleaned.length,
        gauge: cleaned.gauge,
        color: cleaned.color,
        quantity: cleaned.quantity
      });
    }
    
    return cleaned;
  });
  
  console.log('🧪 V5.6.2 CLEANED PAYLOAD FIELDS', {
    count: cleanedRecords.length,
    fields: Object.keys(cleanedRecords[0] || {})
  });
  
  // Bulk insert into database
  const { data, error } = await supabase
    .from('bom_records')
    .insert(cleanedRecords)
    .select();
  
  if (error) {
    console.error('🧠 [BOM Service] Database insert error:', error);
    console.error('🧠 [BOM Service] Failed payload sample:', cleanedRecords[0]);
    throw new Error(`Failed to store BOM records for ${partNumber}: ${error.message}`);
  }
  
  console.log(`🧠 [BOM Service] Successfully stored ${data?.length || cleanedRecords.length} records for ${partNumber}`);
}

/**
 * Delete BOM records by source reference
 * 
 * V5.1: Useful for re-importing/replacing BOM data
 * 
 * @param sourceReference Source identifier to delete
 */
export async function deleteBOMBySource(sourceReference: string): Promise<number> {
  console.log(`🧠 V5.1 [BOM Service] Deleting BOM records from source: ${sourceReference}`);
  
  const { data, error } = await supabase
    .from('bom_records')
    .delete()
    .eq('source_reference', sourceReference)
    .select();
  
  if (error) {
    console.error('🧠 [BOM Service] Database delete error:', error);
    throw new Error(`Failed to delete BOM by source ${sourceReference}: ${error.message}`);
  }
  
  const deletedCount = data?.length || 0;
  console.log(`🧠 [BOM Service] Deleted ${deletedCount} records from source: ${sourceReference}`);
  
  return deletedCount;
}

/**
 * Get database statistics (for debugging)
 * 
 * V5.1: Queries actual database counts
 */
export async function getDatabaseStats(): Promise<{ 
  totalRecords: number; 
  uniquePartNumbers: number;
  uniqueSources: number;
}> {
  console.log('🧠 V5.1 [BOM Service] Fetching database statistics');
  
  // Get total record count
  const { count: totalRecords, error: countError } = await supabase
    .from('bom_records')
    .select('*', { count: 'exact', head: true });
  
  if (countError) {
    console.error('🧠 [BOM Service] Error fetching count:', countError);
    throw new Error(`Failed to get database stats: ${countError.message}`);
  }
  
  // Get unique parent part numbers
  const { data: uniqueParts, error: partsError } = await supabase
    .from('bom_records')
    .select('parent_part_number')
    .order('parent_part_number');
  
  const uniquePartNumbers = new Set(uniqueParts?.map(r => r.parent_part_number)).size;
  
  // Get unique sources
  const { data: uniqueSourcesData, error: sourcesError } = await supabase
    .from('bom_records')
    .select('source_reference')
    .order('source_reference');
  
  const uniqueSources = new Set(uniqueSourcesData?.map(r => r.source_reference)).size;
  
  const stats = {
    totalRecords: totalRecords || 0,
    uniquePartNumbers,
    uniqueSources
  };
  
  console.log('🧠 [BOM Service] Database stats:', stats);
  
  return stats;
}

// ============================================================
// PARSER INTEGRATION (Convenience Methods)
// ============================================================

/**
 * Parse and store BOM from raw text
 * 
 * V5.1: Parses and stores to Supabase database
 * 
 * Convenience method that combines parsing and storage.
 * 
 * @param text Raw BOM text
 * @param sourceReference Source identifier
 * @returns Parsed raw BOM data
 */
export async function parseAndStoreBOM(
  text: string, 
  sourceReference: string
): Promise<RawBOMData> {
  console.log(`🧠 V5.1 [BOM Service] Parse and store from source: ${sourceReference}`);
  
  const parseResult = parseBOMWithValidation(text);
  
  if (!parseResult.success || !parseResult.data) {
    throw new Error(`BOM parsing failed: ${parseResult.errors.map(e => e.message).join(', ')}`);
  }
  
  const rawData = parseResult.data;
  
  // Note: This is a simplified normalization
  // Full normalization should use ingestion.ts for production
  const records: BOMRecord[] = [];
  
  for (const operation of rawData.operations) {
    for (const component of operation.components) {
      // Prepare metadata
      const metadata = {
        rawLine: component.rawLine,
        candidateIds: component.candidateIds,
      };
      
      records.push({
        parent_part_number: rawData.masterPartNumber,
        component_part_number: component.detectedPartId,
        quantity: component.detectedQty || 1,
        unit: component.detectedUom,
        description: null, // Can be enriched in future
        operation_step: operation.step,
        gauge: null, // V5.6.4: Wire gauge (not extracted in legacy function)
        color: null, // V5.6.4: Wire color (not extracted in legacy function)
        revision: null, // V5.6.4: Revision (not provided in legacy function)
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
  }
  
  await storeBOM(rawData.masterPartNumber, records);
  
  console.log(`🧠 [BOM Service] Stored ${records.length} normalized records to database`);
  
  return rawData;
}
