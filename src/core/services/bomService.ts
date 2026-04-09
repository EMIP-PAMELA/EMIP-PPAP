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
// V6.7: REVISION INTELLIGENCE LAYER
// ============================================================

/**
 * V6.7: Compare two revision strings to determine which is newer
 * 
 * Returns:
 *  > 0 if revision 'a' is newer than 'b'
 *  < 0 if revision 'a' is older than 'b'
 *  = 0 if revisions are equal
 * 
 * Examples:
 *  compareRevision('08', '07') = 1  (08 is newer)
 *  compareRevision('07', '08') = -1 (07 is older)
 *  compareRevision('E', 'D') = 1   (E is newer)
 */
export function compareRevision(a: string, b: string): number {
  // Normalize inputs
  const revA = (a || '').trim();
  const revB = (b || '').trim();
  
  // Handle empty cases
  if (!revA && !revB) return 0;
  if (!revA) return -1; // No revision is oldest
  if (!revB) return 1;
  
  // Try numeric comparison first (e.g., '07', '08')
  const numA = Number(revA);
  const numB = Number(revB);
  
  if (!isNaN(numA) && !isNaN(numB)) {
    return numA - numB;
  }
  
  // Fallback to string comparison (e.g., 'A', 'B', 'E')
  return revA.localeCompare(revB);
}

// ============================================================
// V6.1: SKU INTELLIGENCE LAYER
// ============================================================

/**
 * V6.2: Normalize color label for display
 * Phase 3H.15.3: Enhanced compound color handling
 * 
 * Maps raw color codes to standardized display names.
 * Handles compound colors (WH/BK) by returning primary color.
 * Does NOT modify stored BOM data - display/projection only.
 */
function normalizeColorLabel(rawColor: string | null | undefined): string {
  if (!rawColor) return 'UNKNOWN';
  
  const normalized = rawColor.trim().toUpperCase();
  
  // Phase 3H.15.3: Handle compound colors (WH/BK → white)
  if (normalized.includes('/')) {
    const primaryColor = normalized.split('/')[0].trim();
    return normalizeColorLabel(primaryColor); // Recursive call for primary
  }
  
  // Standard color mappings
  const colorMap: Record<string, string> = {
    'BLK': 'black',
    'BK': 'black',    // Phase 3H.15.3: Short code
    'BLU': 'blue',
    'BRN': 'brown',
    'BR': 'brown',    // Phase 3H.15.3: Short code
    'GRN': 'green',
    'GR': 'green',    // Phase 3H.15.3: Short code
    'GRY': 'gray',
    'ORG': 'orange',
    'PNK': 'pink',
    'PUR': 'purple',
    'RED': 'red',
    'RD': 'red',      // Phase 3H.15.3: Short code
    'WHT': 'white',
    'WH': 'white',    // Phase 3H.15.3: Short code
    'YEL': 'yellow',
    'YLW': 'yellow',
    'YL': 'yellow',
    'GLD': 'gold',
    'SLV': 'silver',
    'TAN': 'tan',
    'VIO': 'violet',
    'VI': 'violet'
  };
  
  return colorMap[normalized] || normalized.toLowerCase();
}

/**
 * V6.2: Normalized component with computed fields
 */
interface NormalizedComponent {
  component_part_number: string;
  description: string | null;
  length: number;
  quantity: number;
  qtyPer: number;
  gauge: string | null;
  color: string | null;
  colorNormalized: string;
  isWire: boolean;
  effectiveLength: number;
  operation_step: string | null;
}

/**
 * V6.2: True wire detection based on description and part number
 * 
 * A component is a wire if:
 * - Description contains "WIRE", OR
 * - Part number starts with "W"
 */
function isWireComponent(record: BOMRecord): boolean {
  const desc = (record.description || '').toUpperCase();
  const part = (record.component_part_number || '').toUpperCase();

  return desc.includes('WIRE') || part.startsWith('W');
}

/**
 * V6.2: Normalize component with computed fields
 * 
 * Adds:
 * - colorNormalized: Standardized color label
 * - isWire: True wire detection
 * - qtyPer: Quantity per assembly (default 1)
 * - effectiveLength: length * qtyPer (true material usage)
 */
