/**
 * Apogee Drawing Revision Extraction (Revision Record Box)
 *
 * Apogee drawings (527-XXXX-010) store revision in the upper-right revision
 * record box — a structured table with DATE and REV columns.
 *
 * Example revision box content (DATE → REV):
 *   06/19/25  00
 *   11/13/25  02    ← most recent = document revision
 *
 * Single-entry example:
 *   10/20/25  00    ← authoritative for that drawing
 *
 * Revision values may be numeric (00, 01, 02) or alphabetic (A, B, LL).
 *
 * Identifiers that MUST NOT be confused with revision:
 *   527-XXXX-010  — Apogee internal drawing number (lower-right title block)
 *   45-*          — Rheem/customer part number (may appear in the title area)
 *   MM/DD/YY      — Date entries in the revision box (NOT the revision itself)
 *
 * Search strategy:
 *   PRIMARY  — first 40 lines (revision box is upper-right; PDF text extractors
 *               typically emit upper-right content early in the text stream)
 *   FALLBACK — last 40 lines (for PDFs that reverse column order)
 *
 * Page-2-only files:
 *   May not contain a complete revision box. If no box is found, extraction
 *   returns { revision: null, isApogeeDrawing: true } and callers use generic
 *   fallback without asserting false confidence.
 *
 * This extractor MUST NOT be invoked for BOM documents or Rheem-format drawings.
 */

const SCAN_LIMIT = 40;

/** Apogee internal drawing number. Presence confirms this is an Apogee drawing. */
const APOGEE_PN_PATTERN = /\b527-\d{4}-010\b/;

/** Date entry pattern for revision box rows (MM/DD/YY or MM/DD/YYYY). */
const DATE_ENTRY_PATTERN = /\b\d{2}\/\d{2}\/\d{2,4}\b/;

/**
 * Valid numeric revision: exactly 2 digits with optional leading zero (00–99).
 * Apogee numeric revisions always use 2-digit zero-padded form.
 */
const NUMERIC_REVISION = /^\d{2}$/;

/**
 * Valid alphabetic revision: 1–4 uppercase letters.
 * Examples: A, B, LL.
 */
const ALPHA_REVISION = /^[A-Z]{1,4}$/;

/**
 * Header labels and structural tokens that are never revisions.
 * Applied after toUpperCase().
 */
const REJECT_TOKENS = new Set([
  'DATE', 'REV', 'REVISION', 'REVISIONS',
  'NOTE', 'NOTES', 'PAGE', 'BY', 'CHK', 'APPD', 'APPROVED',
  'DESC', 'DESCRIPTION', 'SIZE', 'SCALE', 'DWG', 'DRW',
  'DRAWN', 'CHECKED', 'NO', 'OF', 'SHEET', 'TITLE',
  'UNLESS', 'OTHERWISE', 'TOLERANCES', 'SIGNATURE',
  'NAME', 'COMPANY', 'THIRD', 'ANGLE',
]);

function splitLines(text: string): string[] {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && l.length < 300);
}

/**
 * Return true when the candidate string is a valid Apogee revision token.
 *
 * Rejected candidates:
 *   - Header/structural labels (DATE, REV, BY, etc.)
 *   - Apogee drawing numbers (527-XXXX-010)
 *   - Rheem part numbers (45-*)
 *   - Date strings (MM/DD/YY)
 *   - Values containing decimals or slashes
 *   - Pure numeric values with 3+ digits
 */
function isValidRevisionCandidate(candidate: string): boolean {
  if (!candidate) return false;
  const upper = candidate.toUpperCase();
  if (REJECT_TOKENS.has(upper)) return false;
  if (APOGEE_PN_PATTERN.test(candidate)) return false;
  if (/^45-/i.test(candidate)) return false;
  if (DATE_ENTRY_PATTERN.test(candidate)) return false;
  if (/[./]/.test(candidate)) return false;
  if (/^\d{3,}$/.test(candidate)) return false;
  return NUMERIC_REVISION.test(candidate) || ALPHA_REVISION.test(candidate);
}

/**
 * Strategy A — Date-anchored extraction.
 *
 * Scans lines that contain a date pattern (MM/DD/YY). For each such line:
 *   1. Checks the token immediately after the date (most common: "06/19/25 00")
 *   2. Checks the token immediately before the date (REV-first format: "00 06/19/25")
 *   3. Checks the next non-empty line (split-column: date on one line, rev on next)
 *
 * Collects ALL valid candidates in order; the last entry is the most recent revision.
 */
