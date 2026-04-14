/**
 * Rheem Drawing Intelligence Engine — Phase 3H.43.X
 *
 * Structured parser for Rheem customer drawings (45-XXXXX-XX format).
 * Transforms raw OCR text into a canonical engineering data model with:
 *   - Title block extraction (part number, revision, description)
 *   - Wire table parsing (ID, length, gauge, color, pin)
 *   - Connector table parsing (manufacturer, part number, torque, color)
 *   - Notes extraction (tolerances, instructions)
 *
 * Governance:
 *   - This parser is ONLY invoked when drawing subtype is CUSTOMER_DRAWING
 *     and the Rheem PN pattern (45-XXXXX-XX) is detected.
 *   - No DB writes. No side effects. Pure extraction.
 *   - Results are bridged into the signal system via analyzeIngestion.
 */

// ---------------------------------------------------------------------------
// Types — Rheem Drawing Model
// ---------------------------------------------------------------------------

export interface RheemWireRow {
  id: string;
  length: number | null;
  gauge: string | null;
  color: string | null;
  pin: number | null;
  /** Phase 3H.44 C4.2: Terminal part number extracted from wire table (e.g. "929504-1"). */
  terminal: string | null;
  rawText: string;
}

export interface RheemConnector {
  manufacturer: string | null;
  partNumber: string | null;
  torque: string | null;
  color: string | null;
  rawText: string;
}

export interface RheemNotes {
  tolerances: string[];
  instructions: string[];
}

export interface RheemTitleBlock {
  partNumber: string | null;
  revision: string | null;
  description: string | null;
  anchorFound: boolean;
  confidence: number;
}

export interface RheemDrawingModel {
  partNumber: string | null;
  revision: string | null;
  description: string | null;
  wires: RheemWireRow[];
  connectors: RheemConnector[];
  notes: RheemNotes;
  titleBlock: RheemTitleBlock;
  parseQuality: {
    wireTableDetected: boolean;
    connectorTableDetected: boolean;
    titleBlockDetected: boolean;
    wireCount: number;
    connectorCount: number;
    toleranceCount: number;
  };
  /** Phase 3H.43.Y: Normalized title block text after vertical reinterpretation, if applied. */
  normalizedTitleBlockText?: string | null;
  /** Phase 3H.43.Y: True when vertical normalization was applied before title block parsing. */
  verticalNormalizationApplied?: boolean;
}

