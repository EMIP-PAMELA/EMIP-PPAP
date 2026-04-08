/**
 * V5.0 EMIP Core - BOM Parser Service
 * 
 * FOUNDATION LAYER - Shared Parser Engine
 * 
 * PURE PARSER - NO SIDE EFFECTS
 * 
 * Responsibility: Extract structured data from Visual Engineering Master text
 * Input: Raw text from PDF/file extraction
 * Output: RawBOMData with operations, components, and metadata
 * 
 * This parser is PURE and reusable across all feature modules:
 * - NO database calls
 * - NO service imports
 * - NO feature coupling
 * - NO side effects
 * 
 * Architecture:
 * - Extracted from documentEngine/core/bomParser.ts
 * - Now part of EMIP Core foundation layer
 * - Consumed by all feature modules via bomService
 */

import { RawBOMData, RawOperation, RawComponent, PageLog, ProcessInstruction, ParseResult, ParserError, ParserConfidence } from '../data/bom/types';

// ============================================================
// PARSER VERSION
// ============================================================

export const PARSER_VERSION = 'V5.0.0';

// ============================================================
// REGEX PATTERNS FOR PART ID DETECTION
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

/**
 * Extract revision from BOM header
 * 
 * V5.7.3: Canonical revision extraction from header end
 * 
 * CableQuest BOM format:
 * - Leading "M" is NOT the revision
 * - Revision is at END of header line
 * - Formats: "( 01", "(01", "01"
 * - Always 2 digits
 * 
 * @param text Raw BOM text
 * @returns Raw revision string or null if not found
 */