function normalizeComponentForAnalytics(record: BOMRecord): NormalizedComponent {
  const length = Number(record.length) || 0;
  const quantity = Number(record.quantity) || 0;
  // V6.2: qty_per may not exist in all records, default to 1
  const qtyPer = Number((record as any).qty_per) || 1;
  
  // Phase 3H.15.6: Use normalizedColor from DB as single source of truth
  // NO runtime normalization - DB is authoritative
  return {
    component_part_number: record.component_part_number,
    description: record.description || null,
    length,
    quantity,
    qtyPer,
    gauge: record.gauge || null,
    color: record.color || null,
    colorNormalized: record.normalizedColor || record.color || 'UNKNOWN',
    isWire: isWireComponent(record),
    effectiveLength: length * qtyPer,
    operation_step: record.operation_step || null
  };
}


// ============================================================
// V6.4: CALIBRATION ENGINE
// ============================================================

/**
 * V6.4: Wire calibration data (10 ft sample method)
 */
interface WireCalibration {
  gauge: string;
  grossLbsPerFt: number;
  copperLbsPerFt: number;
  insulationLbsPerFt: number;
}

/**
 * V6.4.3: Calibration cache (loaded from database)
 */
let CALIBRATION_CACHE: Record<string, WireCalibration> = {};
let CALIBRATION_LAST_LOADED: number = 0;
const CALIBRATION_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * V6.4.3: Load calibration data from database
 */
export async function loadCalibrationFromDB(): Promise<void> {
  try {
    const response = await fetch('/api/calibration');
    if (!response.ok) {
      console.warn('⚠️ [BOM Service] Failed to load calibration from API');
      return;
    }
    
    const { data } = await response.json();
    
    CALIBRATION_CACHE = {};
    data.forEach((cal: any) => {
      CALIBRATION_CACHE[cal.gauge] = {
        gauge: cal.gauge,
        copperLbsPerFt: parseFloat(cal.copper_lbs_per_ft),
        grossLbsPerFt: parseFloat(cal.gross_lbs_per_ft),
        insulationLbsPerFt: parseFloat(cal.insulation_lbs_per_ft)
      };
    });
    
    CALIBRATION_LAST_LOADED = Date.now();
    
    console.log('✅ V6.4.3 CALIBRATION LOADED', {
      count: Object.keys(CALIBRATION_CACHE).length,
      gauges: Object.keys(CALIBRATION_CACHE)
    });
  } catch (err) {
    console.error('❌ [BOM Service] Error loading calibration:', err);
  }
}

/**
 * V6.4.3: Get calibration data for a specific gauge (with auto-refresh)
 */
async function getCalibration(gauge: string): Promise<WireCalibration | null> {
  // Auto-refresh cache if expired
  if (Date.now() - CALIBRATION_LAST_LOADED > CALIBRATION_CACHE_TTL) {
    await loadCalibrationFromDB();
  }
  
  return CALIBRATION_CACHE[gauge] || null;
}

/**
 * V6.4.3: Get all active calibrations (for UI display)
 */
export function getActiveCalibrations(): Record<string, WireCalibration> {
  return { ...CALIBRATION_CACHE };
}

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
  estimatedInsulationWeight: number;  // V6.4: Insulation weight (from calibration)
  estimatedGrossWeight: number;  // V6.4: Total wire weight (copper + insulation)
  copperPercent: number;  // V6.4: Copper percentage of gross weight
  insulationPercent: number;  // V6.4: Insulation percentage of gross weight
  lengthUnit: 'feet' | 'inches';  // V6.2.4: Source unit (deterministic)
  unitSource: 'engineering_master';  // V6.2.4: Unit source metadata
}

/**
 * V6.2: Compute SKU-level intelligence from BOM records
 * 
 * MATERIAL-BASED ANALYTICS:
 * - True wire detection (description + part number)
 * - Qty Per support for accurate material usage
 * - Length-weighted distributions (not count-based)
 * - Accurate copper weight estimation
 * 
 * @param records BOM records for a single SKU
 * @returns Computed insights and metrics
 */
