// ⚠️ WARNING: NON-CANONICAL CLASSIFICATION LOGIC
// This classification is local to visual parsing only.
// DO NOT use for BOM classification.
// Canonical classification system:
// src/core/projections/normalizers.ts → classifyComponent

/**
 * Visual Engineering Master Parser v5.0 - "AGNOSTIC SLEDGEHAMMER" Edition
 * Maximum Recall Atomic Parsing for Infor Visual Engineering Reports
 * 
 * ⚠️ MANUFACTURER AGNOSTIC - No hardcoded Trane/Appleton/RHEEM rules
 * Uses "Key-Matching" logic to find links between ANY Engineering Master and ANY Drawing.
 * 
 * PARSING RULEBOOK:
 * - Lines starting with "--" (2 dashes) = Operations/Process Steps
 * - Lines starting with "----" (4 dashes) = Material Components
 * 
 * SLEDGEHAMMER RULES:
 * 1. NO FUZZY LOGIC - If a line starts with dashes, capture the ENTIRE raw line
 * 2. CATCH-ALL REGEX - Search for vendor#, catalog#, and 10-15 digit patterns
 * 3. NOISE-TO-SIGNAL - Store full rawLine as fallback for every component
 * 4. PAGE ACCOUNTABILITY - Log every page, warn on "zero components" pages
 * 5. AGNOSTIC - All extraction uses generic patterns, no manufacturer-specific logic
 * 
 * Format example:
 * --10 WR-CUTGROUP - Wire cut/strip/crimp machine Type:
 * ----770006-3     ACI03442 SOCKET 14-20AWG TIN REEL    9.00 EA
 * ----770005-3     ACI03088 PIN 20-14 AWG UNIV MATE-N-LOK   12.00 FT
 * --50 WR-WIREASSY - general cable assembly work
 * ----770026-1     ACI09817 CAP HSG KIT 4 CKT INLINE UNML   1.00 EA
 */

// ============================================================
// AGNOSTIC CATCH-ALL REGEX PATTERNS FOR MAXIMUM RECALL
// No manufacturer-specific logic - uses generic pattern matching
// ============================================================