function extractRevision(text: string): string | null {
  // Take first 500 characters for header search (don't scan entire BOM)
  const header = text.substring(0, 500);
  const lines = header.split(/\r?\n/).slice(0, 10);
  
  // V5.7.3: STEP 1 - Find header line with part number
  for (const line of lines) {
    // Header line contains part number pattern (NH or numeric format)
    if (/NH\d{2}-\d{6}-\d{2}|\d{12}/.test(line)) {
      console.log('🧠 V5.7.3 REVISION EXTRACTION - Header line found:', line);
      
      // V5.7.3: STEP 2 - Extract revision from END of line
      // Match optional parenthesis + 2 digits at end, avoiding decimals
      // Negative lookbehind to avoid matching "00" from "1.00"
      const revisionMatch = line.match(/(?<!\d\.)\(?\s*(\d{2})\s*$/);
      
      if (revisionMatch) {
        const extractedRevision = revisionMatch[1];
        
        // V5.7.3: STEP 3 - Validate: ensure NOT part of decimal
        if (/\d+\.\d{2}\s*$/.test(line)) {
          console.log('🧠 V5.7.3 REVISION EXTRACTION - Skipping decimal match:', extractedRevision);
          continue;
        }
        
        console.log('🧠 V5.7.3 REVISION EXTRACTION', {
          headerLine: line.substring(0, 100),
          extractedRevision: extractedRevision,
          source: 'header_end'
        });
        
        return extractedRevision;
      }
    }
  }
  
  // V5.7.3: STEP 5 - Fallback to legacy patterns
  console.log('🧠 V5.7.3 REVISION EXTRACTION - No header-end revision found, trying fallback patterns');
  
  // Pattern 1: REV/REVISION followed by revision value
  const revMatch = header.match(/(?:REV(?:ISION)?\.?|R)[\s:]+([A-Z0-9]{1,10})/i);
  if (revMatch) {
    console.log('🧠 V5.7.3 REVISION EXTRACTION - Fallback match (REV pattern):', revMatch[1]);
    return revMatch[1].trim();
  }
  
  // Pattern 2: Standalone revision in header (e.g., "A" on its own line)
  for (const line of lines) {
    const trimmed = line.trim();
    // Single letter or short alphanumeric that looks like revision
    if (/^[A-Z]$|^[A-Z]{2}$|^\d{1,2}$|^[A-Z]\d{1,2}$/i.test(trimmed)) {
      // Additional check: not part of other data
      if (!line.includes('NH') && !line.includes('Type:') && !line.includes('----')) {
        console.log('🧠 V5.7.3 REVISION EXTRACTION - Fallback match (standalone):', trimmed);
        return trimmed;
      }
    }
  }
  
  console.log('🧠 V5.7.3 REVISION EXTRACTION - No revision found');
  return null;
}

/**
 * Extract revision date from BOM header
 * 
 * V5.2.5: Pure extraction - NO logic
 * 
 * @param text Raw BOM text
 * @returns Raw revision date string or null if not found
 */
function extractRevisionDate(text: string): string | null {
  const header = text.substring(0, 500);
  
  // Pattern: DATE or REV DATE followed by date
  const dateMatch = header.match(/(?:REV(?:ISION)?\s+)?DATE[\s:]+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i);
  if (dateMatch) {
    return dateMatch[1].trim();
  }
  
  // Not found
  return null;
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
  
  console.log(`🧠 [EMIP Core Parser V${PARSER_VERSION}] Starting parse of ${lines.length} lines...`);
  
  // V5.8.2: Track parsing statistics
  let totalLinesProcessed = 0;
  let linesSkipped = 0;
  let componentsParsed = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    totalLinesProcessed++;
    
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
          console.warn(`🧠 [EMIP Core Parser] ⚠️ ${warning}`);
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
    
    if (!trimmedLine) {
      linesSkipped++;
      continue;
    }
    
    if (isOperationLine(line)) {
      const stepInfo = detectStep(line);
      if (stepInfo) {
        if (currentOperation) {
          operations.push(currentOperation);
          console.log(`🧠 [EMIP Core Parser] Operation ${currentOperation.step} complete: ${currentOperation.components.length} components`);
        }
        
        pageOperationCount++;
        
        currentOperation = {
          step: stepInfo.step,
          resourceId: stepInfo.resourceId,
          description: stepInfo.description,
          rawLines: [line],
          components: []
        };
        
        console.log(`🧠 [EMIP Core Parser] Operation --${stepInfo.step}: ${stepInfo.resourceId}`);
        continue;
      }
    }
    
    const dashCount = countLeadingDashes(line);
    
    // V5.8.2: Trace all lines with dashes
    if (dashCount >= 2) {
      if (currentOperation) {
        currentOperation.rawLines.push(line);
      }
      
      // V5.8.2: Log why lines are skipped
      if (dashCount < 4) {
        console.log(`🧠 V5.8.2 PARSE TRACE [Line ${i + 1}]`, {
          line: line.substring(0, 80),
          dashCount,
          parsed: false,
          reason: `Insufficient dashes (need >=4, got ${dashCount})`
        });
        linesSkipped++;
      } else {
        // dashCount >= 4: Attempt to parse as component
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
            componentsParsed++;
            console.log(`🧠 V5.8.2 PARSE TRACE [Line ${i + 1}]`, {
              line: line.substring(0, 80),
              dashCount,
              parsed: true,
              partId,
              operation: currentOperation.step
            });
          } else {
            console.log(`🧠 V5.8.2 PARSE TRACE [Line ${i + 1}]`, {
              line: line.substring(0, 80),
              dashCount,
              parsed: false,
              reason: 'No active operation context'
            });
            linesSkipped++;
          }
          pageComponentCount++;
          console.log(`🧠 [EMIP Core Parser] Component: ${partId} | ACI: ${aciCode || "N/A"}`);
        } catch (e) {
          console.warn(`🧠 [EMIP Core Parser] Error parsing line ${i + 1}, continuing...`, e);
          console.log(`🧠 V5.8.2 PARSE TRACE [Line ${i + 1}]`, {
            line: line.substring(0, 80),
            dashCount,
            parsed: false,
            reason: `Parse error: ${e instanceof Error ? e.message : 'unknown'}`
          });
          linesSkipped++;
          if (currentOperation) {
            currentOperation.rawLines.push(line);
          }
        }
      }
    } else if (trimmedLine && !trimmedLine.includes('PAGE')) {
      // V5.8.2: Log non-dash lines that might be components
      if (trimmedLine.match(/\d{2,}[-\d]+/) || trimmedLine.match(/[A-Z]\d{5,}/)) {
        console.log(`🧠 V5.8.2 PARSE TRACE [Line ${i + 1}]`, {
          line: line.substring(0, 80),
          dashCount,
          parsed: false,
          reason: 'Potential component but no leading dashes'
        });
      }
      linesSkipped++;
    }
  }
  
  if (currentOperation) {
    operations.push(currentOperation);
    console.log(`🧠 [EMIP Core Parser] Operation ${currentOperation.step} complete: ${currentOperation.components.length} components`);
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
      console.warn(`🧠 [EMIP Core Parser] ⚠️ ${warning}`);
    }
  }
  
  const totalComponents = operations.reduce((sum, op) => sum + op.components.length, 0);
  // V5.2.5: Extract revision metadata (pure extraction, no logic)
  const revision_raw = extractRevision(normalizedText);
  const revision_date_raw = extractRevisionDate(normalizedText);
  
  if (revision_raw) {
    console.log(`🧠 [EMIP Core Parser V5.2.5] Extracted revision: ${revision_raw}`);
  }
  
  // V5.8.2: Summary statistics
  console.log(`🧠 V5.8.2 PARSE SUMMARY`, {
    totalLines: totalLinesProcessed,
    linesSkipped,
    componentsParsed,
    operations: operations.length,
    totalComponents,
    parseRate: `${((componentsParsed / totalLinesProcessed) * 100).toFixed(2)}%`
  });
  
  console.log(`🧠 [EMIP Core Parser] Complete: ${masterPN} - ${operations.length} operations, ${totalComponents} components`);
  
  return {
    masterPartNumber: masterPN,
    operations,
    rawText: normalizedText,
    pageLogs,
    revision_raw,
    revision_date_raw
  };
}