export function computeSKUInsights(records: BOMRecord[]): SKUInsights {
  // V6.2: STEP 1 - Normalize all components with computed fields
  const normalized = records.map(normalizeComponentForAnalytics);
  
  // V6.2.4: STEP 2A - Enforce deterministic source unit (Engineering Masters = feet)
  const sourceUnit: 'feet' | 'inches' = 'feet';
  const unitFactor = 12;  // feet → inches conversion
  
  // V6.2.4: STEP 2B - Normalize all lengths to canonical inches
  const normalizedWithUnits = normalized.map(r => ({
    ...r,
    normalizedLength: r.length * unitFactor,  // feet → inches
    effectiveLength: r.length * unitFactor * r.qtyPer
  }));
  
  // V6.2: STEP 2 - Filter to wire records only
  const wireRecords = normalizedWithUnits.filter(r => r.isWire && r.length > 0);
  
  // V6.2.1: Calculate physical wire count (sum of qtyPer)
  const physicalWireCount = wireRecords.reduce(
    (sum, r) => sum + r.qtyPer,
    0
  );
  
  const componentWireCount = wireRecords.length;
  
  // V6.2: STEP 3 - Initialize metrics
  const totalComponents = normalized.length;
  const totalQuantity = normalized.reduce((sum, r) => sum + r.quantity, 0);
  
  // V6.2.1: Use physical wire count (backward compatible via wireCount variable)
  const wireCount = physicalWireCount;
  
  // V6.2: STEP 4 - Material-based wire length calculation
  const totalWireLength = wireRecords.reduce(
    (sum, r) => sum + r.effectiveLength,
    0
  );
  
  // V6.2.1: Fix average - use physical wire count, not component count
  const avgWireLength = physicalWireCount > 0 ? totalWireLength / physicalWireCount : 0;
  
  // V6.2: STEP 5 - Length-weighted color distribution
  const colorBreakdown: Record<string, number> = {};
  wireRecords.forEach(r => {
    const color = r.colorNormalized || 'UNKNOWN';
    colorBreakdown[color] = (colorBreakdown[color] || 0) + r.effectiveLength;
  });
  
  // V6.2: STEP 6 - Length-weighted gauge distribution
  const gaugeBreakdown: Record<string, number> = {};
  wireRecords.forEach(r => {
    const gauge = r.gauge || 'UNKNOWN';
    gaugeBreakdown[gauge] = (gaugeBreakdown[gauge] || 0) + r.effectiveLength;
  });
  
  // V6.3: STEP 7 - Accurate copper weight calculation using AWG lookup table
  // Industry-standard copper weight (lbs per foot) for solid copper wire
  const COPPER_LBS_PER_FOOT: Record<string, number> = {
    '2': 0.641,
    '4': 0.404,
    '6': 0.255,
    '8': 0.160,
    '10': 0.101,
    '12': 0.0641,
    '14': 0.0408,
    '16': 0.0257,
    '18': 0.0160,
    '20': 0.0101,
    '22': 0.0064
  };
  
  // V6.3: Optional calibration overrides (empty by default)
  const CALIBRATED_OVERRIDES: Record<string, number> = {};
  
  // V6.3: Get copper factor with calibration override support
  const getCopperFactor = (gauge: string): number | null => {
    return CALIBRATED_OVERRIDES[gauge] || COPPER_LBS_PER_FOOT[gauge] || null;
  };
  
  // V6.4: Weight calculations with calibration support
  let estimatedCopperWeight = 0;
  let estimatedInsulationWeight = 0;
  let estimatedGrossWeight = 0;
  
  // V6.4.4: Calibration-first calculation with derived insulation
  wireRecords.forEach(r => {
    const gauge = r.gauge || '';
    const lengthFeet = r.length * r.qtyPer;
    const calibration = CALIBRATION_CACHE[gauge];
    
    if (calibration) {
      // V6.4.4: Use calibration data ONLY (10 ft sample method)
      const copper = lengthFeet * calibration.copperLbsPerFt;
      const gross = lengthFeet * calibration.grossLbsPerFt;
      const insulation = gross - copper;  // Always derive from gross - copper
      
      estimatedCopperWeight += copper;
      estimatedInsulationWeight += insulation;
      estimatedGrossWeight += gross;
      
      // V6.4.4: Debug calibration usage
      if (lengthFeet > 0) {
        console.log('🧠 V6.4.4 CALIBRATION ACTIVE', {
          gauge,
          lengthFeet: lengthFeet.toFixed(2),
          copperPerFt: calibration.copperLbsPerFt.toFixed(4),
          grossPerFt: calibration.grossLbsPerFt.toFixed(4),
          insulationPerFt: (calibration.grossLbsPerFt - calibration.copperLbsPerFt).toFixed(4),
          totalCopper: copper.toFixed(4),
          totalInsulation: insulation.toFixed(4),
          totalGross: gross.toFixed(4)
        });
      }
    } else {
      // V6.4.4: Fallback to AWG lookup table (copper-only)
      const factor = getCopperFactor(gauge);
      if (factor && r.length) {
        const copper = lengthFeet * factor;
        
        estimatedCopperWeight += copper;
        estimatedGrossWeight += copper;  // Assume copper-only for fallback
        // IMPORTANT: estimatedInsulationWeight remains 0 in fallback path
      }
    }
  });
  
  // V6.4: Calculate percentage metrics
  const copperPercent = estimatedGrossWeight > 0 ? estimatedCopperWeight / estimatedGrossWeight : 0;
  const insulationPercent = estimatedGrossWeight > 0 ? estimatedInsulationWeight / estimatedGrossWeight : 0;
  
  // V6.2: STEP 8 - Operation step distribution (count-based, this is correct)
  const operationStepDistribution: Record<string, number> = {};
  normalized.forEach(r => {
    if (r.operation_step) {
      operationStepDistribution[r.operation_step] = 
        (operationStepDistribution[r.operation_step] || 0) + 1;
    }
  });
  
  // V6.2.4: STEP 9 - Validation logging with deterministic unit enforcement
  console.log('🧠 V6.2.4 UNIT SOURCE LOCKED', {
    unit: 'feet',
    source: 'engineering_master',
    behavior: 'deterministic_no_detection',
    unitFactor,
    sampleLengths: normalized.slice(0, 3).map(r => r.length),
    componentWireCount,
    physicalWireCount,
    totalWireLength: Number(totalWireLength.toFixed(2)),
    totalWireLengthDisplay: `${(totalWireLength / 12).toFixed(1)} ft`,
    avgWireLength: Number(avgWireLength.toFixed(2)),
    avgWireLengthDisplay: `${(avgWireLength / 12).toFixed(1)} ft`,
    copperWeight: Number(estimatedCopperWeight.toFixed(4)),
    colorDistribution: Object.fromEntries(
      Object.entries(colorBreakdown).map(([k, v]) => [k, Number(v.toFixed(2))])
    ),
    gaugeDistribution: Object.fromEntries(
      Object.entries(gaugeBreakdown).map(([k, v]) => [k, Number(v.toFixed(2))])
    )
  });
  
  // V6.2: Debug logging for wire records
  if (wireRecords.length > 0) {
    console.log('🧠 V6.2 WIRE RECORDS', wireRecords.slice(0, 5).map(r => ({
      part: r.component_part_number,
      description: r.description,
      length: r.length,
      qtyPer: r.qtyPer,
      effectiveLength: Number(r.effectiveLength.toFixed(2)),
      gauge: r.gauge,
      color: r.color,
      colorNormalized: r.colorNormalized
    })));
  }
  
  return {
    totalComponents,
    totalQuantity,
    wireCount,
    totalWireLength,
    avgWireLength,
    gaugeBreakdown,
    colorBreakdown,
    operationStepDistribution,
    estimatedCopperWeight,
    estimatedInsulationWeight,  // V6.4: Insulation weight
    estimatedGrossWeight,  // V6.4: Gross weight
    copperPercent,  // V6.4: Copper percentage
    insulationPercent,  // V6.4: Insulation percentage
    lengthUnit: sourceUnit,  // V6.2.4: Deterministic source unit
    unitSource: 'engineering_master'  // V6.2.4: Unit source metadata
  };
}

