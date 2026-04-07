/**
 * Copper Index - Type Definitions
 * 
 * V5.0: Scaffolded only - not yet implemented
 * 
 * These types will be used when copper index calculation is implemented.
 */

/**
 * Copper price data point
 */
export interface CopperPrice {
  date: string;
  pricePerPound: number;
  currency: 'USD' | 'EUR' | 'GBP';
  source: string;
}

/**
 * Wire cost breakdown
 */
export interface WireCostBreakdown {
  partNumber: string;
  gauge: string;
  lengthFeet: number;
  quantity: number;
  copperWeightPounds: number;
  estimatedCost: number;
}

/**
 * Copper index report
 */
export interface CopperIndexReport {
  partNumber: string;
  totalWireLength: number;
  totalCopperWeight: number;
  estimatedCopperCost: number;
  priceDate: string;
  copperPricePerPound: number;
  breakdown: WireCostBreakdown[];
}

/**
 * Historical cost trend
 */
export interface CostTrend {
  partNumber: string;
  dataPoints: Array<{
    date: string;
    estimatedCost: number;
    copperPrice: number;
  }>;
}
