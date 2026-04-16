/**
 * Tooling Panel — Phase T19
 *
 * Read-only dashboard for the plant applicator inventory.
 * Displays all known applicators with filtering by location, status,
 * part number, and ACI. No mutation — purely informational.
 *
 * Data source: src/data/applicators.json via toolingService.
 * Governance:
 *   - Never mutates applicator data.
 *   - Filters are UI-only state — never persisted.
 *   - Deterministic: same data → same table every render.
 */

'use client';

import React, { useMemo, useState } from 'react';
import { getAllApplicatorEntries } from '@/src/features/harness-work-instructions/services/toolingService';
import type { ApplicatorLocation, ApplicatorStatus } from '@/src/features/harness-work-instructions/types/tooling';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LOCATION_LABELS: Record<ApplicatorLocation, string> = {
  FT_SMITH:       'Ft Smith',
  BALL_GROUND:    'Ball Ground',
  WARNER_ROBBINS: 'Warner Robbins',
};

const STATUS_STYLE: Record<ApplicatorStatus, string> = {
  ACTIVE:      'bg-emerald-100 text-emerald-800',
  INACTIVE:    'bg-gray-100    text-gray-500',
  MAINTENANCE: 'bg-amber-100   text-amber-800',
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LocationBadge({ location }: { location: string | null }) {
  if (!location) return <span className="text-gray-300 text-[9px]">—</span>;
  const label = LOCATION_LABELS[location as ApplicatorLocation] ?? location;
  return (
    <span className="rounded bg-slate-100 text-slate-700 px-1.5 py-0.5 text-[9px] font-semibold">
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLE[status as ApplicatorStatus] ?? 'bg-gray-100 text-gray-500';
  return (
    <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${style}`}>
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ToolingPanel() {
  const allApplicators = useMemo(() => getAllApplicatorEntries(), []);

  const [filterLocation, setFilterLocation] = useState<string>('ALL');
  const [filterStatus,   setFilterStatus]   = useState<string>('ALL');
  const [searchQuery,    setSearchQuery]     = useState('');

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toUpperCase();
    return allApplicators.filter(a => {
      if (filterLocation !== 'ALL' && a.location !== filterLocation) return false;
      if (filterStatus   !== 'ALL' && a.status   !== filterStatus)   return false;
      if (!q) return true;
      if (a.applicatorModel.toUpperCase().includes(q))               return true;
      if (a.aci?.toUpperCase().includes(q))                          return true;
      if (a.manufacturer?.toUpperCase().includes(q))                 return true;
      if (a.serialNumber?.toUpperCase().includes(q))                 return true;
      if (a.terminalPartNumbers.some(pn => pn.toUpperCase().includes(q))) return true;
      return false;
    });
  }, [allApplicators, filterLocation, filterStatus, searchQuery]);

  const locationCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of allApplicators) {
      const loc = a.location ?? 'UNKNOWN';
      counts[loc] = (counts[loc] ?? 0) + 1;
    }
    return counts;
  }, [allApplicators]);

  return (
    <details className="mt-4 rounded-xl border border-orange-200 bg-white text-xs shadow-sm">
      <summary className="cursor-pointer select-none px-4 py-2.5 font-semibold text-gray-700 flex items-center gap-2 flex-wrap">
        <span className="text-orange-600 text-[11px] font-bold uppercase tracking-wide">
          T19 · Tooling Inventory
        </span>
        <span className="rounded-full bg-orange-100 text-orange-800 px-2 py-0.5 text-[9px] font-bold">
          {allApplicators.length} applicators
        </span>
        {Object.entries(locationCounts).map(([loc, count]) => (
          <span key={loc} className="rounded-full bg-slate-100 text-slate-700 px-2 py-0.5 text-[9px] font-semibold">
            {LOCATION_LABELS[loc as ApplicatorLocation] ?? loc}: {count}
          </span>
        ))}
      </summary>

      <div className="px-4 pb-4 space-y-3">
        {/* ── Filters */}
        <div className="pt-3 flex flex-wrap gap-2 items-center border-b border-gray-100 pb-3">
          {/* Search */}
          <input
            type="text"
            placeholder="Search model, ACI, PN, serial…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="rounded-md border border-gray-300 px-2.5 py-1 text-[11px] placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-orange-400 w-52"
          />

          {/* Location filter */}
          <select
            value={filterLocation}
            onChange={e => setFilterLocation(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-orange-400"
          >
            <option value="ALL">All Locations</option>
            <option value="FT_SMITH">Ft Smith</option>
            <option value="BALL_GROUND">Ball Ground</option>
            <option value="WARNER_ROBBINS">Warner Robbins</option>
          </select>

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-orange-400"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="MAINTENANCE">Maintenance</option>
          </select>

          <span className="text-[10px] text-gray-400 ml-auto">
            {filtered.length} of {allApplicators.length} shown
          </span>
        </div>

        {/* ── Table */}
        {filtered.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-max text-left border-collapse text-[10px]">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  {['Applicator Model', 'ACI', 'Terminal Part #(s)', 'Manufacturer', 'Serial #', 'Location', 'Status', 'Qty'].map(h => (
                    <th key={h} className="px-2 py-1.5 text-[9px] font-bold uppercase tracking-wide text-gray-500 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((app, idx) => (
                  <tr
                    key={`${app.applicatorModel}-${app.serialNumber ?? idx}-${app.location}`}
                    className="border-b border-gray-100 hover:bg-orange-50 transition-colors"
                  >
                    <td className="px-2 py-1.5 font-mono text-gray-800 whitespace-nowrap">
                      {app.applicatorModel}
                    </td>
                    <td className="px-2 py-1.5 font-mono text-orange-700 whitespace-nowrap">
                      {app.aci ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-2 py-1.5 text-gray-600 max-w-[220px]">
                      {app.terminalPartNumbers.length > 0 ? (
                        <div className="flex flex-wrap gap-0.5">
                          {app.terminalPartNumbers.slice(0, 5).map(pn => (
                            <span key={pn} className="rounded bg-blue-50 text-blue-700 px-1 py-0.5 text-[9px] font-mono">
                              {pn}
                            </span>
                          ))}
                          {app.terminalPartNumbers.length > 5 && (
                            <span className="text-gray-400 text-[9px]">+{app.terminalPartNumbers.length - 5} more</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-gray-600 whitespace-nowrap">
                      {app.manufacturer ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-2 py-1.5 font-mono text-gray-600 whitespace-nowrap">
                      {app.serialNumber ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      <LocationBadge location={app.location} />
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      <StatusBadge status={app.status} />
                    </td>
                    <td className="px-2 py-1.5 text-center text-gray-700">
                      {app.quantity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-[11px] text-gray-400 italic pt-1">
            No applicators match the current filters.
          </p>
        )}
      </div>
    </details>
  );
}
