/**
 * Komax Cut Sheet Panel — Phases T16 / T17
 *
 * Renders a production-ready cut sheet and batch grouping derived from the
 * effective harness model. Updates live: any change to wires, topology, or
 * identity triggers a re-render.
 *
 * Features:
 *   - Wire view  : per-wire table
 *   - Batch view : grouped by Komax setup key (T17)
 *   - Export by Wire  (CSV)
 *   - Export by Batch (CSV)
 *
 * Governance:
 *   - Read-only. No mutations to effectiveState.
 *   - Derives all data on every render — no internal cache.
 */

'use client';

import React, { useCallback, useMemo, useState } from 'react';
import type { EffectiveHarnessState } from '@/src/features/harness-work-instructions/services/effectiveHarnessModelService';
import {
  buildKomaxCutSheet,
  buildKomaxBatches,
  buildWireCsvString,
  buildBatchCsvString,
  type KomaxCutSheetRow,
  type KomaxBatch,
} from '@/src/features/harness-work-instructions/services/komaxCutSheetService';
import { MACHINE_KOMAX } from '@/src/constants/manufacturing';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface KomaxCutSheetPanelProps {
  effectiveState: EffectiveHarnessState;
  /** Optional part number used in the CSV filename. */
  partNumber?: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const dash = '—';

type ViewMode = 'wire' | 'batch';

function TopologyBadge({ topology }: { topology: KomaxCutSheetRow['topology'] }) {
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

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function KomaxCutSheetPanel({
  effectiveState,
  partNumber,
}: KomaxCutSheetPanelProps) {
  const [copied, setCopied]     = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('wire');

  const result = useMemo(
    () => buildKomaxCutSheet(effectiveState),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [effectiveState],
  );

  const batchResult = useMemo(
    () => buildKomaxBatches(effectiveState),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [effectiveState],
  );

  const wireCsv  = useMemo(() => buildWireCsvString(result),      [result]);
  const batchCsv = useMemo(() => buildBatchCsvString(batchResult), [batchResult]);

  const slug = partNumber ? partNumber.replace(/[^A-Za-z0-9_-]/g, '_') : null;

  const handleCopyWire = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(wireCsv);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable — no-op */ }
  }, [wireCsv]);

  const handleDownloadWire  = useCallback(() =>
    downloadCsv(wireCsv,  slug ? `komax-cut-sheet-${slug}.csv`  : 'komax-cut-sheet.csv'),
  [wireCsv, slug]);

  const handleDownloadBatch = useCallback(() =>
    downloadCsv(batchCsv, slug ? `komax-batches-${slug}.csv` : 'komax-batches.csv'),
  [batchCsv, slug]);

  const { rows, summary } = result;
  const { batches }       = batchResult;

  return (
    <details open className="mt-4 rounded-xl border border-emerald-200 bg-white text-xs shadow-sm">
      <summary className="cursor-pointer select-none px-4 py-2.5 font-semibold text-gray-700 flex items-center gap-2">
        <span className="text-emerald-600 text-[11px] font-bold uppercase tracking-wide">
          T17 · {MACHINE_KOMAX} Cut Sheet
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
        {batchResult.totalBatches > 0 && (
          <span className="rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 text-[10px] font-semibold">
            {batchResult.totalBatches} batch{batchResult.totalBatches !== 1 ? 'es' : ''}
          </span>
        )}
      </summary>

      <div className="px-4 pb-4 space-y-3">

        {/* ── Toolbar ──────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">

          {/* View toggle */}
          <div className="flex rounded-md border border-gray-200 overflow-hidden text-[10px] font-medium">
            {(['wire', 'batch'] as const).map(mode => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 capitalize transition ${
                  viewMode === mode
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {mode === 'wire' ? 'Wire View' : 'Batch View'}
              </button>
            ))}
          </div>

          <div className="flex gap-2 flex-wrap">
            <p className="text-[10px] text-gray-400 italic self-center">
              Live — updates automatically
            </p>
            {/* Wire CSV */}
            <button
              type="button"
              onClick={handleCopyWire}
              className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-[10px] font-medium text-gray-600 shadow-sm hover:bg-gray-50 active:scale-95 transition"
            >
              {copied ? (
                <span className="text-emerald-600">Copied!</span>
              ) : (
                <>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={2}>
                    <rect x="5" y="5" width="8" height="8" rx="1" />
                    <path strokeLinecap="round" d="M3 11V3h8" />
                  </svg>
                  Copy Wires CSV
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleDownloadWire}
              className="flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[10px] font-medium text-emerald-700 shadow-sm hover:bg-emerald-100 active:scale-95 transition"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 3v7m0 0L5 7m3 3l3-3M3 13h10" />
              </svg>
              Export by Wire
            </button>
            {/* Batch CSV */}
            <button
              type="button"
              onClick={handleDownloadBatch}
              className="flex items-center gap-1.5 rounded-md border border-blue-300 bg-blue-50 px-2.5 py-1 text-[10px] font-medium text-blue-700 shadow-sm hover:bg-blue-100 active:scale-95 transition"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 3v7m0 0L5 7m3 3l3-3M3 13h10" />
              </svg>
              Export by Batch
            </button>
          </div>
        </div>

        {/* ── Empty state ───────────────────────────────────────────── */}
        {rows.length === 0 && (
          <div className="rounded-lg border border-dashed border-gray-200 px-4 py-6 text-center text-[11px] text-gray-400">
            No wire data available — add wires to the model to generate a cut sheet.
          </div>
        )}

        {/* ── Batch view ────────────────────────────────────────────── */}
        {viewMode === 'batch' && batches.length > 0 && (
          <div className="space-y-2">
            {batches.map(batch => (
              <BatchCard key={batch.batchId} batch={batch} />
            ))}
          </div>
        )}

        {/* ── Wire view table ───────────────────────────────────────── */}
        {viewMode === 'wire' && rows.length > 0 && (
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
                    <td className="px-2 py-1.5 font-mono font-bold text-gray-900 whitespace-nowrap">{row.internalWireId}</td>
                    <td className="px-2 py-1.5 font-mono text-gray-500 whitespace-nowrap">{row.customerWireId ?? <span className="text-gray-300">{dash}</span>}</td>
                    <td className="px-2 py-1.5 text-right font-mono whitespace-nowrap">
                      {row.lengthInches != null
                        ? <span className="font-semibold text-gray-800">{row.lengthInches}<span className="text-gray-400 font-normal ml-0.5">in</span></span>
                        : <span className="text-gray-300">{dash}</span>}
                    </td>
                    <td className="px-2 py-1.5 text-gray-700">{row.wireColor ?? <span className="text-gray-300">{dash}</span>}</td>
                    <td className="px-2 py-1.5 font-mono text-gray-700">{row.wireGauge ?? <span className="text-gray-300">{dash}</span>}</td>
                    <td className="px-2 py-1.5">
                      <div className="flex flex-col gap-0.5">
                        {(row.fromComponent || row.fromCavity) ? (
                          <span className="font-mono text-gray-800">{row.fromComponent ?? dash}{row.fromCavity && <span className="text-gray-400">:{row.fromCavity}</span>}</span>
                        ) : <span className="text-gray-300">{dash}</span>}
                        <TermBadge type={row.fromTerminationType} />
                      </div>
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex flex-col gap-0.5">
                        {(row.toComponent || row.toCavity) ? (
                          <span className="font-mono text-gray-800">{row.toComponent ?? dash}{row.toCavity && <span className="text-gray-400">:{row.toCavity}</span>}</span>
                        ) : <span className="text-gray-300">{dash}</span>}
                        <TermBadge type={row.toTerminationType} />
                      </div>
                    </td>
                    <td className="px-2 py-1.5"><TopologyBadge topology={row.topology} /></td>
                    <td className="px-2 py-1.5 text-gray-500">
                      {row.notes.length === 0 ? (
                        <span className="text-gray-200">{dash}</span>
                      ) : (
                        <ul className="space-y-0.5">{row.notes.map((n, i) => <li key={i} className="text-[10px] text-gray-500 leading-tight">{n}</li>)}</ul>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Summary footer ──────────────────────────────────────────── */}
        {rows.length > 0 && (
          <div className="flex flex-wrap gap-4 text-[10px] text-gray-400 pt-1">
            <span>Total wires: <strong className="text-gray-700">{summary.totalWires}</strong></span>
            <span>Branch wires: <strong className={summary.branchCount > 0 ? 'text-amber-700' : 'text-gray-700'}>{summary.branchCount}</strong></span>
            <span>Strip-only ends: <strong className="text-gray-700">{summary.stripOnlyCount}</strong></span>
            {batchResult.totalBatches > 0 && (
              <span>Batches: <strong className="text-blue-700">{batchResult.totalBatches}</strong></span>
            )}
          </div>
        )}
      </div>
    </details>
  );
}

// ---------------------------------------------------------------------------
// BatchCard sub-component
// ---------------------------------------------------------------------------

function BatchCard({ batch }: { batch: KomaxBatch }) {
  return (
    <div className={`rounded-lg border px-3 py-2.5 space-y-1.5 ${
      batch.hasBranchWires
        ? 'border-amber-200 bg-amber-50/40'
        : 'border-gray-200 bg-gray-50'
    }`}>
      {/* Header row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono font-bold text-[10px] text-blue-700 bg-blue-100 rounded px-1.5 py-0.5">
          {batch.batchId}
        </span>
        <span className="text-[10px] font-semibold text-gray-700">{batch.setupSignature}</span>
        <span className="ml-auto text-[10px] font-semibold text-gray-500">
          Qty: {batch.totalWires}
        </span>
      </div>

      {/* Wire IDs */}
      <div className="flex flex-wrap gap-1">
        {batch.wireIds.map(id => (
          <span
            key={id}
            className="font-mono text-[9px] font-bold text-gray-700 bg-white border border-gray-200 rounded px-1 py-0.5"
          >
            {id}
          </span>
        ))}
      </div>

      {/* Flags */}
      <div className="flex gap-2">
        {batch.requiresPrinting && (
          <span className="text-[9px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded px-1.5 py-0.5">
            LABEL PRINT
          </span>
        )}
        {batch.hasBranchWires && (
          <span className="text-[9px] font-semibold text-amber-700 bg-amber-100 border border-amber-300 rounded px-1.5 py-0.5">
            ⚠ Branch wires present
          </span>
        )}
      </div>
    </div>
  );
}
