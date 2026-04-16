/**
 * SKU Lifecycle History Panel — Phase T17.5
 *
 * Displays the full audit timeline for a SKU: events, snapshots, diff previews,
 * and artifact references. Intended for operator review and quality audits.
 *
 * Layout:
 *   A. Header summary
 *   B. Timeline (chronological events)
 *   C. Snapshot checkpoints
 *   D. Export (JSON + CSV)
 *
 * Governance:
 *   - Read-only display. Never mutates audit data.
 *   - Fetches live from DB on mount and on manual refresh.
 *   - Gracefully handles empty / error states.
 */

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  listSkuAuditEvents,
  listSkuAuditSnapshots,
  exportSkuAuditAsJson,
  exportSkuAuditAsCsv,
  sortEventsByTimestamp,
  buildSkuAuditSummary,
} from '@/src/features/harness-work-instructions/services/skuAuditService';
import type { SkuAuditEvent, SkuAuditSnapshot, SkuAuditEventType } from '@/src/features/harness-work-instructions/types/skuAudit';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SkuLifecycleHistoryPanelProps {
  skuKey: string | null;
}

// ---------------------------------------------------------------------------
// Event-type display config
// ---------------------------------------------------------------------------

const EVENT_CONFIG: Record<SkuAuditEventType, { label: string; color: string }> = {
  DRAWING_UPLOADED:            { label: 'Drawing Uploaded',          color: 'bg-blue-100 text-blue-800' },
  BOM_UPLOADED:                { label: 'BOM Uploaded',              color: 'bg-blue-100 text-blue-800' },
  DOC_TYPE_CONFIRMED:          { label: 'Doc Type Confirmed',        color: 'bg-emerald-100 text-emerald-800' },
  FIELD_CONFIRMED:             { label: 'Field Confirmed',           color: 'bg-emerald-100 text-emerald-800' },
  WIRE_OVERRIDE_APPLIED:       { label: 'Wire Override',             color: 'bg-amber-100 text-amber-800' },
  SKU_WIRE_ADDED:              { label: 'Wire Added',                color: 'bg-indigo-100 text-indigo-800' },
  SKU_WIRE_EDITED:             { label: 'Wire Edited',               color: 'bg-indigo-100 text-indigo-800' },
  SKU_WIRE_DELETED:            { label: 'Wire Deleted',              color: 'bg-red-100 text-red-800' },
  BRANCH_DECLARED:             { label: 'Branch Declared',           color: 'bg-amber-100 text-amber-800' },
  TOPOLOGY_WARNING_RESOLVED:   { label: 'Topology Resolved',         color: 'bg-teal-100 text-teal-800' },
  WIRE_IDENTITIES_RECALCULATED:{ label: 'Identities Recalculated',  color: 'bg-slate-100 text-slate-700' },
  KOMAX_CUT_SHEET_GENERATED:   { label: 'Komax Cut Sheet',          color: 'bg-violet-100 text-violet-800' },
  KOMAX_BATCHES_GENERATED:     { label: 'Komax Batches',            color: 'bg-violet-100 text-violet-800' },
  KOMAX_PROGRAM_GENERATED:     { label: 'Program Built',            color: 'bg-violet-200 text-violet-900' },
  KOMAX_PROGRAM_EXPORTED:      { label: 'Program Exported',         color: 'bg-violet-200 text-violet-900' },
  ENDPOINT_PROCESS_ENRICHED:   { label: 'ACI Enriched',             color: 'bg-teal-100 text-teal-800' },
  TOOLING_VALIDATED:           { label: 'Tooling Validated',        color: 'bg-orange-100 text-orange-800' },
  SKU_READY_TO_COMMIT:         { label: 'Ready to Commit',          color: 'bg-emerald-200 text-emerald-900' },
  SKU_COMMITTED:               { label: 'Committed',                color: 'bg-emerald-600 text-white' },
};

