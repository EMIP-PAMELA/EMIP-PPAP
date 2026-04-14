/**
 * Title Block Region Extractor — Phase 3H.50 C12
 *
 * Region-aware extraction layer for title block and revision record regions.
 * Wraps existing extractors (Apogee revision record box, Rheem title block anchor)
 * in explicit region-attributed output for use in:
 *   - Field authority resolver (TITLE_BLOCK_REGION / REVISION_REGION sources)
 *   - Overlay system (new label types distinct from generic TITLE_BLOCK / REVISION)
 *   - analyzeIngestion signal candidates (bypass of enforceTitleBlockSanity for trusted regions)
 *
 * Governance:
 *   - Pure function. No I/O, no DB calls, no side effects.
 *   - Never throws — returns null values on bad/missing input.
 *   - Additive only. Does not replace existing parsers.
 *   - Revision values must come from credible title block / revision record zones only.
 *   - Never fabricates revision from notes, dimensions, or instruction text.
 *   - Apogee revision comes exclusively from the date-anchored revision record box.
 *   - Rheem revision comes from the REV PART NO. anchor or structured model titleBlock.
 */

import { extractApogeeDrawingRevision } from '@/src/utils/extractApogeeDrawingRevision';
import type { RheemDrawingModel } from './rheemDrawingParser';

// ---------------------------------------------------------------------------
// Core Types (spec-mandated)
// ---------------------------------------------------------------------------

export type RegionDerivedField = {
  value: string | null;
  confidence: number;
  source: 'TITLE_BLOCK_REGION' | 'REVISION_REGION' | 'UNKNOWN';
  evidence: string[];
};

export type TitleBlockExtractionResult = {
  titleBlockDetected: boolean;
  revisionRegionDetected: boolean;
  titleBlockBox?: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  revisionRegionBox?: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  partNumber: RegionDerivedField;
  drawingNumber: RegionDerivedField;
  revision: RegionDerivedField;
};

// ---------------------------------------------------------------------------
// PN patterns
// ---------------------------------------------------------------------------

const APOGEE_DRN_RE = /\b(527-\d{4}-010)\b/;  // Apogee DRAWING NUMBER pattern
const RHEEM_PN_RE  = /\b(45-\d{5,6}-\d{2,4}[A-Z]?)\b/;

const RHEEM_TITLE_ANCHOR_RE = /REV\s+PART\s+NO\.?/i;

/** Keywords expected near the Apogee title block (lower-right). */
const APOGEE_TB_CONTEXT_KW = ['DRAWN', 'APPROVED', 'DATE', 'SCALE', 'SHEET', 'DWG', 'DRAWING', 'TITLE'];

// ---------------------------------------------------------------------------
// Revision validation
// ---------------------------------------------------------------------------

const REVISION_REJECT_TOKENS = new Set([
  'ISED', 'EVISED', 'EVISION', 'ISE', 'REVIS', 'EVISE',
  'DATE', 'REV', 'REVISION', 'BY', 'APPD', 'DRAWN', 'CHECKED', 'DWG', 'SHEET',
]);

function isValidRevision(v: string | null | undefined): boolean {
  if (!v) return false;
  const u = v.trim().toUpperCase();
  if (u.length === 0 || u.length > 4) return false;
  if (REVISION_REJECT_TOKENS.has(u)) return false;
  return /^\d{2}$/.test(u) || /^[A-Z]{1,4}$/.test(u);
}

// ---------------------------------------------------------------------------
// Null helpers
// ---------------------------------------------------------------------------

function nullField(): RegionDerivedField {
  return { value: null, confidence: 0, source: 'UNKNOWN', evidence: [] };
}

function nullResult(): TitleBlockExtractionResult {
  return {
    titleBlockDetected: false,
    revisionRegionDetected: false,
    partNumber: nullField(),
    drawingNumber: nullField(),
    revision: nullField(),
  };
}

// ---------------------------------------------------------------------------
// Line splitter
// ---------------------------------------------------------------------------

