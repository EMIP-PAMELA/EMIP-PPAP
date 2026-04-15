/**
 * Endpoint Classifier — Phase T6
 *
 * Classifies every wire endpoint (from T2 HC-BOM) as:
 *   CONNECTOR, TERMINAL, OPEN, or AMBIGUOUS
 *
 * Uses deterministic evidence scoring against three independent signal sets:
 *   - CONNECTOR: cavity/pin present, connector ref (J/P/X), housing keywords,
 *     Phoenix brand, multi-wire sharing count
 *   - TERMINAL: ACI PN, dash-numeric PN, terminal type keywords
 *   - OPEN: null component, SPLICE/HEAT_SHRINK treatment, strip length callout
 *
 * The highest-scoring type wins. If two scores fall within the TIE_THRESHOLD
 * of each other, the result is AMBIGUOUS (never force-resolved).
 *
 * Governance:
 *   - Pure functions. No I/O, no DB calls, no side effects. Never throws.
 *   - DOES NOT modify T2 HC-BOM or T4 diagram extraction outputs.
 *   - DOES NOT use AI. Deterministic scoring only.
 *   - Ambiguous states are preserved, never collapsed.
 *   - Additive layer: all outputs are INTERMEDIATE signals — not authoritative.
 *   - Evidence traceability: every ClassifiedEndpoint includes an evidence array.
 */

import type { HarnessConnectivityResult } from './harnessConnectivityService';

// ---------------------------------------------------------------------------
// Data Model
// ---------------------------------------------------------------------------

export type EndpointType = 'CONNECTOR' | 'TERMINAL' | 'OPEN' | 'AMBIGUOUS';

export interface EndpointEvidenceScores {
  /** 0–1 score from CONNECTOR signal set. */
  connectorEvidence: number;
  /** 0–1 score from TERMINAL signal set. */
  terminalEvidence: number;
  /** 0–1 score from OPEN signal set. */
  openEvidence: number;
}

export interface ClassifiedEndpoint {
  /** Winning classification, or AMBIGUOUS when top two scores tie. */
  type: EndpointType;
  /** Normalized winning score (0–1). */
  confidence: number;
  scores: EndpointEvidenceScores;
  /** Human-readable evidence strings describing which signals fired. */
  evidence: string[];
}

/**
 * All context needed to classify a single wire endpoint.
 * Mirrors T2's WireEndpoint fields, plus rawText from the parent wire and
 * an optional wire-sharing count for multi-wire housing detection.
 */
export interface EndpointClassificationContext {
  component: string | null;
  cavity:    string | null;
  treatment: string | null;
  rawText:   string;
  /**
   * Number of wires that reference the same component label in this harness.
   * Defaults to 1 when not provided. Values >= 3 strongly indicate a
   * multi-wire connector housing.
   */
  wireShareCount?: number;
}

export interface WireClassification {
  from: ClassifiedEndpoint;
  to:   ClassifiedEndpoint;
}

