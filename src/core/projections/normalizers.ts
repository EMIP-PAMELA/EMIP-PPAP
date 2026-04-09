/**
 * V5.3 EMIP Core - Projection Normalizers
 * 
 * FOUNDATION LAYER - Data Normalization for Projections
 * 
 * Responsibilities:
 * - Normalize wire gauge values
 * - Normalize wire colors
 * - Normalize length units
 * - Extract structured data from BOM descriptions
 * 
 * Architecture:
 * - Pure functions (no database access)
 * - Used by projectionService
 * - Derives from canonical BOM data
 */

// ============================================================
// WIRE GAUGE NORMALIZATION
// ============================================================

/**
 * Normalize wire gauge to standard format
 * 
 * Handles:
 * - "18 AWG" → "18"
 * - "20GA" → "20"
 * - "22 gauge" → "22"
 * - Extracts from descriptions
 * 
 * @param input Raw gauge string or description
 * @returns Normalized gauge string or null
 */
export function normalizeWireGauge(input: string | null | undefined): string | null {
  if (!input) return null;
  
  const cleaned = input.toUpperCase().trim();
  
  // Pattern 1: Direct gauge number with AWG/GA/GAUGE
  const gaugeMatch = cleaned.match(/(\d{1,2})\s*(?:AWG|GA|GAUGE|G)/i);
  if (gaugeMatch) {
    return gaugeMatch[1];
  }
  
  // Pattern 2: Standalone number in wire context
  if (cleaned.includes('WIRE') || cleaned.includes('CABLE')) {
    const numberMatch = cleaned.match(/\b(\d{1,2})\b/);
    if (numberMatch) {
      const num = parseInt(numberMatch[1], 10);
      // Valid wire gauge range: 8-30 typically
      if (num >= 8 && num <= 30) {
        return numberMatch[1];
      }
    }
  }
  
  return null;
}

// ============================================================
// WIRE COLOR NORMALIZATION
// ============================================================

const COLOR_MAP: Record<string, string> = {
  'BLK': 'black',
  'BLU': 'blue',
  'BRN': 'brown',
  'GRN': 'green',
  'GRY': 'gray',
  'ORG': 'orange',
  'PNK': 'pink',
  'PUR': 'purple',
  'RED': 'red',
  'WHT': 'white',
  'YEL': 'yellow',
  'YLW': 'yellow',
  'YL': 'yellow',   // Phase 3H.14.1: Short code mapping
  'GLD': 'gold',
  'SLV': 'silver',
  'TAN': 'tan',
  'VIO': 'violet',
  'VI': 'violet'    // Phase 3H.14.1: Short code mapping
};

/**
 * Normalize wire color to standard lowercase format
 * 
 * Handles:
 * - "BLK" → "black"
 * - "Red" → "red"
 * - "BLU/WHT" → "blue/white"
 * 
 * @param input Raw color string
 * @returns Normalized color string or null
 */
export function normalizeWireColor(input: string | null | undefined): string | null {
  if (!input) return null;
  
  const cleaned = input.toUpperCase().trim();
  
  // Check for mapped abbreviations
  if (COLOR_MAP[cleaned]) {
    return COLOR_MAP[cleaned];
  }
  
  // Check for compound colors (e.g., "BLK/WHT")
  if (cleaned.includes('/')) {
    const parts = cleaned.split('/').map(part => {
      const trimmed = part.trim();
      return COLOR_MAP[trimmed] || trimmed.toLowerCase();
    });
    return parts.join('/');
  }
  
  // Check for known color names in input
  const lowerInput = cleaned.toLowerCase();
  for (const [abbrev, fullColor] of Object.entries(COLOR_MAP)) {
    if (lowerInput.includes(fullColor)) {
      return fullColor;
    }
  }
  
  // Return as lowercase if not found in map
  return cleaned.toLowerCase();
}

// ============================================================
// LENGTH UNIT NORMALIZATION
// ============================================================

/**
 * Normalize length to feet
 * 
 * Handles:
 * - inches → feet
 * - meters → feet
 * - centimeters → feet
 * 
 * @param value Length value
 * @param unit Unit string
 * @returns Length in feet
 */
export function normalizeLengthToFeet(
  value: number,
  unit: string | null | undefined
): number {
  if (!unit) return value; // Assume feet if no unit
  
  const normalizedUnit = unit.toLowerCase().trim();
  
  // Convert to feet
  switch (normalizedUnit) {
    case 'in':
    case 'inch':
    case 'inches':
      return value / 12;
    
    case 'm':
    case 'meter':
    case 'meters':
      return value * 3.28084;
    
    case 'cm':
    case 'centimeter':
    case 'centimeters':
      return value * 0.0328084;
    
    case 'mm':
    case 'millimeter':
    case 'millimeters':
      return value * 0.00328084;
    
    case 'ft':
    case 'foot':
    case 'feet':
    default:
      return value;
  }
}

