/**
 * BOM Normalizer - Document Engine Core (Canonical Model)
 *
 * Responsibility: Transform raw parsed BOM data into normalized business entities
 * Input: RawBOMData from bomParser
 * Output: Normalized BOM structures ready for template mapping + system-wide consumption
 *
 * Capabilities:
 * - Component classification logic (wire / terminal / hardware / unknown)
 * - Terminal detection logic
 * - UOM interpretation + length normalization in inches
 * - Gauge / color extraction and classification signals
 * - Business rules for component categorization + validation buckets
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
import { normalizeWireMaterialKey } from '@/src/utils/normalizeWireMaterialKey';

// ============================================================
// BUSINESS LOGIC CONSTANTS
// ============================================================

const TERMINAL_PREFIXES = ["770", "350", "87"];
const TERMINAL_STEPS = ["10", "30"];
const HARDWARE_STEPS = ["50", "90"];
const CONNECTOR_KEYWORDS = [
  'CONNECTOR',
  'PLUG',
  'SOCKET',
  'RECEPTACLE',
  'TERMINAL',
  'HOUSING',
  'PIN',
  'CONTACT'
];

const LENGTH_UOM_PATTERNS = /^(FT|FEET|FOOT|IN|INCH|INCHES|M|METER|METERS|CM|MM|YD|YARD|YARDS)$/i;
const COMPONENT_UOM_PATTERNS = /^(EA|EACH|PC|PCS|PIECE|PIECES|SET|KIT|UNIT|UNITS|LOT)$/i;
const GAUGE_PATTERN = /(\d{1,2})\s*(?:AWG|GA|GAUGE)/i;
const COLOR_TOKENS: Record<string, string> = {
  BLK: 'black',
  BK: 'black',
  BLACK: 'black',
  RED: 'red',
  RD: 'red',
  BLU: 'blue',
  BLUE: 'blue',
  GRN: 'green',
  GREEN: 'green',
  WHT: 'white',
  WHITE: 'white',
  YEL: 'yellow',
  YELLOW: 'yellow',
  ORG: 'orange',
  ORANGE: 'orange',
  BRN: 'brown',
  BROWN: 'brown',
  GRY: 'gray',
  GREY: 'gray',
  VIO: 'violet',
  VIOLET: 'violet',
  PNK: 'pink',
  PINK: 'pink',
};

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
export function classifyComponentType(
  partId: string,
  uom: string | null,
  step: string,
  description?: string | null,
  trailingLines: string[] = []
): ComponentType {
  const searchSpace = [partId, description, ...trailingLines]
    .filter(Boolean)
    .join(' ')
    .toUpperCase();

  // Connector keywords take precedence (no downstream reclassification)
  if (CONNECTOR_KEYWORDS.some(keyword => searchSpace.includes(keyword))) {
    return 'connector';
  }

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

function normalizePartNumber(partId: string): string {
  return partId.trim().toUpperCase();
}

function normalizeDescriptionText(description: string | null): string | null {
  if (!description) return null;
  return description.replace(/\s+/g, ' ').trim().toUpperCase();
}

function extractGauge(partId: string, description: string | null): { value: string | null; signal?: string } {
  const fromPart = partId.match(GAUGE_PATTERN);
  if (fromPart) {
    return { value: fromPart[1], signal: 'AWG_MATCH_PART' };
  }
  if (description) {
    const fromDesc = description.match(GAUGE_PATTERN);
    if (fromDesc) {
      return { value: fromDesc[1], signal: 'AWG_MATCH_DESC' };
    }
  }
  return { value: null };
}

function extractColor(description: string | null, trailingLines: string[]): { value: string | null; signal?: string } {
  const searchSpace = [description, ...trailingLines].filter(Boolean).join(' ').toUpperCase();
  for (const [token, normalized] of Object.entries(COLOR_TOKENS)) {
    if (searchSpace.includes(token)) {
      return { value: normalized, signal: 'COLOR_MATCH' };
    }
  }
  return { value: null };
}

function normalizeLengthToInches(raw: RawComponent): { inches: number | null; signal?: string } {
  const qty = typeof raw.detectedQty === 'number' ? raw.detectedQty : null;
  const uom = raw.detectedUom?.toUpperCase() ?? null;
  if (!qty || !uom) {
    return { inches: null };
  }

  if (['FT', 'FEET', 'FOOT'].includes(uom)) {
    return { inches: qty * 12, signal: 'LENGTH_FT' };
  }
  if (['IN', 'INCH', 'INCHES'].includes(uom)) {
    return { inches: qty, signal: 'LENGTH_IN' };
  }
  if (['CM'].includes(uom)) {
    return { inches: qty * 0.393701, signal: 'LENGTH_CM' };
  }
  if (['MM'].includes(uom)) {
    return { inches: qty * 0.0393701, signal: 'LENGTH_MM' };
  }
  if (['M', 'METER', 'METERS'].includes(uom)) {
    return { inches: qty * 39.3701, signal: 'LENGTH_M' };
  }
  if (['YD', 'YARD', 'YARDS'].includes(uom)) {
    return { inches: qty * 36, signal: 'LENGTH_YD' };
  }
  return { inches: null };
}

function computeConfidence(signals: string[]): number {
  if (signals.length === 0) return 0.2;
  return Math.min(1, signals.length * 0.2);
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
  let totalConnectors = 0;
  const flatComponents: NormalizedComponent[] = [];
  
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
            flatComponents.push(normalized);
            
            // Update type counts
            if (normalized.componentType === 'wire') totalWires++;
            if (normalized.componentType === 'terminal') totalTerminals++;
            if (normalized.componentType === 'hardware') totalHardware++;
            if (normalized.componentType === 'connector') totalConnectors++;
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
        flatComponents.push(normalized);
        
        if (normalized.componentType === 'wire') totalWires++;
        if (normalized.componentType === 'terminal') totalTerminals++;
        if (normalized.componentType === 'hardware') totalHardware++;
        if (normalized.componentType === 'connector') totalConnectors++;
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
    hardware: totalHardware,
    connectors: totalConnectors,
  };
  
  console.log(`[BOMNormalizer] Complete: ${summary.totalComponents} components (${summary.wires} wires, ${summary.terminals} terminals, ${summary.hardware} hardware, ${totalConnectors} connectors)`);

  const wireTotalsByMaterialKey: Record<string, number> = {};
  const componentCountsByType: Record<string, number> = {};

  flatComponents.forEach(component => {
    componentCountsByType[component.componentType] = (componentCountsByType[component.componentType] || 0) + 1;
    if (component.componentType === 'wire') {
      const key = normalizeWireMaterialKey({
        gauge: component.gauge ?? null,
        color: component.color ?? null,
        type: 'wire'
      });
      const length = component.normalizedLengthInches ?? 0;
      if (length > 0) {
        wireTotalsByMaterialKey[key] = (wireTotalsByMaterialKey[key] || 0) + length;
      }
    }
  });

  const processSteps = normalizedOps.map(op => op.step);

  const validation = {
    unknownItems: flatComponents
      .filter(c => c.componentType === 'unknown')
      .map(c => ({ partId: c.partId, reason: 'UNKNOWN_TYPE' })),
    suspiciousItems: flatComponents
      .filter(c => (c.confidence ?? 0) < 0.3)
      .map(c => ({ partId: c.partId, confidence: c.confidence ?? 0 })),
    missingFields: flatComponents
      .filter(c => !c.normalizedPartNumber || !c.normalizedDescription)
      .map(c => ({ partId: c.partId, missing: !c.normalizedPartNumber ? 'partNumber' : 'description' }))
  };

  console.log('[T23.6.54B NORMALIZED BOM OUTPUT]', {
    componentCount: flatComponents.length,
    sample: flatComponents.slice(0, 3)
  });
  
  return {
    masterPartNumber: rawData.masterPartNumber,
    operations: normalizedOps,
    summary,
    skuPartNumber: rawData.masterPartNumber,
    drawingNumber: null,
    revision: null,
    sourceDocumentId: null,
    sourceFileName: null,
    summaries: {
      wireTotalsByMaterialKey,
      componentCountsByType,
      processSteps
    },
    validation
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
  const normalizedPartNumber = normalizePartNumber(partId);
  const normalizedDescription = normalizeDescriptionText(description);
  const { inches: normalizedLengthInches, signal: lengthSignal } = normalizeLengthToInches(raw);
  const { value: gauge, signal: gaugeSignal } = extractGauge(partId, description);
  const { value: color, signal: colorSignal } = extractColor(description, trailingLines);
  const classificationSignals: string[] = [];
  if (componentType !== 'unknown') classificationSignals.push(`TYPE_${componentType.toUpperCase()}`);
  if (gaugeSignal) classificationSignals.push(gaugeSignal);
  if (colorSignal) classificationSignals.push(colorSignal);
  if (lengthSignal) classificationSignals.push(lengthSignal);
  classificationSignals.push(`STEP_${step}`);
  const confidence = computeConfidence(classificationSignals);
  const processCode = STEP_LABELS[step] || resourceId || null;
  
  return {
    partId,
    aciCode: raw.detectedAci || null,
    description,
    quantity: raw.detectedQty || 1,
    uom: raw.detectedUom || null,
    componentType,
    normalizedPartNumber,
    normalizedDescription,
    normalizedLengthInches: normalizedLengthInches ?? null,
    gauge,
    color,
    processCode,
    confidence,
    classificationSignals,
    source: {
      rawLine: raw.rawLine,
      trailingLines
    }
  };
}
