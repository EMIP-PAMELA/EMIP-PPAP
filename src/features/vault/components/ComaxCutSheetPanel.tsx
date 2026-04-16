/**
 * Comax Cut Sheet Panel — Phase T16
 *
 * Renders a production-ready cut sheet derived from the effective harness model.
 * Updates live: any change to wires, topology, or identity triggers a re-render.
 *
 * Features:
 *   - Sortable table view
 *   - Copy to clipboard (CSV)
 *   - Download CSV
 *   - Summary statistics
 *
 * Governance:
 *   - Read-only. No mutations to effectiveState.
 *   - Calls buildComaxCutSheet on every render (derived live, no internal cache).
 */

'use client';

import React, { useCallback, useMemo, useState } from 'react';
import type { EffectiveHarnessState } from '@/src/features/harness-work-instructions/services/effectiveHarnessModelService';
import {
  buildComaxCutSheet,
  buildCsvString,
  type ComaxCutSheetRow,
} from '@/src/features/harness-work-instructions/services/comaxCutSheetService';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ComaxCutSheetPanelProps {
  effectiveState: EffectiveHarnessState;
  /** Optional part number used in the CSV filename. */
  partNumber?: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const dash = '—';

function TopologyBadge({ topology }: { topology: ComaxCutSheetRow['topology'] }) {
  if (topology === 'BRANCH_DOUBLE_CRIMP') {
    return (
      <span className="inline-block rounded-full bg-amber-100 text-amber-800 px-1.5 py-0.5 text-[9px] font-semibold">
        BRANCH
      </span>
    );
  }
  if (topology === 'SPLICE') {
    return (
      <span className="inline-block rounded-full bg-purple-100 text-purple-800 px-1.5 py-0.5 text-[9px] font-semibold">
        SPLICE
      </span>
    );
  }
  return null;
}

function TermBadge({ type }: { type: string | undefined }) {
  if (!type) return <span className="text-gray-300">{dash}</span>;
  const styles: Record<string, string> = {
    CONNECTOR_PIN: 'bg-blue-50 text-blue-700',
    TERMINAL:      'bg-green-50 text-green-700',
    FERRULE:       'bg-teal-50 text-teal-700',
    STRIP:         'bg-slate-100 text-slate-600',
    GROUND:        'bg-gray-100 text-gray-600',
    SPLICE:        'bg-purple-50 text-purple-700',
    RING:          'bg-indigo-50 text-indigo-700',
    SPADE:         'bg-indigo-50 text-indigo-700',
    RECEPTACLE:    'bg-cyan-50 text-cyan-700',
  };
  const cls = styles[type] ?? 'bg-gray-50 text-gray-500';
  return (
    <span className={`inline-block rounded px-1 py-0.5 text-[8px] font-semibold uppercase ${cls}`}>
      {type}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ComaxCutSheetPanel({
  effectiveState,
  partNumber,
}: ComaxCutSheetPanelProps) {
  const [copied, setCopied] = useState(false);

  const result = useMemo(
    () => buildComaxCutSheet(effectiveState),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [effectiveState],
  );

  const csv = useMemo(() => buildCsvString(result), [result]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(csv);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable in non-secure contexts — no-op */
    }
  }, [csv]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const filename = partNumber
      ? `comax-cut-sheet-${partNumber.replace(/[^A-Za-z0-9_-]/g, '_')}.csv`
      : 'comax-cut-sheet.csv';
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [csv, partNumber]);

  const { rows, summary } = result;

  return (
    <details open className="mt-4 rounded-xl border border-emerald-200 bg-white text-xs shadow-sm">
      <summary className="cursor-pointer select-none px-4 py-2.5 font-semibold text-gray-700 flex items-center gap-2">
        <span className="text-emerald-600 text-[11px] font-bold uppercase tracking-wide">
          T16 · Comax Cut Sheet
        </span>
        <span className="ml-1 rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] font-semibold">
          {summary.totalWires} wire{summary.totalWires !== 1 ? 's' : ''}
        </span>
        {summary.branchCount > 0 && (
          <span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[10px] font-semibold">
            {summary.branchCount} branch
          </span>
        )}
        {summary.stripOnlyCount > 0 && (
          <span className="rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 text-[10px] font-semibold">
            {summary.stripOnlyCount} strip-only
          </span>
        )}
      </summary>

      <div className="px-4 pb-4 space-y-3">

        {/* ── Toolbar ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between pt-1">
          <p className="text-[10px] text-gray-400 italic">
            Live — updates automatically when the model changes
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-[10px] font-medium text-gray-600 shadow-sm hover:bg-gray-50 active:scale-95 transition"
            >
              {copied ? (
                <>
                  <svg className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l4 4 6-6" />
                  </svg>
                  <span className="text-emerald-600">Copied!</span>
                </>
              ) : (
                <>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={2}>
                    <rect x="5" y="5" width="8" height="8" rx="1" />
                    <path strokeLinecap="round" d="M3 11V3h8" />
                  </svg>
                  Copy CSV
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[10px] font-medium text-emerald-700 shadow-sm hover:bg-emerald-100 active:scale-95 transition"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 3v7m0 0L5 7m3 3l3-3M3 13h10" />
              </svg>
              Download CSV
            </button>
          </div>
        </div>

        {/* ── Empty state ───────────────────────────────────────────── */}
        {rows.length === 0 && (
          <div className="rounded-lg border border-dashed border-gray-200 px-4 py-6 text-center text-[11px] text-gray-400">
            No wire data available — add wires to the model to generate a cut sheet.
          </div>
        )}

        {/* ── Cut sheet table ───────────────────────────────────────── */}
        {rows.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-[11px] border-collapse">
              <thead className="bg-gray-50 text-gray-500 uppercase text-[9px] tracking-wide">
                <tr>
                  <th className="px-2 py-1.5 text-left font-semibold border-b border-gray-200 whitespace-nowrap">Wire</th>
                  <th className="px-2 py-1.5 text-left font-semibold border-b border-gray-200 whitespace-nowrap">Cust ID</th>
                  <th className="px-2 py-1.5 text-right font-semibold border-b border-gray-200 whitespace-nowrap">Length</th>
                  <th className="px-2 py-1.5 text-left font-semibold border-b border-gray-200">Color</th>
                  <th className="px-2 py-1.5 text-left font-semibold border-b border-gray-200">Gauge</th>
                  <th className="px-2 py-1.5 text-left font-semibold border-b border-gray-200 whitespace-nowrap">From</th>
                  <th className="px-2 py-1.5 text-left font-semibold border-b border-gray-200 whitespace-nowrap">To</th>
                  <th className="px-2 py-1.5 text-left font-semibold border-b border-gray-200 whitespace-nowrap">Topology</th>
                  <th className="px-2 py-1.5 text-left font-semibold border-b border-gray-200">Notes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr
                    key={row.internalWireId}
                    className={`border-b border-gray-100 hover:bg-gray-50/60 ${
                      row.topology === 'BRANCH_DOUBLE_CRIMP'
                        ? 'bg-amber-50/30'
                        : row.topology === 'SPLICE'
                          ? 'bg-purple-50/20'
                          : ''
                    }`}
                  >
                    {/* Wire */}
                    <td className="px-2 py-1.5 font-mono font-bold text-gray-900 whitespace-nowrap">
                      {row.internalWireId}
                    </td>

                    {/* Cust ID */}
                    <td className="px-2 py-1.5 font-mono text-gray-500 whitespace-nowrap">
                      {row.customerWireId ?? <span className="text-gray-300">{dash}</span>}
                    </td>

                    {/* Length */}
                    <td className="px-2 py-1.5 text-right font-mono whitespace-nowrap">
                      {row.lengthInches != null
                        ? <span className="font-semibold text-gray-800">{row.lengthInches}<span className="text-gray-400 font-normal ml-0.5">in</span></span>
                        : <span className="text-gray-300">{dash}</span>
                      }
                    </td>

                    {/* Color */}
                    <td className="px-2 py-1.5 text-gray-700">
                      {row.wireColor ?? <span className="text-gray-300">{dash}</span>}
                    </td>

                    {/* Gauge */}
                    <td className="px-2 py-1.5 font-mono text-gray-700">
                      {row.wireGauge ?? <span className="text-gray-300">{dash}</span>}
                    </td>

                    {/* From */}
                    <td className="px-2 py-1.5">
                      <div className="flex flex-col gap-0.5">
                        {(row.fromComponent || row.fromCavity) ? (
                          <span className="font-mono text-gray-800">
                            {row.fromComponent ?? dash}
                            {row.fromCavity && <span className="text-gray-400">:{row.fromCavity}</span>}
                          </span>
                        ) : (
                          <span className="text-gray-300">{dash}</span>
                        )}
                        <TermBadge type={row.fromTerminationType} />
                      </div>
                    </td>

                    {/* To */}
                    <td className="px-2 py-1.5">
                      <div className="flex flex-col gap-0.5">
                        {(row.toComponent || row.toCavity) ? (
                          <span className="font-mono text-gray-800">
                            {row.toComponent ?? dash}
                            {row.toCavity && <span className="text-gray-400">:{row.toCavity}</span>}
                          </span>
                        ) : (
                          <span className="text-gray-300">{dash}</span>
                        )}
                        <TermBadge type={row.toTerminationType} />
                      </div>
                    </td>

                    {/* Topology */}
                    <td className="px-2 py-1.5">
                      <TopologyBadge topology={row.topology} />
                    </td>

                    {/* Notes */}
                    <td className="px-2 py-1.5 text-gray-500">
                      {row.notes.length === 0 ? (
                        <span className="text-gray-200">{dash}</span>
                      ) : (
                        <ul className="space-y-0.5">
                          {row.notes.map((n, i) => (
                            <li key={i} className="text-[10px] text-gray-500 leading-tight">{n}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Summary footer ────────────────────────────────────────── */}
        {rows.length > 0 && (
          <div className="flex flex-wrap gap-4 text-[10px] text-gray-400 pt-1">
            <span>Total wires: <strong className="text-gray-700">{summary.totalWires}</strong></span>
            <span>Branch wires: <strong className={summary.branchCount > 0 ? 'text-amber-700' : 'text-gray-700'}>{summary.branchCount}</strong></span>
            <span>Strip-only ends: <strong className="text-gray-700">{summary.stripOnlyCount}</strong></span>
          </div>
        )}
      </div>
    </details>
  );
}