// Vendor catalog patterns: VENDOR#PARTNUMBER (e.g., APP#123, MOLEX#456, TE#789)
const VENDOR_CATALOG_PATTERN = /([A-Z0-9]{2,20}#[A-Z0-9-]{1,20})/gi;

// Long numeric SKU patterns: 10-15 digit numeric sequences (works for any manufacturer)
const LONG_SKU_PATTERN = /\b(\d{10,15})\b/g;

// Standard part patterns: Alphanumeric 5-25 chars with dashes (universal)
const STANDARD_PART_PATTERN = /\b([A-Z0-9][A-Z0-9-]{4,25})\b/gi;

// ============================================================
// ACI BRIDGE NUMBER PATTERNS - Enhanced for full component block capture
// Captures: ACI03442, ACI-03442, ACI 03442, AC103442 variants
// ============================================================
const ACI_PATTERN = /(ACI[-\s]?\d{4,6})/gi;
const ACI_BRIDGE_PATTERN = /(AC[I1][-\s]?\d{4,6})/gi; // Also catch OCR errors: AC1 instead of ACI

// ============================================================
// FULL COMPONENT BLOCK DETECTION (---- prefix lines)
// These lines contain the critical ACI bridge numbers
// ============================================================
const COMPONENT_BLOCK_PREFIX = /^-{4,}/; // 4+ dashes = component line
const OPERATION_BLOCK_PREFIX = /^-{2}(?!-)/; // Exactly 2 dashes = operation line

// ============================================================
// DATA STRUCTURES
// ============================================================

export interface ParsedPart {
  partId: string;              // e.g., "770006-3"
  aciCode: string | null;      // e.g., "ACI03442"
  fullDescription: string | null; // Complete description string
  operationStep: string;       // e.g., "10", "20", "50"
  resourceId: string | null;   // e.g., "WR-CUTGROUP"
  sequenceLabel: string;       // e.g., "10 - WR-CUTGROUP"
  stepDescription: string;     // e.g., "Wire cut/strip/crimp machine"
  quantity: number;
  qtyPer: number;              // Quantity per assembly
  unitOfMeasure: string | null; // e.g., "EA", "FT", "IN"
  componentClass: 'Component' | 'Consumable/Wire' | 'Hardware'; // Classification
  isTerminal: boolean;         // True if likely a terminal (Step 10/30, starts with 77)
  isHardware: boolean;         // True if hardware/assembly item
  wireLength: number | null;   // For Wire class items: the actual length value
  rawLine: string;             // NOISE-TO-SIGNAL: Full raw line for fallback
  candidateIds: string[];      // All potential IDs found on this line
}

export interface ParsedOperation {
  step: string;                // e.g., "10", "30", "50"
  resourceId: string;          // e.g., "WR-CUTGROUP"
  description: string;         // e.g., "Wire cut/strip/crimp machine"
  sequenceLabel: string;       // e.g., "10 - WR-CUTGROUP"
  components: ParsedPart[];    // Components under this operation
  rawLines: string[];          // All raw lines under this operation
}

export interface ProcessInstruction {
  step: string;
  instruction: string;
}

export interface PageLog {
  pageNumber: number;
  hasText: boolean;
  componentCount: number;
  operationCount: number;
  warning: string | null;
}

export interface VisualMasterData {
  masterPartNumber: string;           // e.g., "NH495337430009"
  parts: ParsedPart[];
  operations: ParsedOperation[];      // Hierarchical operations with components
  steps: Map<string, { resourceId: string; description: string }>;
  processNotes: ProcessInstruction[]; // Setup notes between steps
  rawText: string;                    // Original text for debugging - FULL document
  pageLogs: PageLog[];                // PAGE ACCOUNTABILITY logs
  // Summary counts
  operationCount: number;
  componentCount: number;
}

// Operation step labels
export const STEP_LABELS: Record<string, string> = {
  "10": "Termination/Tooling Zone (Komax)",
  "20": "Strip Prep Zone",
  "30": "Crimp/Terminal Zone",
  "50": "Assembly/Hardware Zone",
  "90": "Label & Bag",
  "95": "Quality Control"
};

// Terminal prefixes (likely need applicators)
const TERMINAL_PREFIXES = ["770", "350", "87"];

// UOM patterns that indicate length-based consumables
const LENGTH_UOM_PATTERNS = /^(FT|FEET|FOOT|IN|INCH|INCHES|M|METER|METERS|CM|MM|YD|YARD|YARDS)$/i;

// UOM patterns that indicate discrete components
const COMPONENT_UOM_PATTERNS = /^(EA|EACH|PC|PCS|PIECE|PIECES|SET|KIT|UNIT|UNITS|LOT)$/i;

// Process instruction patterns to capture
const PROCESS_INSTRUCTION_PATTERNS = [
  /CUT\s*\/?\s*STRIP\s+PER\s+INSTRUCTION/gi,
  /CRIMP\s+PER\s+SPEC/gi,
  /SEAL\s+(?:AND\s+)?ASSEMBLE/gi,
  /APPLY\s+(?:HEAT\s+)?SHRINK/gi,
  /INSTALL\s+(?:CONNECTOR|TERMINAL)/gi,
  /VERIFY\s+CRIMP\s+HEIGHT/gi,
  /LABEL\s+(?:AND\s+)?(?:BAG|PACKAGE)/gi,
  /TORQUE\s+TO\s+\d+(?:\.\d+)?\s*(?:IN-?LB|FT-?LB|NM)/gi,
  /REFER\s+TO\s+DRAWING/gi,
  /NOTE:\s*.+/gi,
  /SETUP:\s*.+/gi,
  /INSTRUCTION:\s*.+/gi
];

/**
 * DASH-INITIATOR DETECTION
 * Count leading dashes (normalized) to determine line type:
 * - 2 dashes = Operation/Step header
 * - 4+ dashes = Component/Material line
 */
function countLeadingDashes(line: string): number {
  const normalized = line.replace(/[–—]/g, '-').trimStart();
  const match = normalized.match(/^(-+)/);
  return match ? match[1].length : 0;
}

/**
 * Check if line is an OPERATION header (-- prefix, exactly 2-3 dashes)
 */
function isOperationLine(line: string): boolean {
  const dashCount = countLeadingDashes(line);
  return dashCount >= 2 && dashCount <= 3;
}

/**
 * Check if line is a COMPONENT line (---- prefix, 4+ dashes)
 */
function isComponentLine(line: string): boolean {
  const dashCount = countLeadingDashes(line);
  return dashCount >= 4;
}

/**
 * Extract master part number from text
 * Looks for patterns like "M NH495337430009" or "NH495337430009"
 */
function extractMasterPN(text: string): string {
  // Look for NH followed by 12 digits
  const nhMatch = text.match(/(?:M\s+)?(?:NH)?(\d{12})/);
  if (nhMatch) return nhMatch[1];
  
  // Look for explicit master line
  const masterMatch = text.match(/^M\s+(NH?\d+)/m);
  if (masterMatch) return masterMatch[1].replace(/^NH/, "");
  
  return "UNKNOWN";
}

// Metadata lines to skip after step headers
const METADATA_SKIP_PATTERNS = [
  /^resource\s*id/i,
  /^setup/i,
  /^run/i,
  /^labor\s*per/i,
  /^machine\s*per/i,
  /^qty\s*per/i,
  /^sequence/i,
  /^description/i,
  /^type:/i,
  /^\d+\.\d+\s*$/, // Pure decimal numbers like "1.00"
  /^[A-Z]{2,}-[A-Z]+\s*$/i, // Resource IDs alone on a line
];

/**
 * Check if a line is metadata to skip (between step header and parts)
 */
function isMetadataLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  
  // Skip if matches any metadata pattern
  return METADATA_SKIP_PATTERNS.some(pattern => pattern.test(trimmed));
}