// ============================================================
// V6.4: FAMILY COPPER INDEX
// ============================================================

/**
 * V6.4: Family copper index result
 */
export interface FamilyCopperIndex {
  family: string;
  totalCopper: number;
  totalInsulation: number;
  totalGross: number;
  totalLength: number;
  totalWireCount: number;
  skuCount: number;
}

/**
 * V6.4: Group BOM records by family number
 */
function groupByFamily(records: BOMRecord[]): Record<string, BOMRecord[]> {
  return records.reduce((acc, r) => {
    const family = extractFamilyNumber(r.parent_part_number || '') || 'UNKNOWN';
    if (!acc[family]) acc[family] = [];
    acc[family].push(r);
    return acc;
  }, {} as Record<string, BOMRecord[]>);
}

/**
 * V6.4: Compute family-level copper index
 * 
 * Aggregates SKU insights by family number and calculates:
 * - Total copper weight per family
 * - Total insulation weight per family
 * - Total gross weight per family
 * - Total wire length per family
 * - Total wire count per family
 * - SKU count per family
 * 
 * @param records All BOM records to aggregate
 * @returns Map of family number to aggregated metrics
 */
export function computeFamilyCopperIndex(
  records: BOMRecord[]
): Record<string, FamilyCopperIndex> {
  const families = groupByFamily(records);
  const result: Record<string, FamilyCopperIndex> = {};
  
  Object.entries(families).forEach(([family, familyRecords]) => {
    // Get unique SKUs in this family
    const uniqueSKUs = new Set(familyRecords.map(r => r.parent_part_number));
    
    // Compute insights for all records in this family
    const insights = computeSKUInsights(familyRecords);
    
    result[family] = {
      family,
      totalCopper: insights.estimatedCopperWeight,
      totalInsulation: insights.estimatedInsulationWeight,
      totalGross: insights.estimatedGrossWeight,
      totalLength: insights.totalWireLength,
      totalWireCount: insights.wireCount,
      skuCount: uniqueSKUs.size
    };
  });
  
  // V6.4.4: Log family copper index
  console.log('🧠 V6.4.4 FAMILY COPPER INDEX', {
    familyCount: Object.keys(result).length,
    calibrationActive: Object.keys(CALIBRATION_CACHE).length > 0,
    families: Object.entries(result).map(([family, data]) => ({
      family,
      skuCount: data.skuCount,
      totalCopper: Number(data.totalCopper.toFixed(4)),
      totalGross: Number(data.totalGross.toFixed(4))
    }))
  });
  
  return result;
}

