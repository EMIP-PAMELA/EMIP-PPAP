'use client';

/**
 * HarnessStructurePanel — Phase 3H.46 C3
 *
 * Displays the system's structural interpretation of a SKU using pipeline outputs.
 * Purely presentational — all counts are derived upstream and passed as props.
 *
 * ZONES:
 *   A — Header: title + subtitle
 *   B — Visual placeholder (visualization deferred)
 *   C — Summary strip: Wires · Terminals · Connectors · Pin Map Rows
 */

import React from 'react';

export interface HarnessStructurePanelProps {
  wireCount: number;
  terminalCount: number;
  connectorCount: number;
  pinMapCount?: number;
  hasData: boolean;
}

const STATS: {
  label: string;
  key: keyof Omit<HarnessStructurePanelProps, 'hasData'>;
}[] = [
  { label: 'Wires',         key: 'wireCount' },
  { label: 'Terminals',     key: 'terminalCount' },
  { label: 'Connectors',    key: 'connectorCount' },
  { label: 'Pin Map Rows',  key: 'pinMapCount' },
];

export default function HarnessStructurePanel({
  wireCount,
  terminalCount,
  connectorCount,
  pinMapCount = 0,
  hasData,
}: HarnessStructurePanelProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* ── ZONE A: Header ─────────────────────────────────────────────────── */}
      <div className="px-6 py-4 border-b border-gray-100">
        <p className="text-xs uppercase tracking-[0.4em] text-gray-400">System Interpretation</p>
        <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">Harness Structure</h2>
        <p className="text-sm text-gray-500">Derived from pipeline outputs for this SKU</p>
      </div>

      {/* ── ZONE B: Visual placeholder ─────────────────────────────────────── */}
      <div className="px-6 py-5 border-b border-gray-100">
        {hasData ? (
          <div className="rounded-xl border border-dashed border-blue-200 bg-blue-50 px-4 py-4 text-center">
            <p className="text-sm font-semibold text-blue-700">Visualization coming soon</p>
            <p className="text-xs text-blue-500 mt-0.5">
              Wire topology diagram will render here in a future phase
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-4 text-center">
            <p className="text-sm font-semibold text-gray-500">No structure data available</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Run the pipeline with a BOM and drawing to generate structure data
            </p>
          </div>
        )}
      </div>

      {/* ── ZONE C: Summary stats ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-100">
        {STATS.map(({ label, key }) => {
          const value = key === 'pinMapCount' ? pinMapCount : { wireCount, terminalCount, connectorCount }[key];
          return (
            <div key={key} className="px-5 py-4">
              <p className="text-xs uppercase tracking-wide text-gray-400">{label}</p>
              <p className={`text-2xl font-semibold mt-0.5 ${(value ?? 0) > 0 ? 'text-gray-900' : 'text-gray-300'}`}>
                {value ?? 0}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
