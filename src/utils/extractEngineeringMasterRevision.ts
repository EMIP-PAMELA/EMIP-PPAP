/**
 * Engineering Master Revision Extraction
 *
 * Engineering Master BOM documents carry the authoritative revision in the
 * "repeated header line" — a line starting with "M NH..." that contains the
 * part number twice, followed by routing/description fields, and ending with
 * the explicit revision field.
 *
 * Example repeated header lines:
 *   M NH45-108115-24-JJ - NH45-108115-24-JJ - MOQ200 ACI CONVERSION 1.00 527-4535-010 00
 *   M NH45-108252-01    - NH45-108252-01    - MOQ200 ACI09723 CONVERSION 1.00 527-4684-010 ( 01
 *   M NH45-108208-01    - NH45-108208-01    - MOQ700 ACI09644 CONVERSION 1.00 45-108208-01 03
 *   M NH45-108115-24-EE - NH45-108115-24-EE - MOQ200 ACI CONVERSION 1.00 527-4748-010 00
 *
 * The trailing numeric token (e.g. 00, 01, 03) after the drawing or customer
 * part number reference is the document revision.
 *
 * IMPORTANT: Identifier suffixes like -JJ and -EE are PART-NUMBER VARIANTS,
 * not revision tokens. They appear inside the NH part number and must never
 * be captured as revision.
 *
 * Tokens explicitly rejected as revision candidates:
 *   - NH*       identifiers
 *   - 45-*      identifiers
 *   - 527-XXXX-010  drawing numbers
 *   - quantities    (1.00, 200)
 *   - ACI* order numbers
 *   - routing labels (--10, --30, --50)
 *   - part-number suffixes (-JJ, -EE)
 */

const HEADER_LINE_LIMIT = 15;

/**
 * Matches the Engineering Master repeated header line.
 * The line must start with "M " followed by two NH part numbers separated by " - ".
 * This structure is unique to the EM BOM master header block.
 */
const EM_REPEATED_HEADER_LINE =
  /^M\s+(NH\d{2}-\d{6}-\d{2}(?:-[A-Z]{2})?)\s+-\s+(NH\d{2}-\d{6}-\d{2}(?:-[A-Z]{2})?)/;

export interface EngineeringMasterRevisionResult {
  /**
   * Raw revision extracted from the repeated header line (e.g. "00", "01", "03").
   * null if no matching header line was found or the trailing token did not qualify.
   */
  revision: string | null;
  /**
   * True when the revision came from the explicit trailing field of the header line.
   * False when this result is empty and the caller must fall back to generic extraction.
   */
  isHeaderExplicit: boolean;
}

function normalizeHeaderLines(text: string): string[] {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && l.length < 200)
    .slice(0, HEADER_LINE_LIMIT);
}

/**
 * Extract the trailing revision token from a confirmed repeated header line.
 *
 * Handles optional "(" wrapping: "( 01" → "01", "(01" → "01".
 * Rejects decimal quantities (1.00), drawing numbers (527-...), and any
 * token that is not a clean 2-or-3-digit integer.
 */
function extractTrailingRevisionToken(line: string): string | null {
  const tokens = line.trim().split(/\s+/);
  if (tokens.length === 0) return null;

  let candidate = tokens[tokens.length - 1];
  candidate = candidate.replace(/^\(+/, '').replace(/[),]+$/, '').trim();

  return /^\d{2,3}$/.test(candidate) ? candidate : null;
}

/**
 * Extract the Engineering Master revision from the authoritative repeated header line.
 *
 * Scans only the first HEADER_LINE_LIMIT lines (the header block) to avoid
 * false matches in component rows. Returns { revision: null, isHeaderExplicit: false }
 * when no valid header line is found — callers must then apply a generic fallback.
 *
 * Priority:
 *   1. Repeated header line match ("M NH... - NH...") → trailing token = revision
 *   2. No match → null; caller falls back to generic extraction
 */
export function extractEngineeringMasterRevision(
  text: string | null | undefined,
): EngineeringMasterRevisionResult {
  const empty: EngineeringMasterRevisionResult = { revision: null, isHeaderExplicit: false };

  if (!text || text.trim().length === 0) return empty;

  const lines = normalizeHeaderLines(text);

  for (const line of lines) {
    if (!EM_REPEATED_HEADER_LINE.test(line)) continue;

    const revision = extractTrailingRevisionToken(line);
    if (revision) {
      console.log('[EM REVISION] Extracted from repeated header line', { revision, line });
      return { revision, isHeaderExplicit: true };
    }

    // Header line matched but trailing token was not a valid revision — stop scanning
    console.warn('[EM REVISION] Header line found but trailing token invalid', { line });
    break;
  }

  return empty;
}
