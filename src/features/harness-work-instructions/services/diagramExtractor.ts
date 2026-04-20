/**
 * Diagram Extractor — Phase T4
 *
 * Detects and normalizes connector and callout components from the
 * diagram region OCR text. The diagram region is defined as the set of
 * OCR lines BEFORE the wire table header (T1) and after excluding
 * title block line contamination (C12).
 *
 * Governance:
 *   - Pure functions. No I/O, no DB calls, no side effects. Never throws.
 *   - DOES NOT perform topology mapping, line-following, or graph solving.
 *   - DOES NOT override HC-BOM endpoints or T2 harness connectivity.
 *   - AI vision is additive-only fallback; deterministic result = base truth.
 *   - All outputs are INTERMEDIATE structured signals — not authoritative.
 *   - Evidence traceability: every component/callout preserves rawText.
 */

// ---------------------------------------------------------------------------
// Data Model
// ---------------------------------------------------------------------------

export interface ComponentNode {
  /** Stable unique ID within this extraction result (e.g., "CONN_1"). */
  id: string;
  type: 'CONNECTOR' | 'TERMINAL' | 'SPLICE' | 'UNKNOWN';
  /** Human-readable label (e.g., "J1", "PHOENIX CONTACT", "PHOENIX 1700443"). */
  label: string;
  /** Normalized part number if detectable from OCR text, else null. */
  normalizedPartNumber: string | null;
  /**
   * Coarse spatial hint.
   * PHOENIX → LEFT (domain rule: Phoenix blocks are on the connector/left side).
   * Others → null unless AI provides positional context.
   */
  locationHint: 'LEFT' | 'RIGHT' | 'CENTER' | null;
  source: 'OCR' | 'VISION' | 'HYBRID';
  confidence: number;
  rawText: string;
}

export interface Callout {
  /** Callout text as found in OCR (e.g., "ACI01960", "929504-1"). */
  text: string;
  /** Normalized part number if the callout text IS a part number, else null. */
  normalizedPartNumber: string | null;
  /** ID of the ComponentNode this callout is spatially associated with, or null. */
  associatedComponentId: string | null;
  source: 'OCR' | 'VISION';
  confidence: number;
  rawText: string;
}

export interface DiagramExtractionResult {
  components: ComponentNode[];
  callouts: Callout[];
  /** Callout texts that could not be associated with any ComponentNode. */
  unresolvedCallouts: string[];
}

/**
 * Structured result returned by runDiagramComponentParse (AI pass).
 * Defined here so it can be imported by aiDrawingVisionService without
 * circular dependency — the AI service just returns this shape.
 */
export interface DiagramVisionResult {
  components: Array<{
    label: string;
    type: 'CONNECTOR' | 'TERMINAL' | 'SPLICE' | 'UNKNOWN';
    partNumber: string | null;
    position: 'LEFT' | 'RIGHT' | 'CENTER' | null;
  }>;
  callouts: Array<{
    text: string;
    partNumber: string | null;
    associatedComponent: string | null;
  }>;
}

// ---------------------------------------------------------------------------
// Regex patterns
// ---------------------------------------------------------------------------

/** Phoenix connector keyword. */
const PHOENIX_KW_RE = /\bPHOENIX(?:\s+CONTACT)?\b/i;

/** Phoenix connector PN (17xxxxx). */
const PHOENIX_PN_RE = /\b(17\d{5})\b/;

/** Connector reference designators: J1, J12, P1, P2, X3. */
const CONNECTOR_REF_GRE = /\b([JPX]\d{1,3})\b/gi;

/** ACI-prefixed callout labels (e.g., ACI01960, ACI10898). */
const ACI_CALLOUT_GRE = /\b(ACI\d{4,7})\b/gi;

/** Terminal / splice part numbers — matches T2 TERMINAL_RE pattern. */
const TERMINAL_PN_GRE = /\b(\d{1,4}-\d{4,9}(?:-\d{1,4})?|\d{4,9}-\d{1,4})\b/g;

/** Title block line patterns — exclude these from the diagram region. */
const TITLE_BLOCK_LINE_RE =
  /^(?:DRAWN|APPROVED|CHECKED|DATE|SCALE|UNLESS|NOTES?|REVISION\s+HISTORY|TOLERAN|GENERAL)/i;

/** Apogee DRN anchor — signals title block territory. */
const APOGEE_DRN_RE = /\b527-\d{4}-010\b/;

/** Proximity threshold (in line-index units) for callout→component association. */
const LINE_PROXIMITY_THRESHOLD = 6;

// ---------------------------------------------------------------------------
// Step 1 — Diagram region isolation
// ---------------------------------------------------------------------------

