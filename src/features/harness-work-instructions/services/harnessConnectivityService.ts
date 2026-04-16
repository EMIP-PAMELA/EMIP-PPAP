/**
 * Harness Connectivity Service — Phase T2
 *
 * Transforms T1 parsed wire table rows into a normalized Harness
 * Connectivity BOM (HC-BOM) with explicit from/to endpoints per wire.
 *
 * Governance:
 *   - Pure function. No I/O, no DB writes, no side effects. Never throws.
 *   - DOES NOT perform full graph topology inference or line-following.
 *   - DOES NOT use AI to guess connections.
 *   - DOES NOT override table-derived truth or modify authority resolver.
 *   - Ambiguity remains visible — forced mappings are forbidden.
 *   - All outputs are INTERMEDIATE structured models.
 *   - Evidence traceability: every wire preserves rawText and sourceRowIndex.
 */

import type { WireRow } from './wireTableParser';
import type { LengthUnit } from './unitInferenceService';

// ---------------------------------------------------------------------------
// HC-BOM Data Model
// ---------------------------------------------------------------------------

/**
 * Tracks which authority layer provided the machine process data
 * (partNumber + stripLength) for this endpoint.
 *   EXTRACTED — parsed directly from the source document.
 *   ACI_TABLE  — auto-resolved via the ACI lookup table (T18.5).
 *   OPERATOR   — set explicitly by the operator in the editor.
 */
export type EndpointProcessSource = 'EXTRACTED' | 'ACI_TABLE' | 'OPERATOR';

export type EndpointTerminationType =
  | 'UNKNOWN'
  | 'CONNECTOR_PIN'
  | 'TERMINAL'
  | 'FERRULE'
  | 'STRIP_ONLY'
  | 'SPLICE'
  | 'GROUND'
  | 'RING'
  | 'SPADE'
  | 'RECEPTACLE'
  | 'OTHER_TREATMENT';

export interface WireEndpoint {
  /** Component identifier (connector ref, Phoenix PN, terminal PN, etc.) */
  component: string | null;
  /** Cavity / pin position within the component. */
  cavity: string | null;
  /** Treatment applied at this endpoint (SPLICE, HEAT_SHRINK, etc.) */
  treatment: string | null;
  /** Explicit termination classification derived from T2 or operator edits. */
  terminationType?: EndpointTerminationType | null;

  // T18.5: Machine process enrichment fields
  /** Terminal or ferrule part number for this endpoint. Operator-set or ACI-resolved. */
  partNumber?: string | null;
  /** Required strip length for machine setup (e.g. "8.5 mm"). Operator-set or ACI-resolved. */
  stripLength?: string | null;
  /** Tracks which authority layer provided partNumber / stripLength. */
  processSource?: EndpointProcessSource | null;
}

export interface WireConnectivity {
  wireId: string;
  length: number | null;
  lengthUnit: LengthUnit | null;
  lengthInches: number | null;
  gauge: string | null;
  color: string | null;

  from: WireEndpoint;
  to: WireEndpoint;

  /** Index of this wire's source row in wireTableResult.rows. */
  sourceRowIndex: number;
  /** Raw OCR text for evidence traceability. */
  rawText: string;

  /** 0–1 deterministic confidence based on field completeness. */
  confidence: number;
  /**
   * True when mapping is ambiguous — e.g. multiple terminals,
   * SPLICE treatment, COM/GND/SHLD without clear endpoint.
   * Downstream phases must NOT treat unresolved wires as authoritative.
   */
  unresolved: boolean;
}

