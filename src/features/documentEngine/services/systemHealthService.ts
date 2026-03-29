/**
 * Phase 42: System Health Scoring and Risk Aggregation
 * 
 * Deterministic health scoring model that aggregates individual risks
 * into a single system-level health assessment.
 * 
 * All scoring is transparent and explainable - no AI/probabilistic models.
 */

import { RiskItem, RiskSeverity } from './riskAnalysisService';

/**
 * System health status levels
 */
export type HealthStatus = 'healthy' | 'warning' | 'at_risk';

/**
 * System health assessment
 */
export interface SystemHealth {
  score: number;              // 0-100 health score
  status: HealthStatus;       // Overall health status
  drivers: string[];          // Top risk contributors (human-readable)
  riskBreakdown: {            // Detailed breakdown
    high: number;
    medium: number;
    low: number;
  };
}

/**
 * Health scoring thresholds
 */
const HEALTH_THRESHOLDS = {
  HEALTHY: 85,      // Score >= 85 is healthy
  WARNING: 60,      // Score 60-84 is warning
  // Score < 60 is at_risk
};

/**
 * Risk penalty values (subtracted from base score of 100)
 */
const RISK_PENALTIES = {
  high: 20,         // High severity: -20 points each
  medium: 10,       // Medium severity: -10 points each
  low: 5,           // Low severity: -5 points each
};

/**
 * Calculate system health from risk analysis
 */
export function calculateSystemHealth(risks: RiskItem[]): SystemHealth {
  // Start from perfect score
  let score = 100;

  // Count risks by severity
  const riskBreakdown = {
    high: 0,
    medium: 0,
    low: 0
  };

  // Apply penalties for each risk
  for (const risk of risks) {
    const penalty = RISK_PENALTIES[risk.severity];
    score -= penalty;
    riskBreakdown[risk.severity]++;
  }

  // Clamp score to 0 minimum
  score = Math.max(0, score);

  // Determine status based on score
  const status = determineHealthStatus(score);

  // Identify top drivers
  const drivers = identifyHealthDrivers(risks, riskBreakdown);

  return {
    score,
    status,
    drivers,
    riskBreakdown
  };
}

/**
 * Determine health status from score
 */
function determineHealthStatus(score: number): HealthStatus {
  if (score >= HEALTH_THRESHOLDS.HEALTHY) {
    return 'healthy';
  } else if (score >= HEALTH_THRESHOLDS.WARNING) {
    return 'warning';
  } else {
    return 'at_risk';
  }
}

/**
 * Identify top contributors to health status
 */
function identifyHealthDrivers(risks: RiskItem[], breakdown: { high: number; medium: number; low: number }): string[] {
  const drivers: string[] = [];

  // Add high-severity risk summary
  if (breakdown.high > 0) {
    if (breakdown.high === 1) {
      drivers.push('1 high-severity risk detected');
    } else {
      drivers.push(`${breakdown.high} high-severity risks detected`);
    }
  }

  // Add medium-severity risk summary
  if (breakdown.medium > 0) {
    if (breakdown.medium === 1) {
      drivers.push('1 medium-severity risk detected');
    } else {
      drivers.push(`${breakdown.medium} medium-severity risks detected`);
    }
  }

  // Identify most common risk types
  const typeCounts: Record<string, number> = {};
  for (const risk of risks) {
    typeCounts[risk.type] = (typeCounts[risk.type] || 0) + 1;
  }

  // Sort by frequency
  const sortedTypes = Object.entries(typeCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2); // Top 2 types

  // Add type-specific drivers
  for (const [type, count] of sortedTypes) {
    const readableType = getReadableRiskType(type);
    if (count > 1) {
      drivers.push(`Multiple ${readableType} issues`);
    }
  }

  // If no risks, add positive driver
  if (risks.length === 0) {
    drivers.push('No risks detected');
  }

  return drivers.slice(0, 3); // Return top 3 drivers
}

/**
 * Convert risk type to human-readable string
 */
function getReadableRiskType(type: string): string {
  const typeMap: Record<string, string> = {
    validation_risk: 'validation',
    mapping_risk: 'mapping',
    process_risk: 'process',
    coverage_risk: 'coverage',
    approval_risk: 'approval'
  };
  return typeMap[type] || type;
}

/**
 * Get health status display information
 */
export function getHealthStatusDisplay(status: HealthStatus): {
  icon: string;
  color: string;
  label: string;
} {
  switch (status) {
    case 'healthy':
      return {
        icon: '🟢',
        color: 'text-green-600',
        label: 'Healthy'
      };
    case 'warning':
      return {
        icon: '🟡',
        color: 'text-yellow-600',
        label: 'Warning'
      };
    case 'at_risk':
      return {
        icon: '🔴',
        color: 'text-red-600',
        label: 'At Risk'
      };
  }
}
