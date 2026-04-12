/**
 * Rheem Drawing Revision Extraction (Title Block Structure)
 *
 * Rheem drawings store revision in the title block using "REV PART NO." structure.
 * Revision is tied to the part number, not a standalone REV label.
 *
 * Title block structure — Case A (revision on next line):
 *   REV PART NO.
 *   45-110858-36
 *   01
 *
 * Title block structure — Case B (revision inline):
 *   REV PART NO.
 *   45-42522-235 02
 *
 * Search strategy:
 *   PRIMARY  — last 40 lines (title block is bottom-left or vertical strip on most drawings)
 *   FALLBACK — first 40 lines (in case PDF text extraction is page-ordered top-to-bottom)
 *
 * Tokens explicitly rejected as revision candidates:
 *   - 45-* part numbers themselves
 *   - quantities with decimals (1.00, 200.00)
 *   - drawing numbers (NNN-NNNN-NNN format)
 *   - any non-2-digit token
 *
 * This extractor is ONLY invoked for documents that contain a 45-* Rheem part number.
 * It does NOT affect BOM extraction or Engineering Master revision logic.
 */

const TITLE_BLOCK_SCAN_LIMIT = 40;

/**
 * Rheem title block anchor line.
 * Allows spacing variations: "REV PART NO.", "REV  PART NO", "REV PART NO" etc.
 */
const ANCHOR_PATTERN = /REV\s+PART\s+NO\.?/i;

/**
 * Rheem customer part number in the title block.
 * Format: 45 + hyphen + 5-or-6 digits + hyphen + 2-to-4 digits
 * Examples: 45-110858-36, 45-42522-235, 45-106065-12
 */
const RHEEM_PN_PATTERN = /\b(45-\d{5,6}-\d{2,4})\b/;

/**
 * Valid revision token: exactly 2 digits (00–99, leading-zero included).
 * Rejects quantities (1.00), drawing numbers (NNN-NNNN), single digits, 3+ digits.
 */
const REVISION_TOKEN = /^\d{2}$/;

export interface RheemDrawingRevisionResult {
  /**
   * Revision extracted from the title block (e.g. "00", "01", "02").
   * null if no valid revision token was found, even when anchor was detected.
   */
  revision: string | null;
  /**
   * True when the "REV PART NO." anchor was found and a Rheem part number was
   * located in the window. False means this is not a Rheem-format title block.
   */
  isRheemTitleBlock: boolean;
}

function splitLines(text: string): string[] {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && l.length < 300);
}

/**
 * Given the lines starting just after the anchor, find the Rheem PN and then
 * extract the immediately following 2-digit numeric revision.
 *
 * Returns the revision string, or null if the PN/revision is not found in the window.
 */
function extractRevisionFromWindow(
  windowLines: string[],
): { revision: string | null; pnFound: boolean } {
  for (let i = 0; i < windowLines.length; i++) {
    const line = windowLines[i];
    if (!RHEEM_PN_PATTERN.test(line)) continue;

    // PN found — this is a Rheem title block window
    const tokens = line.trim().split(/\s+/);

    // Case B: revision is the trailing token on the same line as the PN
    // e.g. "45-42522-235 02"
    if (tokens.length >= 2) {
      const last = tokens[tokens.length - 1];
      if (!RHEEM_PN_PATTERN.test(last) && REVISION_TOKEN.test(last)) {
        return { revision: last, pnFound: true };
      }
    }

    // Case A: revision is on the next non-empty line after the PN
    // e.g. "45-110858-36" then "01"
    for (let j = i + 1; j < windowLines.length && j <= i + 4; j++) {
      const next = windowLines[j].trim();
      if (!next) continue;

      // Exact match — the line IS the revision token
      if (REVISION_TOKEN.test(next)) {
        return { revision: next, pnFound: true };
      }

      // Last token of next line is the revision (some formats pad with other fields)
      const nextTokens = next.split(/\s+/);
      const nextLast = nextTokens[nextTokens.length - 1];
      if (REVISION_TOKEN.test(nextLast)) {
        return { revision: nextLast, pnFound: true };
      }

      // First non-empty non-revision line — stop scanning
      break;
    }

    // PN found but no valid revision in window
    return { revision: null, pnFound: true };
  }

  return { revision: null, pnFound: false };
}

/**
 * Extract the revision for a Rheem drawing from its title block.
 *
 * Scans the last 40 lines first (primary — title block is typically at the bottom),
 * then the first 40 lines as a fallback (handles top-to-bottom PDF text extraction order).
 *
 * Returns { revision: null, isRheemTitleBlock: false } when no "REV PART NO." anchor
 * is found — callers must then apply generic fallback extraction.
 */
export function extractRheemDrawingRevision(
  text: string | null | undefined,
): RheemDrawingRevisionResult {
  const empty: RheemDrawingRevisionResult = { revision: null, isRheemTitleBlock: false };

  if (!text || text.trim().length === 0) return empty;

  const all = splitLines(text);

  // Build primary (last 40) and fallback (first 40) scan zones
  const zones: Array<{ label: string; lines: string[] }> = [
    { label: 'last40', lines: all.slice(-TITLE_BLOCK_SCAN_LIMIT) },
    { label: 'first40', lines: all.slice(0, TITLE_BLOCK_SCAN_LIMIT) },
  ];

  for (const { label, lines } of zones) {
    const anchorIdx = lines.findIndex(l => ANCHOR_PATTERN.test(l));
    if (anchorIdx === -1) continue;

    // Anchor found — extract window of up to 8 lines after it
    const window = lines.slice(anchorIdx + 1, anchorIdx + 9);
    const { revision, pnFound } = extractRevisionFromWindow(window);

    if (pnFound) {
      console.log('[RHEEM REVISION] Title block anchor found', { zone: label, anchorIdx, revision });
      return { revision, isRheemTitleBlock: true };
    }
  }

  return empty;
}
