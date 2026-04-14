'use client';

/**
 * HarnessConnectivityPanel — Phase T3
 *
 * Renders the HC-BOM (Harness Connectivity BOM) as a compact, operator-reviewable
 * panel within the Upload Workbench. Shows per-wire from/to connectivity, confidence,
 * unresolved status, and expandable raw row evidence.
 *
 * Governance:
 *   - Read-only / informational only. No writeback, no side effects.
 *   - Does NOT modify HC-BOM data, authority resolver, or ingestion pipeline.
 *   - Ambiguity is exposed, never hidden. Uncertainty is visible, not masked.
 *   - Additive only. Self-contained — no changes to T1/T2 logic required.
 *   - Uses existing UI conventions from UploadWorkbench (details/summary, badges, pills).
 */

import React, { useState } from 'react';
import type {
  HarnessConnectivityResult,
  WireConnectivity,
} from '@/src/features/harness-work-instructions/services/harnessConnectivityService';
import type {
  HarnessReconciliationResult,
  ReconciledWire,
} from '@/src/features/harness-work-instructions/services/harnessReconciliationService';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AMBIGUOUS_WIRE_IDS = new Set(['COM', 'GND', 'SHLD', 'SHIELD', 'SHD']);

const TERMINAL_RE = /\b(\d{1,4}-\d{4,9}(?:-\d{1,4})?|\d{4,9}-\d{1,4})\b/g;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type WireStatus = 'RESOLVED' | 'PARTIAL' | 'UNRESOLVED';

function classifyWire(w: WireConnectivity): WireStatus {
  if (w.unresolved) return 'UNRESOLVED';
  if (w.from.component !== null && w.to.component !== null) return 'RESOLVED';
  return 'PARTIAL';
}

const STATUS_STYLES: Record<WireStatus, { label: string; className: string }> = {
  RESOLVED:   { label: 'Resolved',   className: 'bg-emerald-100 text-emerald-800' },
  PARTIAL:    { label: 'Partial',    className: 'bg-amber-100 text-amber-800' },
  UNRESOLVED: { label: 'Unresolved', className: 'bg-red-100 text-red-700' },
};

function confidencePill(conf: number): { label: string; className: string } {
  const pct = `${Math.round(conf * 100)}%`;
  if (conf >= 0.9) return { label: pct, className: 'bg-emerald-100 text-emerald-800' };
  if (conf >= 0.5) return { label: pct, className: 'bg-amber-100 text-amber-900' };
  return { label: pct, className: 'bg-red-100 text-red-800' };
}

/** Infer the reason a wire is unresolved from its existing data. */
function inferUnresolvedReason(w: WireConnectivity): string | null {
  if (!w.unresolved) return null;
  const reasons: string[] = [];
  if (AMBIGUOUS_WIRE_IDS.has(w.wireId.toUpperCase())) {
    reasons.push('Bus/ground/shield wire — endpoint mapping unclear');
  }
  if (w.from.treatment === 'SPLICE') {
    reasons.push('SPLICE treatment — connection semantics ambiguous');
  }
  if (w.from.treatment === 'HEAT_SHRINK') {
    reasons.push('HEAT_SHRINK treatment — connection semantics ambiguous');
  }
  TERMINAL_RE.lastIndex = 0;
  const terminals = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = TERMINAL_RE.exec(w.rawText)) !== null) terminals.add(m[1]);
  if (terminals.size > 1) {
    reasons.push(`Multiple terminals detected (${terminals.size})`);
  }
  return reasons.length > 0 ? reasons.join('; ') : 'Ambiguous mapping';
}

const dash = '—';

// ---------------------------------------------------------------------------
// Reconciliation match indicator
// ---------------------------------------------------------------------------

const STRONG_MATCH = new Set(['EXACT', 'PN_MATCH']);