/**
 * Return the subset of OCR lines that belong to the diagram region:
 * - Lines BEFORE the wire table header (wireTableHeaderIdx)
 * - Excluding title block contamination
 *
 * @param allLines    All OCR lines (trimmed, non-empty).
 * @param wireTableHeaderIdx  Line index returned by detectWireTableRegion, or null.
 */
export function isolateDiagramLines(
  allLines: string[],
  wireTableHeaderIdx: number | null,
): string[] {
  const endIdx = wireTableHeaderIdx !== null ? wireTableHeaderIdx : allLines.length;
  return allLines.slice(0, endIdx).filter(line => {
    const t = line.trim();
    if (t.length < 2) return false;
    if (TITLE_BLOCK_LINE_RE.test(t)) return false;
    if (APOGEE_DRN_RE.test(t)) return false;
    return true;
  });
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function makeId(prefix: string, counter: { n: number }): string {
  return `${prefix}_${++counter.n}`;
}

function findAll(re: RegExp, text: string): string[] {
  re.lastIndex = 0;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.push(m[1]);
  return out;
}

// ---------------------------------------------------------------------------
// Step 2 — Deterministic extraction
// ---------------------------------------------------------------------------

/**
 * Build structured components and callouts from diagram-region OCR lines.
 *
 * Detection rules (in priority order per line):
 *   1. PHOENIX keyword → CONNECTOR, locationHint=LEFT (domain rule)
 *   2. Phoenix PN (17xxxxx) standalone → CONNECTOR, locationHint=LEFT
 *   3. Connector reference designators (J*, P*, X*) → CONNECTOR
 *   4. ACI callout tokens → Callout (text label, no PN)
 *   5. Terminal part numbers → Callout (with normalizedPartNumber)
 *
 * Deduplication: by label key for components, by text key for callouts.
 * Association: callouts linked to nearest component by line-index proximity.
 */
export function extractDiagramComponents(
  diagramLines: string[],
): DiagramExtractionResult {
  // Internal detection records with line index for proximity association
  const compDetections: Array<{ node: ComponentNode; lineIdx: number }> = [];
  const calloutDetections: Array<{ callout: Callout; lineIdx: number }> = [];

  const seenCompLabels = new Set<string>();
  const seenCalloutTexts = new Set<string>();
  const compCounter = { n: 0 };

  for (let i = 0; i < diagramLines.length; i++) {
    const line = diagramLines[i];
    const t = line.trim();
    if (!t) continue;

    // ── 1. Phoenix keyword ──────────────────────────────────────────────
    if (PHOENIX_KW_RE.test(t)) {
      const pnM = t.match(PHOENIX_PN_RE);
      const pn = pnM ? pnM[1] : null;
      const label = pn ? `PHOENIX ${pn}` : 'PHOENIX CONTACT';
      if (!seenCompLabels.has(label)) {
        seenCompLabels.add(label);
        compDetections.push({
          lineIdx: i,
          node: {
            id:                  makeId('CONN', compCounter),
            type:                'CONNECTOR',
            label,
            normalizedPartNumber: pn,
            locationHint:        'LEFT',
            source:              'OCR',
            confidence:          pn ? 0.88 : 0.82,
            rawText:             t,
          },
        });
      }
      continue; // line is consumed — skip further per-line checks
    }

    // ── 2. Phoenix PN standalone (without keyword) ──────────────────────
    const pnM = t.match(PHOENIX_PN_RE);
    if (pnM) {
      const pn = pnM[1];
      const label = `PHOENIX ${pn}`;
      if (!seenCompLabels.has(label)) {
        seenCompLabels.add(label);
        compDetections.push({
          lineIdx: i,
          node: {
            id:                  makeId('CONN', compCounter),
            type:                'CONNECTOR',
            label,
            normalizedPartNumber: pn,
            locationHint:        'LEFT',
            source:              'OCR',
            confidence:          0.70,
            rawText:             t,
          },
        });
      }
    }

    // ── 3. Connector reference designators (J*, P*, X*) ─────────────────
    const refs = findAll(CONNECTOR_REF_GRE, t);
    for (const ref of refs) {
      const key = ref.toUpperCase();
      if (!seenCompLabels.has(key)) {
        seenCompLabels.add(key);
        compDetections.push({
          lineIdx: i,
          node: {
            id:                  makeId('CONN', compCounter),
            type:                'CONNECTOR',
            label:               key,
            normalizedPartNumber: null,
            locationHint:        null,
            source:              'OCR',
            confidence:          0.65,
            rawText:             t,
          },
        });
      }
    }

    // ── 4. ACI callout labels ────────────────────────────────────────────
    const aciTokens = findAll(ACI_CALLOUT_GRE, t);
    for (const aci of aciTokens) {
      const key = aci.toUpperCase();
      if (!seenCalloutTexts.has(key)) {
        seenCalloutTexts.add(key);
        calloutDetections.push({
          lineIdx: i,
          callout: {
            text:                  aci,
            normalizedPartNumber:  null,
            associatedComponentId: null,
            source:                'OCR',
            confidence:            0.80,
            rawText:               t,
          },
        });
      }
    }

    // ── 5. Terminal PN callouts ──────────────────────────────────────────
    const termPNs = findAll(TERMINAL_PN_GRE, t);
    for (const pn of termPNs) {
      if (!seenCalloutTexts.has(pn)) {
        seenCalloutTexts.add(pn);
        calloutDetections.push({
          lineIdx: i,
          callout: {
            text:                  pn,
            normalizedPartNumber:  pn,
            associatedComponentId: null,
            source:                'OCR',
            confidence:            0.72,
            rawText:               t,
          },
        });
      }
    }
  }

  // ── Associate callouts to nearest component by line-index proximity ──
  for (const cd of calloutDetections) {
    let nearestId: string | null = null;
    let nearestDist = Infinity;
    for (const compD of compDetections) {
      const dist = Math.abs(cd.lineIdx - compD.lineIdx);
      if (dist < nearestDist && dist <= LINE_PROXIMITY_THRESHOLD) {
        nearestDist = dist;
        nearestId = compD.node.id;
      }
    }
    cd.callout.associatedComponentId = nearestId;
  }

  const components = compDetections.map(d => d.node);
  const callouts   = calloutDetections.map(d => d.callout);
  const unresolvedCallouts = callouts
    .filter(c => c.associatedComponentId === null)
    .map(c => c.text);

  return { components, callouts, unresolvedCallouts };
}

// ---------------------------------------------------------------------------
// Step 3 — Merge deterministic + AI vision results
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Step T23.7.1 — Connector table context promotion
// ---------------------------------------------------------------------------

/** T23.7.1: Context triggers — at least one must match for table-context scanning. */
const EQUIV_CONNECTOR_CTX_RE = /\b(?:OR\s+)?EQUIVALENT\b/i;
const CONNECTOR_TABLE_CTX_RE = /\b(?:CONNECTOR|CONN|HOUSING|ASSY)\b/i;
const BRAND_CTX_RE           = /\b(?:PHOENIX|MOLEX|AMP\b|TYCO|DEUTSCH|APTIV|DELPHI|JST|WAGO)\b/i;

/** T23.7.1: Non-PN rejection sets — tokens that superficially match PN patterns. */
const TABLE_REJECT_COLORS = new Set([
  'BLK','BK','BLACK','RED','RD','BLU','BLUE','GRN','GREEN','WHT','WHITE',
  'YEL','YELLOW','ORG','ORANGE','BRN','BROWN','GRY','GREY','GRAY',
  'VIO','VIOLET','PNK','PINK','NAT','NATURAL',
]);
const TABLE_REJECT_UNITS = new Set([
  'FT','FEET','FOOT','IN','INCH','INCHES','M','MM','CM','AWG','GA','GAUGE',
  'EA','EACH','PC','PCS','REQ','QTY','LBS','LB',
]);
const TABLE_REJECT_PROCESS = new Set([
  'STRIP','CRIMP','TORQUE','SEAL','APPLY','LABEL','BAG','NOTE','SETUP',
]);

/** T23.7.1: Rejects "4.5", "0.250" etc. */
const PURE_DECIMAL_RE = /^\d+\.\d+$/;

/**
 * T23.7.2 — Unconditional full-OCR PN promotion.
 *
 * Scans EVERY OCR line (no context-keyword gating) for part-number-like tokens
 * and promotes them as CONNECTOR ComponentNodes.  Context keywords are retained
 * for metadata/confidence only — they do NOT gate which lines are scanned.
 *
 * Promoted:  6-8 digit plain numerics, dash-separated numeric PNs, alpha-prefix PNs
 * Rejected:  colors, unit tokens, process keywords, pure decimals, numerics < 1000
 * Source tag: FORCED_TABLE_PROMOTION
 */
export function extractConnectorTableComponents(allLines: string[]): ComponentNode[] {
  const promoted: ComponentNode[] = [];
  const seenPNs = new Set<string>();
  let idCount   = 0;

  for (const line of allLines) {
    const t = line.trim();
    if (!t || t.length < 3) continue;

    const upper = t.toUpperCase();

    // Context metadata (used for confidence scoring only — does NOT gate the line)
    const isEquivContext = EQUIV_CONNECTOR_CTX_RE.test(t);
    const isConnContext  = CONNECTOR_TABLE_CTX_RE.test(t);
    const isBrandContext = BRAND_CTX_RE.test(t);

    const candidates: string[] = [];

    // Class 1 — 6-8 digit plain numerics (e.g. 1700443, 1792566)
    for (const m of upper.matchAll(/\b(\d{6,8})\b/g)) {
      candidates.push(m[1]);
    }

    // Class 2 — Dash-separated numeric PNs (e.g. 284040-6, 929504-1)
    for (const m of upper.matchAll(/\b(\d{5,6}-\d)\b/g)) {
      candidates.push(m[1]);
    }

    // Class 3 — Alpha-prefix with dashes (e.g. EB1550B-06-800)
    for (const m of upper.matchAll(/\b([A-Z0-9]{2,}-\d{2,}(?:-[A-Z0-9]+)*)\b/g)) {
      candidates.push(m[1]);
    }

    for (const raw of candidates) {
      const token = raw.trim();
      if (!token) continue;

      if (TABLE_REJECT_COLORS.has(token)) {
        console.log('[T23.7.1 TABLE FILTER REJECT]', { token, reason: 'COLOR_TOKEN' });
        continue;
      }
      if (TABLE_REJECT_UNITS.has(token)) {
        console.log('[T23.7.1 TABLE FILTER REJECT]', { token, reason: 'UNIT_TOKEN' });
        continue;
      }
      if (TABLE_REJECT_PROCESS.has(token)) {
        console.log('[T23.7.1 TABLE FILTER REJECT]', { token, reason: 'PROCESS_TOKEN' });
        continue;
      }
      if (PURE_DECIMAL_RE.test(token)) continue;
      if (/^\d+$/.test(token) && Number(token) < 1000) {
        console.log('[T23.7.1 TABLE FILTER REJECT]', { token, reason: 'NUMERIC_TOO_SMALL' });
        continue;
      }

      if (seenPNs.has(token)) continue;
      seenPNs.add(token);

      console.log('[T23.7.2 FORCED PN]', token, t.length > 80 ? t.slice(0, 80) + '\u2026' : t);

      const confidence = isEquivContext ? 0.85 : isBrandContext ? 0.80 : isConnContext ? 0.72 : 0.60;

      promoted.push({
        id:                   `CONN_TBL_${++idCount}`,
        type:                 'CONNECTOR',
        label:                token,
        normalizedPartNumber: token,
        locationHint:         null,
        source:               'OCR',
        confidence,
        rawText:              t,
      });
    }
  }

  return promoted;
}

// ---------------------------------------------------------------------------

/**
 * Merge a deterministic DiagramExtractionResult with an optional AI vision
 * result. Deterministic result is the base. AI can only ADD new components
 * and callouts that are not already represented.
 *
 * Rules:
 *   - Deduplication by normalizedPartNumber (components) and text (callouts).
 *   - AI-derived entries get source='VISION' and confidence scaled by 0.85.
 *   - AI entries never override deterministic results.
 */
export function mergeWithVisionResult(
  deterministic: DiagramExtractionResult,
  vision: DiagramVisionResult | null,
): DiagramExtractionResult {
  if (!vision) return deterministic;

  const compCounter = { n: deterministic.components.length };
  const existingPNs = new Set(
    deterministic.components.map(c => c.normalizedPartNumber).filter(Boolean),
  );
  const existingLabels = new Set(
    deterministic.components.map(c => c.label.toUpperCase()),
  );
  const existingCalloutTexts = new Set(
    deterministic.callouts.map(c => c.text.toUpperCase()),
  );

  const addedComponents: ComponentNode[] = [];
  const addedCallouts:   Callout[]       = [];

  for (const vc of vision.components) {
    const label = (vc.label ?? '').trim();
    if (!label) continue;
    const pn = vc.partNumber?.trim() || null;

    const alreadyByPN    = pn && existingPNs.has(pn);
    const alreadyByLabel = existingLabels.has(label.toUpperCase());
    if (alreadyByPN || alreadyByLabel) continue;

    existingLabels.add(label.toUpperCase());
    if (pn) existingPNs.add(pn);

    addedComponents.push({
      id:                  makeId('CONN', compCounter),
      type:                vc.type ?? 'UNKNOWN',
      label,
      normalizedPartNumber: pn,
      locationHint:        vc.position ?? null,
      source:              'VISION',
      confidence:          0.65, // AI-derived, lower trust
      rawText:             label,
    });
  }

  for (const vCallout of vision.callouts) {
    const text = (vCallout.text ?? '').trim();
    if (!text) continue;
    if (existingCalloutTexts.has(text.toUpperCase())) continue;

    existingCalloutTexts.add(text.toUpperCase());

    addedCallouts.push({
      text,
      normalizedPartNumber:  vCallout.partNumber?.trim() || null,
      associatedComponentId: null,
      source:                'VISION',
      confidence:            0.60,
      rawText:               text,
    });
  }

  const components = [...deterministic.components, ...addedComponents];
  const callouts   = [...deterministic.callouts,   ...addedCallouts];
  const unresolvedCallouts = callouts
    .filter(c => c.associatedComponentId === null)
    .map(c => c.text);

  return { components, callouts, unresolvedCallouts };
}