function splitLines(text: string): string[] {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && l.length < 300);
}

// ---------------------------------------------------------------------------
// Apogee (INTERNAL_DRAWING) extraction
// ---------------------------------------------------------------------------

type RegionExtracted = Pick<
  TitleBlockExtractionResult,
  'titleBlockDetected' | 'titleBlockBox' | 'revisionRegionDetected' | 'revisionRegionBox' |
  'partNumber' | 'drawingNumber' | 'revision'
>;

const RHEEM_PN_IN_APOGEE_RE = /\b(45-\d{5,6}-\d{2,4}[A-Z]?)\b/;

// C12.1: Wire-table noise filter for Apogee drawings.
// Rejects 45-pattern lines containing assembly-process terms that signal a harness BOM row
// (e.g. "45-16851-08  20AWG  WHT") rather than a title block part number field.
const APOGEE_WIRE_TABLE_NOISE_RE = /\b(?:AWG|SPLICE|HEAT[\s-]?SHRINK)\b/i;

/**
 * C12.1: Scan allLines for a 45-pattern PN using zone-priority and DRN proximity anchoring.
 * Exported for direct unit testing without invoking the full region extractor.
 *
 * Priority order:
 *   1. DRN proximity (±20 lines in allLines) — strongest cluster signal; title block co-location
 *   2. Last-40 zone — Apogee title block bias (lower-right of page, emitted last in OCR stream)
 *   3. First-40 zone — reversed PDF column-order fallback
 *   4. Full text — last resort; still noise-filtered
 *
 * All strategies reject lines matching APOGEE_WIRE_TABLE_NOISE_RE.
 */
export function scanForApogeePN45(
  allLines: string[],
  drnLineIdx: number,
): { value: string | null; source: 'drn-proximity' | 'last40-zone' | 'first40-zone' | 'full-text' | null } {
  // Strategy 1: proximity to DRN
  if (drnLineIdx >= 0) {
    const start = Math.max(0, drnLineIdx - 20);
    const end   = Math.min(allLines.length, drnLineIdx + 22);
    for (let i = start; i < end; i++) {
      const m = allLines[i].match(RHEEM_PN_IN_APOGEE_RE);
      if (!m) continue;
      if (APOGEE_WIRE_TABLE_NOISE_RE.test(allLines[i])) continue;
      return { value: m[1], source: 'drn-proximity' };
    }
  }
  // Strategy 2: last-40 zone
  for (const line of allLines.slice(-40)) {
    const m = line.match(RHEEM_PN_IN_APOGEE_RE);
    if (!m) continue;
    if (APOGEE_WIRE_TABLE_NOISE_RE.test(line)) continue;
    return { value: m[1], source: 'last40-zone' };
  }
  // Strategy 3: first-40 zone
  for (const line of allLines.slice(0, 40)) {
    const m = line.match(RHEEM_PN_IN_APOGEE_RE);
    if (!m) continue;
    if (APOGEE_WIRE_TABLE_NOISE_RE.test(line)) continue;
    return { value: m[1], source: 'first40-zone' };
  }
  // Strategy 4: full-text fallback
  for (const line of allLines) {
    const m = line.match(RHEEM_PN_IN_APOGEE_RE);
    if (!m) continue;
    if (APOGEE_WIRE_TABLE_NOISE_RE.test(line)) continue;
    return { value: m[1], source: 'full-text' };
  }
  return { value: null, source: null };
}

