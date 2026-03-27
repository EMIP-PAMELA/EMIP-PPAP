/**
 * BOM Normalizer - Document Engine Core
 * 
 * BUSINESS LOGIC LAYER
 * 
 * Responsibility: Transform raw parsed BOM data into normalized business entities
 * Input: RawBOMData from bomParser
 * Output: Normalized BOM structures ready for template mapping
 * 
 * This layer contains:
 * - Component classification logic (Component/Consumable/Hardware)
 * - Terminal detection logic
 * - UOM interpretation
 * - Wire length calculation
 * - Business rules for component categorization
 * 
 * PLACEHOLDER IMPLEMENTATION
 * Full implementation will be completed in future phase.
 */

import { 
  RawBOMData, 
  RawOperation, 
  RawComponent,
  NormalizedBOM,
  NormalizedOperation,
  NormalizedComponent,
  ComponentType,
  BOMSummary
} from '../types/bomTypes';

// ============================================================
// BUSINESS LOGIC CONSTANTS
// ============================================================

const TERMINAL_PREFIXES = ["770", "350", "87"];
const TERMINAL_STEPS = ["10", "30"];
const HARDWARE_STEPS = ["50", "90"];

const LENGTH_UOM_PATTERNS = /^(FT|FEET|FOOT|IN|INCH|INCHES|M|METER|METERS|CM|MM|YD|YARD|YARDS)$/i;
const COMPONENT_UOM_PATTERNS = /^(EA|EACH|PC|PCS|PIECE|PIECES|SET|KIT|UNIT|UNITS|LOT)$/i;

export const STEP_LABELS: Record<string, string> = {
  "10": "Termination/Tooling Zone (Komax)",
  "20": "Strip Prep Zone",
  "30": "Crimp/Terminal Zone",
  "50": "Assembly/Hardware Zone",
  "90": "Label & Bag",
  "95": "Quality Control"
};

// ============================================================
// LINE CLASSIFICATION HELPERS
// ============================================================

function isMetadataLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  
  const metadataPatterns = [
    /^resource\s*id/i,
    /^setup/i,
    /^run/i,
    /^labor\s*per/i,
    /^machine\s*per/i,
    /^qty\s*per/i,
    /^sequence/i,
    /^type:/i,
    /^\d+\.\d+\s*$/,
    /^[A-Z]{2,}-[A-Z]+\s*$/i,
  ];
  
  return metadataPatterns.some(pattern => pattern.test(trimmed));
}

function isProcessLine(line: string): boolean {
  const processPatterns = [
    /CUT\s*\/?\s*STRIP\s+PER\s+INSTRUCTION/i,
    /CRIMP\s+PER\s+SPEC/i,
    /SEAL\s+(?:AND\s+)?ASSEMBLE/i,
    /APPLY\s+(?:HEAT\s+)?SHRINK/i,
    /INSTALL\s+(?:CONNECTOR|TERMINAL)/i,
    /VERIFY\s+CRIMP\s+HEIGHT/i,
    /LABEL\s+(?:AND\s+)?(?:BAG|PACKAGE)/i,
    /TORQUE\s+TO/i,
    /REFER\s+TO\s+DRAWING/i,
    /NOTE:/i,
    /SETUP:/i,
    /INSTRUCTION:/i
  ];
  
  return processPatterns.some(pattern => pattern.test(line));
}

function isComponentLine(line: string): boolean {
  const normalized = line.replace(/[–—]/g, '-').trimStart();
  const match = normalized.match(/^(-+)/);
  const dashCount = match ? match[1].length : 0;
  return dashCount >= 4;
}

// ============================================================
// CLASSIFICATION FUNCTIONS (Business Logic)
// ============================================================

/**
 * Classify component type based on UOM, step, and part ID
 * 
 * Business rules:
 * - Length-based UOM (FT, IN, M) → wire
 * - Terminal prefix (770, 350, 87) OR termination step (10, 30) → terminal
 * - Hardware step (50, 90) → hardware
 * - Otherwise → unknown
 */
export function classifyComponentType(partId: string, uom: string | null, step: string): ComponentType {
  // Wire: Length-based UOM
  if (uom && LENGTH_UOM_PATTERNS.test(uom)) {
    return 'wire';
  }
  
  // Terminal: Prefix or termination step
  const upper = partId.toUpperCase();
  const hasTerminalPrefix = TERMINAL_PREFIXES.some(prefix => upper.startsWith(prefix));
  const isTerminationStep = TERMINAL_STEPS.includes(step);
  
  if (hasTerminalPrefix || isTerminationStep) {
    return 'terminal';
  }
  
  // Hardware: Assembly/packaging steps
  if (HARDWARE_STEPS.includes(step)) {
    return 'hardware';
  }
  
  return 'unknown';
}

/**
 * Extract description from component raw line
 * Removes part ID, ACI code, quantity, and UOM to get clean description
 */