// ============================================================
// V6.4: SKU SELECTION LAYER
// ============================================================

/**
 * V6.4: Filter BOM records to include only selected SKUs
 * 
 * @param records All BOM records
 * @param selectedPartNumbers Part numbers to include
 * @returns Filtered records
 */
export function filterSelectedSKUs(
  records: BOMRecord[],
  selectedPartNumbers: string[]
): BOMRecord[] {
  return records.filter(r =>
    selectedPartNumbers.includes(r.parent_part_number || '')
  );
}

/**
 * V6.4: Get all part numbers except excluded ones
 * 
 * @param allPartNumbers All available part numbers
 * @param excluded Part numbers to exclude
 * @returns Filtered part numbers
 */
export function excludeSKUs(
  allPartNumbers: string[],
  excluded: string[]
): string[] {
  return allPartNumbers.filter(p => !excluded.includes(p));
}

// ============================================================
// V6.3: MATERIAL DELTA ENGINE
// ============================================================

/**
 * V6.3: Material Delta - Revision comparison result
 */
export interface MaterialDelta {
  partNumber: string;
  fromRevision: string;
  toRevision: string;
  wireLengthDelta: number;
  copperDelta: number;
  wireCountDelta: number;
  gaugeDelta: Record<string, number>;
  colorDelta: Record<string, number>;
}

