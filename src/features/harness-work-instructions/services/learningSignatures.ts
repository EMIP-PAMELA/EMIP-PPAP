/**
 * HWI Learning Signatures — Pure Types + Deterministic Signature Builders
 * Phase HWI.12 — Human Resolution Learning Engine
 *
 * This module is intentionally dependency-free (no Supabase, no React).
 * It is safe to import from any service — fusion, endpoint resolution,
 * process instructions — without pulling in database clients.
 *
 * Signature strategies (from HWI.12 spec):
 *   WIRE_MATCH  → gauge_color_lengthBucket
 *   ENDPOINT    → wireLabel_connectorHint
 *   TERMINAL    → gauge_connector_cavity
 *   TOOLING     → terminal_operationType
 *
 * Length bucket = round(length / 0.5) * 0.5  (nearest 0.5 unit)
 */

// ---------------------------------------------------------------------------
// Context type discriminant
// ---------------------------------------------------------------------------

export type ContextType = 'WIRE_MATCH' | 'ENDPOINT' | 'TERMINAL' | 'TOOLING';

// ---------------------------------------------------------------------------
// Decision payloads (one per ContextType)
// ---------------------------------------------------------------------------

export interface WireMatchDecision {
  gauge:                string;
  color:                string;
  aci_wire_part_number: string;
}

export interface EndpointDecision {
  connector_id:         string | null;
  cavity:               string | null;
  terminal_part_number: string | null;
}

export interface TerminalDecision {
  terminal_part_number: string;
}

export interface ToolingDecision {
  applicator_id: string | null;
  hand_tool_ref: string | null;
}

// ---------------------------------------------------------------------------
// FusionHints — pre-fetched learning data, passed to sync services
// ---------------------------------------------------------------------------

export interface FusionHints {
  wireMatchOverrides: Map<string, WireMatchDecision>;
  endpointOverrides:  Map<string, EndpointDecision>;
  toolingOverrides:   Map<string, ToolingDecision>;
}

export const EMPTY_FUSION_HINTS: FusionHints = {
  wireMatchOverrides: new Map(),
  endpointOverrides:  new Map(),
  toolingOverrides:   new Map(),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tok(value: string | number | null | undefined): string {
  if (value == null) return 'UNK';
  const s = String(value).trim().toUpperCase();
  return s.length === 0 ? 'UNK' : s;
}

function lengthBucket(length: number | null): string {
  if (length == null) return 'UNK';
  const bucketed = Math.round(length / 0.5) * 0.5;
  return String(bucketed);
}

// ---------------------------------------------------------------------------
// Signature builders (exported — used by both learningService and callers)
// ---------------------------------------------------------------------------

/**
 * Wire-match signature: identifies a wire type by gauge + color + cut-length bucket.
 * Matches across jobs that share the same wire specification.
 */
export function buildWireMatchSignature(
  gauge:  string | number | null,
  color:  string | null,
  length: number | null,
): string {
  return `${tok(gauge)}_${tok(color)}_${lengthBucket(length)}`;
}

/**
 * Endpoint signature: identifies a wire's endpoint by label + connector hint.
 * Used to pre-populate connector/cavity for wires seen in previous jobs.
 */
export function buildEndpointSignature(
  wireLabel:     string | null,
  connectorHint: string | null,
): string {
  return `${tok(wireLabel)}_${tok(connectorHint)}`;
}

/**
 * Terminal signature: identifies a terminal assignment by gauge + connector + cavity.
 * Used to recall terminal P/N for a given location.
 */
export function buildTerminalSignature(
  gauge:     string | null,
  connector: string | null,
  cavity:    string | null,
): string {
  return `${tok(gauge)}_${tok(connector)}_${tok(cavity)}`;
}

/**
 * Tooling signature: identifies tooling by terminal P/N + operation type.
 * Used to recall applicator/hand-tool for a known terminal.
 */
export function buildToolingSignature(
  terminal:      string | null,
  operationType: string | null,
): string {
  return `${tok(terminal)}_${tok(operationType ?? 'PRESS')}`;
}
