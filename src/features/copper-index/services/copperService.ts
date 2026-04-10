/**
 * V5.4 EMIP Copper Index - Copper Service
 * 
 * DOMAIN ENGINE - Copper Analytics API
 * 
 * Responsibilities:
 * - Single-part copper calculation
 * - Multi-SKU copper aggregation
 * - Filtered wire usage queries
 * - Cross-SKU analytics
 * 
 * Architecture:
 * - Consumes projectionService for normalized wire data
 * - Uses copperCalculator for weight calculations
 * - Isolated from core BOM system
 * - No database writes (derived calculations only)
 */

import { getSimplifiedBOM } from '@/src/core/projections/projectionService';
import { calculateCopperForPart } from '../calculations/copperCalculator';
import type {
  CopperCalculationResult,
  CopperUsageAggregation,
  WireUsageFilter,
  FilteredWireUsage,
  WireCopperBreakdown
} from '../types';

// ============================================================
// SINGLE PART API
// ============================================================

/**
 * Get copper weight calculation for a single part
 * 
 * Flow:
 * 1. Fetch simplified BOM from projection layer
 * 2. Calculate copper weight using copperCalculator
 * 3. Return result with breakdown
 * 
 * @param partNumber Part number
 * @returns Copper calculation result or null if no BOM found
 */
export async function getCopperForPart(
  partNumber: string
): Promise<CopperCalculationResult | null> {
  console.log('🧠 V5.4 [Copper Service] Fetching copper data for part', {
    partNumber,
    timestamp: new Date().toISOString()
  });

  // Get simplified BOM from projection layer
  const projection = await getSimplifiedBOM(partNumber);

  if (!projection) {
    console.log('🧠 [Copper Service] No BOM found for part:', partNumber);
    return null;
  }

  // Calculate copper weight
  const result = calculateCopperForPart(projection);

  return result;
}

// ============================================================
// MULTI-SKU AGGREGATION
// ============================================================

/**
 * Get copper usage aggregated across multiple SKUs
 * 
 * Provides:
 * - Total copper weight across all SKUs
 * - Breakdown by wire gauge
 * - Breakdown by wire color
 * - Per-SKU details
 * 
 * @param partNumbers Array of part numbers to analyze
 * @returns Aggregated copper usage data
 */
export async function getCopperUsageAcrossParts(
  partNumbers: string[]
): Promise<CopperUsageAggregation> {
  console.log('🧠 V5.4 [Copper Service] Aggregating copper usage across SKUs', {
    skuCount: partNumbers.length,
    timestamp: new Date().toISOString()
  });

  const byPart: CopperCalculationResult[] = [];
  const byGauge: Record<string, {
    gauge: string;
    totalWeight: number | null;
    totalLength: number;
    wireCount: number;
  }> = {};
  const byColor: Record<string, {
    color: string;
    totalWeight: number | null;
    totalLength: number;
    wireCount: number;
  }> = {};
  // Phase 3H.21.3: Initialize with null-safe type
  let totalCopperWeight: number | null = 0;
  let isComplete = true;  // Phase 3H.21.3: Track completeness

  // Process each part
  for (const partNumber of partNumbers) {
    const copperResult = await getCopperForPart(partNumber);

    if (!copperResult) {
      console.warn('🧠 [Copper Service] Skipping part (no BOM):', partNumber);
      continue;
    }

    // Add to per-part results
    byPart.push(copperResult);
    
    // Phase 3H.21.3: Safe aggregation - if any null, total becomes null
    if (totalCopperWeight !== null && copperResult.totalCopperWeight !== null) {
      totalCopperWeight += copperResult.totalCopperWeight;
    } else {
      totalCopperWeight = null;
    }
    
    // Phase 3H.21.3: Track completeness
    if (!copperResult.isComplete) {
      isComplete = false;
    }

    // Aggregate by gauge
    for (const wire of copperResult.wireBreakdown) {
      if (!byGauge[wire.gauge]) {
        byGauge[wire.gauge] = {
          gauge: wire.gauge,
          totalWeight: 0,
          totalLength: 0,
          wireCount: 0
        };
      }
      // Phase 3H.21.3/3H.21.4/3H.21.5: Safe weight aggregation with local var for TS narrowing
      // Non-null assertion safe because we just initialized above
      const gaugeEntry = byGauge[wire.gauge]!;
      if (gaugeEntry.totalWeight !== null && wire.weight !== null) {
        gaugeEntry.totalWeight += wire.weight;
      } else {
        gaugeEntry.totalWeight = null;
      }
      gaugeEntry.totalLength += wire.totalLength;
      gaugeEntry.wireCount += 1;
    }

    // Aggregate by color
    for (const wire of copperResult.wireBreakdown) {
      const colorKey = wire.color || 'UNKNOWN';
      if (!byColor[colorKey]) {
        byColor[colorKey] = {
          color: colorKey,
          totalWeight: 0,
          totalLength: 0,
          wireCount: 0
        };
      }
      // Phase 3H.21.3/3H.21.4/3H.21.5: Safe weight aggregation with local var for TS narrowing
      // Non-null assertion safe because we just initialized above
      const colorEntry = byColor[colorKey]!;
      if (colorEntry.totalWeight !== null && wire.weight !== null) {
        colorEntry.totalWeight += wire.weight;
      } else {
        colorEntry.totalWeight = null;
      }
      colorEntry.totalLength += wire.totalLength;
      colorEntry.wireCount += 1;
    }
  }

  const result: CopperUsageAggregation = {
    totalCopperWeight,  // Phase 3H.21.3: null if any part incomplete
    isComplete,  // Phase 3H.21.3: Completeness flag
    byGauge,
    byColor,
    byPart,
    skuCount: byPart.length,
    calculatedAt: new Date().toISOString()
  };

  console.log('🧠 V5.4 COPPER AGGREGATION', {
    skuCount: result.skuCount,
    totalCopperWeight: result.totalCopperWeight,
    gaugeCount: Object.keys(byGauge).length,
    colorCount: Object.keys(byColor).length,
    timestamp: result.calculatedAt
  });

  return result;
}

