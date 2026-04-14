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

// ---------------------------------------------------------------------------
// HC-BOM Data Model
// ---------------------------------------------------------------------------

export interface WireEndpoint {
  /** Component identifier (connector ref, Phoenix PN, terminal PN, etc.) */
  component: string | null;
  /** Cavity / pin position within the component. */
  cavity: string | null;
  /** Treatment applied at this endpoint (SPLICE, HEAT_SHRINK, etc.) */
  treatment: string | null;
}

export interface WireConnectivity {
  wireId: string;
  length: number | null;
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

    const from: WireEndpoint = {
      component: fromComponent,
      cavity:    row.pin ?? null,
      treatment: row.treatment ?? null,
    };

    // ── TO endpoint (right side / terminal side) ────────────────────────
    const to: WireEndpoint = {
      component: row.terminal ?? null,
      cavity:    null,
      treatment: null,
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
    const confidence = computeConfidence(row.gauge, row.pin, row.terminal, unresolved);

    const wire: WireConnectivity = {
      wireId,
      length: row.length,
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
    } else if (w.from.component !== null && w.to.component !== null) {
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
