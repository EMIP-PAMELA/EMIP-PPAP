/**
 * Engineering Master Identifier Extraction
 *
 * Engineering Master BOM documents contain three distinct identifier types.
 * Each maps to a specific semantic role and must never be conflated:
 *
 *   NH*          → internal part number  (Nehemiah/EMIP canonical)
 *                   Example: NH45-108115-24-JJ
 *   45-*         → customer part number  (Rheem/OEM)
 *                   Example: 45-108115-24-JJ
 *   527-XXXX-010 → drawing number        (Apogee)
 *                   Example: 527-4535-010
 *
 * Priority rules enforced by this module:
 *   1. If NH exists → canonical part_number = NH value; customer_part_number = NH value with "NH" stripped
 *   2. Else if 45 exists → canonical part_number = 45 value
 *   3. 527 values ALWAYS → drawing_number; NEVER promoted to part_number
 *   4. If neither NH nor 45 found → canonicalPartNumber is null; caller must apply PENDING fallback
 */

const HEADER_LINE_LIMIT = 15;

/**
 * Nehemiah internal part number.
 * Format: NH + 2 digits + hyphen + 6 digits + hyphen + 2 digits [+ hyphen + 2 uppercase letters]
 * Examples: NH45-108115-24-JJ, NH45-108208-02
 */
const NH_PATTERN = /\b(NH\d{2}-\d{6}-\d{2}(?:-[A-Z]{2})?)\b/;

/**
 * Rheem customer part number.
 * Format: 45 + hyphen + 6 digits + hyphen + 2 digits [+ hyphen + 2 uppercase letters]
 * Examples: 45-108115-24-JJ, 45-108208-02
 *
 * Word boundary (\b) before "45" prevents matching the "45" inside "NH45-..." because
 * "H" and "4" are both \w characters — no word boundary exists between them.
 */
const RHEEM_PATTERN = /\b(45-\d{6}-\d{2}(?:-[A-Z]{2})?)\b/;

/**
 * Apogee drawing number.
 * Format: 527 + hyphen + 4 digits + hyphen + 010
 * Example: 527-4535-010
 * This value is ALWAYS a drawing number — never a part number.
 */
const APOGEE_PATTERN = /\b(527-\d{4}-010)\b/;

export interface EngineeringMasterIdentifiers {
  /**
   * Canonical part number for SKU creation.
   * NH value if present; 45 value if NH absent; null if neither found.
   * 527 (Apogee) values are NEVER assigned here.
   */
  canonicalPartNumber: string | null;
  /** Nehemiah internal part number (NH-prefixed), if found. */
  internalPartNumber: string | null;
  /**
   * Customer (Rheem) part number.
   * When NH present: derived by stripping the "NH" prefix from the NH value.
   * When only 45 present: the 45-* value directly.
   */
  customerPartNumber: string | null;
  /**
   * Apogee drawing number (527-XXXX-010), if found.
   * This field is populated independently of part number logic.
   * It must NEVER be used as a fallback part_number.
   */
  drawingNumber: string | null;
  /** Which identifier pattern supplied the canonical part number. */
  identifierSource: 'NH' | 'RHEEM' | 'NONE';
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
 * Extract and classify all Engineering Master identifiers from BOM header text.
 *
 * Scans only the first HEADER_LINE_LIMIT lines (the document header block) to avoid
 * false positives from body content. Returns a structured result with strict semantic
 * role assignment — no ambiguous or probabilistic selection logic.
 */
export function extractEngineeringMasterIdentifiers(
  text: string | null | undefined,
): EngineeringMasterIdentifiers {
  const empty: EngineeringMasterIdentifiers = {
    canonicalPartNumber: null,
    internalPartNumber: null,
    customerPartNumber: null,
    drawingNumber: null,
    identifierSource: 'NONE',
  };

  if (!text || text.trim().length === 0) return empty;

  const lines = normalizeHeaderLines(text);
  const headerBlock = lines.join(' ');

  // Step 1: Extract Apogee drawing number — runs unconditionally; never promotes to part_number
  const apogeeMatch = headerBlock.match(APOGEE_PATTERN);
  const drawingNumber = apogeeMatch ? apogeeMatch[1] : null;

  // Step 2: NH (Nehemiah internal) — highest priority; if found, all part number roles are resolved
  const nhMatch = headerBlock.match(NH_PATTERN);
  if (nhMatch) {
    const nhFull = nhMatch[1];
    const customerDerived = nhFull.replace(/^NH/, '');
    console.log('[EM IDENTIFIER] NH', { nhFull, customerDerived, drawingNumber });
    return {
      canonicalPartNumber: nhFull,
      internalPartNumber: nhFull,
      customerPartNumber: customerDerived,
      drawingNumber,
      identifierSource: 'NH',
    };
  }

  // Step 3: Rheem (customer) part number — only reached when no NH is present
  const rheemMatch = headerBlock.match(RHEEM_PATTERN);
  if (rheemMatch) {
    const rheemValue = rheemMatch[1];
    console.log('[EM IDENTIFIER] Rheem', { rheemValue, drawingNumber });
    return {
      canonicalPartNumber: rheemValue,
      internalPartNumber: null,
      customerPartNumber: rheemValue,
      drawingNumber,
      identifierSource: 'RHEEM',
    };
  }

  // Step 4: Neither NH nor 45 found — drawing number still preserved; caller must PENDING-fallback
  console.log('[EM IDENTIFIER] No part number', { drawingNumber });
  return { ...empty, drawingNumber, identifierSource: 'NONE' };
}
