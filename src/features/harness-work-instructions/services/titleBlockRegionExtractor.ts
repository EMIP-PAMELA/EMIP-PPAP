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

// C11.3: 45-pattern search used inside extractApogee for customer PN cross-references
const RHEEM_PN_IN_APOGEE_RE = /\b(45-\d{5,6}-\d{2,4}[A-Z]?)\b/;

function extractApogee(text: string, allLines: string[]): RegionExtracted {
  // ── Drawing Number (527-xxxx-010) ─────────────────────────────────────
  // This is the Apogee DRAWING NUMBER, not the part number.
  let drnValue: string | null = null;
  let drnInContext = false;

  // Prefer last-40 first (Apogee title block is lower-right; OCR may emit it last)
  // then first-40, then full document as a fallback
  const scanZones: string[][] = [
    allLines.slice(-40),
    allLines.slice(0, 40),
    allLines,
  ];

  outer: for (const zone of scanZones) {
    for (let i = 0; i < zone.length; i++) {
      const m = zone[i].match(APOGEE_DRN_RE);
      if (!m) continue;
      drnValue = m[1];
      const windowText = zone
        .slice(Math.max(0, i - 5), Math.min(zone.length, i + 7))
        .join('\n')
        .toUpperCase();
      drnInContext = APOGEE_TB_CONTEXT_KW.some(kw => windowText.includes(kw));
      break outer;
    }
  }

  const drnConfidence = drnInContext ? 0.96 : 0.88;

  // ── Part Number — search for 45-pattern Rheem PN in drawing text ─────
  // Apogee drawings sometimes cross-reference the Rheem customer part number.
  // If absent, leave partNumber null — alias lookup will resolve 527 DRN → 45 PN downstream.
  const rheem45Match = text.match(RHEEM_PN_IN_APOGEE_RE);
  const rheem45Val   = rheem45Match?.[1] ?? null;

  const partNumber: RegionDerivedField = rheem45Val
    ? {
        value:      rheem45Val,
        confidence: 0.82,
        source:     'TITLE_BLOCK_REGION',
        evidence:   ['Apogee drawing — 45-pattern Rheem part number cross-reference'],
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
  // This is authoritative: date-anchored scan of the upper-right revision table.
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

  return {
    titleBlockDetected:     Boolean(drnValue),
    titleBlockBox:          drnValue ? { x: 0.55, y: 0.80, w: 0.40, h: 0.15 } : undefined,
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
