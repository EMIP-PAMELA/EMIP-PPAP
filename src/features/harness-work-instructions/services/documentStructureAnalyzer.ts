/**
 * Document Structure Analyzer — Phase 3H.29 / 3H.43.Y
 *
 * Analyzes extraction fragments to detect document layout: title block region,
 * connector tables, wire mapping sections, and overall document class.
 *
 * Phase 3H.43.Y additions:
 *   - Spatial awareness: orientation detection from bounding box geometry
 *   - Rheem vertical title block: explicit left-edge detection
 *   - Structural table classification: prevents wire/connector tables from being
 *     mislabeled as PART_NUMBER or DRAWING_NUMBER regions
 *   - Authority scores: title block regions get elevated authority
 *   - Raw OCR text: actual extracted text in extractedText (not placeholder strings)
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
import type { RegionOverlay, RegionBoundingBox, RegionOrientation } from '../types/documentRegionOverlay';

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

// Rheem title block anchor indicators
const RHEEM_TITLE_BLOCK_ANCHORS = [
  /REV\s+PART\s+NO\.?/i,
  /\b45-\d{5,6}-\d{2,4}\b/,
  /\b(?:DRAWN\s+BY|CHECKED\s+BY|APPROVED\s+BY|DATE|SHEET)\b/i,
];

// Structural patterns that identify a region as a DATA TABLE (not title block)
const WIRE_TABLE_STRUCTURAL = /\b(?:I\.?D\.?|WIRE\s*ID)\b.*\b(?:LENGTH|LEN)\b/i;
const CONNECTOR_TABLE_STRUCTURAL = /\bMANUFACTURER\b.*\bPART\s*(?:NO\.?|NUMBER)\b/i;
const TABLE_ROW_PATTERN = /^\s*[A-Z]?\d{1,3}\s+\d{1,4}(?:\.\d+)?\s+\d{1,2}\s+\w+/;

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
 * Phase 3H.43.Y: Determine orientation from bounding box geometry.
 * Very tall narrow regions near the left edge → VERTICAL.
 * Wide shallow regions → HORIZONTAL.
 */
function detectRegionOrientation(box: RegionBoundingBox): RegionOrientation {
  const aspectRatio = box.height / Math.max(box.width, 0.001);
  if (aspectRatio >= 2.5 && box.x <= 0.2) return 'VERTICAL';
  if (aspectRatio <= 0.5) return 'HORIZONTAL';
  return 'UNKNOWN';
}

/**
 * Phase 3H.43.Y: Determine if a text block looks like a structured data table.
 * Used to prevent keyword-only mislabeling of wire/connector tables.
 */
function looksLikeDataTable(text: string): boolean {
  const upper = text.toUpperCase();
  if (WIRE_TABLE_STRUCTURAL.test(upper)) return true;
  if (CONNECTOR_TABLE_STRUCTURAL.test(upper)) return true;
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  const tableRowCount = lines.filter(l => TABLE_ROW_PATTERN.test(l)).length;
  return tableRowCount >= 2;
}

/**
 * Phase 3H.43.Y: Check if text contains strong Rheem title block anchors.
 */
function hasRheemTitleBlockAnchors(text: string): boolean {
  return RHEEM_TITLE_BLOCK_ANCHORS.filter(p => p.test(text)).length >= 2;
}

/**
 * Extract a short representative snippet from text (max 400 chars).
 * Prefers lines that contain signal-bearing content.
 */
