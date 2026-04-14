/**
 * Wire Table Parser — Phase T1
 *
 * Converts body lines from an isolated Apogee wire/connectivity table
 * into structured WireRow records with column-aligned fields.
 *
 * Governance:
 *   - Pure function. No I/O, no DB calls, no side effects. Never throws.
 *   - DOES NOT perform topology reconstruction.
 *   - DOES NOT produce authoritative fields — intermediate data only.
 *   - Multi-line row continuation is supported (common in OCR output).
 *   - All columns are nullable; partial rows are preserved.
 *   - Raw row text is always preserved for evidence traceability.
 *   - Reuses noise-filtering vocabulary from titleBlockRegionExtractor.
 */

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

/** Structured representation of a single wire/connectivity table row. */
export interface WireRow {
  /** Wire identifier (W1, Y1, COM, GND, SHLD, bare numeric, etc.) */
  wireId:       string | null;
  length:       number | null;
  gauge:        string | null;
  color:        string | null;
  /** Connector reference — J1, P2, X3, etc. */
  connectorRef: string | null;
  pin:          string | null;
  /** Treatment keyword: SPLICE or HEAT_SHRINK when present. */
  treatment:    string | null;
  terminal:     string | null;
  /** Raw OCR text for this row. Multi-line rows use '\n' as separator. */
  rawText:      string;
}

export interface WireTableParseResult {
  rows:          WireRow[];
  rowCount:      number;
  /** GOOD ≥ 60% rows have gauge; PARTIAL ≥ 30%; POOR otherwise. */
  parseQuality:  'GOOD' | 'PARTIAL' | 'POOR';
  linesConsumed: number;
  noiseLines:    number;
}

// ---------------------------------------------------------------------------
// Patterns
// ---------------------------------------------------------------------------

/**
 * Wire ID: leading token on a row identifies the wire.
 * Matches: W1, W12, Y1, Y12, bare numerics 1–9999, COM, GND, SHLD, SHIELD, SHD.
 * Anchored to start of trimmed line with a word-boundary after.
 */
const WIRE_ID_RE = /^(W\d{1,4}|\d{1,4}|COM|GND|SHLD|SHIELD|SHD|Y\d{1,3}|N\.?C\.?)\b/i;

