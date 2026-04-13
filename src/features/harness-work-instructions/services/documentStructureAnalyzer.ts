/**
 * Document Structure Analyzer — Phase 3H.29 (STEP 5)
 *
 * Analyzes extraction fragments to detect document layout: title block region,
 * connector tables, wire mapping sections, and overall document class.
 *
 * Governance:
 *   - This pass DETECTS STRUCTURE only. It does NOT extract revision or drawing number values.
 *   - Uses heuristic pattern matching; analyzed_by = 'HEURISTIC' until an AI model is active.
 *   - All inputs are ExtractionFragment objects. The analyzer never loads storage or makes DB calls.
 */

import type {
  ExtractionFragment,
  DocumentStructureAnalysis,
  DocumentRegion,
  DocumentClassHint,
} from '../types/extractionEvidence';

// ---------------------------------------------------------------------------
// Document-class patterns
// ---------------------------------------------------------------------------

const APOGEE_PATTERN    = /\b527-\d{4}-010\b/;
const RHEEM_PATTERN     = /\b45-\d{5,6}-\d{2,4}\b/;
const EM_PATTERN        = /(?:\bNH\b[^\n]*\b45-\d|\bENGINEERING\s+MASTER\b|\bEMP(?:LOYEE)?\s+MASTER\b)/i;

// ---------------------------------------------------------------------------
// Structural keyword sets
// ---------------------------------------------------------------------------

const TITLE_BLOCK_KEYWORDS = ['REV', 'REVISION', 'DRW', 'DRAWING', 'SHEET', 'APPROVED', 'DATE'];
const CONNECTOR_KEYWORDS   = ['CONNECTOR', 'CAVITY', 'CIRCUIT', 'TERMINAL', 'CONTACT', 'MATING'];
const MAPPING_KEYWORDS     = ['FROM', 'GAUGE', 'AWG', 'KOMAX', 'CUT', 'WIRE', 'COLOR', 'LENGTH'];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function detectDocumentClass(text: string): DocumentClassHint {
  if (APOGEE_PATTERN.test(text))  return 'APOGEE_DRAWING';
  if (EM_PATTERN.test(text))      return 'ENGINEERING_MASTER';
  if (RHEEM_PATTERN.test(text))   return 'RHEEM_DRAWING';
  return 'UNKNOWN';
}

/**
 * Scan a set of lines for a keyword cluster.
 * Returns a DocumentRegion if at least `minMatches` keywords are present,
 * otherwise returns null.
 */
function scanForRegion(
  lines: string[],
  keywords: string[],
  label: string,
  minMatches: number,
): DocumentRegion | null {
  if (lines.length === 0) return null;
  const textUpper = lines.join('\n').toUpperCase();
  const matched   = keywords.filter(kw => textUpper.includes(kw.toUpperCase()));
  if (matched.length < minMatches) return null;
  return {
    label,
    confidence: Math.min(matched.length / keywords.length, 1.0),
    line_start:  0,
    line_end:    lines.length - 1,
    indicators:  matched,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Analyze extraction fragments to produce a structural layout description.
 *
 * Only OCR_TITLE_BLOCK and FILENAME fragments are used. Full-document analysis
 * (OCR_FULL) is deferred to a future phase when AI structural detection is active.
 */
export function analyzeDocumentStructure(fragments: ExtractionFragment[]): DocumentStructureAnalysis {
  const titleFragment    = fragments.find(f => f.source === 'OCR_TITLE_BLOCK');
  const filenameFragment = fragments.find(f => f.source === 'FILENAME');

  const classText = [
    titleFragment?.raw_text   ?? '',
    filenameFragment?.raw_text ?? '',
  ].join('\n');

  const documentClassHint = detectDocumentClass(classText);

  const lines = (titleFragment?.raw_text ?? '').split('\n');

  const titleBlockRegion  = scanForRegion(lines, TITLE_BLOCK_KEYWORDS, 'Title Block',   2);
  const connectorRegion   = scanForRegion(lines, CONNECTOR_KEYWORDS,   'Connector Table', 2);
  const mappingRegion     = scanForRegion(lines, MAPPING_KEYWORDS,     'Wire Mapping',   3);

  return {
    document_class_hint:    documentClassHint,
    has_title_block:        titleBlockRegion  !== null,
    title_block_region:     titleBlockRegion,
    has_connector_tables:   connectorRegion   !== null,
    connector_regions:      connectorRegion   ? [connectorRegion]  : [],
    has_wire_mapping:       mappingRegion     !== null,
    mapping_regions:        mappingRegion     ? [mappingRegion]    : [],
    analyzed_by:            'HEURISTIC',
    analyzed_at:            new Date().toISOString(),
  };
}