function extractByDateAnchor(lines: string[]): string[] {
  const candidates: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!DATE_ENTRY_PATTERN.test(line)) continue;

    const tokens = line.trim().split(/\s+/);
    const dateIdx = tokens.findIndex(t => DATE_ENTRY_PATTERN.test(t));
    if (dateIdx === -1) continue;

    // Token after date on the same line (most common layout)
    if (dateIdx + 1 < tokens.length) {
      const after = tokens[dateIdx + 1];
      if (isValidRevisionCandidate(after)) {
        candidates.push(after);
        continue;
      }
    }

    // Token before date on the same line (REV-first / reversed column order)
    if (dateIdx > 0) {
      const before = tokens[dateIdx - 1];
      if (isValidRevisionCandidate(before)) {
        candidates.push(before);
        continue;
      }
    }

    // Next non-empty line (column-split PDF: date and revision in separate rows)
    for (let j = i + 1; j <= i + 2 && j < lines.length; j++) {
      const next = lines[j].trim();
      if (!next) continue;
      if (isValidRevisionCandidate(next)) {
        candidates.push(next);
      }
      break;
    }
  }

  return candidates;
}

/**
 * Strategy B — REV column header scan.
 *
 * Used when dates and revision values appear in fully separated columns
 * (dates in one block, revisions in another). Locates a "REV" header line
 * (without a date pattern) and collects valid revision tokens from the
 * immediately following lines.
 *
 * This is a secondary strategy applied only when Strategy A yields nothing.
 */
function extractByRevColumn(lines: string[]): string[] {
  const candidates: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim().toUpperCase();
    // A header line containing REV but NOT a date (e.g. "REV" or "DATE REV BY")
    if (!/\bREV\b/.test(line)) continue;
    if (DATE_ENTRY_PATTERN.test(lines[i])) continue;

    // Collect valid revision tokens from the next lines (up to 10 rows)
    for (let j = i + 1; j <= i + 10 && j < lines.length; j++) {
      const next = lines[j].trim();
      if (!next) continue;
      if (isValidRevisionCandidate(next)) {
        candidates.push(next);
      } else if (!DATE_ENTRY_PATTERN.test(next) && !REJECT_TOKENS.has(next.toUpperCase())) {
        break; // End of revision column — non-revision, non-date, non-header line
      }
    }

    if (candidates.length > 0) break;
  }

  return candidates;
}

export interface ApogeeDrawingRevisionResult {
  /**
   * Revision extracted from the revision record box (e.g. "00", "01", "LL").
   * null when no valid revision entry was found — callers must use generic fallback.
   */
  revision: string | null;
  /**
   * True when a 527-XXXX-010 Apogee drawing number was detected.
   * Callers use this to confirm Apogee layout and skip Rheem extraction.
   */
  isApogeeDrawing: boolean;
}

/**
 * Extract the revision from an Apogee drawing's revision record box.
 *
 * Identification: a 527-XXXX-010 pattern in the document text confirms Apogee format.
 * When identified, the revision box in the upper-right area is targeted.
 *
 * Two scan zones:
 *   1. First 40 lines (PRIMARY — upper-right box typically appears early in PDF text)
 *   2. Last 40 lines (FALLBACK — for PDFs with reversed column ordering)
 *
 * Two extraction strategies (applied in order within each zone):
 *   A. Date-anchored: finds "MM/DD/YY REV" rows → revision is the adjacent token
 *   B. REV-column: finds a REV header then collects tokens from following rows
 *
 * The LAST valid candidate collected is returned as the most recent revision.
 * (Revision boxes list entries chronologically; last = most recent = current.)
 */
export function extractApogeeDrawingRevision(
  text: string | null | undefined,
): ApogeeDrawingRevisionResult {
  const notApogee: ApogeeDrawingRevisionResult = { revision: null, isApogeeDrawing: false };

  if (!text || text.trim().length === 0) return notApogee;
  if (!APOGEE_PN_PATTERN.test(text)) return notApogee;

  const all = splitLines(text);

  const zones: Array<{ label: string; lines: string[] }> = [
    { label: 'first40', lines: all.slice(0, SCAN_LIMIT) },
    { label: 'last40', lines: all.slice(-SCAN_LIMIT) },
  ];

  for (const { label, lines } of zones) {
    // Strategy A: date-anchored rows
    let candidates = extractByDateAnchor(lines);

    // Strategy B: REV column header (fallback within zone)
    if (candidates.length === 0) {
      candidates = extractByRevColumn(lines);
    }

    if (candidates.length > 0) {
      const revision = candidates[candidates.length - 1]; // last = most recent
      console.log('[APOGEE REVISION] Extracted from revision record box', {
        zone: label,
        allCandidates: candidates,
        revision,
      });
      return { revision, isApogeeDrawing: true };
    }
  }

  console.warn('[APOGEE REVISION] No revision found in revision record box — fallback required');
  return { revision: null, isApogeeDrawing: true };
}
