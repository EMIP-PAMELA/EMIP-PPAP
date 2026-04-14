'use client';

/**
 * BOMDrawer — Phase 3H.46 C6
 *
 * Slide-out panel for inline BOM inspection.
 * Fetches BOM records lazily on open via getBOM(); grouped by category.
 *
 * Governance:
 *   - UI ONLY. Reads from bom_records via existing bomService — no new endpoint.
 *   - No BOM parsing or pipeline mutation.
 *   - Isolated; all context passed as props.
 */

import React, { useEffect, useState } from 'react';
import type { BOMRecord } from '@/src/core/data/bom/types';
import { getBOM } from '@/src/core/services/bomService';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface BOMDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  partNumber: string;
  bomData?: BOMRecord[];
}

// ---------------------------------------------------------------------------
// Grouping helpers
// ---------------------------------------------------------------------------

const CATEGORY_ORDER = ['WIRE', 'TERMINAL', 'CONNECTOR', 'HARDWARE', 'OTHER'];

const CATEGORY_LABELS: Record<string, string> = {
  WIRE:      'Wires',
  TERMINAL:  'Terminals',
  CONNECTOR: 'Connectors',
  HARDWARE:  'Hardware',
  OTHER:     'Other',
};

function groupByCategory(items: BOMRecord[]): [string, BOMRecord[]][] {
  const map: Record<string, BOMRecord[]> = {};
  for (const item of items) {
    const key = (item.category ?? 'OTHER').toUpperCase();
    if (!map[key]) map[key] = [];
    map[key].push(item);
  }

  const knownOrder = [...CATEGORY_ORDER];
  for (const key of Object.keys(map)) {
    if (!knownOrder.includes(key)) knownOrder.push(key);
  }

  return knownOrder.filter(k => map[k]).map(k => [k, map[k]]);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BOMDrawer({
  isOpen,
  onClose,
  partNumber,
  bomData,
}: BOMDrawerProps) {
  const [data,    setData]    = useState<BOMRecord[] | null>(bomData ?? null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (data !== null) return;

    setLoading(true);
    setError(null);
    getBOM(partNumber)
      .then(records => setData(records))
      .catch(err => setError(String((err as Error).message ?? err)))
      .finally(() => setLoading(false));
  }, [isOpen, partNumber]);

  useEffect(() => {
    console.log('[BOM DRAWER]', {
      opened:    isOpen,
      itemCount: data?.length ?? 0,
    });
  }, [isOpen, data?.length]);

  if (!isOpen) return null;

  const groups = data ? groupByCategory(data) : [];

  return (
    <>
      {/* ── Backdrop ──────────────────────────────────────────────────────────── */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* ── Drawer panel ─────────────────────────────────────────────────────── */}
      <div className="fixed right-0 top-0 h-full w-full max-w-[480px] bg-white shadow-2xl z-50 flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-gray-400">BOM Inspection</p>
            <h2 className="text-lg font-semibold text-gray-900">Bill of Materials</h2>
            <p className="text-sm text-gray-500 font-mono mt-0.5">{partNumber}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close BOM drawer"
            className="mt-0.5 text-gray-400 hover:text-gray-700 transition text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* Loading */}
          {loading && (
            <div className="px-6 py-10 text-center">
              <p className="text-sm text-gray-400">Loading BOM…</p>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="px-6 py-10 text-center space-y-1">
              <p className="text-sm font-semibold text-red-600">Failed to load BOM</p>
              <p className="text-xs text-gray-400">{error}</p>
            </div>
          )}

          {/* Empty */}
          {!loading && !error && data !== null && data.length === 0 && (
            <div className="px-6 py-10 text-center space-y-1">
              <p className="text-sm font-semibold text-gray-400">No BOM data available</p>
              <p className="text-xs text-gray-400">Upload a BOM document to populate this view</p>
            </div>
          )}

          {/* Grouped rows */}
          {!loading && !error && groups.length > 0 && (
            <div>
              {groups.map(([cat, items]) => (
                <div key={cat} className="border-b border-gray-100 last:border-b-0">
                  {/* Category header */}
                  <div className="flex items-center gap-2 px-6 py-2 bg-gray-50 border-b border-gray-100">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-600">
                      {CATEGORY_LABELS[cat] ?? cat}
                    </span>
                    <span className="text-[11px] text-gray-400">({items.length})</span>
                  </div>

                  {/* Column micro-header */}
                  <div className="grid grid-cols-[1fr_auto] gap-x-3 px-6 py-1 bg-gray-50/60">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Part / Description</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 text-right">Qty</span>
                  </div>

                  {/* BOM item rows */}
                  <div className="divide-y divide-gray-100">
                    {items.map((item, idx) => (
                      <div
                        key={`${item.component_part_number}-${idx}`}
                        className="grid grid-cols-[1fr_auto] gap-x-3 items-start px-6 py-3 hover:bg-gray-50/80 transition"
                      >
                        <div className="min-w-0">
                          <p className="font-mono text-sm font-semibold text-gray-800 truncate">
                            {item.component_part_number}
                          </p>
                          {item.description && (
                            <p className="text-xs text-gray-500 truncate mt-0.5">
                              {item.description}
                            </p>
                          )}
                          {(item.gauge || item.color || item.length != null) && (
                            <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                              {[
                                item.gauge  && `${item.gauge} AWG`,
                                item.color,
                                item.length != null && `${item.length} mm`,
                              ].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0 pt-0.5">
                          <span className="text-sm font-semibold text-gray-800">
                            {item.quantity}
                          </span>
                          {item.unit && (
                            <span className="text-xs text-gray-400 ml-1">{item.unit}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {data !== null && data.length > 0 && (
          <div className="px-6 py-2.5 border-t border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-400">
              {data.length} item{data.length !== 1 ? 's' : ''}
              {groups.length > 1 && ` · ${groups.length} categories`}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