function extractApogee(text: string, allLines: string[]): RegionExtracted {
  // ── Drawing Number (527-xxxx-010) ─────────────────────────────────────
  // Track zone label and absolute line index so the 45-PN cluster search can proximity-anchor.
  let drnValue: string | null = null;
  let drnInContext = false;
  let drnZoneLabel: 'last40' | 'first40' | 'full' = 'full';
  let drnLineIdx = -1;   // index into full allLines array

  const zoneSpec: Array<{ label: 'last40' | 'first40' | 'full'; lines: string[] }> = [
    { label: 'last40',  lines: allLines.slice(-40) },
    { label: 'first40', lines: allLines.slice(0, 40) },
    { label: 'full',    lines: allLines },
  ];

  outer: for (const { label, lines } of zoneSpec) {
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(APOGEE_DRN_RE);
      if (!m) continue;
      drnValue     = m[1];
      drnZoneLabel = label;
      // Convert zone-local index to full allLines index
      drnLineIdx   = label === 'last40'  ? Math.max(0, allLines.length - 40) + i
                   : /* first40 | full */  i;
      const windowText = lines
        .slice(Math.max(0, i - 5), Math.min(lines.length, i + 7))
        .join('\n')
        .toUpperCase();
      drnInContext = APOGEE_TB_CONTEXT_KW.some(kw => windowText.includes(kw));
      break outer;
    }
  }

  const drnConfidence = drnInContext ? 0.96 : 0.88;

  // ── Part Number — proximity-anchored cluster search (C12.1) ────────────
  // Pass the full allLines with the DRN's absolute index. scanForApogeePN45
  // handles all zone-priority and noise-filter strategies internally.
  const pnResult       = scanForApogeePN45(allLines, drnLineIdx);
  const rheem45Val     = pnResult.value;
  const pnClusterSrc   = pnResult.source;

  const pnConfidence = pnClusterSrc === 'drn-proximity' ? 0.90
                     : pnClusterSrc === 'last40-zone'   ? 0.82
                     : pnClusterSrc === 'first40-zone'  ? 0.72
                     :                                    0.62;

  const partNumber: RegionDerivedField = rheem45Val
    ? {
        value:      rheem45Val,
        confidence: pnConfidence,
        source:     'TITLE_BLOCK_REGION',
        evidence:   [
          `Apogee drawing — 45-pattern PN [${pnClusterSrc}]`,
          ...(pnClusterSrc === 'drn-proximity' ? ['co-located with 527 DRN in title block cluster'] : []),
        ],
      }
    : nullField();

  const drawingNumber: RegionDerivedField = drnValue
    ? {
        value:      drnValue,
        confidence: drnConfidence,
        source:     'TITLE_BLOCK_REGION',
        evidence:   [
          'Apogee 527-XXXX-010 drawing number',
          ...(drnInContext ? ['confirmed near DRAWN/DATE/SCALE context'] : []),
        ],
      }
    : nullField();

  // ── Revision — use the dedicated Apogee revision record box extractor ────
  const apogeeRev = extractApogeeDrawingRevision(text);
  const revision: RegionDerivedField =
    apogeeRev.isApogeeDrawing && isValidRevision(apogeeRev.revision)
      ? {
          value:      apogeeRev.revision!,
          confidence: 0.92,
          source:     'REVISION_REGION',
          evidence:   ['Apogee revision record box (upper-right, date-anchored extraction)'],
        }
      : nullField();

  // ── Overlay box — zone-anchored (C12.1) ──────────────────────────────
  // Apogee title block is always lower-right on the physical page.
  // y-position is refined from which text zone found the DRN:
  //   last40  → lower portion (y=0.78); first40 → reversed PDF, slightly expanded (y=0.65).
  const tbY   = drnZoneLabel === 'first40' ? 0.65 : 0.78;
  const tbBox = drnValue ? { x: 0.55, y: tbY, w: 0.42, h: 0.20 } : undefined;

  console.log('[C12.1 APOGEE TITLE BLOCK]', {
    drnZoneLabel,
    drnLineIdx,
    drnValue,
    drnInContext,
    pnClusterSrc,
    rheem45Val,
    pnConfidence: rheem45Val ? pnConfidence : null,
    overlayBox: tbBox,
  });

  return {
    titleBlockDetected:     Boolean(drnValue),
    titleBlockBox:          tbBox,
    revisionRegionDetected: revision.value !== null,
    revisionRegionBox:      revision.value !== null ? { x: 0.65, y: 0.00, w: 0.30, h: 0.18 } : undefined,
    partNumber,
    drawingNumber,
    revision,
  };
}

