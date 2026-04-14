/**
 * Extraction Coverage + Gap Detection Engine — Phase 3H.44 C7.1
 *
 * Deterministic, side-effect-free analysis layer.
 * Computes completeness metrics for drawing-derived wires and reports gaps.
 *
 * Governance:
 *   - ANALYSIS ONLY. No modifications to parser, resolver, or pipeline.
 *   - No DB writes. No external calls. Pure computation.
 *   - Safe to call with null model (non-Rheem or missing drawing data).
 */

import type { RheemDrawingModel } from './rheemDrawingParser';
import type { ResolvedWire } from './wireResolutionService';

// ---------------------------------------------------------------------------
// Output Type
// ---------------------------------------------------------------------------

export interface ExtractionCoverage {
  totalRows: number;
  resolvedWires: number;

  missingLength: number;
  missingTerminal: number;
  missingPin: number;

  unresolvedWireIds: string[];
  partiallyResolvedWireIds: string[];

  /** 0–100 integer. Reflects completeness of length + terminal + pin across resolved wires. */
  coverageScore: number;

  issues: string[];
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

export function computeExtractionCoverage(
  model: RheemDrawingModel | null,
  resolved: ResolvedWire[],
): ExtractionCoverage {
  // ── Totals ──────────────────────────────────────────────────────────────
  const totalRows     = model?.wires.length ?? 0;
  const resolvedCount = resolved.length;

  // ── Field-level gap counts ──────────────────────────────────────────────
  const missingLength   = resolved.filter(w => w.length === null).length;
  const missingTerminal = resolved.filter(w => w.terminal === null).length;
  const missingPin      = resolved.filter(w => w.from?.pin == null).length;

  // ── Unresolved wire IDs (present in model but absent from resolved set) ─
  const resolvedIds       = new Set(resolved.map(w => w.wireId));
  const unresolvedWireIds = model
    ? model.wires.filter(row => !resolvedIds.has(row.id)).map(row => row.id)
    : [];

  // ── Partially resolved wire IDs (resolved but missing at least one field)
  const partiallyResolvedWireIds = resolved
    .filter(w => !w.length || !w.terminal || !w.from?.pin)
    .map(w => w.wireId);

  // ── Coverage score (0–100) ──────────────────────────────────────────────
  // Three fields per wire: length, terminal, pin
  const totalFields  = resolvedCount * 3;
  const filledFields =
    resolved.filter(w => w.length !== null).length +
    resolved.filter(w => w.terminal !== null).length +
    resolved.filter(w => w.from?.pin != null).length;

  const coverageScore = Math.round((filledFields / totalFields) * 100) || 0;

  // ── Issue strings ───────────────────────────────────────────────────────
  const issues: string[] = [];

  if (missingLength > 0) {
    issues.push(`Missing length on ${missingLength} wire${missingLength > 1 ? 's' : ''}`);
  }
  if (missingTerminal > 0) {
    issues.push(`Missing terminal on ${missingTerminal} wire${missingTerminal > 1 ? 's' : ''}`);
  }
  if (missingPin > 0) {
    issues.push(`Missing pin mapping on ${missingPin} wire${missingPin > 1 ? 's' : ''}`);
  }
  if (unresolvedWireIds.length > 0) {
    issues.push(`Unresolved wires: ${unresolvedWireIds.join(', ')}`);
  }

  // ── Structured log ──────────────────────────────────────────────────────
  console.log('[EXTRACTION COVERAGE]', {
    totalRows,
    resolvedWires:             resolvedCount,
    missingLength,
    missingTerminal,
    missingPin,
    coverageScore,
    unresolvedWireIds,
    partiallyResolvedWireIds,
  });

  return {
    totalRows,
    resolvedWires:             resolvedCount,
    missingLength,
    missingTerminal,
    missingPin,
    unresolvedWireIds,
    partiallyResolvedWireIds,
    coverageScore,
    issues,
  };
}
