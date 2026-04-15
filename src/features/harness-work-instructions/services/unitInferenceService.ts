/**
 * Unit Inference Service — Phase T11.3
 *
 * Provides deterministic length unit inference for harness drawings.
 *
 * Rules (priority order):
 *   1. Internal Apogee/Rheem drawings → inches.
 *   2. Heuristic fallback: majority of lengths are small whole numbers with AWG gauges.
 *   3. Final fallback → millimeters.
 */

export type LengthUnit = 'in' | 'mm';
export type UnitInferenceReason =
  | 'INTERNAL_DRAWING'
  | 'HEURISTIC_SMALL_INTEGER'
  | 'DEFAULT_MM';

export interface UnitInferenceArgs {
  extractedText?: string | null;
  isLikelyInternal?: boolean;
  wireSamples?: Array<{ length: number | null; gauge: string | null }>;
}

export interface UnitInferenceResult {
  unit: LengthUnit;
  reason: UnitInferenceReason;
}

const INTERNAL_DRAWING_PATTERN = /\b527-\d{4}-010\b/i;

const SMALL_INT_MIN = 2;
const SMALL_INT_MAX = 30;
const SMALL_INT_TOLERANCE = 0.05;
const GAUGE_MIN = 16;
const GAUGE_MAX = 22;

export function inferLengthUnit(args: UnitInferenceArgs = {}): UnitInferenceResult {
  const text = args.extractedText ?? '';
  const isInternal = Boolean(args.isLikelyInternal) || INTERNAL_DRAWING_PATTERN.test(text);

  let result: UnitInferenceResult;
  if (isInternal) {
    result = { unit: 'in', reason: 'INTERNAL_DRAWING' };
  } else {
    const samples = args.wireSamples ?? [];
    const qualifyingSamples = samples.filter(sample =>
      isSmallInteger(sample.length) && hasGaugeInRange(sample.gauge)
    );

    const ratio = samples.length > 0 ? qualifyingSamples.length / samples.length : 0;
    if (qualifyingSamples.length >= 3 && ratio >= 0.5) {
      result = { unit: 'in', reason: 'HEURISTIC_SMALL_INTEGER' };
    } else {
      result = { unit: 'mm', reason: 'DEFAULT_MM' };
    }
  }

  console.log('[T11.3 UNIT]', {
    unit: result.unit,
    reason: result.reason,
    sampleCount: args.wireSamples?.length ?? 0,
    isLikelyInternal: Boolean(args.isLikelyInternal),
  });

  return result;
}

function isSmallInteger(length: number | null): boolean {
  if (length === null || Number.isNaN(length)) return false;
  if (length < SMALL_INT_MIN || length > SMALL_INT_MAX) return false;
  return Math.abs(length - Math.round(length)) <= SMALL_INT_TOLERANCE;
}

function hasGaugeInRange(gauge: string | null): boolean {
  if (!gauge) return false;
  const value = parseInt(gauge, 10);
  if (Number.isNaN(value)) return false;
  return value >= GAUGE_MIN && value <= GAUGE_MAX;
}
