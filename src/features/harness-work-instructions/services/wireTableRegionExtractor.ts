/**
 * Wire Table Region Extractor — Phase T1
 *
 * Detects and isolates the wire/connectivity table region from Apogee
 * (INTERNAL_DRAWING) OCR text lines. The wire table is located in the
 * upper portion of the page, before the lower-right title block.
 *
 * Governance:
 *   - Pure function. No I/O, no DB calls, no side effects. Never throws.
 *   - DETECTION ONLY. Row parsing is handled by wireTableParser.ts.
 *   - Does NOT modify title block, revision, or any authority-bearing data.
 *   - Additive only — does not replace any existing extractor.
 *   - Outputs are intermediate structured data, not authoritative fields.
 *
 * Usage:
 *   const detected = detectWireTableRegion(ocrLines);
 *   if (detected) parseWireTableRows(detected.bodyLines);
 */

// ---------------------------------------------------------------------------
// Constants — shared column header vocabulary
// ---------------------------------------------------------------------------

/** Known wire table column header tokens. */
const WIRE_TABLE_HEADER_TOKENS = [
  'I.D.', 'I.D', 'ID', 'LENGTH', 'GAUGE', 'AWG', 'COLOR', 'COLOUR',
  'STRIP', 'TERMINAL', 'PIN', 'CONN', 'CONNECTOR',
];

/**
 * Strong header pattern: I.D. (or WIRE ID) + LENGTH present in the same line.
 * Reuses the same column vocabulary as the Rheem drawing parser.
 */
const WIRE_TABLE_HEADER_PATTERN =
  /\b(?:I\.?D\.?|WIRE\s*ID)\b.*\b(?:LENGTH|LEN)\b/i;

/**
 * Loose header pattern: I.D./WIRE ID + GAUGE present.
 * Catches headers where LENGTH is on an adjacent line (OCR fragmentation).
 */
const WIRE_TABLE_LOOSE_PATTERN =
  /\b(?:I\.?D\.?|WIRE\s*ID|CIRCUIT)\b.*\b(?:GAUGE|AWG|GA)\b/i;

/**
 * Content-row indicator: a line with an AWG-style gauge or treatment keyword
 * is very likely a wire data row.
 */
const WIRE_ROW_CONTENT_RE =
  /\b(?:\d{1,2}\s*(?:AWG|GA(?:UGE)?)|AWG|SPLICE|HEAT[\s-]?SHRINK)\b/i;

/**
 * Table-end anchors: keywords that signal we've left the wire table and
 * entered annotation / title block territory.
 */
const TABLE_END_PATTERN =
  /^(?:NOTES?|REVISION\s+HISTORY|DRAWN|APPROVED|CHECKED|DATE|SCALE|UNLESS|GENERAL|TOLERANCE|CONNECTOR\s+(?:TABLE|LIST|CHART))/i;

/** Apogee drawing number anchor — signals we've hit the title block area. */
const APOGEE_DRN_ANCHOR = /\b527-\d{4}-010\b/;

// ---------------------------------------------------------------------------
// Output type
// ---------------------------------------------------------------------------

export interface WireTableRegion {
  /**
   * Approximate normalized region coordinates (0–1) for this table.
   * Derived from line-index position in the OCR stream. Suitable for
   * use as a hint to extractPDFRegionText in downstream phases.
   */
  region: { x: number; y: number; w: number; h: number };
  /** 0–1 detection confidence based on header pattern strength. */
  confidence: number;
  /** Line index in allLines where the header row was found. */
  headerLineIdx: number;
  /** Full text of the detected header line. */
  headerText: string;
  /** Body lines (excluding the header row). Ready for wireTableParser. */
  bodyLines: string[];
  /** Number of lines in bodyLines that match the wire-content pattern. */
  candidateRowCount: number;
}

// ---------------------------------------------------------------------------
// Main detector
// ---------------------------------------------------------------------------

/**
 * Detect the wire/connectivity table in Apogee (INTERNAL_DRAWING) OCR lines.
 *
 * Detection strategy:
 *   1. Search the first 65% of lines for a wire table header (strong → loose → multi-token).
 *   2. Expand downward collecting body lines until a table-end anchor or DRN is seen.
 *   3. Derive approximate normalized region coords from line-index ratio.
 *
 * Returns null when no credible wire table header is found.
 */
export function detectWireTableRegion(allLines: string[]): WireTableRegion | null {
  if (!allLines.length) return null;

  const searchLimit = Math.floor(allLines.length * 0.65); // upper 65% of page
  let headerIdx  = -1;
  let confidence = 0;

  for (let i = 0; i < searchLimit; i++) {
    const line  = allLines[i];
    const upper = line.toUpperCase();

    // Strong match: I.D. or WIRE ID plus LENGTH on same line
    if (WIRE_TABLE_HEADER_PATTERN.test(line)) {
      headerIdx  = i;
      confidence = 0.90;
      break;
    }

    // Loose match: I.D./WIRE ID plus GAUGE on same line
    if (WIRE_TABLE_LOOSE_PATTERN.test(line)) {
      headerIdx  = i;
      confidence = 0.75;
      break;
    }

    // Multi-token fallback: ≥3 known header tokens present
    const hits = WIRE_TABLE_HEADER_TOKENS.filter(tok =>
      upper.includes(tok.toUpperCase()),
    ).length;
    if (hits >= 3) {
      headerIdx  = i;
      confidence = 0.68;
      break;
    }
  }

  if (headerIdx < 0) {
    console.log('[T1 TABLE REGION] No wire table header detected');
    return null;
  }

  const headerText = allLines[headerIdx];

  // Expand downward from header to collect body lines
  const bodyLines: string[] = [];
  let tableEndIdx = headerIdx;

  for (let i = headerIdx + 1; i < allLines.length; i++) {
    const line = allLines[i];

    // Hard stop: section-break keywords or Apogee DRN
    if (TABLE_END_PATTERN.test(line))  break;
    if (APOGEE_DRN_ANCHOR.test(line))  break;

    // Skip separator or trivially short lines (keep iterating, don't add)
    if (line.trim().length < 3)        continue;

    // Stop if another wire table header appears (malformed or repeated header)
    if (WIRE_TABLE_HEADER_PATTERN.test(line)) break;

    bodyLines.push(line);
    tableEndIdx = i;
  }

  const candidateRowCount = bodyLines.filter(l => WIRE_ROW_CONTENT_RE.test(l)).length;

  // Require at least one credible content row to declare success
  if (candidateRowCount === 0 && bodyLines.length === 0) {
    console.log('[T1 TABLE REGION] Header found but no body content — treating as non-detection', {
      headerText: headerText.slice(0, 80),
    });
    return null;
  }

  // Derive normalized region coordinates from line-index ratios
  const n     = allLines.length;
  const yStart = Math.max(0, (headerIdx - 1) / n);
  const yEnd   = Math.min(1, (tableEndIdx + 2) / n);

  const region = {
    x: 0.02,
    y: yStart,
    w: 0.96,
    h: Math.max(0.05, yEnd - yStart),
  };

  console.log('[T1 TABLE REGION]', {
    headerLineIdx:    headerIdx,
    headerText:       headerText.slice(0, 80),
    region,
    confidence,
    bodyLineCount:    bodyLines.length,
    candidateRowCount,
  });

  return {
    region,
    confidence,
    headerLineIdx: headerIdx,
    headerText,
    bodyLines,
    candidateRowCount,
  };
}