/**
 * Parse BOM file from browser upload
 * 
 * @param file File object from browser
 * @returns Promise<RawBOMData>
 */
export async function parseBOMFile(file: File): Promise<RawBOMData> {
  const text = await file.text();
  return parseBOMText(text);
}

/**
 * Parse BOM text with full error handling and confidence scoring
 * 
 * V5.0 enhancement: Returns structured result with errors, warnings, and confidence
 * 
 * @param text Raw text from PDF/file extraction
 * @returns ParseResult with data, errors, warnings, and confidence scoring
 */
export function parseBOMWithValidation(text: string): ParseResult {
  const errors: ParserError[] = [];
  const warnings: ParserError[] = [];
  
  try {
    const data = parseBOMText(text);
    
    // Calculate confidence scores
    const totalComponents = data.operations.reduce((sum, op) => sum + op.components.length, 0);
    const componentsWithACI = data.operations.reduce(
      (sum, op) => sum + op.components.filter(c => c.detectedAci).length, 
      0
    );
    const componentsWithQty = data.operations.reduce(
      (sum, op) => sum + op.components.filter(c => c.detectedQty > 0).length, 
      0
    );
    const componentsWithUOM = data.operations.reduce(
      (sum, op) => sum + op.components.filter(c => c.detectedUom).length, 
      0
    );
    
    const confidence: ParserConfidence = {
      overall: totalComponents > 0 ? (componentsWithQty + componentsWithUOM) / (totalComponents * 2) : 0,
      partIdConfidence: totalComponents > 0 ? totalComponents / totalComponents : 0, // All components have part IDs
      quantityConfidence: totalComponents > 0 ? componentsWithQty / totalComponents : 0,
      uomConfidence: totalComponents > 0 ? componentsWithUOM / totalComponents : 0,
      aciConfidence: totalComponents > 0 ? componentsWithACI / totalComponents : 0,
    };
    
    // Check for warnings from page logs
    data.pageLogs.forEach(log => {
      if (log.warning) {
        warnings.push({
          lineNumber: 0,
          rawLine: `Page ${log.pageNumber}`,
          errorType: 'ocr_issue',
          message: log.warning,
          severity: 'warning'
        });
      }
    });
    
    return {
      success: true,
      data,
      errors,
      warnings,
      confidence
    };
  } catch (error) {
    errors.push({
      lineNumber: 0,
      rawLine: '',
      errorType: 'parse_failed',
      message: error instanceof Error ? error.message : 'Unknown parsing error',
      severity: 'error'
    });
    
    return {
      success: false,
      errors,
      warnings,
      confidence: {
        overall: 0,
        partIdConfidence: 0,
        quantityConfidence: 0,
        uomConfidence: 0,
        aciConfidence: 0
      }
    };
  }
}