export interface HarnessConnectivityResult {
  wires: WireConnectivity[];
  /** Wire IDs that were flagged unresolved. */
  unresolvedWires: string[];
  confidenceSummary: {
    total: number;
    /** Both endpoints present and not ambiguous. */
    resolved: number;
    /** At least one endpoint missing, but not flagged ambiguous. */
    partial: number;
    /** Flagged ambiguous — see unresolved field on each wire. */
    unresolved: number;
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Special wire IDs whose from/to mapping is inherently ambiguous.
 * These represent bus, ground, or shield connections without clear endpoints.
 */
const AMBIGUOUS_WIRE_IDS = new Set([
  'COM', 'GND', 'SHLD', 'SHIELD', 'SHD',
]);

/** Phoenix connector keyword in raw text. */
const PHOENIX_KEYWORD_RE = /\bPHOENIX\b/i;

/** Phoenix connector PN pattern (17xxxxx series). */
const PHOENIX_PN_RE = /\b(17\d{5})\b/;

const STRIP_KEYWORD_RE = /\bSTRIP(?:PED)?\b/i;
const STRIP_LENGTH_RE = /\b(?:[1-9]\d{0,1}\/\d{1,2}|(?:6|8|10|12|15|20|25)\s*mm)\b/i;
const FERRULE_KEYWORD_RE = /\bFERRULE\b/i;
const SPLICE_KEYWORD_RE = /\bSPLICE\b/i;
const RING_KEYWORD_RE = /\bRING\b/i;
const SPADE_KEYWORD_RE = /\bSPADE\b/i;
const RECEPTACLE_KEYWORD_RE = /\bRECEPTACLE\b/i;
const GROUND_KEYWORD_RE = /\bGND\b|\bGROUND\b/i;

/**
 * Terminal part number — dash-separated numeric.
 * Used here to detect MULTIPLE terminals in a single raw line (→ ambiguous).
 */
const TERMINAL_GLOBAL_RE = /\b(\d{1,4}-\d{4,9}(?:-\d{1,4})?|\d{4,9}-\d{1,4})\b/g;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Count distinct terminal part numbers in raw text.
 * Returns deduplicated list of all terminal-shaped tokens found.
 */
function findAllTerminals(rawText: string): string[] {
  const seen = new Set<string>();
  TERMINAL_GLOBAL_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TERMINAL_GLOBAL_RE.exec(rawText)) !== null) {
    seen.add(m[1]);
  }
  return [...seen];
}

/**
 * Detect Phoenix connector reference from raw text.
 * Returns a normalized component string or null.
 */
function detectPhoenixComponent(rawText: string): string | null {
  const pnMatch = rawText.match(PHOENIX_PN_RE);
  if (pnMatch) return `PHOENIX_${pnMatch[1]}`;
  if (PHOENIX_KEYWORD_RE.test(rawText)) return 'PHOENIX';
  return null;
}

function hasStripIndication(treatment: string | null, rawText: string): boolean {
  return STRIP_KEYWORD_RE.test(treatment ?? '') || STRIP_LENGTH_RE.test(rawText);
}

export function inferTerminationType(args: {
  component: string | null;
  cavity: string | null;
  treatment: string | null;
  rawText: string;
}): EndpointTerminationType {
  const { component, cavity, treatment, rawText } = args;
  const comp = component?.trim() ?? '';
  const treat = treatment?.trim() ?? '';
  if (comp && cavity) return 'CONNECTOR_PIN';
  if (comp) {
    const upperComp = comp.toUpperCase();
    if (GROUND_KEYWORD_RE.test(upperComp)) return 'GROUND';
    if (SPLICE_KEYWORD_RE.test(upperComp)) return 'SPLICE';
    if (FERRULE_KEYWORD_RE.test(upperComp)) return 'FERRULE';
    if (RING_KEYWORD_RE.test(upperComp)) return 'RING';
    if (SPADE_KEYWORD_RE.test(upperComp)) return 'SPADE';
    if (RECEPTACLE_KEYWORD_RE.test(upperComp)) return 'RECEPTACLE';
    if (upperComp.includes('TERMINAL')) return 'TERMINAL';
    return 'TERMINAL';
  }

  if (treat) {
    const upperTreat = treat.toUpperCase();
    if (SPLICE_KEYWORD_RE.test(upperTreat)) return 'SPLICE';
    if (FERRULE_KEYWORD_RE.test(upperTreat)) return 'FERRULE';
    if (RING_KEYWORD_RE.test(upperTreat)) return 'RING';
    if (SPADE_KEYWORD_RE.test(upperTreat)) return 'SPADE';
    if (RECEPTACLE_KEYWORD_RE.test(upperTreat)) return 'RECEPTACLE';
    if (hasStripIndication(treat, rawText)) return 'STRIP_ONLY';
    return 'OTHER_TREATMENT';
  }

  if (hasStripIndication(null, rawText)) return 'STRIP_ONLY';

  return 'UNKNOWN';
}

export function endpointHasAuthoritativeTermination(endpoint: WireEndpoint | undefined | null): boolean {
  if (!endpoint) return false;
  if (endpoint.component && endpoint.component.trim()) return true;
  const term = endpoint.terminationType ?? 'UNKNOWN';
  return term !== 'UNKNOWN';
}

/**
 * Compute deterministic confidence score from field completeness.
 *
 * Starts at 1.0 and subtracts:
 *   - missing gauge    → −0.1
 *   - missing pin      → −0.2
 *   - missing terminal → −0.3
 *   - ambiguous (unresolved) → −0.4
 *
 * Clamped to [0.0, 1.0].
 */