/**
 * Detect operation step from a line (DASH-AGNOSTIC)
 * NEW PATTERN: --[NUMBER] (e.g., --10, --30, --50)
 * Handles hyphens, em-dashes, and en-dashes
 */
function detectStep(line: string): { 
  step: string; 
  resourceId: string; 
  description: string;
  sequenceLabel: string;
} | null {
  // Normalize all dash types to hyphens
  const normalizedLine = line.replace(/[–—]/g, '-');
  
  // PRIMARY PATTERN: --[NUMBER] at the start (with possible leading spaces)
  // Matches: "--10", "  --30", "Type: --50"
  const stepMatch = normalizedLine.match(/(?:^|Type:\s*)[-]{2,}(\d{2})(?:\s+([A-Z0-9-]+))?(?:\s*[-–]\s*(.+?))?(?:\s*Type:|$)/i);
  if (stepMatch) {
    const step = stepMatch[1];
    const resourceId = stepMatch[2]?.trim() || 'UNKNOWN';
    const description = stepMatch[3]?.trim() || '';
    return {
      step,
      resourceId,
      description,
      sequenceLabel: `${step} - ${resourceId}` 
    };
  }
  
  // ALTERNATE: Just --NUMBER anywhere in the line
  const simpleMatch = normalizedLine.match(/[-]{2,}(\d{2})(?:\s|$)/);
  if (simpleMatch) {
    // Try to extract resource ID from rest of line
    const rest = normalizedLine.substring(normalizedLine.indexOf(simpleMatch[0]) + simpleMatch[0].length);
    const resourceMatch = rest.match(/^\s*([A-Z0-9-]+)/i);
    const resourceId = resourceMatch?.[1] || 'UNKNOWN';
    const descMatch = rest.match(/[-–]\s*(.+?)(?:\s*Type:|$)/i);
    const description = descMatch?.[1]?.trim() || '';
    
    return {
      step: simpleMatch[1],
      resourceId,
      description,
      sequenceLabel: `${simpleMatch[1]} - ${resourceId}` 
    };
  }
  
  return null;
}

