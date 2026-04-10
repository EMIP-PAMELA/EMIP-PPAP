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

// Phase 3H.15.7: Complete color abbreviation mapping
const COLOR_MAP: Record<string, string> = {
  // Black variants
  'BLK': 'black',
  'BK': 'black',
  'BLACK': 'black',
  
  // Blue variants
  'BLU': 'blue',
  'BL': 'blue',
  'BLUE': 'blue',
  
  // Brown variants
  'BRN': 'brown',
  'BR': 'brown',
  'BROWN': 'brown',
  
  // Green variants
  'GRN': 'green',
  'GR': 'green',
  'GREEN': 'green',
  
  // Gray variants
  'GRY': 'gray',
  'GRA': 'gray',
  'GRAY': 'gray',
  'GREY': 'grey',
  
  // Orange variants
  'ORG': 'orange',
  'OR': 'orange',
  'ORANGE': 'orange',
  
  // Pink variants
  'PNK': 'pink',
  'PINK': 'pink',
  
  // Purple variants
  'PUR': 'purple',
  'PURPLE': 'purple',
  
  // Red variants
  'RED': 'red',
  'RD': 'red',
  
  // White variants
  'WHT': 'white',
  'WH': 'white',
  'WHITE': 'white',
  
  // Yellow variants
  'YEL': 'yellow',
  'YLW': 'yellow',
  'YL': 'yellow',
  'YE': 'yellow',
  'YELLOW': 'yellow',
  
  // Violet variants
  'VIO': 'violet',
  'VI': 'violet',
  'VIOLET': 'violet',
  
  // Metallic variants
  'GLD': 'gold',
  'GOLD': 'gold',
  'SLV': 'silver',
  'SILVER': 'silver',
  'TAN': 'tan'
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
  
  // Phase 3H.15.7: Handle compound colors (e.g., "BLK/WHT" or "WH/BK")
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
  
  // Phase 3H.15.7: Safe fallback - return lowercase if not found
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
 * Phase 3H.17.3: Added HARDWARE, LABEL, SLEEVING categories with precision rules
 * Phase 3H.17.5: SEMANTIC PRIORITY SYSTEM - specific categories take precedence over generic WIRE
 * Returns structured category string for BOM display
 * 
 * @param partNumber Part number
 * @param description Description
 * @returns Category string: WIRE | CONNECTOR | TERMINAL | SEAL | HARDWARE | LABEL | SLEEVING | UNKNOWN
 * 
 * Phase 3H.17.5: SEMANTIC PRIORITY TEST CASES (specific > generic):
 * Priority Order: LABEL → SLEEVING → HARDWARE → CONNECTOR → TERMINAL → SEAL → WIRE → UNKNOWN
 * 
 * - "W18GR1015" (part number) → WIRE (W\d+ pattern - highest confidence)
 * - "SVH-21T-P1.1" (part number) → TERMINAL (SVH pattern)
 * - "VHR-5N" (part number) → CONNECTOR (VHR pattern)
 * - "Wire Label Sticker" (description) → LABEL (PRIORITY: label > wire)
 * - "Heat Shrink Sleeve" (description) → SLEEVING (PRIORITY: sleeve > wire)
 * - "Cable Tie Clip" (description) → HARDWARE (PRIORITY: clip > wire)
 * - "Connector Housing" (description) → CONNECTOR (connector keyword)
 * - "Terminal Contact" (description) → TERMINAL (terminal keyword)
 * - "Pin Contact Housing" (description) → CONNECTOR (housing excludes terminal)
 * - "Cavities Plug Housing" (description) → CONNECTOR (plug + housing)
 * - "18AWG Wire" (description) → WIRE (gauge pattern - constrained fallback)
 * - "Unknown Part" (description) → UNKNOWN (no matches)
 */
export function classifyComponent(
  partNumber: string | null | undefined,
  description: string | null | undefined
): string {
  if (!partNumber && !description) {
    return 'UNKNOWN';
  }
  
  // Phase 3H.17.5: Normalize input once for consistent matching
  const pnUpper = (partNumber || '').toUpperCase().trim();
  const descLower = (description || '').toLowerCase().trim().replace(/\s+/g, ' ');
  const searchText = `${partNumber || ''} ${description || ''}`.toUpperCase();
  
  // Phase 3H.17.5: SEMANTIC PRIORITY SYSTEM
  // Classification Priority (Phase 3H.17.5 - Semantic Priority Model):
  // 1. WIRE (part number pattern - highest confidence)
  // 2. LABEL
  // 3. SLEEVING
  // 4. HARDWARE
  // 5. CONNECTOR
  // 6. TERMINAL
  // 7. SEAL
  // 8. WIRE (keyword-based constrained fallback)
  // 9. UNKNOWN
  //
  // NOTE:
  // - Specific component types override generic material descriptions
  // - WIRE keyword matching is intentionally last to prevent false positives
  // - Part number patterns (W\d+) take precedence as they are highest confidence
  
  // A. WIRE (part number pattern only - highest confidence)
  // Wire detection: starts with W followed by digits (e.g., W18GR1015)
  // This pattern is highly specific and takes precedence
  if (pnUpper.match(/^W\d+/)) {
    return 'WIRE';
  }
  
  // B. LABEL (Priority 1 - specific component type)
  // Guard: If description contains both "wire" and label keywords, classify as LABEL
  // Example: "Wire Label Sticker" → LABEL (not WIRE)
  if (
    descLower.includes('label') ||
    descLower.includes('sticker') ||
    descLower.includes('tag')
  ) {
    return 'LABEL';
  }
  
  // C. SLEEVING (Priority 2 - specific component type)
  // Guard: "Heat Shrink Sleeve" → SLEEVING (not WIRE)
  if (
    descLower.includes('sleeve') ||
    descLower.includes('heat shrink') ||
    descLower.includes('shrink')
  ) {
    return 'SLEEVING';
  }
  
  // D. HARDWARE (Priority 3 - specific component type)
  // Examples: "Cable Tie Clip", "Mounting Screw"
  if (
    descLower.includes('clip') ||
    descLower.includes('tie') ||
    descLower.includes('screw') ||
    descLower.includes('bolt') ||
    descLower.includes('fastener')
  ) {
    return 'HARDWARE';
  }
  
  // E. CONNECTOR (Priority 4 - connector-specific detection)
  // Part number patterns OR description keywords
  // Assembly keyword removed - too broad, causes misclassification
  if (
    pnUpper.includes('JST') ||
    pnUpper.includes('VHR') ||
    descLower.includes('connector') ||
    descLower.includes('housing') ||
    descLower.includes('receptacle') ||
    descLower.includes('plug') ||
    descLower.includes('header')
  ) {
    return 'CONNECTOR';
  }
  
  // F. TERMINAL (Priority 5 - with false positive protection)
  // Only classify as terminal if explicitly terminal OR pin/contact without housing
  // Guard: "Pin Contact Housing" → CONNECTOR (not TERMINAL because of housing)
  if (
    pnUpper.includes('T-') ||
    pnUpper.includes('TERM') ||
    pnUpper.includes('SVH') ||
    pnUpper.includes('SPH') ||
    descLower.includes('terminal') ||
    (
      (descLower.includes('pin') || descLower.includes('contact') || descLower.includes('crimp')) &&
      !descLower.includes('housing')
    ) ||
    descLower.includes('socket') ||
    descLower.includes('blade')
  ) {
    return 'TERMINAL';
  }
  
  // G. SEAL (Priority 6)
  if (
    descLower.includes('seal') ||
    descLower.includes('grommet')
  ) {
    return 'SEAL';
  }
  
  // H. WIRE (Priority 7 - CONSTRAINED FALLBACK)
  // Only classify as WIRE if no higher-priority category matched
  // AND description/part number strongly indicates actual wire
  // Wire-specific patterns: gauge numbers (e.g., 18AWG, 20GA), insulation types
  const hasGaugePattern = /\d+\s*(AWG|GA|GAUGE)/i.test(searchText);
  const hasWireKeyword = /\b(WIRE|CABLE|LEAD)\b/i.test(searchText);
  
  if (hasGaugePattern || hasWireKeyword) {
    return 'WIRE';
  }
  
  // I. LEGACY FALLBACK (lowest priority)
  // Only check legacy keywords for categories not yet matched
  const CONNECTOR_KEYWORDS = ['CONNECTOR', 'CONN', 'PLUG', 'SOCKET', 'RECEPTACLE', 'HOUSING'];
  const TERMINAL_KEYWORDS = ['TERMINAL', 'TERM', 'CONTACT'];
  const SEAL_KEYWORDS = ['SEAL', 'GROMMET'];
  
  if (isConnector(partNumber, description) || CONNECTOR_KEYWORDS.some(k => searchText.includes(k))) {
    return 'CONNECTOR';
  }
  
  if (TERMINAL_KEYWORDS.some(k => searchText.includes(k))) {
    return 'TERMINAL';
  }
  
  if (SEAL_KEYWORDS.some(k => searchText.includes(k))) {
    return 'SEAL';
  }
  
  // Phase 3H.17.5: Log UNKNOWN classifications for debugging
  console.warn('⚠️ UNKNOWN COMPONENT TYPE', {
    partNumber,
    description: description ? description.substring(0, 50) : null
  });
  
  return 'UNKNOWN';
}