/**
 * V6.3: Group BOM records by revision
 */
function groupByRevision(records: BOMRecord[]): Record<string, BOMRecord[]> {
  return records.reduce((acc, r) => {
    const rev = r.revision || 'UNKNOWN';
    if (!acc[rev]) acc[rev] = [];
    acc[rev].push(r);
    return acc;
  }, {} as Record<string, BOMRecord[]>);
}

/**
 * V6.3: Calculate distribution delta (current - previous)
 */
function diffDistribution(
  curr: Record<string, number>,
  prev: Record<string, number>
): Record<string, number> {
  const keys = new Set([
    ...Object.keys(curr),
    ...Object.keys(prev)
  ]);

  const result: Record<string, number> = {};

  keys.forEach(k => {
    result[k] = (curr[k] || 0) - (prev[k] || 0);
  });

  return result;
}

/**
 * V6.3: Compute material delta between two revisions
 * 
 * Compares current vs previous revision and calculates:
 * - Wire length delta
 * - Copper weight delta
 * - Wire count delta
 * - Gauge distribution changes
 * - Color distribution changes
 * 
 * @param partNumber Part number to compare
 * @param records All BOM records for this part number
 * @returns Material delta or null if insufficient revisions
 */
export function computeMaterialDelta(
  partNumber: string,
  records: BOMRecord[]
): MaterialDelta | null {
  // V6.3: Group records by revision
  const revisions = groupByRevision(records);
  
  // V6.3: Sort revisions (assumes lexicographic ordering)
  const sortedRevs = Object.keys(revisions).sort();
  
  if (sortedRevs.length < 2) {
    console.log('🧠 V6.3 MATERIAL DELTA - Insufficient revisions', {
      partNumber,
      revisionCount: sortedRevs.length
    });
    return null;
  }
  
  // V6.3: Select previous and current revisions
  const previousRev = sortedRevs[sortedRevs.length - 2];
  const currentRev = sortedRevs[sortedRevs.length - 1];
  
  const previousRecords = revisions[previousRev];
  const currentRecords = revisions[currentRev];
  
  // V6.3: Compute insights for both revisions
  const prevInsights = computeSKUInsights(previousRecords);
  const currInsights = computeSKUInsights(currentRecords);
  
  // V6.3: Calculate deltas
  const materialDelta: MaterialDelta = {
    partNumber,
    fromRevision: previousRev,
    toRevision: currentRev,
    wireLengthDelta: currInsights.totalWireLength - prevInsights.totalWireLength,
    copperDelta: currInsights.estimatedCopperWeight - prevInsights.estimatedCopperWeight,
    wireCountDelta: currInsights.wireCount - prevInsights.wireCount,
    gaugeDelta: diffDistribution(
      currInsights.gaugeBreakdown,
      prevInsights.gaugeBreakdown
    ),
    colorDelta: diffDistribution(
      currInsights.colorBreakdown,
      prevInsights.colorBreakdown
    )
  };
  
  // V6.3: Log material delta
  console.log('🧠 V6.3 MATERIAL DELTA', {
    partNumber,
    fromRevision: previousRev,
    toRevision: currentRev,
    wireLengthDelta: Number(materialDelta.wireLengthDelta.toFixed(2)),
    copperDelta: Number(materialDelta.copperDelta.toFixed(4)),
    wireCountDelta: materialDelta.wireCountDelta,
    gaugeDelta: Object.fromEntries(
      Object.entries(materialDelta.gaugeDelta).map(([k, v]) => [k, Number(v.toFixed(2))])
    ),
    colorDelta: Object.fromEntries(
      Object.entries(materialDelta.colorDelta).map(([k, v]) => [k, Number(v.toFixed(2))])
    )
  });
  
  return materialDelta;
}

// ============================================================
// BOM ACCESS METHODS
// ============================================================