/**
 * Extract UOM and quantity from a line
 * Handles formats like "9.00 EA", "12.50 FT", "1 EACH"
 */
function extractUOMAndQty(line: string): { uom: string | null; qty: number } {
  // Pattern: number followed by UOM
  const uomMatch = line.match(/(\d+\.?\d*)\s*(EA|EACH|FT|FEET|FOOT|IN|INCH|INCHES|PC|PCS|PIECE|SET|KIT|M|METER|CM|MM|YD|YARD|LOT|UNIT)/i);
  if (uomMatch) {
    return {
      qty: parseFloat(uomMatch[1]) || 1,
      uom: uomMatch[2].toUpperCase()
    };
  }
  
  // Try Qty Per pattern
  const qtyPerMatch = line.match(/Qty\s*(?:Per)?:?\s*(\d+\.?\d*)\s*(\w+)?/i);
  if (qtyPerMatch) {
    return {
      qty: parseFloat(qtyPerMatch[1]) || 1,
      uom: qtyPerMatch[2]?.toUpperCase() || null
    };
  }
  
  return { uom: null, qty: 1 };
}

/**
 * Classify component based on UOM
 */
function classifyComponent(uom: string | null, step: string): 'Component' | 'Consumable/Wire' | 'Hardware' {
  if (uom && LENGTH_UOM_PATTERNS.test(uom)) {
    return 'Consumable/Wire';
  }
  if (step === "50" || step === "90") {
    return 'Hardware';
  }
  return 'Component';
}

/**
 * DASH-AGNOSTIC marker detection
 * Matches any sequence of 2+ dashes (hyphens, em-dashes, en-dashes)
 * BROAD REGEX: ^[ \t]*[-—–]{2,} to catch dashes with leading spaces
 */
const DASH_MARKER_REGEX = /^[ \t]*[-–—]{2,}/;

/**
 * Normalize dashes to standard hyphens for consistent parsing
 */
function normalizeDashes(text: string): string {
  return text.replace(/[–—]/g, '-'); // Convert em/en-dashes to hyphens
}

/**
 * Check if a line contains a valid part marker (2+ dashes at start)
 * Uses BROAD REGEX to catch leading whitespace
 */
function hasPartMarker(line: string): boolean {
  const normalized = normalizeDashes(line);
  return DASH_MARKER_REGEX.test(normalized);
}

/**
 * Parse a part line from the Visual Master format
 * 
 * DASH-AGNOSTIC: Treats any 2+ dashes as a valid marker
 * PART ID PRIORITY: The string immediately after dashes is the part_id
 * DESCRIPTION: Everything between part_id and the quantity/decimal at the end
 * ACI OPTIONAL: Captured if present, but never required
 */
