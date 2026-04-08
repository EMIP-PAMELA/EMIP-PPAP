/**
 * V5.6 EMIP Core - BOM Parser (MVP)
 * 
 * PARSER LAYER - Text to Structured Data
 * 
 * Responsibilities:
 * - Parse BOM text into structured components
 * - Identify wires with gauge, length, quantity
 * - Extract basic component information
 * - Provide normalized output for ingestion
 * 
 * Architecture:
 * - Simple line-by-line parsing
 * - Pattern matching for wire components
 * - Returns structured component array
 */

export interface ParsedComponent {
  type: 'wire' | 'connector' | 'component';
  gauge?: string;
  length?: number;
  lengthUnit?: string;
  quantity?: number;
  color?: string;
  description?: string;
  rawLine?: string;
}

export interface ParsedBOM {
  components: ParsedComponent[];
  rawText?: string;
}

/**
 * Parse BOM text into structured components
 * 
 * MVP logic:
 * - Line-by-line processing
 * - Pattern matching for wire gauges, lengths, quantities
 * - Basic component extraction
 * 
 * @param text Raw BOM text
 * @returns Parsed BOM with components
 */
export function parseBOMText(text: string): ParsedBOM {
  console.log('🧠 V5.6 [BOM Parser] Starting parse', {
    textLength: text.length
  });

  const components: ParsedComponent[] = [];
  const lines = text.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Skip empty lines or very short lines
    if (!trimmedLine || trimmedLine.length < 5) {
      continue;
    }

    // Attempt to parse as wire component
    const wireComponent = parseWireLine(trimmedLine);
    if (wireComponent) {
      components.push(wireComponent);
      continue;
    }

    // Attempt to parse as connector
    const connectorComponent = parseConnectorLine(trimmedLine);
    if (connectorComponent) {
      components.push(connectorComponent);
      continue;
    }

    // Otherwise, parse as generic component
    const genericComponent = parseGenericLine(trimmedLine);
    if (genericComponent) {
      components.push(genericComponent);
    }
  }

  console.log('🧠 V5.6 PARSED COMPONENTS', {
    count: components.length,
    wires: components.filter(c => c.type === 'wire').length,
    connectors: components.filter(c => c.type === 'connector').length,
    others: components.filter(c => c.type === 'component').length
  });

  return {
    components,
    rawText: text
  };
}

/**
 * Parse line as wire component
 * 
 * Looks for patterns like:
 * - 18AWG, 20 AWG, 22 GA
 * - lengths: 10 ft, 5 inches, 12"
 * - quantities: QTY 2, (5), x3
 */
function parseWireLine(line: string): ParsedComponent | null {
  // Pattern: gauge (e.g., 18AWG, 20 AWG, 22GA)
  const gaugeMatch = line.match(/(\d{1,2})\s*(?:AWG|GA|GAUGE)/i);
  
  if (!gaugeMatch) {
    return null; // Not a wire line
  }

  const gauge = gaugeMatch[1];

  // Pattern: length (e.g., 10 ft, 5.5 inches, 12")
  const lengthMatch = line.match(/(\d+\.?\d*)\s*(ft|feet|inch|inches|in|")/i);
  let length = 0;
  let lengthUnit = 'ft';

  if (lengthMatch) {
    length = parseFloat(lengthMatch[1]);
    const unit = lengthMatch[2].toLowerCase();
    
    // Normalize to feet
    if (unit.includes('inch') || unit === 'in' || unit === '"') {
      length = length / 12; // Convert inches to feet
      lengthUnit = 'ft';
    } else {
      lengthUnit = 'ft';
    }
  }

  // Pattern: quantity (e.g., QTY 2, (5), x3, 2 EA)
  const qtyMatch = line.match(/(?:qty|quantity|\(|\bx)\s*(\d+)|(\d+)\s*(?:ea|each|\))/i);
  const quantity = qtyMatch ? parseInt(qtyMatch[1] || qtyMatch[2]) : 1;

  // Pattern: color (e.g., RED, BLK, WHT)
  const colorMatch = line.match(/\b(red|black|white|blue|green|yellow|orange|brown|gray|grey|blk|wht|blu|grn|yel|org|brn|gry)\b/i);
  const color = colorMatch ? colorMatch[1].toUpperCase() : undefined;

  return {
    type: 'wire',
    gauge,
    length,
    lengthUnit,
    quantity,
    color,
    description: line,
    rawLine: line
  };
}

/**
 * Parse line as connector component
 * 
 * Looks for patterns like:
 * - CONNECTOR, CONN, PLUG, SOCKET
 */
function parseConnectorLine(line: string): ParsedComponent | null {
  const connectorPattern = /\b(connector|conn|plug|socket|terminal|crimp)\b/i;
  
  if (!connectorPattern.test(line)) {
    return null;
  }

  // Pattern: quantity
  const qtyMatch = line.match(/(?:qty|quantity|\(|\bx)\s*(\d+)|(\d+)\s*(?:ea|each|\))/i);
  const quantity = qtyMatch ? parseInt(qtyMatch[1] || qtyMatch[2]) : 1;

  return {
    type: 'connector',
    quantity,
    description: line,
    rawLine: line
  };
}

/**
 * Parse line as generic component
 * 
 * Fallback for lines that contain part numbers or descriptions
 */
function parseGenericLine(line: string): ParsedComponent | null {
  // Must contain at least some alphanumeric content
  if (!/[a-zA-Z0-9]{3,}/.test(line)) {
    return null;
  }

  // Pattern: quantity
  const qtyMatch = line.match(/(?:qty|quantity|\(|\bx)\s*(\d+)|(\d+)\s*(?:ea|each|\))/i);
  const quantity = qtyMatch ? parseInt(qtyMatch[1] || qtyMatch[2]) : 1;

  return {
    type: 'component',
    quantity,
    description: line,
    rawLine: line
  };
}