function extractSnippet(text: string, maxChars = 400): string {
  const lines = text.split('\n').filter(l => l.trim().length > 2);
  const meaningful = lines.filter(l =>
    /\d/.test(l) || /[A-Z]{2,}/i.test(l),
  );
  const source = meaningful.length > 0 ? meaningful : lines;
  return source.join('\n').slice(0, maxChars).trim();
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

  const rawText = titleFragment?.raw_text ?? '';
  const lines = rawText.split('\n');
  const textUpper = rawText.toUpperCase();
  const isDataTable = looksLikeDataTable(rawText);

  const titleBlockRegion  = scanForRegion(lines, TITLE_BLOCK_KEYWORDS, 'Title Block',   2);
  const connectorRegion   = scanForRegion(lines, CONNECTOR_KEYWORDS,   'Connector Table', 2);
  const mappingRegion     = scanForRegion(lines, MAPPING_KEYWORDS,     'Wire Mapping',   3);

  const heuristicRegions: RegionOverlay[] = [];
  let overlayCount = 0;
  const pushRegion = (region: Omit<RegionOverlay, 'id'>) => {
    heuristicRegions.push({ id: `heuristic-${overlayCount++}`, ...region });
  };

  // -------------------------------------------------------------------------
  // RHEEM_DRAWING: explicit spatial-aware layout
  // -------------------------------------------------------------------------
  if (documentClassHint === 'RHEEM_DRAWING') {
    const hasAnchors = hasRheemTitleBlockAnchors(rawText);
    const rheemPnMatch = rawText.match(/\b(45-\d{5,6}-\d{2,4}[A-Z]?)\b/);
    const titleBlockSnippet = extractSnippet(rawText);

    // Left vertical strip = authoritative TITLE_BLOCK for Rheem drawings
    const titleBlockBox: RegionBoundingBox = { x: 0.0, y: 0.0, width: 0.13, height: 1.0 };
    pushRegion({
      label: 'TITLE_BLOCK',
      boundingBox: titleBlockBox,
      confidence: hasAnchors ? 0.93 : 0.78,
      extractedText: titleBlockSnippet || `PN: ${rheemPnMatch?.[1] ?? '?'}`,
      source: 'HEURISTIC',
      orientation: 'VERTICAL',
      authority: hasAnchors ? 0.95 : 0.82,
    });

    // Wire table: middle section, horizontal
    if (mappingRegion || textUpper.includes('LENGTH') || textUpper.includes('GAUGE')) {
      const wireSnippet = lines
        .filter(l => /\b(?:I\.?D\.?|LENGTH|GAUGE|COLOR)\b/i.test(l))
        .slice(0, 6)
        .join('\n')
        .slice(0, 300);
      pushRegion({
        label: 'TABLE',
        boundingBox: { x: 0.13, y: 0.15, width: 0.74, height: 0.45 },
        confidence: 0.7,
        extractedText: wireSnippet || 'Wire table structure detected',
        source: 'HEURISTIC',
        orientation: 'HORIZONTAL',
        authority: 0.5,
      });
    }

    // Connector table: separate horizontal block if connector keywords present
    if (connectorRegion) {
      const connSnippet = lines
        .filter(l => /\b(?:MANUFACTURER|PART\s*NO|CONNECTOR|TORQUE)\b/i.test(l))
        .slice(0, 6)
        .join('\n')
        .slice(0, 300);
      pushRegion({
        label: 'TABLE',
        boundingBox: { x: 0.13, y: 0.62, width: 0.74, height: 0.22 },
        confidence: 0.65,
        extractedText: connSnippet || 'Connector table structure detected',
        source: 'HEURISTIC',
        orientation: 'HORIZONTAL',
        authority: 0.45,
      });
    }

    // Revision is inside the title block — emit a small REVISION region inside the strip
    if (textUpper.includes('REV')) {
      pushRegion({
        label: 'REVISION',
        boundingBox: { x: 0.0, y: 0.82, width: 0.13, height: 0.1 },
        confidence: hasAnchors ? 0.88 : 0.6,
        extractedText: extractSnippet(
          lines.filter(l => /\bREV\b/i.test(l)).join('\n'), 200,
        ) || 'REV anchor in title block',
        source: 'HEURISTIC',
        orientation: 'VERTICAL',
        authority: hasAnchors ? 0.90 : 0.65,
      });
    }

    return {
      document_class_hint:  documentClassHint,
      has_title_block:      true,
      title_block_region:   titleBlockRegion,
      has_connector_tables: connectorRegion !== null,
      connector_regions:    connectorRegion ? [connectorRegion] : [],
      has_wire_mapping:     mappingRegion !== null,
      mapping_regions:      mappingRegion ? [mappingRegion] : [],
      regions:              heuristicRegions,
      analyzed_by:          'HEURISTIC',
      analyzed_at:          new Date().toISOString(),
    };
  }

  // -------------------------------------------------------------------------
  // Generic drawing / non-Rheem path
  // -------------------------------------------------------------------------
  if (titleBlockRegion) {
    const titleBox: RegionBoundingBox = { x: 0.05, y: 0.75, width: 0.5, height: 0.2 };
    pushRegion({
      label: 'TITLE_BLOCK',
      boundingBox: titleBox,
      confidence: Math.min(0.9, titleBlockRegion.confidence + 0.2),
      extractedText: extractSnippet(rawText),
      source: 'HEURISTIC',
      orientation: detectRegionOrientation(titleBox),
      authority: 0.75,
    });
  }

  if (textUpper.includes('REV')) {
    const revBox: RegionBoundingBox = { x: 0.65, y: 0.78, width: 0.3, height: 0.18 };
    pushRegion({
      label: 'REVISION',
      boundingBox: revBox,
      confidence: 0.5,
      extractedText: extractSnippet(
        lines.filter(l => /\bREV\b/i.test(l)).join('\n'), 200,
      ) || 'REV keyword present',
      source: 'HEURISTIC',
      orientation: detectRegionOrientation(revBox),
      authority: 0.5,
    });
  }

  // Phase 3H.43.Y: Only emit PART_NUMBER overlay if the text does NOT look like a data table.
  // This prevents connector-table MANUFACTURER/PART NUMBER rows from being flagged as PART_NUMBER.
  if ((textUpper.includes('PART') || textUpper.includes('PN')) && !isDataTable) {
    const pnBox: RegionBoundingBox = { x: 0.6, y: 0.1, width: 0.35, height: 0.2 };
    pushRegion({
      label: 'PART_NUMBER',
      boundingBox: pnBox,
      confidence: 0.45,
      extractedText: extractSnippet(
        lines.filter(l => /\bPART\b|\bPN\b/i.test(l)).join('\n'), 200,
      ) || 'PART keyword present',
      source: 'HEURISTIC',
      orientation: detectRegionOrientation(pnBox),
      authority: 0.4,
    });
  }

  // Phase 3H.43.Y: Only emit DRAWING_NUMBER overlay if text doesn't look like a data table.
  if ((textUpper.includes('DRAWING') || textUpper.includes('DWG')) && !isDataTable) {
    const drnBox: RegionBoundingBox = { x: 0.1, y: 0.05, width: 0.35, height: 0.15 };
    pushRegion({
      label: 'DRAWING_NUMBER',
      boundingBox: drnBox,
      confidence: 0.4,
      extractedText: extractSnippet(
        lines.filter(l => /\bDRAWING\b|\bDWG\b/i.test(l)).join('\n'), 200,
      ) || 'DRAWING keyword present',
      source: 'HEURISTIC',
      orientation: detectRegionOrientation(drnBox),
      authority: 0.35,
    });
  }

  if (connectorRegion || mappingRegion) {
    const tableBox: RegionBoundingBox = { x: 0.1, y: 0.25, width: 0.8, height: 0.4 };
    const tableSnippet = lines
      .filter(l => /\b(?:GAUGE|AWG|LENGTH|CIRCUIT|CONNECTOR|TERMINAL)\b/i.test(l))
      .slice(0, 6)
      .join('\n')
      .slice(0, 300);
    pushRegion({
      label: 'TABLE',
      boundingBox: tableBox,
      confidence: 0.5,
      extractedText: tableSnippet || 'Connector / mapping table signatures detected',
      source: 'HEURISTIC',
      orientation: detectRegionOrientation(tableBox),
      authority: 0.45,
    });
  }

  return {
    document_class_hint:    documentClassHint,
    has_title_block:        titleBlockRegion  !== null,
    title_block_region:     titleBlockRegion,
    has_connector_tables:   connectorRegion   !== null,
    connector_regions:      connectorRegion   ? [connectorRegion]  : [],
    has_wire_mapping:       mappingRegion     !== null,
    mapping_regions:        mappingRegion     ? [mappingRegion]    : [],
    regions:                heuristicRegions,
    analyzed_by:            'HEURISTIC',
    analyzed_at:            new Date().toISOString(),
  };
}
