'use client';

/**
 * HarnessVisualizationPanel — Phase 3H.46 C5
 *
 * Lightweight structural representation of harness wire connections.
 * Shows wire ID, source (connector/pin), and destination (terminal or unknown).
 *
 * Governance:
 *   - UI ONLY. No data mutation, no pipeline modification.
 *   - No canvas, no spatial layout — clarity over accuracy.
 *   - Isolated component; all data passed as props.
 */

import React, { useEffect } from 'react';
import type { WireInstance } from '@/src/features/harness-work-instructions/types/harnessInstruction.schema';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface HarnessVisualizationPanelProps {
  wires: WireInstance[];
  pinMapCount?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fromLabel(wire: WireInstance): string {
  if (wire.end_a?.connector_id) {
    return `${wire.end_a.connector_id}-${wire.end_a.cavity ?? '?'}`;
  }
  if (wire.end_a?.cavity) {
    return `Pin ${wire.end_a.cavity}`;
  }
  return 'Unknown';
}

function toLabel(wire: WireInstance): string {
  if (wire.end_b?.terminal_part_number) return wire.end_b.terminal_part_number;
  if (wire.end_a?.terminal_part_number) return wire.end_a.terminal_part_number;
  return 'Unknown';
}

function sortWires(wires: WireInstance[]): WireInstance[] {
  return [...wires].sort((a, b) => {
    const numA = parseInt(a.wire_id.replace(/\D/g, ''), 10);
    const numB = parseInt(b.wire_id.replace(/\D/g, ''), 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.wire_id.localeCompare(b.wire_id);
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function HarnessVisualizationPanel({
  wires,
  pinMapCount,
}: HarnessVisualizationPanelProps) {
  useEffect(() => {
    console.log('[HARNESS VISUALIZATION]', { wireCount: wires.length });
  }, [wires.length]);

  const sorted = sortWires(wires);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="px-6 py-4 border-b border-gray-100">
        <p className="text-xs uppercase tracking-[0.4em] text-gray-400">Wire-Level View</p>
        <h2 className="text-lg font-semibold text-gray-900">Harness Visualization</h2>
        <p className="text-sm text-gray-500">System representation of wire connections</p>
      </div>

      {/* ── Pin map hint ────────────────────────────────────────────────────── */}
      {pinMapCount !== undefined && pinMapCount > 0 && (
        <div className="px-6 py-2 border-b border-gray-100 bg-blue-50">
          <p className="text-xs font-semibold text-blue-700">
            📌 Pin Map Available ({pinMapCount} connection{pinMapCount > 1 ? 's' : ''}) — full map rendering coming in a future phase
          </p>
        </div>
      )}

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      {sorted.length === 0 ? (
        <div className="px-6 py-8 text-center">
          <p className="text-sm font-semibold text-gray-400">No wire data available</p>
          <p className="text-xs text-gray-400 mt-0.5">Run the pipeline with a BOM and drawing to populate wire connections</p>
        </div>
      ) : (
        <>
          {/* Column header */}
          <div className="grid grid-cols-[6rem_1fr_auto_1fr] gap-x-4 px-6 py-2 bg-gray-50 border-b border-gray-100">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Wire</span>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">From</span>
            <span />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">To (Terminal)</span>
          </div>

          {/* Scrollable wire list */}
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-100">
            {sorted.map(wire => {
              const from = fromLabel(wire);
              const to   = toLabel(wire);
              const fromMissing = from === 'Unknown';
              const toMissing   = to   === 'Unknown';

              return (
                <div
                  key={wire.wire_id}
                  className="grid grid-cols-[6rem_1fr_auto_1fr] gap-x-4 items-center px-6 py-2.5 hover:bg-gray-50 transition"
                >
                  {/* Wire ID */}
                  <span className="font-mono text-sm font-semibold text-gray-800">
                    {wire.wire_id}
                  </span>

                  {/* FROM */}
                  <span className={`font-mono text-sm rounded px-1.5 py-0.5 w-fit ${
                    fromMissing
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'text-gray-700'
                  }`}>
                    {from}
                  </span>

                  {/* Arrow */}
                  <span className="text-gray-300 font-semibold select-none">→</span>

                  {/* TO */}
                  <span className={`font-mono text-sm rounded px-1.5 py-0.5 w-fit ${
                    toMissing
                      ? 'bg-red-50 text-red-700 border border-red-200'
                      : 'text-gray-700'
                  }`}>
                    {to}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Footer count */}
          <div className="px-6 py-2.5 border-t border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-400">
              {sorted.length} wire{sorted.length > 1 ? 's' : ''} shown
              {sorted.filter(w => fromLabel(w) === 'Unknown' || toLabel(w) === 'Unknown').length > 0 && (
                <span className="ml-2 text-amber-600 font-semibold">
                  · {sorted.filter(w => fromLabel(w) === 'Unknown' || toLabel(w) === 'Unknown').length} with missing endpoints
                </span>
              )}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
