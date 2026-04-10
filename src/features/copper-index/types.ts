/**
 * V5.4 EMIP Copper Index - Type Definitions
 * 
 * DOMAIN ENGINE - Wire Weight Intelligence
 * 
 * Types for copper weight calculation and analytics.
 * 
 * Architecture:
 * - Consumes projection layer for normalized wire data
 * - Isolated from core BOM system
 * - Derived calculations, not stored as canonical truth
 */

// ============================================================
// COPPER FACTOR MODEL
// ============================================================

/**
 * Copper weight factor for wire gauge
 * 
 * Defines copper weight per foot for each wire gauge.
 */
export interface CopperFactor {
  /** Wire gauge (e.g., "18", "20") */
  gauge: string;
  
  /** Copper weight per foot in pounds */
  weightPerFoot: number;
}

/**
 * Copper weight factors by gauge
 * 
 * Based on standard AWG copper wire weights.
 * Values represent pounds of copper per foot of wire.
 * 
 * Source: Standard AWG wire specifications
 * Note: These are approximate values for 100% copper wire
 */
export const COPPER_FACTORS: Record<string, number> = {
  "8": 0.0497,   // 8 AWG
  "10": 0.0314,  // 10 AWG
  "12": 0.0198,  // 12 AWG
  "14": 0.0125,  // 14 AWG
  "16": 0.0079,  // 16 AWG
  "18": 0.0050,  // 18 AWG
  "20": 0.0031,  // 20 AWG
  "22": 0.0019,  // 22 AWG
  "24": 0.0012,  // 24 AWG
  "26": 0.0008,  // 26 AWG
  "28": 0.0005,  // 28 AWG
  "30": 0.0003   // 30 AWG
};

// ============================================================
// COPPER CALCULATION RESULTS
// ============================================================

/**
 * Wire-level copper breakdown
 * Phase 3H.21.1: weight can be null for unknown gauge
 */
export interface WireCopperBreakdown {
  /** Wire gauge */
  gauge: string;
  
  /** Wire color */
  color: string | null;
  
  /** Part number */
  partNumber: string;
  
  /** Total length (feet) */
  totalLength: number;
  
  /** Quantity of wires */
  quantity: number;
  
  /** Copper weight (pounds) — null if gauge unknown */
  weight: number | null;
}

/**
 * SKU-level copper calculation result
 * Phase 3H.21.1: totals can be null if calculation incomplete
 */
export interface CopperCalculationResult {
  /** Part number */
  partNumber: string;
  
  /** Revision */
  revision: string;
  
  /** Total copper weight (pounds) — null if any wire has unknown gauge */
  totalCopperWeight: number | null;
  
  /** Wire-by-wire breakdown */
  wireBreakdown: WireCopperBreakdown[];
  
  /** Calculation timestamp */
  calculatedAt: string;
  
  /** Phase 3H.21.1: True if all wires had known gauge */
  isComplete: boolean;
}

/**
 * Multi-SKU aggregation result
 * Phase 3H.21.3: totalCopperWeight can be null if any part has incomplete calculation
 */
export interface CopperUsageAggregation {
  /** Total copper weight across all SKUs (pounds) — null if any part incomplete */
  totalCopperWeight: number | null;
  
  /** Phase 3H.21.3: True if all parts had complete copper calculations */
  isComplete: boolean;
  
  /** Copper usage by wire gauge */
  byGauge: Record<string, {
    gauge: string;
    /** Phase 3H.21.3: null if any wire in this gauge has unknown weight */
    totalWeight: number | null;
    totalLength: number;
    wireCount: number;
  }>;
  
  /** Copper usage by wire color */
  byColor: Record<string, {
    color: string;
    /** Phase 3H.21.3: null if any wire in this color has unknown weight */
    totalWeight: number | null;
    totalLength: number;
    wireCount: number;
  }>;
  
  /** Copper usage by part */
  byPart: CopperCalculationResult[];
  
  /** Number of SKUs analyzed */
  skuCount: number;
  
  /** Calculation timestamp */
  calculatedAt: string;
}

/**
 * Wire usage filter
 */
export interface WireUsageFilter {
  /** Filter by gauge (optional) */
  gauge?: string;
  
  /** Filter by color (optional) */
  color?: string;
  
  /** Filter by part numbers (optional) */
  partNumbers?: string[];
}

/**
 * Filtered wire usage result
 * Phase 3H.21.3: totalWeight can be null if any wire has unknown weight
 */
export interface FilteredWireUsage {
  /** Total length (feet) */
  totalLength: number;
  
  /** Total copper weight (pounds) — null if any wire has unknown weight */
  totalWeight: number | null;
  
  /** Number of matching wires */
  wireCount: number;
  
  /** Affected SKUs */
  affectedSKUs: string[];
  
  /** Applied filter */
  filter: WireUsageFilter;
  
  /** Matching wires */
  wires: WireCopperBreakdown[];
}