function computeConfidence(
  gauge: string | null,
  pin: string | null,
  terminal: string | null,
  unresolved: boolean,
): number {
  let score = 1.0;
  if (!gauge)    score -= 0.1;
  if (!pin)      score -= 0.2;
  if (!terminal) score -= 0.3;
  if (unresolved) score -= 0.4;
  return Math.max(0.0, Math.min(1.0, score));
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

/**
 * Build a Harness Connectivity BOM from parsed wire table rows.
 *
 * For each WireRow:
 *   1. Map basic fields (wireId, length, gauge, color).
 *   2. Determine FROM endpoint: connectorRef → component, pin → cavity,
 *      treatment → treatment. Falls back to Phoenix detection in rawText.
 *   3. Determine TO endpoint: terminal → component.
 *   4. Flag ambiguous rows (multiple terminals, SPLICE/HEAT_SHRINK,
 *      COM/GND/SHLD without clear mapping).
 *   5. Score confidence deterministically.
 *
 * @param wireRows - Parsed wire rows from T1 wireTableParser.
 */
export function buildHarnessConnectivity(wireRows: WireRow[]): HarnessConnectivityResult {
  const wires: WireConnectivity[] = [];
  const unresolvedWires: string[] = [];

  for (let i = 0; i < wireRows.length; i++) {
    const row = wireRows[i];
    const wireId = row.wireId ?? `UNK_${i + 1}`;

    // ── FROM endpoint (left side / connector side) ──────────────────────
    let fromComponent: string | null = row.connectorRef;
    if (!fromComponent) {
      fromComponent = detectPhoenixComponent(row.rawText);
    }

    const fromTermination = inferTerminationType({
      component: fromComponent,
      cavity:    row.pin ?? null,
      treatment: row.treatment ?? null,
      rawText:   row.rawText,
    });
    const from: WireEndpoint = {
      component: fromComponent,
      cavity:    row.pin ?? null,
      treatment: row.treatment ?? null,
      terminationType: fromTermination,
    };

    // ── TO endpoint (right side / terminal side) ────────────────────────
    const toTermination = inferTerminationType({
      component: row.terminal ?? null,
      cavity:    null,
      treatment: null,
      rawText:   row.rawText,
    });
    const to: WireEndpoint = {
      component: row.terminal ?? null,
      cavity:    null,
      treatment: null,
      terminationType: toTermination,
    };

    // ── Ambiguity detection ─────────────────────────────────────────────
    let unresolved = false;

    // Multiple distinct terminals in raw text → ambiguous TO side
    const allTerminals = findAllTerminals(row.rawText);
    if (allTerminals.length > 1) {
      unresolved = true;
    }

    // SPLICE or HEAT_SHRINK treatment → connection semantics ambiguous
    if (row.treatment === 'SPLICE' || row.treatment === 'HEAT_SHRINK') {
      unresolved = true;
    }

    // Special wire IDs (COM, GND, SHLD) → bus/ground/shield ambiguity
    if (AMBIGUOUS_WIRE_IDS.has(wireId.toUpperCase())) {
      unresolved = true;
    }

    // ── Confidence ──────────────────────────────────────────────────────
    const pinSignal =
      from.cavity
        ?? (endpointHasAuthoritativeTermination(from) && from.terminationType && from.terminationType !== 'CONNECTOR_PIN'
          ? from.terminationType
          : null);

    const terminalSignal = endpointHasAuthoritativeTermination(to)
      ? (to.component ?? to.terminationType ?? 'TERMINATED')
      : row.terminal ?? null;

    const confidence = computeConfidence(row.gauge, pinSignal, terminalSignal, unresolved);

    const wire: WireConnectivity = {
      wireId,
      length: row.length,
      lengthUnit: row.lengthUnit ?? null,
      lengthInches: row.lengthInches ?? (row.length ?? null),
      gauge:  row.gauge,
      color:  row.color,
      from,
      to,
      sourceRowIndex: i,
      rawText:        row.rawText,
      confidence,
      unresolved,
    };

    wires.push(wire);
    if (unresolved) unresolvedWires.push(wireId);
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  const total      = wires.length;
  let resolved   = 0;
  let partial    = 0;
  let unresolvedCount = 0;

  for (const w of wires) {
    if (w.unresolved) {
      unresolvedCount++;
    } else if (endpointHasAuthoritativeTermination(w.from) && endpointHasAuthoritativeTermination(w.to)) {
      resolved++;
    } else {
      partial++;
    }
  }

  console.log('[T2 CONNECTIVITY]', {
    total,
    resolved,
    partial,
    unresolved: unresolvedCount,
    unresolvedWireIds: unresolvedWires.slice(0, 20),
  });

  return {
    wires,
    unresolvedWires,
    confidenceSummary: {
      total,
      resolved,
      partial,
      unresolved: unresolvedCount,
    },
  };
}