function matchIndicator(
  rw: ReconciledWire | undefined,
): { symbol: string; label: string; className: string } | null {
  if (!rw) return null;
  if (rw.from.matchType === 'AMBIGUOUS' || rw.to.matchType === 'AMBIGUOUS') {
    return { symbol: '?', label: 'Ambiguous', className: 'bg-purple-100 text-purple-700' };
  }
  const fromOk = STRONG_MATCH.has(rw.from.matchType);
  const toOk   = STRONG_MATCH.has(rw.to.matchType);
  if (fromOk && toOk)   return { symbol: '\u2714', label: 'Matched', className: 'bg-emerald-100 text-emerald-700' };
  if (fromOk || toOk)   return { symbol: '\u26a0', label: 'Partial',   className: 'bg-amber-100 text-amber-800' };
  return { symbol: '\u2717', label: 'Unmatched', className: 'bg-red-100 text-red-700' };
}

// ---------------------------------------------------------------------------
// Sub-component: expandable wire row evidence
// ---------------------------------------------------------------------------

function WireEvidenceRow({
  wire,
  reconciledWire,
  hasReconciliation,
}: {
  wire: WireConnectivity;
  reconciledWire?: ReconciledWire;
  hasReconciliation: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const status = classifyWire(wire);
  const statusStyle = STATUS_STYLES[status];
  const confStyle = confidencePill(wire.confidence);
  const rowBg = status === 'UNRESOLVED'
    ? 'bg-red-50/40'
    : status === 'PARTIAL'
      ? 'bg-amber-50/30'
      : '';
  const indicator = matchIndicator(reconciledWire);

  return (
    <>
      <tr
        className={`border-t border-gray-100 cursor-pointer hover:bg-teal-50/40 ${rowBg}`}
        onClick={() => setExpanded(prev => !prev)}
        title="Click to expand evidence"
      >
        <td className="px-2 py-1 font-mono font-semibold text-gray-900 whitespace-nowrap">
          {wire.wireId}
          <span className="ml-1 text-[9px] text-gray-400">{expanded ? '▲' : '▾'}</span>
        </td>
        <td className="px-2 py-1 text-right font-mono">{wire.length !== null ? wire.length.toFixed(1) : dash}</td>
        <td className="px-2 py-1">{wire.gauge ?? dash}</td>
        <td className="px-2 py-1">{wire.color ?? dash}</td>
        <td className="px-2 py-1 font-mono">{wire.from.component ?? dash}</td>
        <td className="px-2 py-1 text-right">{wire.from.cavity ?? dash}</td>
        <td className="px-2 py-1 font-mono">{wire.to.component ?? dash}</td>
        <td className="px-2 py-1 text-center">
          <span className={`inline-block rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${confStyle.className}`}>
            {confStyle.label}
          </span>
        </td>
        <td className="px-2 py-1 text-center">
          <span className={`inline-block rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${statusStyle.className}`}>
            {statusStyle.label}
          </span>
        </td>
        {hasReconciliation && (
          <td className="px-2 py-1 text-center">
            {indicator ? (
              <span className={`inline-block rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${indicator.className}`}
                title={indicator.label}>
                {indicator.symbol}
              </span>
            ) : (
              <span className="text-gray-300">—</span>
            )}
          </td>
        )}
      </tr>
      {expanded && (
        <tr className={rowBg}>
          <td colSpan={hasReconciliation ? 10 : 9} className="px-3 py-2">
            <div className="rounded-lg border border-gray-200 bg-white/80 p-2 space-y-1.5 text-[10px] text-gray-700">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <div><span className="font-semibold text-gray-500">Source row:</span> #{wire.sourceRowIndex}</div>
                <div><span className="font-semibold text-gray-500">Confidence:</span> {(wire.confidence * 100).toFixed(0)}%</div>
                <div><span className="font-semibold text-gray-500">From component:</span> {wire.from.component ?? dash}</div>
                <div><span className="font-semibold text-gray-500">From cavity:</span> {wire.from.cavity ?? dash}</div>
                <div><span className="font-semibold text-gray-500">From treatment:</span> {wire.from.treatment ?? dash}</div>
                <div><span className="font-semibold text-gray-500">To component:</span> {wire.to.component ?? dash}</div>
                <div><span className="font-semibold text-gray-500">To cavity:</span> {wire.to.cavity ?? dash}</div>
                <div><span className="font-semibold text-gray-500">To treatment:</span> {wire.to.treatment ?? dash}</div>
                <div><span className="font-semibold text-gray-500">Unresolved:</span> {wire.unresolved ? 'Yes' : 'No'}</div>
                {wire.unresolved && (
                  <div className="col-span-2">
                    <span className="font-semibold text-red-600">Reason:</span>{' '}
                    <span className="text-red-700">{inferUnresolvedReason(wire)}</span>
                  </div>
                )}
              </div>
              {reconciledWire && (
                <div className="border-t border-gray-100 pt-1.5 grid grid-cols-2 gap-x-4 gap-y-1">
                  <div className="col-span-2 font-semibold text-gray-500">Diagram Match (T5)</div>
                  <div><span className="font-semibold text-gray-500">From match:</span>{' '}
                    <span className="font-mono">{reconciledWire.from.matchType}</span>
                    {reconciledWire.from.matchedLabel ? ` → ${reconciledWire.from.matchedLabel}` : ''}
                  </div>
                  <div><span className="font-semibold text-gray-500">From conf:</span>{' '}
                    {(reconciledWire.from.confidence * 100).toFixed(0)}%
                  </div>
                  <div><span className="font-semibold text-gray-500">To match:</span>{' '}
                    <span className="font-mono">{reconciledWire.to.matchType}</span>
                    {reconciledWire.to.matchedLabel ? ` → ${reconciledWire.to.matchedLabel}` : ''}
                  </div>
                  <div><span className="font-semibold text-gray-500">To conf:</span>{' '}
                    {(reconciledWire.to.confidence * 100).toFixed(0)}%
                  </div>
                  {reconciledWire.from.candidateComponentIds && (
                    <div className="col-span-2 text-purple-700">
                      <span className="font-semibold">Ambiguous from candidates:</span>{' '}
                      {reconciledWire.from.candidateComponentIds.join(', ')}
                    </div>
                  )}
                  {reconciledWire.to.candidateComponentIds && (
                    <div className="col-span-2 text-purple-700">
                      <span className="font-semibold">Ambiguous to candidates:</span>{' '}
                      {reconciledWire.to.candidateComponentIds.join(', ')}
                    </div>
                  )}
                </div>
              )}
              <div className="border-t border-gray-100 pt-1.5">
                <span className="font-semibold text-gray-500">Raw OCR text:</span>
                <pre className="mt-0.5 whitespace-pre-wrap break-all font-mono text-[10px] text-gray-600 bg-gray-50 rounded px-1.5 py-1 border border-gray-100">
                  {wire.rawText}
                </pre>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface HarnessConnectivityPanelProps {
  harnessConnectivity: HarnessConnectivityResult | null | undefined;
  reconciliation?: HarnessReconciliationResult | null;
}

export default function HarnessConnectivityPanel({
  harnessConnectivity,
  reconciliation,
}: HarnessConnectivityPanelProps) {
  const [open, setOpen] = useState(false);

  // ── Null / empty state ──────────────────────────────────────────────
  if (!harnessConnectivity) {
    return null;
  }

  const { wires, unresolvedWires, confidenceSummary } = harnessConnectivity;

  if (wires.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
        Connectivity rows were not confidently extracted.
      </div>
    );
  }

  // ── Sort: resolved first, then partial, then unresolved ────────────
  const sortedWires = [...wires].sort((a, b) => {
    const order: Record<WireStatus, number> = { RESOLVED: 0, PARTIAL: 1, UNRESOLVED: 2 };
    return order[classifyWire(a)] - order[classifyWire(b)];
  });

  const { total, resolved, partial, unresolved } = confidenceSummary;

  const reconciledByWireId = new Map<string, ReconciledWire>(
    reconciliation?.wires.map(rw => [rw.wireId, rw]) ?? [],
  );
  const hasReconciliation = reconciledByWireId.size > 0;

  console.log('[T3 HC-BOM PANEL]', { total, resolved, partial, unresolved: unresolvedWires.length });

  return (
    <details
      open={open}
      onToggle={e => setOpen((e.target as HTMLDetailsElement).open)}
      className="rounded-xl border border-teal-200 bg-teal-50/50 text-xs"
    >
      <summary className="cursor-pointer px-3 py-2 font-semibold text-teal-700 select-none flex items-center gap-2">
        <span>Harness Connectivity (HC-BOM)</span>
        <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] text-teal-800">
          {total}W
        </span>
        {unresolved > 0 && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] text-red-700 font-semibold">
            {unresolved} unresolved
          </span>
        )}
        <span className="ml-auto text-[10px] text-teal-400">{open ? '▲' : '▼'}</span>
      </summary>

      {open && (
        <div className="px-3 pb-3 space-y-3 text-gray-700">

          {/* ── Summary stats ───────────────────────────────────────── */}
          <div className="flex flex-wrap gap-2 text-[10px]">
            <span className="rounded-full bg-teal-100 px-2 py-0.5 font-semibold text-teal-800">
              {total} total
            </span>
            {reconciliation && (
              <>
                <span className={`rounded-full px-2 py-0.5 font-semibold ${
                  reconciliation.summary.fullyMatched > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'
                }`}>
                  {reconciliation.summary.fullyMatched} matched
                </span>
                {reconciliation.summary.ambiguous > 0 && (
                  <span className="rounded-full px-2 py-0.5 font-semibold bg-purple-100 text-purple-700">
                    {reconciliation.summary.ambiguous} ambiguous
                  </span>
                )}
              </>
            )}
            <span className={`rounded-full px-2 py-0.5 font-semibold ${
              resolved > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'
            }`}>
              {resolved} resolved
            </span>
            <span className={`rounded-full px-2 py-0.5 font-semibold ${
              partial > 0 ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-500'
            }`}>
              {partial} partial
            </span>
            <span className={`rounded-full px-2 py-0.5 font-semibold ${
              unresolved > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {unresolved} unresolved
            </span>
          </div>

          {/* ── Info banner ─────────────────────────────────────────── */}
          <div className="rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1.5 text-[10px] text-teal-800">
            Intermediate connectivity model — click any wire row to see evidence. Unresolved rows require manual verification.
          </div>

          {/* ── Primary wire table ──────────────────────────────────── */}
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-[11px]">
              <thead className="bg-gray-100 text-gray-500 uppercase text-[10px]">
                <tr>
                  <th className="px-2 py-1 text-left">Wire</th>
                  <th className="px-2 py-1 text-right">Length</th>
                  <th className="px-2 py-1 text-left">Gauge</th>
                  <th className="px-2 py-1 text-left">Color</th>
                  <th className="px-2 py-1 text-left">From</th>
                  <th className="px-2 py-1 text-right">Pin</th>
                  <th className="px-2 py-1 text-left">To</th>
                  <th className="px-2 py-1 text-center">Conf</th>
                  <th className="px-2 py-1 text-center">Status</th>
                  {hasReconciliation && <th className="px-2 py-1 text-center">Match</th>}
                </tr>
              </thead>
              <tbody>
                {sortedWires.slice(0, 100).map(wire => (
                  <WireEvidenceRow
                    key={`${wire.wireId}-${wire.sourceRowIndex}`}
                    wire={wire}
                    reconciledWire={reconciledByWireId.get(wire.wireId)}
                    hasReconciliation={hasReconciliation}
                  />
                ))}
              </tbody>
            </table>
            {wires.length > 100 && (
              <div className="px-2 py-1 text-[10px] text-gray-400">
                Showing first 100 of {wires.length} wires
              </div>
            )}
          </div>

          {/* ── Unresolved wire IDs callout ─────────────────────────── */}
          {unresolvedWires.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[10px] text-red-800">
              <span className="font-semibold">Unresolved wire IDs:</span>{' '}
              {unresolvedWires.join(', ')}
            </div>
          )}
        </div>
      )}
    </details>
  );
}
