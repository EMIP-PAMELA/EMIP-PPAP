/**
 * Komax Program Panel — Phase T18
 *
 * Layer 3 manufacturing output panel: per-wire and per-batch Komax machine
 * program parameters derived from the effective harness state.
 *
 * Displays:
 *   A. Summary header  — Ready / Partial / Blocked counts
 *   B. Wire Program view — table with readiness, process types, missing fields
 *   C. Batch Program view — cards with setup signature, readiness, warnings
 *   D. Export buttons  — wire CSV, batch CSV
 *
 * Governance:
 *   - Read-only. Never mutates effectiveState.
 *   - Derives live via buildKomaxPrograms(effectiveState) in useMemo.
 *   - Audit events are written fire-and-forget on export actions.
 *   - Same instance of effectiveState → identical output (deterministic).
 */

'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EffectiveHarnessState } from '@/src/features/harness-work-instructions/services/effectiveHarnessModelService';
import {
  buildKomaxPrograms,
  buildKomaxProgramWireCsv,
  buildKomaxProgramBatchCsv,
} from '@/src/features/harness-work-instructions/services/komaxProgramService';
import type { KomaxWireProgram, KomaxBatchProgram, KomaxProgramReadiness } from '@/src/features/harness-work-instructions/types/komaxProgram';
import {
  recordSkuAuditEvent,
  normalizeSkuKey,
} from '@/src/features/harness-work-instructions/services/skuAuditService';
import { MACHINE_KOMAX } from '@/src/constants/manufacturing';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface KomaxProgramPanelProps {
  effectiveState: EffectiveHarnessState;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

function slug(partNumber: string | null | undefined): string {
  return (partNumber ?? 'unknown').replace(/[^A-Za-z0-9_-]/g, '_');
}

// ---------------------------------------------------------------------------
// Readiness badge
// ---------------------------------------------------------------------------

const READINESS_STYLE: Record<KomaxProgramReadiness, string> = {
  READY:   'bg-emerald-100 text-emerald-800 border-emerald-300',
  PARTIAL: 'bg-amber-100   text-amber-800   border-amber-300',
  BLOCKED: 'bg-red-100     text-red-800     border-red-300',
};

function ReadinessBadge({ r }: { r: KomaxProgramReadiness }) {
  return (
    <span className={`inline-block rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${READINESS_STYLE[r]}`}>
      {r}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Wire program row
// ---------------------------------------------------------------------------

function WireRow({ wp }: { wp: KomaxWireProgram }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <tr className="border-b border-gray-100 hover:bg-gray-50">
        <td className="px-2 py-1 font-mono text-[10px] text-gray-800 whitespace-nowrap">{wp.internalWireId}</td>
        <td className="px-2 py-1 text-[10px] text-gray-500">{wp.customerWireId ?? '—'}</td>
        <td className="px-2 py-1 text-[10px] text-gray-500">{wp.batchId ?? '—'}</td>
        <td className="px-2 py-1 text-[10px] text-right text-gray-700">
          {wp.lengthInches != null ? wp.lengthInches.toFixed(2) : <span className="text-red-500">—</span>}
        </td>
        <td className="px-2 py-1 text-[10px] text-gray-600">{wp.wireGauge ?? <span className="text-red-500">—</span>}</td>
        <td className="px-2 py-1 text-[10px] text-gray-600">{wp.wireColor ?? '—'}</td>
        <td className="px-2 py-1 text-[10px] font-mono text-blue-700">{wp.leftProcessType  ?? <span className="text-red-500">?</span>}</td>
        <td className="px-2 py-1 text-[10px] font-mono text-blue-700">{wp.rightProcessType ?? <span className="text-red-500">?</span>}</td>
        <td className="px-2 py-1 text-[10px]">
          {wp.printRequired
            ? <span className="rounded bg-violet-100 text-violet-800 px-1.5 py-0.5 text-[9px] font-bold">PRINT</span>
            : <span className="text-gray-300 text-[9px]">—</span>}
        </td>
        <td className="px-2 py-1">
          <ReadinessBadge r={wp.readiness} />
        </td>
        <td className="px-2 py-1 text-[10px]">
          {(wp.missingFields.length > 0 || wp.warnings.length > 0) && (
            <button
              type="button"
              onClick={() => setExpanded(v => !v)}
              className="text-blue-500 hover:underline text-[9px]"
            >
              {expanded ? '▲ hide' : `▼ ${wp.missingFields.length + wp.warnings.length}`}
            </button>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-amber-50">
          <td colSpan={11} className="px-3 py-1.5 text-[10px]">
            {wp.missingFields.length > 0 && (
              <div className="mb-1">
                <span className="font-semibold text-amber-700">Missing: </span>
                <span className="text-amber-600">{wp.missingFields.join(' · ')}</span>
              </div>
            )}
            {wp.warnings.length > 0 && (
              <div>
                <span className="font-semibold text-red-700">Warnings: </span>
                <span className="text-red-600">{wp.warnings.join(' · ')}</span>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Batch program card
// ---------------------------------------------------------------------------

function BatchCard({ bp }: { bp: KomaxBatchProgram }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-lg border px-3 py-2 space-y-1.5 ${READINESS_STYLE[bp.readiness].split(' ')[0]} border-gray-200`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-[11px] font-bold text-gray-800">{bp.batchId}</span>
        <ReadinessBadge r={bp.readiness} />
        <span className="text-[10px] text-gray-500">{bp.totalWires} wire{bp.totalWires !== 1 ? 's' : ''}</span>
        {bp.branchWiresPresent && (
          <span className="rounded bg-amber-100 text-amber-800 px-1.5 py-0.5 text-[9px] font-bold">BRANCH</span>
        )}
        {bp.printRequired && (
          <span className="rounded bg-violet-100 text-violet-800 px-1.5 py-0.5 text-[9px] font-bold">PRINT</span>
        )}
      </div>

      <p className="text-[10px] text-gray-600 font-mono">{bp.setupSignature}</p>

      <div className="flex gap-4 text-[10px] text-gray-600">
        {bp.dominantGauge && <span>Gauge: <strong>{bp.dominantGauge}</strong></span>}
        {bp.dominantColor && <span>Color: <strong>{bp.dominantColor}</strong></span>}
        {bp.sharedLeftProcessType  && <span>Left: <strong className="text-blue-700">{bp.sharedLeftProcessType}</strong></span>}
        {bp.sharedRightProcessType && <span>Right: <strong className="text-blue-700">{bp.sharedRightProcessType}</strong></span>}
      </div>

      {(bp.missingFields.length > 0 || bp.warnings.length > 0) && (
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="text-[9px] text-blue-500 hover:underline"
        >
          {open ? '▲ hide detail' : `▼ ${bp.missingFields.length + bp.warnings.length} issue(s)`}
        </button>
      )}

      {open && (
        <div className="space-y-1 pt-1 border-t border-gray-200 text-[10px]">
          {bp.missingFields.length > 0 && (
            <p>
              <span className="font-semibold text-amber-700">Missing: </span>
              <span className="text-amber-600">{bp.missingFields.join(' · ')}</span>
            </p>
          )}
          {bp.warnings.length > 0 && (
            <p>
              <span className="font-semibold text-red-700">Warnings: </span>
              <span className="text-red-600">{bp.warnings.join(' · ')}</span>
            </p>
          )}
          <p className="text-gray-400">Wire IDs: {bp.wireIds.join(', ')}</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function KomaxProgramPanel({ effectiveState }: KomaxProgramPanelProps) {
  const [view, setView] = useState<'wires' | 'batches'>('wires');
  const programGeneratedRef = useRef(false);

  const result = useMemo(
    () => buildKomaxPrograms(effectiveState),
    [effectiveState],
  );

  const partNumber = effectiveState.effectivePartNumber;
  const skuKey     = normalizeSkuKey(partNumber ?? '');

  // Fire KOMAX_PROGRAM_GENERATED audit event once per non-empty result per skuKey.
  useEffect(() => {
    if (!programGeneratedRef.current && result.wirePrograms.length > 0 && skuKey) {
      programGeneratedRef.current = true;
      void recordSkuAuditEvent({
        skuKey,
        eventType: 'KOMAX_PROGRAM_GENERATED',
        actorType: 'SYSTEM',
        summary:   `Komax program parameters built: ${result.wirePrograms.length} wires, ${result.batchPrograms.length} batches`,
        payload:   {
          machine:            MACHINE_KOMAX,
          totalWires:         result.wirePrograms.length,
          totalBatches:       result.batchPrograms.length,
          readyWirePrograms:  result.summary.readyWirePrograms,
          partialWirePrograms: result.summary.partialWirePrograms,
          blockedWirePrograms: result.summary.blockedWirePrograms,
        },
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.wirePrograms.length, skuKey]);

  const handleExportWireCsv = useCallback(() => {
    if (result.wirePrograms.length === 0) return;
    const filename = `komax-program-wires-${slug(partNumber)}.csv`;
    downloadCsv(buildKomaxProgramWireCsv(result), filename);
    void recordSkuAuditEvent({
      skuKey,
      eventType: 'KOMAX_PROGRAM_EXPORTED',
      actorType: 'USER',
      actorName: 'Unknown Operator',
      summary:   `Komax wire program CSV exported: ${filename} (${result.wirePrograms.length} wires)`,
      payload:   { filename, wireCount: result.wirePrograms.length, machine: MACHINE_KOMAX },
      generatedArtifactIds: [filename],
    });
  }, [result, skuKey, partNumber]);

  const handleExportBatchCsv = useCallback(() => {
    if (result.batchPrograms.length === 0) return;
    const filename = `komax-program-batches-${slug(partNumber)}.csv`;
    downloadCsv(buildKomaxProgramBatchCsv(result), filename);
    void recordSkuAuditEvent({
      skuKey,
      eventType: 'KOMAX_PROGRAM_EXPORTED',
      actorType: 'USER',
      actorName: 'Unknown Operator',
      summary:   `Komax batch program CSV exported: ${filename} (${result.batchPrograms.length} batches)`,
      payload:   { filename, batchCount: result.batchPrograms.length, machine: MACHINE_KOMAX },
      generatedArtifactIds: [filename],
    });
  }, [result, skuKey, partNumber]);

  const { summary } = result;
  const totalWires   = result.wirePrograms.length;
  const totalBatches = result.batchPrograms.length;

  return (
    <details className="mt-4 rounded-xl border border-violet-200 bg-white text-xs shadow-sm">
      <summary className="cursor-pointer select-none px-4 py-2.5 font-semibold text-gray-700 flex items-center gap-2 flex-wrap">
        <span className="text-violet-600 text-[11px] font-bold uppercase tracking-wide">
          T18 · {MACHINE_KOMAX} Program Parameters
        </span>

        {totalWires > 0 && (
          <>
            {summary.readyWirePrograms   > 0 && (
              <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[9px] font-bold">
                {summary.readyWirePrograms} READY
              </span>
            )}
            {summary.partialWirePrograms > 0 && (
              <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[9px] font-bold">
                {summary.partialWirePrograms} PARTIAL
              </span>
            )}
            {summary.blockedWirePrograms > 0 && (
              <span className="rounded-full bg-red-100 text-red-800 px-2 py-0.5 text-[9px] font-bold">
                {summary.blockedWirePrograms} BLOCKED
              </span>
            )}
          </>
        )}

        {totalWires === 0 && (
          <span className="text-[10px] text-gray-400 italic">No wire data</span>
        )}
      </summary>

      <div className="px-4 pb-4 space-y-3">

        {/* ── Summary header */}
        {totalWires > 0 && (
          <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-2">
            <div className="flex gap-4 text-[11px] text-gray-600">
              <span><strong>{totalWires}</strong> wires · <strong>{totalBatches}</strong> batches</span>
              <span className="text-emerald-600">{summary.readyWirePrograms} ready</span>
              <span className="text-amber-600">{summary.partialWirePrograms} partial</span>
              <span className="text-red-600">{summary.blockedWirePrograms} blocked</span>
            </div>

            {/* View toggle */}
            <div className="flex rounded-md border border-gray-200 overflow-hidden text-[10px]">
              {(['wires', 'batches'] as const).map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={`px-3 py-1 font-medium capitalize transition ${
                    view === v
                      ? 'bg-violet-100 text-violet-800'
                      : 'bg-white text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        )}

        {totalWires === 0 && (
          <p className="text-[11px] text-gray-400 italic pt-1">
            No wire program data available. Ensure effective connectivity and wire identities are present.
          </p>
        )}

        {/* ── B. Wire program table */}
        {view === 'wires' && totalWires > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-max text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  {['Wire', 'Cust ID', 'Batch', 'Length', 'Gauge', 'Color',
                    'Left Process', 'Right Process', 'Print', 'Readiness', ''].map(h => (
                    <th key={h} className="px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-gray-500 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.wirePrograms.map(wp => (
                  <WireRow key={wp.internalWireId} wp={wp} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── C. Batch program cards */}
        {view === 'batches' && totalBatches > 0 && (
          <div className="space-y-2">
            {result.batchPrograms.map(bp => (
              <BatchCard key={bp.batchId} bp={bp} />
            ))}
          </div>
        )}

        {view === 'batches' && totalBatches === 0 && totalWires > 0 && (
          <p className="text-[11px] text-gray-400 italic">No batch groupings available.</p>
        )}

        {/* ── D. Export buttons */}
        {totalWires > 0 && (
          <div className="flex gap-2 flex-wrap pt-1 border-t border-gray-100">
            <button
              type="button"
              onClick={handleExportWireCsv}
              className="flex items-center gap-1.5 rounded-md border border-violet-300 bg-violet-50 px-2.5 py-1 text-[10px] font-medium text-violet-700 shadow-sm hover:bg-violet-100 active:scale-95 transition"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 3v7m0 0L5 7m3 3l3-3M3 13h10" />
              </svg>
              Wire Program CSV
            </button>
            <button
              type="button"
              onClick={handleExportBatchCsv}
              disabled={totalBatches === 0}
              className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-700 shadow-sm hover:bg-slate-100 active:scale-95 transition disabled:opacity-40"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 3v7m0 0L5 7m3 3l3-3M3 13h10" />
              </svg>
              Batch Program CSV
            </button>
          </div>
        )}

      </div>
    </details>
  );
}
