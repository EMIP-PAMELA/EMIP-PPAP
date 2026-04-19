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
  BOMSummary,
  NormalizedConnector,
  ConnectorAuthority,
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

const TABLE_HEADER_HINTS = ['CONNECTOR', 'HOUSING', 'ASSY', 'OR EQUIVALENT'];
const DIAGRAM_HINTS = ['CALLOUT', 'CALLOUTS', 'DIAGRAM', 'FIG', 'VIEW', 'ZONE'];
const NOTES_HINTS = ['NOTE', 'NOTES', 'ALT', 'ALTERNATE', 'SEE DRAWING', 'SEE DWG'];
const CONNECTOR_AUTHORITY_PRIORITY: Record<ConnectorAuthority, number> = {
  TABLE_HEADER: 5,
  DIAGRAM_CALLOUT: 4,
  ROW: 3,
  NOTES: 1,
  UNKNOWN: 0,
};

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

function addConnectors(target: NormalizedConnector[], additions: NormalizedConnector[]): void {
  for (const addition of additions) {
    const duplicate = target.some(connector =>
      connector.partNumber === addition.partNumber &&
      connector.authority === addition.authority &&
      connector.sourceText === addition.sourceText
    );
    if (!duplicate) {
      target.push(addition);
    }
  }
}

function collectRowConnectors(components: NormalizedComponent[]): NormalizedConnector[] {
  return components
    .filter(component => component.componentType === 'connector')
    .map(component => ({
      partNumber: normalizeConnectorPN(component.normalizedPartNumber ?? component.partId),
      sourceText: component.source.rawLine,
      authority: 'ROW' as ConnectorAuthority,
      confidence: component.confidence ?? 0.7,
    }));
}

function getTableHeaderLines(operation: RawOperation): string[] {
  const headers: string[] = [];
  for (const line of operation.rawLines) {
    if (!line.trim()) continue;
    if (isComponentLine(line)) break;
    headers.push(line);
  }
  return headers;
}

function collectTableHeaderConnectors(rawData: RawBOMData): NormalizedConnector[] {
  const headerConnectors: NormalizedConnector[] = [];
  for (const op of rawData.operations) {
    const headerLines = getTableHeaderLines(op);
    for (const line of headerLines) {
      const upper = line.toUpperCase();
      if (!TABLE_HEADER_HINTS.some(hint => upper.includes(hint))) continue;
      const candidates = detectPartNumbers(upper);
      candidates.forEach(partNumber => {
        headerConnectors.push({
          partNumber: normalizeConnectorPN(partNumber),
          sourceText: line.trim(),
          authority: 'TABLE_HEADER',
          confidence: 0.95,
        });
      });
    }
  }
  return headerConnectors;
}

function collectDiagramCalloutConnectors(rawData: RawBOMData): NormalizedConnector[] {
  const lines = rawData.rawText?.split(/\r?\n/) ?? [];
  const connectors: NormalizedConnector[] = [];
  for (const line of lines) {
    const upper = line.trim().toUpperCase();
    if (!upper) continue;
    if (!DIAGRAM_HINTS.some(hint => upper.includes(hint))) continue;
    if (!CONNECTOR_KEYWORDS.some(keyword => upper.includes(keyword))) continue;
    const candidates = detectPartNumbers(upper);
    candidates.forEach(partNumber => {
      connectors.push({
        partNumber: normalizeConnectorPN(partNumber),
        sourceText: line.trim(),
        authority: 'DIAGRAM_CALLOUT',
        confidence: 0.85,
      });
    });
  }
  return connectors;
}

function collectNotesConnectors(rawData: RawBOMData): NormalizedConnector[] {
  const lines = rawData.rawText?.split(/\r?\n/) ?? [];
  const connectors: NormalizedConnector[] = [];
  for (const line of lines) {
    const upper = line.trim().toUpperCase();
    if (!upper) continue;
    if (!NOTES_HINTS.some(hint => upper.includes(hint))) continue;
    const candidates = detectPartNumbers(upper);
    candidates.forEach(partNumber => {
      connectors.push({
        partNumber: normalizeConnectorPN(partNumber),
        sourceText: line.trim(),
        authority: 'NOTES',
        confidence: 0.4,
      });
    });
  }
  return connectors;
}