// ============================================================
// FILTERED QUERY
// ============================================================

/**
 * Get wire usage with optional filtering
 * 
 * Supports filtering by:
 * - Wire gauge
 * - Wire color
 * - Part numbers
 * 
 * @param filter Wire usage filter
 * @returns Filtered wire usage data
 */
export async function getWireUsage(
  filter: WireUsageFilter
): Promise<FilteredWireUsage> {
  console.log('🧠 V5.4 [Copper Service] Querying wire usage with filter', {
    filter,
    timestamp: new Date().toISOString()
  });

  const partNumbers = filter.partNumbers || [];
  const affectedSKUs = new Set<string>();
  const matchingWires: WireCopperBreakdown[] = [];
  let totalLength = 0;
  let totalWeight: number | null = 0;  // Phase 3H.21.3: null-safe type

  // If no part numbers specified, we can't query
  // (Future: could query all active BOMs, but that's expensive)
  if (partNumbers.length === 0) {
    return {
      totalLength: 0,
      totalWeight: 0,
      wireCount: 0,
      affectedSKUs: [],
      filter,
      wires: []
    };
  }

  // Process each part
  for (const partNumber of partNumbers) {
    const copperResult = await getCopperForPart(partNumber);

    if (!copperResult) {
      continue;
    }

    // Filter wires
    for (const wire of copperResult.wireBreakdown) {
      let matches = true;

      // Filter by gauge
      if (filter.gauge && wire.gauge !== filter.gauge) {
        matches = false;
      }

      // Filter by color
      if (filter.color && wire.color !== filter.color) {
        matches = false;
      }

      if (matches) {
        matchingWires.push(wire);
        affectedSKUs.add(copperResult.partNumber);
        totalLength += wire.totalLength;
        // Phase 3H.21.3: Safe weight aggregation
        if (totalWeight !== null && wire.weight !== null) {
          totalWeight += wire.weight;
        } else {
          totalWeight = null;
        }
      }
    }
  }

  const result: FilteredWireUsage = {
    totalLength,
    totalWeight,  // Phase 3H.21.3: null if any wire has unknown weight
    wireCount: matchingWires.length,
    affectedSKUs: Array.from(affectedSKUs),
    filter,
    wires: matchingWires
  };

  console.log('🧠 V5.4 WIRE USAGE QUERY', {
    filter,
    wireCount: result.wireCount,
    totalLength: result.totalLength,
    totalWeight: result.totalWeight,
    affectedSKUs: result.affectedSKUs.length,
    timestamp: new Date().toISOString()
  });

  return result;
}
