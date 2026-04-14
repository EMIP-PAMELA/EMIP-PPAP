'use client';

/**
 * HarnessVisualizationPanel — Phase 3H.46 C5 / C5.1 / C5.2 / C5.3
 *
 * Connector-grouped structural representation of harness wire connections.
 * Groups wires by end_a.connector_id; UNASSIGNED group rendered last.
 *
 * Governance:
 *   - UI ONLY. No data mutation, no pipeline modification.
 *   - No canvas, no spatial layout — clarity over accuracy.
 *   - Isolated component; all data passed as props.
 */

import React, { useEffect } from 'react';
import type { WireInstance } from '@/src/features/harness-work-instructions/types/harnessInstruction.schema';

const UNASSIGNED = 'UNASSIGNED';

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

function groupedFromLabel(wire: WireInstance): string {
  return wire.end_a?.cavity ?? '?';
}

function flowFromNode(wire: WireInstance): string {
  if (wire.end_a?.connector_id) {
    return `${wire.end_a.connector_id}-${wire.end_a.cavity ?? '?'}`;
  }
  if (wire.end_a?.cavity) {
    return `Pin ${wire.end_a.cavity}`;
  }
  return 'Unknown';
}

function groupedToLabel(wire: WireInstance): string {
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

function groupWires(wires: WireInstance[]): [string, WireInstance[]][] {
  const map: Record<string, WireInstance[]> = {};
  for (const wire of wires) {
    const key = wire.end_a?.connector_id ?? UNASSIGNED;
    if (!map[key]) map[key] = [];
    map[key].push(wire);
  }

  const entries = Object.entries(map).map(
    ([key, group]): [string, WireInstance[]] => [key, sortWires(group)],
  );

  return entries.sort(([a], [b]) => {
    if (a === UNASSIGNED) return 1;
    if (b === UNASSIGNED) return -1;
    return a.localeCompare(b);
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function HarnessVisualizationPanel({
  wires,
  pinMapCount,
}: HarnessVisualizationPanelProps) {
  const groups = groupWires(wires);

  useEffect(() => {
    console.log('[HARNESS VISUALIZATION]', { wireCount: wires.length });
  }, [wires.length]);

  useEffect(() => {
    console.log('[GROUPED HARNESS]', { groupCount: groups.length });
  }, [groups.length]);

  const missingLength   = wires.filter(w => w.cut_length == null).length;
  const missingTerminal = wires.filter(w => groupedToLabel(w) === 'Unknown').length;
  const missingCavity   = wires.filter(w => groupedFromLabel(w) === '?').length;

  useEffect(() => {
    const wiresWithLength    = wires.filter(w => w.cut_length != null).length;
    const wiresMissingLength = wires.filter(w => w.cut_length == null).length;
    console.log('[WIRE ATTRIBUTES]', { wiresWithLength, wiresMissingLength });
  }, [wires.length]);

  useEffect(() => {
    console.log('[WIRE FLOW VIEW]', { wiresRendered: wires.length });
  }, [wires.length]);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="px-6 py-4 border-b border-gray-100">
        <p className="text-xs uppercase tracking-[0.4em] text-gray-400">Wire-Level View</p>
        <h2 className="text-lg font-semibold text-gray-900">Harness Visualization</h2>
        <p className="text-sm text-gray-500">Wires grouped by connector</p>
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
      {wires.length === 0 ? (
        <div className="px-6 py-8 text-center">
          <p className="text-sm font-semibold text-gray-400">No wire data available</p>
          <p className="text-xs text-gray-400 mt-0.5">Run the pipeline with a BOM and drawing to populate wire connections</p>
        </div>
      ) : (
        <>
          {/* Scrollable grouped list */}
          <div className="max-h-[30rem] overflow-y-auto">
            {groups.map(([groupKey, groupWireList]) => {
              const isUnassigned = groupKey === UNASSIGNED;

              return (
                <div key={groupKey} className="border-b border-gray-100 last:border-b-0">
                  {/* Group header */}
                  <div className="flex items-center gap-2 px-6 py-2 bg-gray-50 border-b border-gray-100">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-600">
                      {isUnassigned ? 'Unassigned Wires' : `Connector ${groupKey}`}
                    </span>
                    <span className="text-[11px] text-gray-400">
                      ({groupWireList.length} wire{groupWireList.length > 1 ? 's' : ''})
                    </span>
                    {isUnassigned && (
                      <span className="ml-auto text-[11px] font-semibold text-amber-600">
                        ⚠ No connector assigned
                      </span>
                    )}
                  </div>

                  {/* Column sub-header */}
                  <div className="grid grid-cols-[4rem_2fr_5rem_4rem_4rem] gap-x-3 pl-10 pr-6 py-1 bg-gray-50/60">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Wire</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Connection Flow</span>
                    <span title="Cut length used for processing" className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Length</span>
                    <span title="Wire gauge (AWG)" className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Gauge</span>
                    <span title="Wire insulation color" className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Color</span>
                  </div>

                  {/* Wire rows */}
                  <div className="divide-y divide-gray-100">
                    {groupWireList.map(wire => {
                      const fromNode    = flowFromNode(wire);
                      const toNode      = groupedToLabel(wire);
                      const fromMissing = fromNode === 'Unknown';
                      const toMissing   = toNode   === 'Unknown';
                      const lengthMissing = wire.cut_length == null;

                      return (
                        <div
                          key={wire.wire_id}
                          className="grid grid-cols-[4rem_2fr_5rem_4rem_4rem] gap-x-3 items-center pl-10 pr-6 py-2 hover:bg-gray-50/80 transition"
                        >
                          {/* Wire ID */}
                          <span className="font-mono text-sm font-semibold text-gray-700">
                            {wire.wire_id}
                          </span>

                          {/* Flow: FROM ────→ TO */}
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={`font-mono text-sm rounded px-1.5 py-0.5 shrink-0 ${
                              fromMissing
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'text-gray-700'
                            }`}>
                              {fromNode}
                            </span>
                            <span className="font-mono text-gray-300 text-sm select-none shrink-0">────→</span>
                            <span className={`font-mono text-sm rounded px-1.5 py-0.5 min-w-0 truncate ${
                              toMissing
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : 'text-gray-700'
                            }`}>
                              {toNode}
                            </span>
                          </div>

                          {/* Length */}
                          <span
                            title="Cut length used for processing"
                            className={`font-mono text-sm ${
                              lengthMissing ? 'text-amber-600 font-semibold' : 'text-gray-700'
                            }`}
                          >
                            {wire.cut_length != null ? `${wire.cut_length} mm` : '—'}
                          </span>

                          {/* Gauge */}
                          <span title="Wire gauge (AWG)" className="font-mono text-sm text-gray-500">
                            {wire.gauge ?? '—'}
                          </span>

                          {/* Color */}
                          <span title="Wire insulation color" className="font-mono text-sm text-gray-500 truncate">
                            {wire.color ?? '—'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-6 py-2.5 border-t border-gray-100 bg-gray-50 space-y-0.5">
            <p className="text-xs text-gray-400">
              {groups.length} connector group{groups.length > 1 ? 's' : ''} · {wires.length} wire{wires.length > 1 ? 's' : ''}
            </p>
            {(missingTerminal > 0 || missingCavity > 0 || missingLength > 0) && (
              <p className="text-xs text-amber-600 font-semibold flex flex-wrap gap-x-3">
                {missingTerminal > 0 && <span>Missing terminal: {missingTerminal}</span>}
                {missingCavity   > 0 && <span>Missing cavity: {missingCavity}</span>}
                {missingLength   > 0 && <span>Missing length: {missingLength}</span>}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
