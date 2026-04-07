/**
 * V5.0 EMIP Core - BOM Service
 * 
 * FOUNDATION LAYER - Single Source of Truth for BOM Data Access
 * 
 * This is the ONLY entry point for BOM data across the entire application.
 * All feature modules (PPAP, Copper Index, etc.) MUST consume BOM via this service.
 * 
 * Responsibilities:
 * - Provide BOM data queries (getBOM, getFlattenedBOM, getWireLines)
 * - Abstract data source (database, cache, external API)
 * - Enforce data access patterns
 * - Track BOM access for debugging
 * 
 * Architecture Rules:
 * - NO feature-specific logic here
 * - PURE data access and transformation
 * - All BOM queries flow through this service
 */

import { BOMRecord, FlattenedBOM, WireBOM, RawBOMData } from '../data/bom/types';
import { parseBOMText, parseBOMWithValidation, PARSER_VERSION } from '../parser/parserService';

// ============================================================
// IN-MEMORY CACHE (Temporary - Phase 1)
// ============================================================

/**
 * Temporary in-memory BOM storage
 * 
 * V5.0 Phase 1: In-memory cache for immediate functionality
 * V5.0 Phase 2: Replace with database queries (Supabase)
 * 
 * Structure: Map<parentPartNumber, BOMRecord[]>
 */
const bomCache = new Map<string, BOMRecord[]>();

// ============================================================
// BOM ACCESS METHODS
// ============================================================

/**
 * Get BOM for a specific part number
 * 
 * Returns all child components for the given parent part.
 * 
 * @param partNumber Parent part number
 * @returns Array of BOM records
 */
export async function getBOM(partNumber: string): Promise<BOMRecord[]> {
  console.log('🧠 EMIP CORE BOM ACCESS', {
    partNumber,
    source: 'bomService.getBOM',
    timestamp: new Date().toISOString(),
  });
  
  const records = bomCache.get(partNumber) || [];
  
  console.log(`🧠 [BOM Service] Retrieved ${records.length} records for ${partNumber}`);
  
  return records;
}

/**
 * Get flattened BOM (multi-level explosion)
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
  console.log('🧠 EMIP CORE BOM ACCESS', {
    partNumber,
    source: 'bomService.getFlattenedBOM',
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
      if (child.child_part_number) {
        await explode(child.child_part_number, level + 1);
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
 * Filters BOM to return only wire and cable items.
 * Useful for copper index calculations and wire-specific analysis.
 * 
 * @param partNumber Parent part number
 * @returns Wire-specific BOM view
 */
export async function getWireLines(partNumber: string): Promise<WireBOM> {
  console.log('🧠 EMIP CORE BOM ACCESS', {
    partNumber,
    source: 'bomService.getWireLines',
    timestamp: new Date().toISOString(),
  });
  
  const allRecords = await getBOM(partNumber);
  
  // Filter for wire components
  // V5.0: Simple description-based detection
  // V5.1: Will use wire detection service from parser
  const wires = allRecords.filter(record => {
    const desc = (record.description || '').toLowerCase();
    return desc.includes('wire') || 
           desc.includes('cable') || 
           desc.includes('awg') || 
           desc.includes('gauge');
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
 * Get BOM by source reference
 * 
 * Retrieve all BOM records from a specific source (file, system, etc.)
 * 
 * @param sourceReference Source identifier
 * @returns Array of BOM records from that source
 */
export async function getBOMBySource(sourceReference: string): Promise<BOMRecord[]> {
  console.log('🧠 EMIP CORE BOM ACCESS', {
    sourceReference,
    source: 'bomService.getBOMBySource',
    timestamp: new Date().toISOString(),
  });
  
  const allRecords: BOMRecord[] = [];
  
  // Iterate through cache to find matching source
  for (const records of bomCache.values()) {
    const matchingRecords = records.filter(r => r.source_reference === sourceReference);
    allRecords.push(...matchingRecords);
  }
  
  console.log(`🧠 [BOM Service] Found ${allRecords.length} records from source: ${sourceReference}`);
  
  return allRecords;
}

// ============================================================
// BOM INGESTION (Temporary Direct Access)
// ============================================================

/**
 * Store BOM records in cache
 * 
 * V5.0 Phase 1: Direct cache storage
 * V5.0 Phase 2: Replace with database inserts
 * 
 * @param partNumber Parent part number
 * @param records BOM records to store
 */
export async function storeBOM(partNumber: string, records: BOMRecord[]): Promise<void> {
  console.log(`🧠 [BOM Service] Storing ${records.length} records for ${partNumber}`);
  
  bomCache.set(partNumber, records);
  
  console.log(`🧠 [BOM Service] Cache now contains ${bomCache.size} part numbers`);
}

/**
 * Clear BOM cache (for testing/development)
 */
export function clearBOMCache(): void {
  console.log('🧠 [BOM Service] Clearing BOM cache');
  bomCache.clear();
}

/**
 * Get cache statistics (for debugging)
 */
export function getCacheStats(): { totalParts: number; totalRecords: number } {
  let totalRecords = 0;
  for (const records of bomCache.values()) {
    totalRecords += records.length;
  }
  
  return {
    totalParts: bomCache.size,
    totalRecords
  };
}

// ============================================================
// PARSER INTEGRATION (Convenience Methods)
// ============================================================

/**
 * Parse and store BOM from raw text
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
  console.log(`🧠 [BOM Service] Parse and store from source: ${sourceReference}`);
  
  const parseResult = parseBOMWithValidation(text);
  
  if (!parseResult.success || !parseResult.data) {
    throw new Error(`BOM parsing failed: ${parseResult.errors.map(e => e.message).join(', ')}`);
  }
  
  const rawData = parseResult.data;
  
  // Note: This is a simplified normalization
  // Full normalization will be in ingestion.ts
  const records: BOMRecord[] = [];
  
  for (const operation of rawData.operations) {
    for (const component of operation.components) {
      records.push({
        parent_part_number: rawData.masterPartNumber,
        child_part_number: component.detectedPartId,
        quantity: component.detectedQty || 1,
        unit: component.detectedUom,
        description: null,
        aci_code: component.detectedAci,
        operation_step: operation.step,
        resource_id: operation.resourceId,
        source_reference: sourceReference,
        source_type: 'visual_export',
        ingestion_timestamp: new Date().toISOString(),
        parser_version: PARSER_VERSION
      });
    }
  }
  
  await storeBOM(rawData.masterPartNumber, records);
  
  console.log(`🧠 [BOM Service] Stored ${records.length} normalized records`);
  
  return rawData;
}