// ---------------------------------------------------------------------------
// Rheem (CUSTOMER_DRAWING) extraction
// ---------------------------------------------------------------------------

function extractRheem(
  text: string,
  allLines: string[],
  rheemModel?: RheemDrawingModel | null,
): RegionExtracted {
  // ── Prefer already-parsed structured model ──────────────────────────────
  if (rheemModel) {
    const pnVal  = rheemModel.titleBlock.partNumber;
    const revVal = rheemModel.titleBlock.revision;
    const anchor = rheemModel.titleBlock.anchorFound;
    const tbConf = rheemModel.titleBlock.confidence || (anchor ? 0.85 : 0.70);

    const partNumber: RegionDerivedField = pnVal
      ? {
          value: pnVal,
          confidence: tbConf,
          source: 'TITLE_BLOCK_REGION',
          evidence: [
            'Rheem title block structured parse',
            ...(anchor ? ['REV PART NO. anchor confirmed'] : []),
          ],
        }
      : nullField();

    const revision: RegionDerivedField = isValidRevision(revVal)
      ? {
          value: revVal!,
          confidence: anchor ? 0.93 : 0.72,
          source: 'REVISION_REGION',
          evidence: [
            'Rheem title block revision',
            ...(anchor ? ['REV PART NO. anchor confirmed'] : []),
          ],
        }
      : nullField();

    return {
      titleBlockDetected:     Boolean(pnVal),
      titleBlockBox:          pnVal   ? { x: 0.00, y: 0.00, w: 0.13, h: 1.00 } : undefined,
      revisionRegionDetected: revision.value !== null,
      revisionRegionBox:      revision.value !== null ? { x: 0.00, y: 0.80, w: 0.13, h: 0.12 } : undefined,
      partNumber,
      drawingNumber: nullField(),
      revision,
    };
  }

  // ── Fallback: scan for REV PART NO. anchor in text ─────────────────────
  // Title block is typically at the end of Rheem drawings; OCR emits it last.
  const scanLines = allLines.length > 40
    ? [...allLines.slice(-40), ...allLines.slice(0, 40)]
    : allLines;

  let pnValue:   string | null = null;
  let revValue:  string | null = null;
  let anchorFound = false;

  for (let i = 0; i < scanLines.length; i++) {
    if (!RHEEM_TITLE_ANCHOR_RE.test(scanLines[i])) continue;
    anchorFound = true;
    const window = scanLines.slice(i + 1, i + 14);
    for (let j = 0; j < window.length; j++) {
      if (!pnValue) {
        const m = window[j].match(RHEEM_PN_RE);
        if (m) {
          pnValue = m[1];
          const tokens = window[j].trim().split(/\s+/);
          const last   = tokens[tokens.length - 1];
          if (!RHEEM_PN_RE.test(last) && isValidRevision(last)) {
            revValue = last;
          }
          continue;
        }
      }
      if (pnValue && !revValue && isValidRevision(window[j])) {
        revValue = window[j].trim();
        break;
      }
    }
    break;
  }

  // Last resort PN match without anchor
  if (!pnValue) {
    const m = text.match(RHEEM_PN_RE);
    if (m) pnValue = m[1];
  }

  const partNumber: RegionDerivedField = pnValue
    ? {
        value: pnValue,
        confidence: anchorFound ? 0.85 : 0.72,
        source: 'TITLE_BLOCK_REGION',
        evidence: [
          'Rheem 45-XXXXX-XX title block PN (text scan)',
          ...(anchorFound ? ['REV PART NO. anchor found'] : []),
        ],
      }
    : nullField();

  const revision: RegionDerivedField = isValidRevision(revValue)
    ? {
        value: revValue!,
        confidence: anchorFound ? 0.85 : 0.60,
        source: 'REVISION_REGION',
        evidence: ['Rheem title block revision (text scan)'],
      }
    : nullField();

  return {
    titleBlockDetected:     Boolean(pnValue),
    titleBlockBox:          pnValue        ? { x: 0.00, y: 0.00, w: 0.13, h: 1.00 } : undefined,
    revisionRegionDetected: revision.value !== null,
    revisionRegionBox:      revision.value !== null ? { x: 0.00, y: 0.80, w: 0.13, h: 0.12 } : undefined,
    partNumber,
    drawingNumber: nullField(),
    revision,
  };
}