function extractDescription(rawLine: string, partId: string): string | null {
  const normalized = rawLine.replace(/[–—]/g, '-');
  const afterDashes = normalized.replace(/^[-]+\s*/, '');
  
  // Remove part ID from start
  let rest = afterDashes.replace(new RegExp(`^${partId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`), '');
  
  // Remove ACI codes
  rest = rest.replace(/ACI[-]?\d{4,6}/gi, '');
  
  // Remove trailing quantity and UOM
  rest = rest.replace(/\d+\.?\d*\s*(?:EA|FT|IN|PC|SET|EACH|FEET|INCH|UNIT|LOT|M|CM|MM|YD)?$/i, '');
  
  // Clean up whitespace
  const cleaned = rest.replace(/\s+/g, ' ').trim();
  
  return cleaned || null;
}

// ============================================================
// NORMALIZATION FUNCTION (PLACEHOLDER)
// ============================================================

/**
 * Normalize raw BOM data into structured business entities
 * 
 * Multi-line aware: Binds trailing lines to components correctly
 * Separates: Components, metadata, and process instructions
 * Classifies: Wire, terminal, hardware based on business rules
 * Preserves: Full traceability back to raw input
 */
export function normalizeBOMData(rawData: RawBOMData): NormalizedBOM {
  console.log(`[BOMNormalizer] Normalizing ${rawData.operations.length} operations...`);
  
  const normalizedOps: NormalizedOperation[] = [];
  
  let totalWires = 0;
  let totalTerminals = 0;
  let totalHardware = 0;
  
  for (const rawOp of rawData.operations) {
    const components: NormalizedComponent[] = [];
    const processLines: string[] = [];
    const metadataLines: string[] = [];
    
    // Track current component for multi-line binding
    let currentComponent: {
      raw: RawComponent;
      trailingLines: string[];
    } | null = null;
    
    // Process rawLines to separate components, metadata, and process instructions
    for (let i = 0; i < rawOp.rawLines.length; i++) {
      const line = rawOp.rawLines[i];
      const trimmed = line.trim();
      
      if (!trimmed) continue;
      
      // Check if this is a component line
      if (isComponentLine(line)) {
        // Save previous component if exists
        if (currentComponent) {
          const normalized = normalizeComponent(
            currentComponent.raw,
            currentComponent.trailingLines,
            rawOp.step,
            rawOp.resourceId
          );
          if (normalized) {
            components.push(normalized);
            
            // Update type counts
            if (normalized.componentType === 'wire') totalWires++;
            if (normalized.componentType === 'terminal') totalTerminals++;
            if (normalized.componentType === 'hardware') totalHardware++;
          }
        }
        
        // Find matching RawComponent
        const matchingRawComp = rawOp.components.find(c => c.rawLine === line);
        if (matchingRawComp) {
          currentComponent = {
            raw: matchingRawComp,
            trailingLines: []
          };
        }
      } else {
        // Non-component line
        if (isProcessLine(line)) {
          processLines.push(line);
        } else if (isMetadataLine(line)) {
          metadataLines.push(line);
        } else if (currentComponent) {
          // Trailing line belongs to current component
          currentComponent.trailingLines.push(line);
        } else {
          // Line before first component - treat as metadata
          metadataLines.push(line);
        }
      }
    }
    
    // Save final component if exists
    if (currentComponent) {
      const normalized = normalizeComponent(
        currentComponent.raw,
        currentComponent.trailingLines,
        rawOp.step,
        rawOp.resourceId
      );
      if (normalized) {
        components.push(normalized);
        
        if (normalized.componentType === 'wire') totalWires++;
        if (normalized.componentType === 'terminal') totalTerminals++;
        if (normalized.componentType === 'hardware') totalHardware++;
      }
    }
    
    normalizedOps.push({
      step: rawOp.step,
      resourceId: rawOp.resourceId,
      description: rawOp.description,
      components,
      processLines,
      metadataLines
    });
    
    console.log(`[BOMNormalizer] Operation ${rawOp.step}: ${components.length} components, ${processLines.length} process lines, ${metadataLines.length} metadata lines`);
  }
  
  const totalComponents = totalWires + totalTerminals + totalHardware;
  
  const summary: BOMSummary = {
    totalComponents,
    totalOperations: normalizedOps.length,
    wires: totalWires,
    terminals: totalTerminals,
    hardware: totalHardware
  };
  
  console.log(`[BOMNormalizer] Complete: ${summary.totalComponents} components (${summary.wires} wires, ${summary.terminals} terminals, ${summary.hardware} hardware)`);
  
  return {
    masterPartNumber: rawData.masterPartNumber,
    operations: normalizedOps,
    summary
  };
}

/**
 * Normalize a single component with its trailing lines
 */
function normalizeComponent(
  raw: RawComponent,
  trailingLines: string[],
  step: string,
  resourceId: string
): NormalizedComponent | null {
  const partId = raw.detectedPartId;
  if (!partId) {
    console.warn(`[BOMNormalizer] Skipping component with no part ID: ${raw.rawLine}`);
    return null;
  }
  
  const componentType = classifyComponentType(partId, raw.detectedUom || null, step);
  const description = extractDescription(raw.rawLine, partId);
  
  return {
    partId,
    aciCode: raw.detectedAci || null,
    description,
    quantity: raw.detectedQty || 1,
    uom: raw.detectedUom || null,
    componentType,
    source: {
      rawLine: raw.rawLine,
      trailingLines
    }
  };
}
