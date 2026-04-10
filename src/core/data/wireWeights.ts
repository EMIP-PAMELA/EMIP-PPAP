/**
 * COPPER.1 — Empirical wire weight lookup table (lbs per foot)
 *
 * These factors were captured from production measurements and must take
 * precedence over calculated estimates whenever the gauge exists here.
 */
export interface WireWeightEntry {
  copper: number;
  gross: number;
}

export const WIRE_WEIGHT_TABLE: Record<number, WireWeightEntry> = Object.freeze({
  22: { copper: 0.0022, gross: 0.0056 },
  18: { copper: 0.0050, gross: 0.0094 },
  16: { copper: 0.0078, gross: 0.0130 },
  14: { copper: 0.0126, gross: 0.0236 },
  12: { copper: 0.0190, gross: 0.0274 },
  10: { copper: 0.0320, gross: 0.0410 },
   8: { copper: 0.0500, gross: 0.0692 },
   6: { copper: 0.0790, gross: 0.1164 },
});