function parsePartLine(line: string): { 
  partId: string; 
  aciCode: string | null; 
  fullDescription: string | null;
  uom: string | null;
  qty: number;
} | null {
  // Normalize all dash types to hyphens
  const normalizedLine = normalizeDashes(line);
  
  // BROAD REGEX: Must have 2+ dashes (with possible leading spaces)
  if (!DASH_MARKER_REGEX.test(normalizedLine)) return null;
  
  // Clean up line - normalize whitespace
  let cleanLine = normalizedLine
    .replace(/\|/g, " ")
    .replace(/\t+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  
  // PART CAPTURE LOGIC:
  // 1. Strip leading dashes
  // 2. Part ID = first token (e.g., W4BR1283-BC)
  // 3. Description = everything after ID until quantity/decimal
  
  // Remove leading dashes
  const afterDashes = cleanLine.replace(/^[-]+\s*/, '');
  
  if (!afterDashes || afterDashes.length < 2) return null;
  
  // Split into tokens
  const tokens = afterDashes.split(/\s+/);
  if (tokens.length === 0) return null;
  
  // PART ID: First token immediately after dashes
  const partId = tokens[0].trim();
  
  // Skip if partId is too short or looks like noise
  if (partId.length < 2) return null;
  
  // Rest of line after part ID
  const rest = tokens.slice(1).join(' ');
  
  // Extract UOM and quantity from the END of the line
  const { uom, qty } = extractUOMAndQty(normalizedLine);
  
  // ENHANCED: Try to extract ACI code from the rest of the line
  // Supports: ACI03442, ACI-03442, ACI 03442, AC103442 (OCR error)
  const aciMatch = rest.match(/(AC[I1][-\s]?\d{4,6})/i);
  const aciCode = aciMatch ? aciMatch[1].replace(/[-\s]/g, "").replace(/^AC1/i, "ACI").toUpperCase() : null;
  
  // DESCRIPTION: Everything between part_id and quantity
  // Remove ACI code and trailing quantity/UOM
  let fullDescription = rest
    .replace(/ACI[-]?\d{4,6}/gi, "")
    .replace(/\d+\.?\d*\s*(?:EA|FT|IN|PC|SET|EACH|FEET|INCH|UNIT|LOT|M|CM|MM|YD)?$/i, "")
    .replace(/\s+/g, " ")
    .trim() || null;
  
  return {
    partId,
    aciCode,
    fullDescription,
    uom,
    qty
  };
}

/**
 * Extract process instructions from text between steps
 */
function extractProcessNotes(text: string): ProcessInstruction[] {
  const notes: ProcessInstruction[] = [];
  const lines = text.split(/\r?\n/);
  let currentStep = "00";
  
  for (const line of lines) {
    // Update current step
    const stepInfo = detectStep(line);
    if (stepInfo) {
      currentStep = stepInfo.step;
      continue;
    }
    
    // Check for process instructions
    for (const pattern of PROCESS_INSTRUCTION_PATTERNS) {
      const matches = line.match(pattern);
      if (matches) {
        for (const match of matches) {
          notes.push({
            step: currentStep,
            instruction: match.trim()
          });
        }
      }
    }
  }
  
  return notes;
}

/**
 * CATCH-ALL ID EXTRACTOR
 * Finds ALL potential part IDs on a line using multiple patterns
 */
function extractAllPartIds(line: string): string[] {
  const ids: string[] = [];
  
  // Reset regex lastIndex (AGNOSTIC patterns)
  VENDOR_CATALOG_PATTERN.lastIndex = 0;
  LONG_SKU_PATTERN.lastIndex = 0;
  STANDARD_PART_PATTERN.lastIndex = 0;
  ACI_PATTERN.lastIndex = 0;
  ACI_BRIDGE_PATTERN.lastIndex = 0;
  
  // Pattern 0 (PRIORITY): ACI Bridge Numbers - Critical for tooling linkage
  let match;
  while ((match = ACI_BRIDGE_PATTERN.exec(line)) !== null) {
    // Normalize: AC1 -> ACI (OCR error correction)
    const normalized = match[1].replace(/[-\s]/g, "").replace(/^AC1/i, "ACI").toUpperCase();
    if (!ids.includes(normalized)) {
      ids.push(normalized);
    }
  }
  
  // Pattern 1: Vendor catalog patterns (APP#, MOLEX#, TE#, etc.)
  while ((match = VENDOR_CATALOG_PATTERN.exec(line)) !== null) {
    if (!ids.includes(match[1])) {
      ids.push(match[1]);
    }
  }
  
  // Pattern 2: 10-15 digit long SKUs (any manufacturer)
  while ((match = LONG_SKU_PATTERN.exec(line)) !== null) {
    if (!ids.includes(match[1])) {
      ids.push(match[1]);
    }
  }
  
  // Pattern 3: Standard alphanumeric part numbers (5-25 chars)
  while ((match = STANDARD_PART_PATTERN.exec(line)) !== null) {
    const candidate = match[1];
    // Avoid duplicates and noise words
    if (!ids.includes(candidate) && 
        candidate.length >= 5 && 
        !/^(TYPE|STEP|SETUP|RESOURCE|DESCRIPTION|MACHINE|GENERAL)$/i.test(candidate)) {
      ids.push(candidate);
    }
  }
  
  return ids;
}

/**
 * Check if a part is likely a terminal (needs applicator)
 */
function isLikelyTerminal(partId: string): boolean {
  const upper = partId.toUpperCase();
  return TERMINAL_PREFIXES.some(prefix => upper.startsWith(prefix));
}

/**
 * Main parser function - SLEDGEHAMMER v4.0
 * Takes raw text from PDF extraction and returns structured data
 * 
 * SLEDGEHAMMER RULES:
 * 1. NO EARLY EXIT - Process EVERY line until absolute EOF
 * 2. CAPTURE ALL - If a line starts with dashes, save the ENTIRE raw line
 * 3. CATCH-ALL REGEX - Find APP#, MOLEX#, and 10-15 digit patterns
 * 4. NOISE-TO-SIGNAL - Store rawLine as fallback for every component
 * 5. PAGE ACCOUNTABILITY - Log every page processed
 */
export function parseVisualMaster(text: string): VisualMasterData {
  // Normalize text: ensure consistent line endings
  const normalizedText = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ');
  
  const lines = normalizedText.split('\n');
  const masterPN = extractMasterPN(normalizedText);
  
  const parts: ParsedPart[] = [];
  const operations: ParsedOperation[] = [];
  const steps = new Map<string, { resourceId: string; description: string }>();
  const processNotes = extractProcessNotes(normalizedText);
  const pageLogs: PageLog[] = [];
  
  let currentStep = "00";
  let currentResourceId = "UNKNOWN";
  let currentStepDescription = "Unknown Step";
  let currentSequenceLabel = "00 - UNKNOWN";
  let currentOperation: ParsedOperation | null = null;
  
  // PAGE ACCOUNTABILITY tracking
  let currentPage = 1;
  let pageComponentCount = 0;
  let pageOperationCount = 0;
  let pageHasText = false;
  
  console.log(`[VisualParser v5.0 SLEDGEHAMMER] Starting Maximum Recall Parse of ${lines.length} lines...`);
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    
    // PAGE BOUNDARY DETECTION
    if (trimmedLine.includes('--- PAGE') || trimmedLine.match(/^-{3,}\s*PAGE\s*\d+/i)) {
      // Log previous page
      if (currentPage > 0 && pageHasText) {
        const warning = (pageHasText && pageComponentCount === 0) 
          ? `Potential OCR occlusion on Page ${currentPage}` 
          : null;
        pageLogs.push({
          pageNumber: currentPage,
          hasText: pageHasText,
          componentCount: pageComponentCount,
          operationCount: pageOperationCount,
          warning
        });
        if (warning) {
          console.warn(`[VisualParser] ⚠️ ${warning}`);
        }
      }
      // Start new page
      currentPage++;
      pageComponentCount = 0;
      pageOperationCount = 0;
      pageHasText = false;
      continue;
    }
    
    // Track that page has content
    if (trimmedLine) {
      pageHasText = true;
    }
    
    // Skip empty lines
    if (!trimmedLine) continue;
    
    // RULE 1: Check for OPERATION header (-- prefix, 2-3 dashes)
    if (isOperationLine(line)) {
      const stepInfo = detectStep(line);
      if (stepInfo) {
        // Save previous operation if it exists (even with 0 components - SLEDGEHAMMER captures all)
        if (currentOperation) {
          operations.push(currentOperation);
          console.log(`[VisualParser] Operation ${currentOperation.step} complete: ${currentOperation.components.length} components, ${currentOperation.rawLines.length} raw lines`);
        }
        
        currentStep = stepInfo.step;
        currentResourceId = stepInfo.resourceId;
        currentStepDescription = stepInfo.description;
        currentSequenceLabel = stepInfo.sequenceLabel;
        pageOperationCount++;
        
        // Create new operation with rawLines array
        currentOperation = {
          step: stepInfo.step,
          resourceId: stepInfo.resourceId,
          description: stepInfo.description,
          sequenceLabel: stepInfo.sequenceLabel,
          components: [],
          rawLines: [line] // Capture raw operation line
        };
        
        steps.set(currentStep, { 
          resourceId: stepInfo.resourceId, 
          description: stepInfo.description 
        });
        console.log(`[VisualParser] OPERATION (--${currentStep}): ${currentResourceId} - ${currentStepDescription}`);
        continue;
      }
    }
    
    // RULE 2: SLEDGEHAMMER - Capture ANY line starting with dashes
    const dashCount = countLeadingDashes(line);
    if (dashCount >= 2) {
      // Capture raw line to current operation
      if (currentOperation) {
        currentOperation.rawLines.push(line);
      }
      
      // Only process as component if 4+ dashes
      if (dashCount >= 4) {
        try {
          const partInfo = parsePartLine(line);
          
          // SLEDGEHAMMER: Extract ALL candidate IDs from the line
          const candidateIds = extractAllPartIds(line);
          
          // Determine primary partId
          const partId = partInfo?.partId || candidateIds[0] || `LINE_${i + 1}`;
          
          const componentClass = classifyComponent(partInfo?.uom || null, currentStep);
          const isWireType = componentClass === 'Consumable/Wire';
          const wireLength = isWireType ? (partInfo?.qty || 1) : null;
          
          // Extract ACI code directly from line as well
          const aciMatch = line.match(ACI_PATTERN);
          const aciCode = partInfo?.aciCode || (aciMatch ? aciMatch[1].replace(/-/g, '').toUpperCase() : null);
          
          const part: ParsedPart = {
            partId,
            aciCode,
            fullDescription: partInfo?.fullDescription || line.replace(/^[-\s]+/, '').trim(),
            operationStep: currentStep,
            resourceId: currentResourceId,
            sequenceLabel: currentSequenceLabel,
            stepDescription: currentStepDescription,
            quantity: isWireType ? 1 : (partInfo?.qty || 1),
            qtyPer: isWireType ? 1 : (partInfo?.qty || 1),
            unitOfMeasure: partInfo?.uom || null,
            componentClass,
            isTerminal: isLikelyTerminal(partId) || currentStep === "10" || currentStep === "30",
            isHardware: currentStep === "50" || currentStep === "90",
            wireLength,
            rawLine: line, // NOISE-TO-SIGNAL: Full raw line
            candidateIds   // All potential IDs found
          };
          
          parts.push(part);
          if (currentOperation) {
            currentOperation.components.push(part);
          }
          pageComponentCount++;
          console.log(`[VisualParser] COMPONENT (----): ${part.partId} | ACI: ${part.aciCode || "N/A"} | Candidates: ${candidateIds.length} | Step ${part.operationStep}`);
        } catch (e) {
          // SLEDGEHAMMER: Don't crash - log and continue
          console.warn(`[VisualParser] Error parsing line ${i + 1}, continuing...`, e);
          // Still capture the raw line even if parsing failed
          if (currentOperation) {
            currentOperation.rawLines.push(line);
          }
        }
      }
    }
  }
  
  // Save final operation
  if (currentOperation) {
    operations.push(currentOperation);
    console.log(`[VisualParser] Operation ${currentOperation.step} complete: ${currentOperation.components.length} components`);
  }
  
  // Log final page
  if (pageHasText) {
    const warning = (pageHasText && pageComponentCount === 0) 
      ? `Potential OCR occlusion on Page ${currentPage}` 
      : null;
    pageLogs.push({
      pageNumber: currentPage,
      hasText: pageHasText,
      componentCount: pageComponentCount,
      operationCount: pageOperationCount,
      warning
    });
    if (warning) {
      console.warn(`[VisualParser] ⚠️ ${warning}`);
    }
  }
  
  console.log(`[VisualParser v5.0 SLEDGEHAMMER] COMPLETE: ${masterPN}`);
  console.log(`[VisualParser v5.0 SLEDGEHAMMER] Summary: ${operations.length} Operations | ${parts.length} Components | ${pageLogs.length} Pages Logged`);
  
  return {
    masterPartNumber: masterPN,
    parts,
    operations,
    steps,
    processNotes,
    rawText: normalizedText, // FULL document text
    pageLogs,
    operationCount: operations.length,
    componentCount: parts.length
  };
}