export interface HarnessEndpointClassificationResult {
  /** wireId → { from, to } classifications */
  classifications: Map<string, WireClassification>;
  summary: {
    totalEndpoints: number;
    byType: Record<EndpointType, number>;
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Maximum score difference between the top two candidates before the result
 * is considered a tie and resolved as AMBIGUOUS.
 */
const TIE_THRESHOLD = 0.10;

// ---------------------------------------------------------------------------
// Regex patterns
// ---------------------------------------------------------------------------

/** Standard connector reference designators: J1, J12, J123, P3, X2. */
const CONN_REF_RE = /^[JPX]\d{1,3}$/i;

/**
 * Phoenix connector brand prefix.
 * Matches: "PHOENIX", "PHOENIX_1700443" (T2 format), "PHOENIX CONTACT" (T4 format).
 * Uses prefix check because underscore is a word character — \bPHOENIX\b
 * would fail to match "PHOENIX_1700443".
 */
const PHOENIX_COMP_RE = /^PHOENIX/i;

/**
 * Connector housing / body keywords anywhere in label.
 * HSG uses \bHSG(?:[_\s\d]|$) because underscores are word chars in regex,
 * so \bHSG\b would fail to match "HSG_3P" (G→_ has no word boundary).
 */
const HOUSING_KW_RE = /\b(?:CONN(?:ECTOR)?|PLUG|HOUSING|SOCKET)\b|\bHSG(?:[_\s\d]|$)/i;

/** ACI-prefixed terminal part number (ACI + 4–7 digits). */
const ACI_PN_RE = /^ACI\d{4,7}$/i;

/**
 * Generic dash-numeric terminal part number.
 * Matches: "929504-1", "1-929504-1", "42866-1", "1700443-1"
 * Does NOT match plain 7-digit Phoenix PNs (no dash), connector refs (J1), or ACI labels.
 */
const TERMINAL_PN_RE = /^(?:\d{1,4}-\d{4,9}(?:-\d{1,4})?|\d{4,9}-\d{1,4})$/;

/** Terminal type keywords in raw text or component label. */
const TERMINAL_KW_RE =
  /\b(?:FASTON|RING\s*TERM(?:INAL)?|SPADE|REC(?:EPTACLE)?|FLAG\s*TERM(?:INAL)?|PIN\s+TERMINAL)\b/i;

/**
 * Strip length callout in raw text.
 * Matches fractional inch (1/4, 3/8) and explicit mm values (6mm, 12mm).
 * Intentionally narrow to avoid false-positive matches on terminal PNs.
 */
const STRIP_LENGTH_RE = /\b(?:[1-9]\d{0,1}\/\d{1,2}|(?:6|8|10|12|15|20|25)\s*mm)\b/i;

// ---------------------------------------------------------------------------
// Scoring functions
// ---------------------------------------------------------------------------

function scoreConnector(
  ctx:           EndpointClassificationContext,
  wireShareCount: number,
  evidence:      string[],
): number {
  let score = 0;
  const comp = (ctx.component ?? '').trim();

  if (ctx.cavity) {
    score += 0.40;
    evidence.push(`cavity/pin present (${ctx.cavity})`);
  }

  if (comp && CONN_REF_RE.test(comp)) {
    score += 0.35;
    evidence.push(`connector ref designator (${comp})`);
  }

  if (comp && PHOENIX_COMP_RE.test(comp)) {
    score += 0.25;
    evidence.push(`Phoenix connector brand (${comp})`);
  }

  if (comp && HOUSING_KW_RE.test(comp)) {
    score += 0.25;
    evidence.push(`housing keyword in component label`);
  }

  if (wireShareCount >= 3) {
    score += 0.30;
    evidence.push(`multi-wire housing (${wireShareCount} wires share this component)`);
  } else if (wireShareCount === 2) {
    score += 0.15;
    evidence.push(`2-wire housing`);
  }

  return Math.min(score, 1.0);
}

function scoreTerminal(
  ctx:           EndpointClassificationContext,
  wireShareCount: number,
  evidence:      string[],
): number {
  let score = 0;
  const comp = (ctx.component ?? '').trim();

  if (comp && ACI_PN_RE.test(comp)) {
    score += 0.55;
    evidence.push(`ACI terminal PN (${comp})`);
  } else if (comp && TERMINAL_PN_RE.test(comp)) {
    score += 0.45;
    evidence.push(`dash-numeric terminal PN (${comp})`);
  }

  if (TERMINAL_KW_RE.test(ctx.rawText)) {
    score += 0.35;
    evidence.push(`terminal keyword in raw text`);
  }

  return Math.min(score, 1.0);
}

function scoreOpen(
  ctx:      EndpointClassificationContext,
  evidence: string[],
): number {
  let score = 0;

  if (!ctx.component) {
    score += 0.60;
    evidence.push(`no component label (bare wire end)`);
  }

  if (ctx.treatment === 'SPLICE') {
    score += 0.20;
    evidence.push(`SPLICE treatment`);
  } else if (ctx.treatment === 'HEAT_SHRINK') {
    score += 0.15;
    evidence.push(`HEAT_SHRINK treatment`);
  }

  if (STRIP_LENGTH_RE.test(ctx.rawText)) {
    score += 0.20;
    evidence.push(`strip length callout in raw text`);
  }

  return Math.min(score, 1.0);
}

// ---------------------------------------------------------------------------
// Primary export: classifyEndpoint
// ---------------------------------------------------------------------------

/**
 * Classify a single wire endpoint as CONNECTOR, TERMINAL, OPEN, or AMBIGUOUS.
 *
 * Algorithm:
 *   1. Independently score all three signal sets.
 *   2. If all scores are 0 → OPEN (unrecognized bare end).
 *   3. If two scores fall within TIE_THRESHOLD of the maximum → AMBIGUOUS.
 *   4. Otherwise the highest-scoring type wins.
 *
 * Never modifies the input. Never throws.
 */
export function classifyEndpoint(ctx: EndpointClassificationContext): ClassifiedEndpoint {
  const wireShareCount = ctx.wireShareCount ?? 1;

  const connEvidence: string[] = [];
  const termEvidence: string[] = [];
  const openEvidence: string[] = [];

  const connScore = scoreConnector(ctx, wireShareCount, connEvidence);
  const termScore = scoreTerminal(ctx, wireShareCount, termEvidence);
  const openScore = scoreOpen(ctx, openEvidence);

  const scores: EndpointEvidenceScores = {
    connectorEvidence: connScore,
    terminalEvidence:  termScore,
    openEvidence:      openScore,
  };

  const maxScore = Math.max(connScore, termScore, openScore);

  // No signals at all → OPEN (safest default for an unrecognized bare end)
  if (maxScore === 0) {
    return {
      type:       'OPEN',
      confidence: 0.0,
      scores,
      evidence:   ['no classification signals detected — treated as OPEN'],
    };
  }

  // Gather all candidates within tie threshold of the maximum
  const candidates = [
    { type: 'CONNECTOR' as EndpointType, score: connScore, evidence: connEvidence },
    { type: 'TERMINAL'  as EndpointType, score: termScore, evidence: termEvidence },
    { type: 'OPEN'      as EndpointType, score: openScore, evidence: openEvidence },
  ].filter(c => c.score > 0 && c.score >= maxScore - TIE_THRESHOLD);

  if (candidates.length > 1) {
    return {
      type:       'AMBIGUOUS',
      confidence: maxScore,
      scores,
      evidence:   candidates.flatMap(c => c.evidence),
    };
  }

  const winner = candidates[0];
  return {
    type:       winner.type,
    confidence: winner.score,
    scores,
    evidence:   winner.evidence,
  };
}

// ---------------------------------------------------------------------------
// Batch classifier over a full HC-BOM
// ---------------------------------------------------------------------------

/**
 * Classify all wire endpoints in a HarnessConnectivityResult.
 *
 * Pre-computes wireShareCount per component label across the full harness so
 * that multi-wire connector housings are correctly detected.
 *
 * @param harnessConnectivity  T2 HC-BOM result. Never mutated.
 */
export function classifyHarnessEndpoints(
  harnessConnectivity: HarnessConnectivityResult,
): HarnessEndpointClassificationResult {
  // Tally how many wires reference each component label
  const shareCount = new Map<string, number>();
  for (const wire of harnessConnectivity.wires) {
    const fk = wire.from.component?.toLowerCase().trim();
    const tk = wire.to.component?.toLowerCase().trim();
    if (fk) shareCount.set(fk, (shareCount.get(fk) ?? 0) + 1);
    if (tk) shareCount.set(tk, (shareCount.get(tk) ?? 0) + 1);
  }

  const classifications = new Map<string, WireClassification>();
  const byType: Record<EndpointType, number> = {
    CONNECTOR: 0, TERMINAL: 0, OPEN: 0, AMBIGUOUS: 0,
  };

  for (const wire of harnessConnectivity.wires) {
    const fromShare = shareCount.get(wire.from.component?.toLowerCase().trim() ?? '') ?? 1;
    const toShare   = shareCount.get(wire.to.component?.toLowerCase().trim()   ?? '') ?? 1;

    const from = classifyEndpoint({
      component:      wire.from.component,
      cavity:         wire.from.cavity,
      treatment:      wire.from.treatment,
      rawText:        wire.rawText,
      wireShareCount: fromShare,
    });

    const to = classifyEndpoint({
      component:      wire.to.component,
      cavity:         wire.to.cavity,
      treatment:      wire.to.treatment,
      rawText:        wire.rawText,
      wireShareCount: toShare,
    });

    classifications.set(wire.wireId, { from, to });
    byType[from.type]++;
    byType[to.type]++;
  }

  const totalEndpoints = harnessConnectivity.wires.length * 2;

  console.log('[T6 ENDPOINT CLASSIFIER]', {
    totalEndpoints,
    CONNECTOR: byType.CONNECTOR,
    TERMINAL:  byType.TERMINAL,
    OPEN:      byType.OPEN,
    AMBIGUOUS: byType.AMBIGUOUS,
  });

  return {
    classifications,
    summary: { totalEndpoints, byType },
  };
}
