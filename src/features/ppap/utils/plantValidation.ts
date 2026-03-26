/**
 * Phase 3H.9: Plant Validation Guard
 * 
 * Hard validation to prevent invalid plant values from entering the database.
 * Enforces data integrity at write time.
 */

export const VALID_PLANTS = ['Ft. Smith', 'Ball Ground', 'Warner Robins'] as const;

export type ValidPlant = typeof VALID_PLANTS[number];

/**
 * Sanitize plant value before database write
 * 
 * @param value - Plant value to validate
 * @returns Valid plant value or null
 * 
 * Phase 3H.9: BLOCKS invalid plant writes with console error
 */
export function sanitizePlant(value: string | null | undefined): string | null {
  if (!value) return null;
  
  if (!VALID_PLANTS.includes(value as ValidPlant)) {
    console.error('🚨 BLOCKED INVALID PLANT WRITE', {
      attempted: value,
      allowed: VALID_PLANTS,
      stack: new Error().stack
    });
    return null;
  }
  
  return value;
}

/**
 * Validate plant for display (used in dashboard)
 * 
 * @param plant - Plant value to validate
 * @param ppapId - PPAP ID for logging
 * @returns Validated plant or '—'
 * 
 * Phase 3H.8/3H.9: Logs warning but does not block (display-only)
 */
export function validatePlantForDisplay(plant: string | null | undefined, ppapId: string): string {
  if (!plant) return '—';
  
  if (!VALID_PLANTS.includes(plant as ValidPlant)) {
    console.warn('⚠️ INVALID PLANT VALUE IN DATABASE', { ppapId, plant, validPlants: VALID_PLANTS });
    return plant; // Show invalid value but log warning
  }
  
  return plant;
}

/**
 * Check if value is a valid plant
 */
export function isValidPlant(value: unknown): value is ValidPlant {
  return typeof value === 'string' && VALID_PLANTS.includes(value as ValidPlant);
}