/**
 * Parse length from description string
 * 
 * Handles:
 * - "3.2 FT" → { value: 3.2, unit: "ft" }
 * - "18 IN" → { value: 18, unit: "in" }
 * 
 * @param description Description string
 * @returns Parsed length or null
 */
export function parseLengthFromDescription(
  description: string | null | undefined
): { value: number; unit: string } | null {
  if (!description) return null;
  
  const cleaned = description.toUpperCase().trim();
  
  // Pattern: number followed by unit
  const lengthMatch = cleaned.match(/(\d+\.?\d*)\s*(FT|FEET|IN|INCH|INCHES|M|METER|METERS|CM|MM)/i);
  
  if (lengthMatch) {
    return {
      value: parseFloat(lengthMatch[1]),
      unit: lengthMatch[2].toLowerCase()
    };
  }
  
  return null;
}

// ============================================================
// COMPONENT TYPE DETECTION
// ============================================================

/**
 * Detect if component is a connector
 * 
 * @param partNumber Part number
 * @param description Description
 * @returns true if connector
 */
export function isConnector(
  partNumber: string | null | undefined,
  description: string | null | undefined
): boolean {
  if (!partNumber && !description) return false;
  
  const searchText = `${partNumber || ''} ${description || ''}`.toUpperCase();
  
  const connectorKeywords = [
    'CONNECTOR',
    'PLUG',
    'SOCKET',
    'RECEPTACLE',
    'TERMINAL',
    'HOUSING',
    'PIN',
    'CONTACT'
  ];
  
  return connectorKeywords.some(keyword => searchText.includes(keyword));
}

/**
 * Detect if component is a wire
 * 
 * @param partNumber Part number
 * @param description Description
 * @returns true if wire
 */
export function isWire(
  partNumber: string | null | undefined,
  description: string | null | undefined
): boolean {
  if (!partNumber && !description) return false;
  
  const searchText = `${partNumber || ''} ${description || ''}`.toUpperCase();
  
  const wireKeywords = [
    'WIRE',
    'CABLE',
    'LEAD',
    'AWG',
    'GAUGE'
  ];
  
  return wireKeywords.some(keyword => searchText.includes(keyword));
}

// ============================================================
// COMPONENT CLASSIFICATION (Phase 3H.14.1)
// ============================================================

/**
 * Classify component into structured category
 * 
 * Phase 3H.14.1: Wrapper around existing detection functions
 * Phase 3H.14.2: Enhanced with keyword arrays for improved accuracy
 * Returns structured category string for BOM display
 * 
 * @param partNumber Part number
 * @param description Description
 * @returns Category string: WIRE | CONNECTOR | TERMINAL | HOUSING | SEAL | UNKNOWN
 */
export function classifyComponent(
  partNumber: string | null | undefined,
  description: string | null | undefined
): string {
  if (!partNumber && !description) {
    console.warn('⚠️ UNKNOWN COMPONENT TYPE', {
      partNumber,
      description,
      reason: 'both_null'
    });
    return 'UNKNOWN';
  }
  
  const searchText = `${partNumber || ''} ${description || ''}`.toUpperCase();
  
  // Phase 3H.14.2: Enhanced keyword arrays
  const WIRE_KEYWORDS = ['WIRE', 'CABLE', 'LEAD', 'AWG', 'GAUGE'];
  const CONNECTOR_KEYWORDS = ['CONNECTOR', 'CONN', 'PLUG', 'SOCKET', 'RECEPTACLE'];
  const TERMINAL_KEYWORDS = ['TERMINAL', 'TERM', 'CONTACT'];
  const HOUSING_KEYWORDS = ['HOUSING'];
  const SEAL_KEYWORDS = ['SEAL', 'GROMMET'];
  
  // Check wire first (most common) - use existing function then fallback
  if (isWire(partNumber, description)) {
    return 'WIRE';
  }
  if (WIRE_KEYWORDS.some(keyword => searchText.includes(keyword))) {
    return 'WIRE';
  }
  
  // Check connector - use existing function then fallback
  if (isConnector(partNumber, description)) {
    return 'CONNECTOR';
  }
  if (CONNECTOR_KEYWORDS.some(keyword => searchText.includes(keyword))) {
    return 'CONNECTOR';
  }
  
  // Terminal detection with enhanced keywords
  if (TERMINAL_KEYWORDS.some(keyword => searchText.includes(keyword))) {
    return 'TERMINAL';
  }
  
  // Housing detection
  if (HOUSING_KEYWORDS.some(keyword => searchText.includes(keyword))) {
    return 'HOUSING';
  }
  
  // Seal detection with enhanced keywords
  if (SEAL_KEYWORDS.some(keyword => searchText.includes(keyword))) {
    return 'SEAL';
  }
  
  // Phase 3H.14.2: Log UNKNOWN classifications for debugging
  console.warn('⚠️ UNKNOWN COMPONENT TYPE', {
    partNumber,
    description: description ? description.substring(0, 50) : null
  });
  
  return 'UNKNOWN';
}
