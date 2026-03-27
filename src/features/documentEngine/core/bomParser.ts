/**
 * BOM Parser - Document Engine Core
 * 
 * PURE PARSER - NO SIDE EFFECTS
 * 
 * Responsibility: Extract raw structured data from Visual Engineering Master text
 * Input: Raw text from PDF/file extraction
 * Output: RawBOMData with operations, components, and metadata
 * 
 * This parser is PURE and reusable:
 * - NO database calls
 * - NO service imports
 * - NO PPAP coupling
 * - NO side effects
 * 
 * Business logic (classification, normalization) belongs in bomNormalizer.ts
 */

import { RawBOMData, RawOperation, RawComponent, PageLog, ProcessInstruction } from '../types/bomTypes';

// ============================================================
// AGNOSTIC CATCH-ALL REGEX PATTERNS FOR MAXIMUM RECALL
// ============================================================

const VENDOR_CATALOG_PATTERN = /([A-Z0-9]{2,20}#[A-Z0-9-]{1,20})/gi;
const LONG_SKU_PATTERN = /\b(\d{10,15})\b/g;
const STANDARD_PART_PATTERN = /\b([A-Z0-9][A-Z0-9-]{4,25})\b/gi;
const ACI_PATTERN = /(ACI[-\s]?\d{4,6})/gi;
const ACI_BRIDGE_PATTERN = /(AC[I1][-\s]?\d{4,6})/gi;

// ============================================================
// PARSING UTILITIES
// ============================================================

function countLeadingDashes(line: string): number {
  const normalized = line.replace(/[–—]/g, '-').trimStart();
  const match = normalized.match(/^(-+)/);
  return match ? match[1].length : 0;
}

function isOperationLine(line: string): boolean {
  const dashCount = countLeadingDashes(line);
  return dashCount >= 2 && dashCount <= 3;
}

function isComponentLine(line: string): boolean {
  const dashCount = countLeadingDashes(line);
  return dashCount >= 4;
}

function extractMasterPN(text: string): string {
  const nhMatch = text.match(/(?:M\s+)?(?:NH)?(\d{12})/);
  if (nhMatch) return nhMatch[1];
  
  const masterMatch = text.match(/^M\s+(NH?\d+)/m);
  if (masterMatch) return masterMatch[1].replace(/^NH/, "");
  
  return "UNKNOWN";
}

function detectStep(line: string): { 
  step: string; 
  resourceId: string; 
  description: string;
  sequenceLabel: string;
} | null {
  const normalizedLine = line.replace(/[–—]/g, '-');
  
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
  
  const simpleMatch = normalizedLine.match(/[-]{2,}(\d{2})(?:\s|$)/);
  if (simpleMatch) {
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

function extractUOMAndQty(line: string): { uom: string | null; qty: number } {
  const uomMatch = line.match(/(\d+\.?\d*)\s*(EA|EACH|FT|FEET|FOOT|IN|INCH|INCHES|PC|PCS|PIECE|SET|KIT|M|METER|CM|MM|YD|YARD|LOT|UNIT)/i);
  if (uomMatch) {
    return {
      qty: parseFloat(uomMatch[1]) || 1,
      uom: uomMatch[2].toUpperCase()
    };
  }
  
  const qtyPerMatch = line.match(/Qty\s*(?:Per)?:?\s*(\d+\.?\d*)\s*(\w+)?/i);
  if (qtyPerMatch) {
    return {
      qty: parseFloat(qtyPerMatch[1]) || 1,
      uom: qtyPerMatch[2]?.toUpperCase() || null
    };
  }
  
  return { uom: null, qty: 1 };
}

const DASH_MARKER_REGEX = /^[ \t]*[-–—]{2,}/;

function normalizeDashes(text: string): string {
  return text.replace(/[–—]/g, '-');
}

function parsePartLine(line: string): { 
  partId: string; 
  aciCode: string | null; 
  fullDescription: string | null;
  uom: string | null;
  qty: number;
} | null {
  const normalizedLine = normalizeDashes(line);
  
  if (!DASH_MARKER_REGEX.test(normalizedLine)) return null;
  
  let cleanLine = normalizedLine
    .replace(/\|/g, " ")
    .replace(/\t+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  
  const afterDashes = cleanLine.replace(/^[-]+\s*/, '');
  
  if (!afterDashes || afterDashes.length < 2) return null;
  
  const tokens = afterDashes.split(/\s+/);
  if (tokens.length === 0) return null;
  
  const partId = tokens[0].trim();
  
  if (partId.length < 2) return null;
  
  const rest = tokens.slice(1).join(' ');
  
  const { uom, qty } = extractUOMAndQty(normalizedLine);
  
  const aciMatch = rest.match(/(AC[I1][-\s]?\d{4,6})/i);
  const aciCode = aciMatch ? aciMatch[1].replace(/[-\s]/g, "").replace(/^AC1/i, "ACI").toUpperCase() : null;
  
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

function extractProcessNotes(text: string): ProcessInstruction[] {
  const notes: ProcessInstruction[] = [];
  const lines = text.split(/\r?\n/);
  let currentStep = "00";
  
  for (const line of lines) {
    const stepInfo = detectStep(line);
    if (stepInfo) {
      currentStep = stepInfo.step;
      continue;
    }
    
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

function extractAllPartIds(line: string): string[] {
  const ids: string[] = [];
  
  VENDOR_CATALOG_PATTERN.lastIndex = 0;
  LONG_SKU_PATTERN.lastIndex = 0;
  STANDARD_PART_PATTERN.lastIndex = 0;
  ACI_PATTERN.lastIndex = 0;
  ACI_BRIDGE_PATTERN.lastIndex = 0;
  
  let match;
  while ((match = ACI_BRIDGE_PATTERN.exec(line)) !== null) {
    const normalized = match[1].replace(/[-\s]/g, "").replace(/^AC1/i, "ACI").toUpperCase();
    if (!ids.includes(normalized)) {
      ids.push(normalized);
    }
  }
  
  while ((match = VENDOR_CATALOG_PATTERN.exec(line)) !== null) {
    if (!ids.includes(match[1])) {
      ids.push(match[1]);
    }
  }
  
  while ((match = LONG_SKU_PATTERN.exec(line)) !== null) {
    if (!ids.includes(match[1])) {
      ids.push(match[1]);
    }
  }
  
  while ((match = STANDARD_PART_PATTERN.exec(line)) !== null) {
    const candidate = match[1];
    if (!ids.includes(candidate) && 
        candidate.length >= 5 && 
        !/^(TYPE|STEP|SETUP|RESOURCE|DESCRIPTION|MACHINE|GENERAL)$/i.test(candidate)) {
      ids.push(candidate);
    }
  }
  
  return ids;
}

// ============================================================
// MAIN PARSER FUNCTION
// ============================================================

/**
 * Parse Visual Engineering Master text into raw BOM data
 * 
 * PURE FUNCTION - NO SIDE EFFECTS
 * 
 * @param text Raw text from PDF/file extraction
 * @returns RawBOMData structure with operations and components
 */
export function parseBOMText(text: string): RawBOMData {
  const normalizedText = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ');
  
  const lines = normalizedText.split('\n');
  const masterPN = extractMasterPN(normalizedText);
  
  const operations: RawOperation[] = [];
  const pageLogs: PageLog[] = [];
  
  let currentOperation: RawOperation | null = null;
  
  let currentPage = 1;
  let pageComponentCount = 0;
  let pageOperationCount = 0;
  let pageHasText = false;
  
  console.log(`[BOMParser] Starting parse of ${lines.length} lines...`);
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    
    if (trimmedLine.includes('--- PAGE') || trimmedLine.match(/^-{3,}\s*PAGE\s*\d+/i)) {
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
          console.warn(`[BOMParser] ⚠️ ${warning}`);
        }
      }
      currentPage++;
      pageComponentCount = 0;
      pageOperationCount = 0;
      pageHasText = false;
      continue;
    }
    
    if (trimmedLine) {
      pageHasText = true;
    }
    
    if (!trimmedLine) continue;
    
    if (isOperationLine(line)) {
      const stepInfo = detectStep(line);
      if (stepInfo) {
        if (currentOperation) {
          operations.push(currentOperation);
          console.log(`[BOMParser] Operation ${currentOperation.step} complete: ${currentOperation.components.length} components`);
        }
        
        pageOperationCount++;
        
        currentOperation = {
          step: stepInfo.step,
          resourceId: stepInfo.resourceId,
          description: stepInfo.description,
          rawLines: [line],
          components: []
        };
        
        console.log(`[BOMParser] Operation --${stepInfo.step}: ${stepInfo.resourceId}`);
        continue;
      }
    }
    
    const dashCount = countLeadingDashes(line);
    if (dashCount >= 2) {
      if (currentOperation) {
        currentOperation.rawLines.push(line);
      }
      
      if (dashCount >= 4) {
        try {
          const partInfo = parsePartLine(line);
          const candidateIds = extractAllPartIds(line);
          
          const partId = partInfo?.partId || candidateIds[0] || `LINE_${i + 1}`;
          
          const aciMatch = line.match(ACI_PATTERN);
          const aciCode = partInfo?.aciCode || (aciMatch ? aciMatch[1].replace(/-/g, '').toUpperCase() : null);
          
          const component: RawComponent = {
            rawLine: line,
            candidateIds,
            detectedPartId: partId,
            detectedAci: aciCode,
            detectedQty: partInfo?.qty || 1,
            detectedUom: partInfo?.uom || null
          };
          
          if (currentOperation) {
            currentOperation.components.push(component);
          }
          pageComponentCount++;
          console.log(`[BOMParser] Component: ${partId} | ACI: ${aciCode || "N/A"}`);
        } catch (e) {
          console.warn(`[BOMParser] Error parsing line ${i + 1}, continuing...`, e);
          if (currentOperation) {
            currentOperation.rawLines.push(line);
          }
        }
      }
    }
  }
  
  if (currentOperation) {
    operations.push(currentOperation);
    console.log(`[BOMParser] Operation ${currentOperation.step} complete: ${currentOperation.components.length} components`);
  }
  
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
      console.warn(`[BOMParser] ⚠️ ${warning}`);
    }
  }
  
  const totalComponents = operations.reduce((sum, op) => sum + op.components.length, 0);
  console.log(`[BOMParser] Complete: ${masterPN} - ${operations.length} operations, ${totalComponents} components`);
  
  return {
    masterPartNumber: masterPN,
    operations,
    rawText: normalizedText,
    pageLogs
  };
}

/**
 * Parse BOM file (stub implementation)
 * 
 * Future implementation will handle File objects from browser upload
 * 
 * @param file File object from browser
 * @returns Promise<RawBOMData>
 */
export async function parseBOMFile(file: File): Promise<RawBOMData> {
  const text = await file.text();
  return parseBOMText(text);
}
