/**
 * V5.4 EMIP Copper Index - Copper Weight Calculator
 * 
 * DOMAIN ENGINE - Core Calculation Logic
 * 
 * Responsibilities:
 * - Calculate copper weight for individual wires
 * - Calculate copper weight for complete SKUs
 * - Handle edge cases (unknown gauge, missing data)
 * - Provide detailed breakdowns
 * 
 * Architecture:
 * - Pure calculation functions (no database access)
 * - Consumes SimplifiedBOM from projection layer
 * - Isolated from core BOM system
 */

import { COPPER_FACTORS } from '../types';
import type { 
  WireCopperBreakdown, 
  CopperCalculationResult 
} from '../types';
import type { SimplifiedBOM, WireProjection } from '@/src/core/projections/projectionService';

// ============================================================
// SINGLE WIRE CALCULATION
// ============================================================

/**
 * Calculate copper weight for a single wire
 * 
 * Formula: weight = length * quantity * copperFactor
 * 
 * @param wire Wire projection data
 * @returns Copper weight in pounds
 */
export function calculateWireCopperWeight(wire: WireProjection): number {
  // Validate gauge
  if (!wire.gauge || !COPPER_FACTORS[wire.gauge]) {
    console.warn('🧠 V5.4 [Copper Calculator] Unknown gauge:', wire.gauge || 'null');
    return 0;
  }

  // Validate length
  if (!wire.length || wire.length <= 0) {
    return 0;
  }

  // Validate quantity
  if (!wire.quantity || wire.quantity <= 0) {
    return 0;
  }

  // Get copper factor for gauge
  const copperFactor = COPPER_FACTORS[wire.gauge];

  // Calculate weight
  const weight = wire.length * wire.quantity * copperFactor;

  return weight;
}

// ============================================================
// SKU-LEVEL CALCULATION
// ============================================================

/**
 * Calculate copper weight for a complete part (SKU)
 * 
 * Processes all wires in the BOM projection and calculates:
 * - Total copper weight
 * - Per-wire breakdown
 * 
 * @param projection Simplified BOM projection from projectionService
 * @returns Copper calculation result with breakdown
 */
export function calculateCopperForPart(
  projection: SimplifiedBOM
): CopperCalculationResult {
  console.log('🧠 V5.4 [Copper Calculator] Calculating copper for part', {
    partNumber: projection.partNumber,
    wireCount: projection.wires.length,
    totalWireLength: projection.summary.totalWireLength,
    // Phase 3H.18: Debug wire details
    firstWire: projection.wires[0] ? {
      partNumber: projection.wires[0].partNumber,
      gauge: projection.wires[0].gauge,
      length: projection.wires[0].length,
      quantity: projection.wires[0].quantity
    } : null
  });

  const wireBreakdown: WireCopperBreakdown[] = [];
  let totalCopperWeight = 0;
  let hasUnknownGauge = false;

  // Process each wire
  for (const wire of projection.wires) {
    // Phase 3H.21: Enforce copper calculation guard
    if (!wire.gauge) {
      console.warn('[COPPER CALCULATION BLOCKED]', {
        part: wire.partNumber,
        reason: 'Gauge not detected'
      });
      hasUnknownGauge = true;
      
      // Add to breakdown with null weight for unknown gauge
      wireBreakdown.push({
        gauge: 'UNKNOWN',
        color: wire.color,
        partNumber: wire.partNumber,
        totalLength: wire.length,
        quantity: wire.quantity,
        weight: null  // Phase 3H.21.1: null (not 0) for unknown gauge
      });
      continue;
    }
    
    const weight = calculateWireCopperWeight(wire);

    // Add to breakdown
    wireBreakdown.push({
      gauge: wire.gauge,
      color: wire.color,
      partNumber: wire.partNumber,
      totalLength: wire.length,
      quantity: wire.quantity,
      weight
    });

    totalCopperWeight += weight;
  }
  
  // Phase 3H.21.1: Determine completeness and final totals
  const isComplete = !hasUnknownGauge;
  
  // Phase 3H.21.1: If incomplete, return null for totals (not underestimated values)
  const finalCopperWeight = isComplete ? totalCopperWeight : null;
  
  // Phase 3H.21.1: Log completeness state
  console.log('[COPPER COMPLETENESS]', {
    partNumber: projection.partNumber,
    isComplete,
    hasUnknownGauge,
    totalCopperWeight: isComplete ? totalCopperWeight : null
  });
  
  // Phase 3H.21: If any wire has unknown gauge, mark copper weight as potentially incomplete
  if (hasUnknownGauge) {
    console.warn('[COPPER CALCULATION INCOMPLETE]', {
      partNumber: projection.partNumber,
      note: 'Some wires lack gauge detection — copper weight set to null'
    });
  }

  const result: CopperCalculationResult = {
    partNumber: projection.partNumber,
    revision: projection.revision,
    totalCopperWeight: finalCopperWeight,  // Phase 3H.21.1: null if incomplete
    wireBreakdown,
    calculatedAt: new Date().toISOString(),
    isComplete  // Phase 3H.21.1: Completeness flag
  };

  console.log('🧠 V5.4 COPPER CALCULATION', {
    partNumber: projection.partNumber,
    totalCopperWeight: finalCopperWeight,
    wireCount: wireBreakdown.length,
    timestamp: result.calculatedAt
  });

  return result;
}

// ============================================================
// EDGE CASE HANDLING
// ============================================================

/**
 * Validate wire data for copper calculation
 * 
 * @param wire Wire projection data
 * @returns true if wire has valid data for calculation
 */
export function isValidWireForCalculation(wire: WireProjection): boolean {
  // Check gauge
  if (!wire.gauge || !COPPER_FACTORS[wire.gauge]) {
    return false;
  }

  // Check length
  if (!wire.length || wire.length <= 0) {
    return false;
  }

  // Check quantity
  if (!wire.quantity || wire.quantity <= 0) {
    return false;
  }

  return true;
}

/**
 * Get list of supported wire gauges
 * 
 * @returns Array of supported gauge values
 */
export function getSupportedGauges(): string[] {
  return Object.keys(COPPER_FACTORS).sort((a, b) => {
    return parseInt(a) - parseInt(b);
  });
}

/**
 * Get copper factor for a specific gauge
 * 
 * @param gauge Wire gauge
 * @returns Copper factor (lbs/ft) or null if unknown
 */
export function getCopperFactor(gauge: string): number | null {
  return COPPER_FACTORS[gauge] || null;
}
