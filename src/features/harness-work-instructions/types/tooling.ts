/**
 * Tooling Types — Phase T19
 *
 * First-class types for the applicator / tooling system.
 *
 * Governance:
 *   - Pure value types. No logic, no I/O.
 *   - All nullable fields use null (never undefined) for JSON safety.
 *   - Location values are the canonical three-plant codes.
 *   - Resolution method and confidence are always explicit — never assumed.
 */

// ---------------------------------------------------------------------------
// Applicator
// ---------------------------------------------------------------------------

/** Canonical plant location codes. */
export type ApplicatorLocation = 'FT_SMITH' | 'BALL_GROUND' | 'WARNER_ROBBINS';

/** Operational status of a physical applicator unit. */
export type ApplicatorStatus = 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';

/**
 * A single physical applicator unit in the tooling inventory.
 * One applicator entry per (model × serialNumber × location) tuple.
 *
 * T19 scope: availability only. Wear, lifecycle, and cost are out of scope.
 */
export interface Applicator {
  /** Manufacturer part number / model identifier (e.g. "2150007-1"). */
  applicatorModel: string;

  /**
   * Applicator Component Identifier. Links this applicator to the ACI lookup
   * table. Null when the applicator record pre-dates ACI assignment.
   */
  aci: string | null;

  /**
   * Terminal part numbers this applicator can process.
   * Always an array; empty when no terminal mapping is recorded.
   */
  terminalPartNumbers: string[];

  manufacturer: string | null;
  serialNumber: string | null;

  /** Plant location. Null for applicators with no assigned location. */
  location: ApplicatorLocation | null;

  status: ApplicatorStatus;

  /** Physical quantity of this applicator at this location. Default 1. */
  quantity: number;

  notes: string | null;
}

// ---------------------------------------------------------------------------
// Tooling resolution
// ---------------------------------------------------------------------------

/**
 * How an applicator was matched to a part number.
 *
 * ACI    — resolved via ACI lookup (part → ACI → applicator).  HIGH confidence.
 * DIRECT — resolved by matching part number directly in applicator records.  MEDIUM confidence.
 * NONE   — no match found.
 */
export type ToolingResolutionMethod = 'ACI' | 'DIRECT' | 'NONE';

/**
 * Confidence level derived from the resolution method.
 *
 * HIGH   — ACI path: part number → canonical ACI → applicator
 * MEDIUM — direct path: part number found in applicator terminal list
 * NONE   — no applicator found
 */
export type ToolingConfidence = 'HIGH' | 'MEDIUM' | 'NONE';

/**
 * The full result of a tooling resolution for a single part number.
 * Returned by `resolveToolingForPart()` in toolingService.ts.
 */
export interface ToolingResolution {
  /** All ACTIVE applicators found for this part number. */
  applicators: Applicator[];
  method:      ToolingResolutionMethod;
  confidence:  ToolingConfidence;
  /**
   * Unique set of plant locations where tooling is available.
   * Empty when method is NONE.
   */
  locations: ApplicatorLocation[];
}