// ---------------------------------------------------------------------------
// Generic drawing (unknown type) — conservative pattern scan
// ---------------------------------------------------------------------------

function extractGeneric(allLines: string[]): RegionExtracted {
  for (const line of allLines) {
    const a = line.match(APOGEE_DRN_RE);
    if (a) {
      return {
        titleBlockDetected:     true,
        revisionRegionDetected: false,
        partNumber:    nullField(),  // 527 is a drawing number — leave PN for alias resolution
        drawingNumber: { value: a[1], confidence: 0.75, source: 'TITLE_BLOCK_REGION', evidence: ['Apogee 527-XXXX-010 drawing number in generic drawing'] },
        revision:      nullField(),
      };
    }
  }
  for (const line of allLines) {
    const r = line.match(RHEEM_PN_RE);
    if (r) {
      return {
        titleBlockDetected: true,
        revisionRegionDetected: false,
        partNumber:   { value: r[1], confidence: 0.65, source: 'TITLE_BLOCK_REGION', evidence: ['Rheem PN pattern in generic drawing'] },
        drawingNumber: nullField(),
        revision: nullField(),
      };
    }
  }
  return {
    titleBlockDetected: false,
    revisionRegionDetected: false,
    partNumber:    nullField(),
    drawingNumber: nullField(),
    revision:      nullField(),
  };
}

// ---------------------------------------------------------------------------
// Main Entry Point
// ---------------------------------------------------------------------------

export function extractTitleBlockAndRevisionRegions(args: {
  fullText?: string | null;
  lines?: string[];
  fileName?: string | null;
  documentType?: string | null;
  existingRegions?: Array<unknown>;
  /** Optional: pass already-parsed RheemDrawingModel to avoid re-parsing. */
  rheemModel?: RheemDrawingModel | null;
}): TitleBlockExtractionResult {
  try {
    const text     = args.fullText ?? '';
    const allLines = args.lines ?? splitLines(text);
    const docType  = args.documentType ?? null;

    let extracted: RegionExtracted;

    if (docType === 'INTERNAL_DRAWING' || (!docType && APOGEE_DRN_RE.test(text))) {
      extracted = extractApogee(text, allLines);
    } else if (docType === 'CUSTOMER_DRAWING' || (!docType && RHEEM_PN_RE.test(text))) {
      extracted = extractRheem(text, allLines, args.rheemModel);
    } else {
      extracted = extractGeneric(allLines);
    }

    const result: TitleBlockExtractionResult = {
      titleBlockDetected:     extracted.titleBlockDetected,
      revisionRegionDetected: extracted.revisionRegionDetected,
      ...(extracted.titleBlockBox    ? { titleBlockBox:    extracted.titleBlockBox }    : {}),
      ...(extracted.revisionRegionBox ? { revisionRegionBox: extracted.revisionRegionBox } : {}),
      partNumber:    extracted.partNumber,
      drawingNumber: extracted.drawingNumber,
      revision:      extracted.revision,
    };

    console.log('[TITLE BLOCK EXTRACTION]', {
      fileName:               args.fileName,
      titleBlockDetected:     result.titleBlockDetected,
      revisionRegionDetected: result.revisionRegionDetected,
      partNumber:    { value: result.partNumber.value,    source: result.partNumber.source,    confidence: result.partNumber.confidence },
      drawingNumber: { value: result.drawingNumber.value, source: result.drawingNumber.source, confidence: result.drawingNumber.confidence },
      revision:      { value: result.revision.value,      source: result.revision.source,      confidence: result.revision.confidence },
    });

    return result;
  } catch (err) {
    console.error('[TITLE BLOCK EXTRACTION] Unhandled error — returning null result.', err);
    return nullResult();
  }
}