export interface RheemTableRegion {
  type: 'WIRE_TABLE' | 'CONNECTOR_TABLE';
  headerLineIndex: number;
  rows: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RHEEM_PN_PATTERN = /\b(45-\d{5,6}-\d{2,4}[A-Z]?)\b/;
const TITLE_BLOCK_ANCHOR = /REV\s+PART\s+NO\.?/i;
const TITLE_BLOCK_SCAN_LIMIT = 40;

const REJECT_REVISION_FRAGMENTS = new Set([
  'ISED', 'EVISED', 'EVISION', 'ISE', 'REVIS', 'EVISE',
]);

const REVISION_TOKEN = /^\d{2}$/;

const WIRE_TABLE_HEADERS = ['I.D.', 'LENGTH', 'GAUGE'];
const WIRE_TABLE_HEADER_PATTERN = /\b(?:I\.?D\.?|WIRE\s*ID)\b.*\b(?:LENGTH|LEN)\b.*\b(?:GAUGE|AWG|GA)\b/i;
const WIRE_TABLE_LOOSE_PATTERN = /\b(?:I\.?D\.?|WIRE\s*ID|CIRCUIT)\b.*\b(?:LENGTH|LEN)\b/i;

const CONNECTOR_TABLE_HEADERS = ['MANUFACTURER', 'PART NUMBER'];
const CONNECTOR_TABLE_PATTERN = /\bMANUFACTURER\b.*\bPART\s*(?:NO\.?|NUMBER)\b/i;

const LENGTH_RE = /\b(\d{1,4}(?:\.\d{1,3})?)\s*(?:IN|"|\s|$)/i;
const GAUGE_RE = /\b(\d{1,2})\s*(?:AWG|GA(?:UGE)?)\b/i;
const GAUGE_BARE_RE = /\b(1[0-8]|[2-9])\b/;
const COLOR_RE = /\b(RED|BLK|BLACK|WHT|WHITE|BLU|BLUE|GRN|GREEN|YEL|YELLOW|ORN|ORANGE|PNK|PINK|VIO|VIOLET|GRA|GRAY|GRY|GREY|BRN|BROWN|TAN|NAT|NATURAL|PUR|PURPLE)\b/i;
const PIN_RE = /\bPIN\s*[-#]?\s*(\d{1,3})\b/i;
const PIN_BARE_RE = /\b(\d{1,2})\s*$/;
/** Phase 3H.44 C4.2: Matches dash-separated terminal/connector part numbers (e.g. "929504-1", "1-1293578-4"). */
const TERMINAL_RE = /\b(\d{1,4}-\d{4,9}(?:-\d{1,4})?)\b/g;

const TOLERANCE_PATTERN = /\b(?:TOLERANCE|TOL\.?)\b/i;
const WIRE_LENGTH_TOLERANCE_PATTERN = /WIRE\s+LENGTH\s+TOLERANCE/i;
const TOLERANCE_RANGE_RE = /(\d+(?:\.\d+)?)\s*(?:TO|-)\s*(\d+(?:\.\d+)?)\s*(?:IN(?:CH(?:ES)?)?|"|\s).*?[±+\-]\s*(\d+(?:\.\d+)?)/i;

// ---------------------------------------------------------------------------
// Step 1 — Drawing Type Detection
// ---------------------------------------------------------------------------

export function detectRheemDrawing(text: string, fileName: string): boolean {
  return RHEEM_PN_PATTERN.test(text) || RHEEM_PN_PATTERN.test(fileName);
}

// ---------------------------------------------------------------------------
// Step 2 — Title Block Anchor Extraction
// ---------------------------------------------------------------------------

function splitLines(text: string): string[] {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && l.length < 300);
}

function isValidRevisionToken(value: string): boolean {
  if (!value) return false;
  const v = value.trim().toUpperCase();
  if (v.length === 0 || v.length > 4) return false;
  if (REJECT_REVISION_FRAGMENTS.has(v)) return false;
  return REVISION_TOKEN.test(v) || /^[A-Z]{1,2}$/.test(v);
}

export function extractRheemTitleBlock(textLines: string[]): RheemTitleBlock {
  const result: RheemTitleBlock = {
    partNumber: null,
    revision: null,
    description: null,
    anchorFound: false,
    confidence: 0,
  };

  const zones: Array<{ label: string; lines: string[] }> = [
    { label: 'last40', lines: textLines.slice(-TITLE_BLOCK_SCAN_LIMIT) },
    { label: 'first40', lines: textLines.slice(0, TITLE_BLOCK_SCAN_LIMIT) },
  ];

  for (const { label, lines } of zones) {
    const anchorIdx = lines.findIndex(l => TITLE_BLOCK_ANCHOR.test(l));
    if (anchorIdx === -1) continue;

    result.anchorFound = true;

    const window = lines.slice(anchorIdx + 1, anchorIdx + 12);

    for (let i = 0; i < window.length; i++) {
      const line = window[i];
      const pnMatch = line.match(RHEEM_PN_PATTERN);
      if (!pnMatch) continue;

      result.partNumber = pnMatch[1];

      // Case B: revision inline after PN — e.g. "45-42522-235 02"
      const tokens = line.trim().split(/\s+/);
      if (tokens.length >= 2) {
        const last = tokens[tokens.length - 1];
        if (!RHEEM_PN_PATTERN.test(last) && isValidRevisionToken(last)) {
          result.revision = last;
          result.confidence = 0.97;
          break;
        }
      }

      // Case A: revision on next line
      for (let j = i + 1; j < window.length && j <= i + 4; j++) {
        const next = window[j].trim();
        if (!next) continue;

        if (isValidRevisionToken(next)) {
          result.revision = next;
          result.confidence = 0.96;
          break;
        }

        const nextTokens = next.split(/\s+/);
        const nextLast = nextTokens[nextTokens.length - 1];
        if (isValidRevisionToken(nextLast)) {
          result.revision = nextLast;
          result.confidence = 0.95;
          break;
        }
        break;
      }
      break;
    }

    if (result.partNumber) {
      if (!result.revision) result.confidence = 0.85;
      console.log('[RHEEM TITLE BLOCK]', { zone: label, anchorIdx, ...result });
      break;
    }
  }

  // Fallback: search full text for PN if anchor method failed
  if (!result.partNumber) {
    for (const line of textLines) {
      const pnMatch = line.match(RHEEM_PN_PATTERN);
      if (pnMatch) {
        result.partNumber = pnMatch[1];
        result.confidence = 0.80;
        break;
      }
    }
  }

  // Description extraction — look for harness/assembly title
  const descPatterns = [
    /(?:WIRE\s+HARNESS|ASSEMBLY|CABLE\s+ASSY|WIRING\s+DIAGRAM|HARNESS\s+ASSY)[^\n]{0,80}/i,
    /(?:DESCRIPTION|TITLE)[:\s]+([^\n]{5,80})/i,
  ];
  for (const pattern of descPatterns) {
    for (const line of textLines) {
      const m = line.match(pattern);
      if (m) {
        result.description = (m[1] ?? m[0]).replace(/\s+/g, ' ').trim().slice(0, 120);
        break;
      }
    }
    if (result.description) break;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Step 3 — Table Detection Engine
// ---------------------------------------------------------------------------

export function detectTableRegions(textLines: string[]): RheemTableRegion[] {
  const regions: RheemTableRegion[] = [];

  for (let i = 0; i < textLines.length; i++) {
    const line = textLines[i];

    // Wire table detection
    if (WIRE_TABLE_HEADER_PATTERN.test(line) || WIRE_TABLE_LOOSE_PATTERN.test(line)) {
      const isStrict = WIRE_TABLE_HEADER_PATTERN.test(line);
      const rows: string[] = [];
      for (let j = i + 1; j < textLines.length; j++) {
        const row = textLines[j];
        // Stop at section breaks
        if (/^(?:NOTES?|REVISION|TITLE|DRAWN|APPROVED|CHECKED|DATE|CONNECTOR|MANUFACTURER|UNLESS|GENERAL)/i.test(row)) break;
        if (row.length < 4) continue;
        // Skip if it looks like another header
        if (WIRE_TABLE_HEADER_PATTERN.test(row) || CONNECTOR_TABLE_PATTERN.test(row)) break;
        rows.push(row);
      }
      if (rows.length > 0 || isStrict) {
        regions.push({ type: 'WIRE_TABLE', headerLineIndex: i, rows });
      }
    }

    // Connector table detection
    if (CONNECTOR_TABLE_PATTERN.test(line)) {
      const rows: string[] = [];
      for (let j = i + 1; j < textLines.length; j++) {
        const row = textLines[j];
        if (/^(?:NOTES?|REVISION|TITLE|DRAWN|APPROVED|CHECKED|DATE|WIRE\s+TABLE|I\.?D\.?)/i.test(row)) break;
        if (row.length < 4) continue;
        if (WIRE_TABLE_HEADER_PATTERN.test(row)) break;
        rows.push(row);
      }
      if (rows.length > 0) {
        regions.push({ type: 'CONNECTOR_TABLE', headerLineIndex: i, rows });
      }
    }
  }

  return regions;
}

// ---------------------------------------------------------------------------
// Step 4 — Wire Table Parser
// ---------------------------------------------------------------------------

export function parseWireTable(rows: string[]): RheemWireRow[] {
  const wires: RheemWireRow[] = [];
  let idCounter = 0;

  for (const raw of rows) {
    // Skip very short or clearly non-data lines
    if (raw.length < 6) continue;
    if (/^[A-Z\s]{2,20}$/.test(raw) && !/\d/.test(raw)) continue;

    const lengthMatch = raw.match(LENGTH_RE);
    const gaugeMatch = raw.match(GAUGE_RE) ?? raw.match(GAUGE_BARE_RE);
    const colorMatch = raw.match(COLOR_RE);
    const pinMatch = raw.match(PIN_RE);

    // Must have at least one numeric field to qualify
    const hasData = lengthMatch || gaugeMatch;
    if (!hasData) continue;

    // Wire ID — leading alphanumeric token
    const idMatch = raw.match(/^([A-Z]?\d{1,4})\s/i);
    const wireId = idMatch ? idMatch[1] : `W${++idCounter}`;

    // Pin extraction: explicit PIN marker or trailing bare number
    let pin: number | null = null;
    if (pinMatch) {
      pin = parseInt(pinMatch[1], 10);
    } else {
      const barePin = raw.match(PIN_BARE_RE);
      if (barePin && lengthMatch && barePin[1] !== lengthMatch[1]) {
        const candidate = parseInt(barePin[1], 10);
        if (candidate <= 50) pin = candidate;
      }
    }

    // Phase 3H.44 C4.2: Terminal — dash-separated part number not already captured as length/gauge/pin
    const knownNums = new Set<string>([
      lengthMatch?.[1],
      gaugeMatch?.[1],
      pinMatch?.[1],
    ].filter((v): v is string => v != null));
    TERMINAL_RE.lastIndex = 0;
    let termMatch: RegExpExecArray | null;
    let terminal: string | null = null;
    while ((termMatch = TERMINAL_RE.exec(raw)) !== null) {
      if (!knownNums.has(termMatch[1])) {
        terminal = termMatch[1];
        break;
      }
    }

    wires.push({
      id: wireId,
      length: lengthMatch ? parseFloat(lengthMatch[1]) : null,
      gauge: gaugeMatch ? gaugeMatch[1] : null,
      color: colorMatch ? colorMatch[1].toUpperCase() : null,
      pin,
      terminal,
      rawText: raw,
    });
  }

  console.log('[RHEEM WIRE TABLE]', { rowsInput: rows.length, wiresParsed: wires.length });
  return wires;
}

// ---------------------------------------------------------------------------
// Step 5 — Connector Table Parser
// ---------------------------------------------------------------------------

export function parseConnectorTable(rows: string[]): RheemConnector[] {
  const connectors: RheemConnector[] = [];

  for (const raw of rows) {
    if (raw.length < 6) continue;

    const tokens = raw.split(/\s{2,}|\t/);
    if (tokens.length < 2) continue;

    const manufacturer = tokens[0]?.trim() || null;
    const partNumber = tokens[1]?.trim() || null;
    const torqueMatch = raw.match(/\b(\d+(?:\.\d+)?\s*(?:IN[.-]?LB|FT[.-]?LB|N[.-]?M|NM))\b/i);
    const colorMatch = raw.match(COLOR_RE);

    if (!manufacturer && !partNumber) continue;

    connectors.push({
      manufacturer,
      partNumber,
      torque: torqueMatch ? torqueMatch[1].replace(/\s+/g, ' ').trim() : null,
      color: colorMatch ? colorMatch[1].toUpperCase() : null,
      rawText: raw,
    });
  }

  console.log('[RHEEM CONNECTOR TABLE]', { rowsInput: rows.length, connectorsParsed: connectors.length });
  return connectors;
}

// ---------------------------------------------------------------------------
// Step 6 — Notes Parser
// ---------------------------------------------------------------------------

export function extractRheemNotes(textLines: string[]): RheemNotes {
  const tolerances: string[] = [];
  const instructions: string[] = [];

  let inToleranceBlock = false;
  let inNotesBlock = false;

  for (const line of textLines) {
    const upper = line.toUpperCase();

    // Detect tolerance section
    if (WIRE_LENGTH_TOLERANCE_PATTERN.test(line) || (TOLERANCE_PATTERN.test(line) && upper.includes('LENGTH'))) {
      inToleranceBlock = true;
      inNotesBlock = false;
      continue;
    }

    // Detect general notes
    if (/^(?:GENERAL\s+)?NOTES?[:\s]*$/i.test(line)) {
      inNotesBlock = true;
      inToleranceBlock = false;
      continue;
    }

    // End of block heuristics
    if (/^(?:REVISION|TITLE|DRAWN|APPROVED|CHECKED|DATE|REV\s+PART)/i.test(line)) {
      inToleranceBlock = false;
      inNotesBlock = false;
      continue;
    }

    if (inToleranceBlock) {
      if (line.length > 3 && /\d/.test(line)) {
        tolerances.push(line);
      } else if (line.length < 3 || /^\s*$/.test(line)) {
        inToleranceBlock = false;
      }
    }

    if (inNotesBlock) {
      if (/^\d+[.)]\s+.{5,}/.test(line)) {
        instructions.push(line);
      } else if (line.length > 10) {
        // Continuation of previous note
        const lastIdx = instructions.length - 1;
        if (lastIdx >= 0) {
          instructions[lastIdx] += ' ' + line;
        }
      }
    }

    // Standalone tolerance lines
    if (!inToleranceBlock && TOLERANCE_RANGE_RE.test(line)) {
      tolerances.push(line);
    }
  }

  console.log('[RHEEM NOTES]', { tolerances: tolerances.length, instructions: instructions.length });
  return { tolerances, instructions };
}

// ---------------------------------------------------------------------------
// Step 4 — Vertical Title Block Text Normalization (Phase 3H.43.Y)
// ---------------------------------------------------------------------------

/**
 * Detect if lines look like they originate from a vertically-oriented text strip.
 * Signals: high proportion of short lines (1–6 chars), or many single-token lines
 * that form coherent patterns when read sequentially.
 */
export function looksLikeVerticalStrip(lines: string[]): boolean {
  if (lines.length < 8) return false;
  const shortLines = lines.filter(l => l.length >= 1 && l.length <= 8);
  return shortLines.length / lines.length >= 0.55;
}

/**
 * Attempt to normalize vertical title block text into horizontal reading order.
 *
 * When a Rheem drawing's left-side title block is OCR'd, the text can be extracted
 * column-by-column rather than row-by-row, resulting in many very short lines.
 * This normalizer tries to reconstruct logical lines by grouping short fragments
 * that are likely part of the same label/value pair.
 *
 * Returns: { normalized: string[], wasNormalized: boolean }
 *   - normalized: the best set of lines to parse from (may be original if not vertical)
 *   - wasNormalized: true if vertical strip was detected and lines were reassembled
 */
export function normalizeVerticalTitleBlockText(
  lines: string[],
): { normalized: string[]; wasNormalized: boolean } {
  const isVertical = looksLikeVerticalStrip(lines);
  if (!isVertical) return { normalized: lines, wasNormalized: false };

  // Reassembly strategy: group runs of short (<= 8 char) lines into one token-line,
  // separated whenever we hit a longer line or a known delimiter token.
  const result: string[] = [];
  let buffer: string[] = [];

  const flush = () => {
    if (buffer.length > 0) {
      result.push(buffer.join(' ').trim());
      buffer = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { flush(); continue; }

    if (trimmed.length > 12) {
      // Long line — flush buffer then add as-is
      flush();
      result.push(trimmed);
    } else if (/^[A-Z]{2,}$/.test(trimmed) && trimmed.length >= 3) {
      // Looks like a keyword (DATE, SHEET, REV, etc.) — start a new group
      flush();
      buffer.push(trimmed);
    } else {
      buffer.push(trimmed);
    }
  }
  flush();

  console.log('[RHEEM VERTICAL NORMALIZE]', {
    inputLines: lines.length,
    outputLines: result.length,
    shortLineFraction: (lines.filter(l => l.length <= 8).length / lines.length).toFixed(2),
  });

  return { normalized: result, wasNormalized: true };
}

// ---------------------------------------------------------------------------
// Step 7 — Main Entry Point
// ---------------------------------------------------------------------------

export function parseRheemDrawing(text: string, fileName: string): RheemDrawingModel {
  const textLines = splitLines(text);

  console.log('[RHEEM PARSER START]', { fileName, lineCount: textLines.length, textLength: text.length });

  // Step 4 (Phase 3H.43.Y): Try vertical normalization on title block candidate lines
  // Primary: last 40 lines (title block is typically at the bottom of Rheem drawings)
  const titleBlockCandidateLines = textLines.length > 40
    ? [...textLines.slice(-40), ...textLines.slice(0, 40)]
    : textLines;
  const { normalized: normalizedTbLines, wasNormalized } =
    normalizeVerticalTitleBlockText(titleBlockCandidateLines);

  // Step 2: Title block extraction — try normalized first, fall back to original
  let titleBlock = extractRheemTitleBlock(normalizedTbLines);
  if (!titleBlock.partNumber || !titleBlock.anchorFound) {
    const fallback = extractRheemTitleBlock(textLines);
    if (fallback.confidence > titleBlock.confidence) {
      titleBlock = fallback;
    }
  }

  // Step 3: Table detection
  const tableRegions = detectTableRegions(textLines);

  // Step 4: Wire table parsing
  const wireRegions = tableRegions.filter(r => r.type === 'WIRE_TABLE');
  const allWireRows = wireRegions.flatMap(r => r.rows);
  const wires = parseWireTable(allWireRows);

  // Step 5: Connector parsing
  const connectorRegions = tableRegions.filter(r => r.type === 'CONNECTOR_TABLE');
  const allConnectorRows = connectorRegions.flatMap(r => r.rows);
  const connectors = parseConnectorTable(allConnectorRows);

  // Step 6: Notes
  const notes = extractRheemNotes(textLines);

  const model: RheemDrawingModel = {
    partNumber: titleBlock.partNumber,
    revision: titleBlock.revision,
    description: titleBlock.description,
    wires,
    connectors,
    notes,
    titleBlock,
    parseQuality: {
      wireTableDetected: wireRegions.length > 0,
      connectorTableDetected: connectorRegions.length > 0,
      titleBlockDetected: titleBlock.anchorFound,
      wireCount: wires.length,
      connectorCount: connectors.length,
      toleranceCount: notes.tolerances.length,
    },
    normalizedTitleBlockText: wasNormalized ? normalizedTbLines.join('\n').slice(0, 600) : null,
    verticalNormalizationApplied: wasNormalized,
  };

  console.log('[RHEEM PARSER COMPLETE]', {
    fileName,
    partNumber: model.partNumber,
    revision: model.revision,
    wires: model.wires.length,
    connectors: model.connectors.length,
    tolerances: model.notes.tolerances.length,
    instructions: model.notes.instructions.length,
    quality: model.parseQuality,
  });

  return model;
}

// ---------------------------------------------------------------------------
// Step 11 — Future Hook (DO NOT IMPLEMENT FULLY)
// ---------------------------------------------------------------------------

export interface PinRelationship {
  wireId: string;
  connectorId: string | null;
  pin: number | null;
  terminal: string | null;
}

/**
 * Placeholder: builds pin-to-connector relationships from parsed wires and connectors.
 * Full implementation deferred to Phase 3H.44 when vision/graph extraction is available.
 */
export function buildPinRelationships(
  _wires: RheemWireRow[],
  _connectors: RheemConnector[],
): PinRelationship[] {
  console.log('[RHEEM PIN RELATIONSHIPS] Placeholder — full implementation deferred to Phase 3H.44');
  return [];
}