const LENGTH_RE      = /\b(\d{1,4}(?:\.\d{1,3})?)\s*(?:IN(?:CH(?:ES)?)?|"|(?=\s|$))/i;
const GAUGE_RE       = /\b(\d{1,2})\s*(?:AWG|GA(?:UGE)?)\b/i;
const GAUGE_BARE_RE  = /\b(1[0-8]|[2-9])\b/; // bare AWG: 2–18 ga

const COLOR_RE = /\b(RED|BLK|BLACK|WHT|WHITE|BLU|BLUE|GRN|GREEN|YEL|YELLOW|ORN|ORANGE|PNK|PINK|VIO|VIOLET|GRA|GRAY|GRY|GREY|BRN|BROWN|TAN|NAT|NATURAL|PUR|PURPLE)\b/i;

/** Connector reference: J1, P2, X3, J11, etc. */
const CONNECTOR_RE   = /\b([JPX]\d{1,3})\b/i;

/** PIN column — explicit PIN keyword or trailing pin number. */
const PIN_EXPLICIT_RE = /\bPIN\s*[-#]?\s*(\d{1,3})\b/i;

/**
 * Terminal / strip part number — dash-separated numeric part numbers
 * (e.g. "929504-1", "1-1293578-4"). Reuses Rheem parser pattern.
 */
const TERMINAL_RE = /\b(\d{1,4}-\d{4,9}(?:-\d{1,4})?|\d{4,9}-\d{1,4})\b/g;

const TREATMENT_SPLICE_RE     = /\bSPLICE\b/i;
const TREATMENT_HEATSHRINK_RE = /\bHEAT[\s-]?SHRINK\b/i;

// ---------------------------------------------------------------------------
// Noise detection
// ---------------------------------------------------------------------------

/**
 * Lines that are purely header labels (column name–only lines) produced when
 * OCR splits multi-row headers. Noise-filter rejects these.
 */
const HEADER_ONLY_RE =
  /^\s*(?:I\.?D\.?|WIRE\s*ID|LENGTH|LEN|GAUGE|AWG|GA|COLOR|COLOUR|STRIP|TERMINAL|PIN|CONN(?:ECTOR)?|CIRCUIT)\s*$/i;

/** Separator lines: runs of dashes, equals, underscores, spaces. */
const SEPARATOR_RE = /^[-=_\s]{3,}$/;

/**
 * Title block / annotation keywords that should never appear in wire table body.
 * Reuses vocabulary from APOGEE_TB_CONTEXT_KW in titleBlockRegionExtractor.
 */
const TB_ANNOTATION_RE =
  /\b(?:DRAWN|APPROVED|DATE|SCALE|SHEET|DWG|TITLE|REVISION|REV\s+NO)\b/i;

function isNoiseLine(line: string): boolean {
  const t = line.trim();
  if (t.length < 3)           return true;
  if (HEADER_ONLY_RE.test(t)) return true;
  if (SEPARATOR_RE.test(t))   return true;
  if (TB_ANNOTATION_RE.test(t)) return true;
  return false;
}

function startsNewWireRow(line: string): boolean {
  return WIRE_ID_RE.test(line.trim());
}

// ---------------------------------------------------------------------------
// Single-line field extractor
// ---------------------------------------------------------------------------

interface LineFields {
  wireId:       string | null;
  length:       number | null;
  gauge:        string | null;
  color:        string | null;
  connectorRef: string | null;
  pin:          string | null;
  treatment:    string | null;
  terminal:     string | null;
}

function extractLineFields(line: string): LineFields {
  const idMatch      = line.trim().match(WIRE_ID_RE);
  const lenMatch     = line.match(LENGTH_RE);
  const gaugeMatch   = line.match(GAUGE_RE) ?? line.match(GAUGE_BARE_RE);
  const colorMatch   = line.match(COLOR_RE);
  const connMatch    = line.match(CONNECTOR_RE);
  const pinMatch     = line.match(PIN_EXPLICIT_RE);

  // Terminal: dash-separated part number; exclude length/gauge/pin numbers already matched
  const knownNums = new Set<string>(
    [lenMatch?.[1], gaugeMatch?.[1], pinMatch?.[1]]
      .filter((v): v is string => v != null),
  );
  TERMINAL_RE.lastIndex = 0;
  let terminal: string | null = null;
  let termMatch: RegExpExecArray | null;
  while ((termMatch = TERMINAL_RE.exec(line)) !== null) {
    if (!knownNums.has(termMatch[1])) {
      terminal = termMatch[1];
      break;
    }
  }

  const treatment =
    TREATMENT_SPLICE_RE.test(line)     ? 'SPLICE'      :
    TREATMENT_HEATSHRINK_RE.test(line) ? 'HEAT_SHRINK' :
    null;

  return {
    wireId:       idMatch    ? idMatch[1]                                : null,
    length:       lenMatch   ? parseFloat(lenMatch[1])                   : null,
    gauge:        gaugeMatch ? gaugeMatch[1]                             : null,
    color:        colorMatch ? colorMatch[1].toUpperCase()               : null,
    connectorRef: connMatch  ? connMatch[1].toUpperCase()                : null,
    pin:          pinMatch   ? pinMatch[1]                               : null,
    treatment,
    terminal,
  };
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

/**
 * Parse structured WireRow records from wire table body lines.
 *
 * @param bodyLines - Lines from detectWireTableRegion().bodyLines (header excluded).
 *
 * Row continuations:
 *   If a line does NOT start with a wire ID it is merged into the previous row,
 *   filling any null fields found there. Accumulated rawText uses '\n' separator.
 */
export function parseWireTableRows(bodyLines: string[]): WireTableParseResult {
  const rows:     WireRow[] = [];
  let noiseLines  = 0;
  let currentRow: WireRow | null = null;

  const flush = () => {
    if (currentRow) rows.push(currentRow);
    currentRow = null;
  };

  for (const raw of bodyLines) {
    const line = raw.trim();

    if (isNoiseLine(line)) {
      noiseLines++;
      continue;
    }

    if (startsNewWireRow(line)) {
      flush();
      const fields = extractLineFields(line);
      currentRow = { ...fields, rawText: raw };
    } else if (currentRow) {
      // Continuation — fill any missing fields from this line
      const cont = extractLineFields(line);
      if (currentRow.length      === null && cont.length      !== null) currentRow.length      = cont.length;
      if (currentRow.gauge       === null && cont.gauge       !== null) currentRow.gauge       = cont.gauge;
      if (currentRow.color       === null && cont.color       !== null) currentRow.color       = cont.color;
      if (currentRow.connectorRef === null && cont.connectorRef !== null) currentRow.connectorRef = cont.connectorRef;
      if (currentRow.pin         === null && cont.pin         !== null) currentRow.pin         = cont.pin;
      if (currentRow.treatment   === null && cont.treatment   !== null) currentRow.treatment   = cont.treatment;
      if (currentRow.terminal    === null && cont.terminal    !== null) currentRow.terminal    = cont.terminal;
      currentRow.rawText += '\n' + raw;
    } else {
      // Orphaned continuation with no open row — try parsing as a standalone row
      const fields      = extractLineFields(line);
      const hasData     = fields.length !== null || fields.gauge !== null || fields.color !== null;
      if (hasData) {
        currentRow = { ...fields, rawText: raw };
      } else {
        noiseLines++;
      }
    }
  }

  flush();

  const rowCount  = rows.length;
  const withGauge = rows.filter(r => r.gauge !== null).length;
  const gaugeRatio = rowCount > 0 ? withGauge / rowCount : 0;

  const parseQuality: WireTableParseResult['parseQuality'] =
    gaugeRatio >= 0.6 ? 'GOOD'    :
    gaugeRatio >= 0.3 ? 'PARTIAL' :
                        'POOR';

  console.log('[T1 WIRE TABLE PARSER]', {
    linesInput:   bodyLines.length,
    noiseLines,
    rowsParsed:   rowCount,
    withGauge,
    parseQuality,
  });

  return {
    rows,
    rowCount,
    parseQuality,
    linesConsumed: bodyLines.length,
    noiseLines,
  };
}
