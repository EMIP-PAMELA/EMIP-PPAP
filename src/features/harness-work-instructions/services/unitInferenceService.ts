/**
 * Unit Inference Service — Phase T11.4
 *
 * Domain authority: ALL drawing-derived wire lengths are in inches.
 *
 * T11.4 Global Drawing Rule:
 *   All wire lengths extracted from Apogee/Rheem drawings are authoritative
 *   in inches. No heuristic or mm fallback applies to drawing workflows.
 *
 * @see T11.3 for the original heuristic implementation history.
 */

export type LengthUnit = 'in' | 'mm';

export type UnitInferenceReason =
  | 'GLOBAL_DRAWING_RULE'
  /** @deprecated T11.3 legacy — superseded by GLOBAL_DRAWING_RULE */
  | 'INTERNAL_DRAWING'
  /** @deprecated T11.3 legacy — superseded by GLOBAL_DRAWING_RULE */
  | 'HEURISTIC_SMALL_INTEGER'
  /** @deprecated T11.3 legacy — superseded by GLOBAL_DRAWING_RULE */
  | 'DEFAULT_MM';

export interface UnitInferenceArgs {
  /** @deprecated ignored — global rule always returns 'in' */
  extractedText?: string | null;
  /** @deprecated ignored — global rule always returns 'in' */
  isLikelyInternal?: boolean;
  /** @deprecated ignored — global rule always returns 'in' */
  wireSamples?: Array<{ length: number | null; gauge: string | null }>;
}

export interface UnitInferenceResult {
  unit: LengthUnit;
  reason: UnitInferenceReason;
}

/**
 * Resolve the authoritative length unit for a drawing-derived wire.
 *
 * T11.4: Always returns 'in' with reason 'GLOBAL_DRAWING_RULE'.
 * All Apogee/Rheem drawing measurements are in inches by domain authority.
 *
 * @param _args - Accepted for backward compatibility; all fields are ignored.
 */
export function inferLengthUnit(_args: UnitInferenceArgs = {}): UnitInferenceResult {
  const result: UnitInferenceResult = { unit: 'in', reason: 'GLOBAL_DRAWING_RULE' };
  console.log('[T11.4 UNIT]', result);
  return result;
}

/**
 * Convenience shorthand returning the authoritative unit directly.
 * Use this when only the unit string is needed.
 */
export function resolveDrawingLengthUnit(): 'in' {
  return 'in';
}