const SNAPSHOT_LABELS: Record<SkuAuditSnapshot['snapshotType'], string> = {
  INGESTION_BASELINE: 'Ingestion Baseline',
  PRE_COMMIT:         'Pre-Commit',
  COMMITTED:          'Committed',
  MANUAL_CHECKPOINT:  'Manual Checkpoint',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtTs(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch {
    return iso;
  }
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EventBadge({ eventType }: { eventType: SkuAuditEventType }) {
  const cfg = EVENT_CONFIG[eventType] ?? { label: eventType, color: 'bg-gray-100 text-gray-700' };
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function DiffPreview({ before, after }: { before: Record<string, unknown> | null | undefined; after: Record<string, unknown> | null | undefined }) {
  if (!before && !after) return null;
  const keys = Array.from(new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]));
  const changed = keys.filter(k => JSON.stringify((before ?? {})[k]) !== JSON.stringify((after ?? {})[k]));
  if (changed.length === 0) return null;
  return (
    <div className="mt-1 space-y-0.5">
      {changed.map(k => (
        <div key={k} className="text-[10px] font-mono text-gray-500">
          <span className="text-red-500">{String((before ?? {})[k] ?? '—')}</span>
          <span className="mx-1 text-gray-400">→</span>
          <span className="text-emerald-600">{String((after ?? {})[k] ?? '—')}</span>
          <span className="ml-1 text-gray-400">({k})</span>
        </div>
      ))}
    </div>
  );
}

function EventRow({ event }: { event: SkuAuditEvent }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="flex gap-2 py-1.5 border-b border-gray-100 last:border-0">
      {/* Timeline dot */}
      <div className="flex flex-col items-center pt-0.5">
        <div className="w-2 h-2 rounded-full bg-gray-300 flex-shrink-0" />
        <div className="w-px flex-1 bg-gray-100 mt-0.5" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <EventBadge eventType={event.eventType} />
          <span className="text-[10px] text-gray-400 whitespace-nowrap">{fmtTs(event.timestamp)}</span>
          <span className="text-[10px] text-gray-500 italic">{event.actorName ?? event.actorType}</span>
        </div>

        <p className="text-[11px] text-gray-700 mt-0.5 leading-snug">{event.summary}</p>

        {event.reason && (
          <p className="text-[10px] text-amber-700 mt-0.5 italic">
            Reason: {event.reason}
          </p>
        )}

        <DiffPreview before={event.beforeState} after={event.afterState} />

        {(event.sourceArtifactIds?.length || event.generatedArtifactIds?.length || event.payload) && (
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="text-[10px] text-blue-500 hover:underline mt-0.5"
          >
            {expanded ? 'hide detail' : 'show detail'}
          </button>
        )}

        {expanded && (
          <div className="mt-1 rounded border border-gray-200 bg-gray-50 px-2 py-1.5 space-y-1">
            {event.sourceArtifactIds?.length ? (
              <div className="text-[10px] text-gray-500">
                Source: {event.sourceArtifactIds.join(', ')}
              </div>
            ) : null}
            {event.generatedArtifactIds?.length ? (
              <div className="text-[10px] text-gray-500">
                Generated: {event.generatedArtifactIds.join(', ')}
              </div>
            ) : null}
            {event.payload && (
              <pre className="text-[9px] text-gray-600 overflow-auto max-h-24">
                {JSON.stringify(event.payload, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SnapshotCard({ snap }: { snap: SkuAuditSnapshot }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-gray-200 px-3 py-2 bg-gray-50 space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold text-gray-700 uppercase tracking-wide">
          {SNAPSHOT_LABELS[snap.snapshotType] ?? snap.snapshotType}
        </span>
        <span className="text-[10px] text-gray-400">{fmtTs(snap.timestamp)}</span>
      </div>
      <p className="text-[10px] text-gray-600">{snap.summary}</p>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="text-[10px] text-blue-500 hover:underline"
      >
        {open ? 'hide state' : 'view state'}
      </button>
      {open && (
        <pre className="text-[9px] text-gray-600 overflow-auto max-h-40 mt-1 rounded border border-gray-200 bg-white px-2 py-1">
          {JSON.stringify(snap.effectiveState, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function SkuLifecycleHistoryPanel({ skuKey }: SkuLifecycleHistoryPanelProps) {
  const [events,    setEvents]    = useState<SkuAuditEvent[]>([]);
  const [snapshots, setSnapshots] = useState<SkuAuditSnapshot[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [refreshAt, setRefreshAt] = useState(0);

  useEffect(() => {
    if (!skuKey?.trim()) return;
    setLoading(true);
    setError(null);
    Promise.all([listSkuAuditEvents(skuKey), listSkuAuditSnapshots(skuKey)])
      .then(([evts, snaps]) => {
        setEvents(sortEventsByTimestamp(evts));
        setSnapshots(snaps);
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load audit data.'))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skuKey, refreshAt]);

  const refresh = useCallback(() => setRefreshAt(n => n + 1), []);

  const handleExportJson = useCallback(async () => {
    if (!skuKey) return;
    const json = await exportSkuAuditAsJson(skuKey);
    const slug = skuKey.replace(/[^A-Za-z0-9_-]/g, '_');
    downloadBlob(json, `sku-audit-${slug}.json`, 'application/json');
  }, [skuKey]);

  const handleExportCsv = useCallback(async () => {
    if (!skuKey) return;
    const csv = await exportSkuAuditAsCsv(skuKey);
    const slug = skuKey.replace(/[^A-Za-z0-9_-]/g, '_');
    downloadBlob(csv, `sku-audit-${slug}.csv`, 'text/csv;charset=utf-8;');
  }, [skuKey]);

  const summary = buildSkuAuditSummary(events);
  const committed   = events.find(e => e.eventType === 'SKU_COMMITTED');
  const firstEvent  = events[0];

  return (
    <details className="mt-4 rounded-xl border border-slate-200 bg-white text-xs shadow-sm">
      <summary className="cursor-pointer select-none px-4 py-2.5 font-semibold text-gray-700 flex items-center gap-2">
        <span className="text-slate-600 text-[11px] font-bold uppercase tracking-wide">
          T17.5 · SKU Lifecycle History
        </span>
        {events.length > 0 && (
          <span className="rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 text-[10px] font-semibold">
            {events.length} event{events.length !== 1 ? 's' : ''}
          </span>
        )}
        {committed && (
          <span className="rounded-full bg-emerald-600 text-white px-2 py-0.5 text-[10px] font-semibold">
            Committed
          </span>
        )}
        {!skuKey && (
          <span className="text-[10px] text-gray-400 italic">No SKU key</span>
        )}
      </summary>

      <div className="px-4 pb-4 space-y-3">

        {/* ── Header summary */}
        {skuKey && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-b border-gray-100 pb-2">
            <div className="space-y-0.5">
              <p className="text-[11px] font-semibold text-gray-700">
                SKU: <span className="font-mono">{skuKey}</span>
              </p>
              {firstEvent && (
                <p className="text-[10px] text-gray-400">
                  First seen: {fmtTs(firstEvent.timestamp)}
                </p>
              )}
              {events.length > 0 && (
                <p className="text-[10px] text-gray-400 italic">{summary}</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={refresh}
                disabled={loading}
                className="flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-1 text-[10px] text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                ↺ Refresh
              </button>
              <button
                type="button"
                onClick={handleExportJson}
                disabled={events.length === 0}
                className="flex items-center gap-1 rounded border border-slate-300 bg-slate-50 px-2 py-1 text-[10px] text-slate-700 hover:bg-slate-100 disabled:opacity-40"
              >
                Export JSON
              </button>
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={events.length === 0}
                className="flex items-center gap-1 rounded border border-slate-300 bg-slate-50 px-2 py-1 text-[10px] text-slate-700 hover:bg-slate-100 disabled:opacity-40"
              >
                Export CSV
              </button>
            </div>
          </div>
        )}

        {/* ── States */}
        {!skuKey && (
          <p className="text-[11px] text-gray-400 italic pt-1">
            No part number confirmed yet — lifecycle history will appear once a part number is set.
          </p>
        )}

        {loading && (
          <p className="text-[11px] text-gray-400 animate-pulse">Loading audit history…</p>
        )}

        {error && (
          <p className="text-[11px] text-red-500">Error: {error}</p>
        )}

        {/* ── Timeline */}
        {!loading && events.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Event Timeline
            </p>
            <div className="space-y-0">
              {events.map(e => <EventRow key={e.id} event={e} />)}
            </div>
          </div>
        )}

        {!loading && skuKey && events.length === 0 && !error && (
          <p className="text-[11px] text-gray-400 italic">
            No events recorded yet for this SKU.
            Events are written as operator actions occur.
          </p>
        )}

        {/* ── Snapshots */}
        {!loading && snapshots.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Checkpoints
            </p>
            <div className="space-y-2">
              {snapshots.map(s => <SnapshotCard key={s.id} snap={s} />)}
            </div>
          </div>
        )}

      </div>
    </details>
  );
}