function deduplicateConnectors(connectors: NormalizedConnector[]): NormalizedConnector[] {
  const uniqueMap = new Map<string, NormalizedConnector>();
  for (const connector of connectors) {
    const key = connector.partNumber;
    const existing = uniqueMap.get(key);
    if (!existing) {
      uniqueMap.set(key, connector);
      continue;
    }

    const currentPriority = CONNECTOR_AUTHORITY_PRIORITY[connector.authority] ?? 0;
    const existingPriority = CONNECTOR_AUTHORITY_PRIORITY[existing.authority] ?? 0;

    if (currentPriority > existingPriority) {
      uniqueMap.set(key, connector);
      continue;
    }

    if (currentPriority === existingPriority) {
      if ((connector.confidence ?? 0) > (existing.confidence ?? 0)) {
        uniqueMap.set(key, connector);
      }
    }
  }
  return Array.from(uniqueMap.values());
}

function resolvePrimaryConnector(connectors: NormalizedConnector[]): NormalizedConnector | null {
  if (!connectors.length) return null;
  return connectors
    .slice()
    .sort((a, b) => {
      const rankDiff = CONNECTOR_AUTHORITY_PRIORITY[b.authority] - CONNECTOR_AUTHORITY_PRIORITY[a.authority];
      if (rankDiff !== 0) return rankDiff;
      return (b.confidence ?? 0) - (a.confidence ?? 0);
    })[0] ?? null;
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

function normalizeConnectorPN(input: string): string {
  const cleaned = input
    .toUpperCase()
    .replace(/PHOENIX/g, '')
    .replace(/OR EQUIVALENT/g, '')
    .replace(/[^A-Z0-9-]/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
    .trim();
  return cleaned || 'UNKNOWN';
}

function detectPartNumbers(line: string): string[] {
  const sanitized = line
    .replace(/[^A-Z0-9-\s]/gi, ' ')
    .split(/\s+/)
    .map(token => token.trim())
    .filter(Boolean);
  return sanitized
    .map(token => token.toUpperCase())
    .filter(token => token.length >= 5 && /[0-9]/.test(token))
    .map(normalizeConnectorPN);
}

function isConnectorPartNumber(partNumber: string | null | undefined): boolean {
  if (!partNumber) return false;
  const pn = partNumber.toUpperCase();

  if (/^\d{6,7}$/.test(pn)) return true;

  if (
    pn.includes('PHOENIX') ||
    pn.includes('CONN') ||
    pn.includes('HOUSING') ||
    pn.includes('HEADER')
  ) {
    return true;
  }

  return false;
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
  const connectorCandidates: NormalizedConnector[] = [];
  
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
            if (normalized.componentType === 'connector') {
              totalConnectors++;
              connectorCandidates.push({
                partNumber: normalizeConnectorPN(normalized.normalizedPartNumber ?? normalized.partId),
                sourceText: normalized.source.rawLine,
                authority: 'ROW',
                confidence: 0.9,
              });
            }
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
        if (normalized.componentType === 'connector') {
          totalConnectors++;
          connectorCandidates.push({
            partNumber: normalizeConnectorPN(normalized.normalizedPartNumber ?? normalized.partId),
            sourceText: normalized.source.rawLine,
            authority: 'ROW',
            confidence: 0.9,
          });
        }
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

  addConnectors(connectorCandidates, collectRowConnectors(flatComponents));
  addConnectors(connectorCandidates, collectTableHeaderConnectors(rawData));
  addConnectors(connectorCandidates, collectDiagramCalloutConnectors(rawData));
  addConnectors(connectorCandidates, collectNotesConnectors(rawData));

  const connectors = deduplicateConnectors(connectorCandidates);
  const primaryConnector = resolvePrimaryConnector(connectors);

  console.log('[T23.6.60 CONNECTOR EXTRACTION]', connectorCandidates);
  console.log('[T23.6.60B NORMALIZED CONNECTORS]', connectors);
  console.log('[T23.6.60 PRIMARY CONNECTOR]', primaryConnector);
  console.log('[T23.6.63A CONNECTOR CLASSIFICATION]', {
    detectedConnectors: connectors.map(connector => connector.partNumber),
    totalComponents: flatComponents.length,
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
    connectors,
    primaryConnector,
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
  
  let componentType = classifyComponentType(partId, raw.detectedUom || null, step);
  const description = extractDescription(raw.rawLine, partId);
  const normalizedPartNumber = normalizePartNumber(partId);
  if (isConnectorPartNumber(normalizedPartNumber)) {
    componentType = 'connector';
  }
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