/**
 * V6.1.3: Extract family number from part number
 * 
 * Supports both harness (NH) and wire formats.
 * Family number is the middle segment of the part number.
 * 
 * Examples:
 * - NH45-42522-214 → 42522
 * - 45-42522-214 → 42522
 * - NH02-123456-78 → 123456
 * 
 * @param partNumber Full part number
 * @returns Family number or null if not extractable
 */
function extractFamilyNumber(partNumber: string): string | null {
  if (!partNumber) return null;

  const normalized = partNumber.trim().toUpperCase();

  // NH format: NH##-#####-##
  const nhMatch = normalized.match(/^NH\d{2}-(\d{5,6})-\d+/);
  if (nhMatch) return nhMatch[1];

  // Numeric/wire format: ##-#####-##
  const wireMatch = normalized.match(/^\d{2}-(\d{5,6})-/);
  if (wireMatch) return wireMatch[1];

  return null;
}

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
  family: string | null;
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
  
  // V6.1.3: Enrich with family data
  const enriched = summaries.map(bom => ({
    ...bom,
    family: extractFamilyNumber(bom.partNumber)
  }));
  
  console.log('🧠 V6.1.3 BOM RETRIEVAL', {
    totalBOMs: enriched.length,
    uniqueFamilies: new Set(enriched.map(b => b.family).filter(Boolean)).size,
    timestamp: new Date().toISOString()
  });
  
  return enriched;
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
  // V6.0.6: CRITICAL - Validate part number at storage entry point
  // This is the final defense against part number degradation
  if (!partNumber || !partNumber.includes('-')) {
    console.error('🚨 V6.0.6 CRITICAL: Invalid part number passed to storeBOM', {
      partNumber,
      recordCount: records.length,
      expectedFormat: 'NH##-#####-##'
    });
    throw new Error(`CRITICAL: Invalid part number passed to storeBOM: "${partNumber}" (expected format with hyphens)`);
  }
  
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
  
  // V6.7.1: Pre-insert validation log
  console.log('💾 V6.7.1 ABOUT TO INSERT TO DB', {
    partNumber,
    recordCount: cleanedRecords.length,
    firstRecordFields: cleanedRecords[0] ? Object.keys(cleanedRecords[0]) : [],
    sampleRecord: cleanedRecords[0] ? {
      parent_part_number: cleanedRecords[0].parent_part_number,
      component_part_number: cleanedRecords[0].component_part_number,
      revision: cleanedRecords[0].revision,
      is_active: cleanedRecords[0].is_active
    } : null
  });
  
  // Bulk insert into database
  let insertResult;
  
  try {
    insertResult = await supabase
      .from('bom_records')
      .insert(cleanedRecords)
      .select();
    
    console.log('✅ V6.7.1 INSERT RESULT', {
      hasData: !!insertResult.data,
      hasError: !!insertResult.error,
      dataCount: insertResult.data?.length,
      status: insertResult.status,
      statusText: insertResult.statusText
    });
  } catch (catchError) {
    console.error('❌ V6.7.1 INSERT FAILED (CATCH)', {
      partNumber,
      error: catchError,
      errorType: typeof catchError,
      errorMessage: catchError instanceof Error ? catchError.message : 'Unknown'
    });
    throw catchError;
  }
  
  if (insertResult.error) {
    console.error('❌ V6.7.1 INSERT ERROR (SUPABASE)', {
      partNumber,
      error: insertResult.error,
      code: insertResult.error.code,
      message: insertResult.error.message,
      details: insertResult.error.details,
      hint: insertResult.error.hint,
      failedPayloadSample: cleanedRecords[0]
    });
    throw new Error(`Failed to store BOM records for ${partNumber}: ${insertResult.error.message}`);
  }
  
  const insertedCount = insertResult.data?.length || 0;
  
  console.log('✅ V6.7.1 INSERT SUCCESS', {
    partNumber,
    recordsInserted: insertedCount,
    expectedCount: cleanedRecords.length,
    match: insertedCount === cleanedRecords.length
  });
  
  if (insertedCount === 0) {
    console.error('⚠️ V6.7.1 WARNING: Zero records inserted', {
      partNumber,
      expectedCount: cleanedRecords.length
    });
  }
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
