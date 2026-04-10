'use client';

/**
 * Phase 3H.25 — AI Classification Review Dashboard
 *
 * Human-in-the-loop control layer for AI classification suggestions.
 *
 * Governance:
 * - AI suggestions are NEVER auto-written to the database.
 * - Every classification requires explicit user action (Accept / Reject / Override).
 * - classifyComponent() is NOT modified.
 * - This page is additive and fully optional.
 */

import React, { useEffect, useState, useRef } from 'react';
import EMIPLayout from '../layout/EMIPLayout';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_CATEGORIES = [
  'WIRE', 'TERMINAL', 'CONNECTOR', 'SEAL',
  'HARDWARE', 'LABEL', 'SLEEVING', 'HOUSING',
] as const;

type Category = typeof VALID_CATEGORIES[number];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RowStatus = 'idle' | 'analyzing' | 'suggested' | 'accepted' | 'rejected' | 'overridden';
type LogType = 'AI_REQUEST' | 'AI_RESPONSE' | 'USER_ACTION' | 'DB_WRITE';

interface AISuggestion {
  category: string;
  confidence: number;
  reason: string;
}

interface ClassificationRow {
  partNumber: string;
  description: string | null;
  status: RowStatus;
  suggestion: AISuggestion | null;
  savedCategory: string | null;
  overrideOpen: boolean;
  overrideValue: Category;
  saving: boolean;
  error: string | null;
}

interface LogEntry {
  id: number;
  ts: string;
  type: LogType;
  message: string;
  detail?: string;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

let _logId = 0;
const nextLogId = () => ++_logId;

function confidenceBarColor(c: number): string {
  if (c >= 0.85) return 'bg-green-500';
  if (c >= 0.70) return 'bg-yellow-400';
  return 'bg-red-400';
}

function confidenceTextColor(c: number): string {
  if (c >= 0.85) return 'text-green-700';
  if (c >= 0.70) return 'text-yellow-700';
  return 'text-red-600';
}

function logTypeStyle(t: LogType): string {
  switch (t) {
    case 'AI_REQUEST':  return 'text-blue-400';
    case 'AI_RESPONSE': return 'text-purple-400';
    case 'USER_ACTION': return 'text-yellow-400';
    case 'DB_WRITE':    return 'text-green-400';
  }
}

function StatusBadge({ status }: { status: RowStatus }) {
  const map: Record<RowStatus, { cls: string; label: string }> = {
    idle:       { cls: 'bg-gray-100 text-gray-500',     label: '—' },
    analyzing:  { cls: 'bg-blue-50 text-blue-600',      label: 'Analyzing…' },
    suggested:  { cls: 'bg-purple-50 text-purple-700',  label: 'AI Suggested' },
    accepted:   { cls: 'bg-green-50 text-green-700',    label: '✅ Accepted' },
    rejected:   { cls: 'bg-red-50 text-red-600',        label: '❌ Rejected' },
    overridden: { cls: 'bg-orange-50 text-orange-700',  label: '✏️ Overridden' },
  };
  const { cls, label } = map[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function AIClassificationPage() {
  // We keep a ref mirror of rows to avoid stale closures in batch async loops
  const rowsRef = useRef<ClassificationRow[]>([]);
  const [rows, setRowsInner] = useState<ClassificationRow[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [batchAnalyzing, setBatchAnalyzing] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Synchronized state setter — keeps ref in sync
  const setRows = (updater: ClassificationRow[] | ((prev: ClassificationRow[]) => ClassificationRow[])) => {
    if (typeof updater === 'function') {
      const next = updater(rowsRef.current);
      rowsRef.current = next;
      setRowsInner(next);
    } else {
      rowsRef.current = updater;
      setRowsInner(updater);
    }
  };

  const updateRow = (partNumber: string, patch: Partial<ClassificationRow>) => {
    setRows(prev => prev.map(r => r.partNumber === partNumber ? { ...r, ...patch } : r));
  };

  const addLog = (type: LogType, message: string, detail?: string) => {
    const entry: LogEntry = { id: nextLogId(), ts: new Date().toLocaleTimeString(), type, message, detail };
    setLogs(prev => [...prev.slice(-299), entry]);
    setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 30);
  };

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  const loadUnknownParts = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/ai/unknowns');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const parts = (json.data as { partNumber: string; description: string | null }[]) ?? [];
      setRows(parts.map(p => ({
        partNumber: p.partNumber,
        description: p.description,
        status: 'idle',
        suggestion: null,
        savedCategory: null,
        overrideOpen: false,
        overrideValue: 'TERMINAL',
        saving: false,
        error: null,
      })));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUnknownParts(); }, []);

  // ---------------------------------------------------------------------------
  // Analyze
  // ---------------------------------------------------------------------------

  const analyzeRow = async (partNumber: string, description: string | null) => {
    // Guard: skip if already analyzing
    const current = rowsRef.current.find(r => r.partNumber === partNumber);
    if (!current || current.status === 'analyzing') return;

    updateRow(partNumber, { status: 'analyzing', error: null });
    addLog('AI_REQUEST', `Classify ${partNumber}`, `Description: ${description ?? 'N/A'}`);

    try {
      const res = await fetch('/api/ai/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partNumber, description }),
      });
      const data = await res.json();

      if (!res.ok) {
        const errMsg: string = data.error ?? `HTTP ${res.status}`;
        addLog('AI_RESPONSE', `Error — ${partNumber}`, errMsg);
        updateRow(partNumber, { status: 'idle', error: errMsg });
        return;
      }

      const pct = (data.confidence * 100).toFixed(0);
      addLog('AI_RESPONSE', `${partNumber} → ${data.category} (${pct}%)`, data.reason);
      updateRow(partNumber, {
        status: 'suggested',
        suggestion: { category: data.category, confidence: data.confidence, reason: data.reason },
        error: null,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      addLog('AI_RESPONSE', `Network error — ${partNumber}`, errMsg);
      updateRow(partNumber, { status: 'idle', error: errMsg });
    }
  };

  // ---------------------------------------------------------------------------
  // Save helper (used by Accept and Override)
  // ---------------------------------------------------------------------------

  const saveClassification = async (
    partNumber: string,
    category: string,
    confidence: number,
    description: string | null,
    source: 'AI' | 'MANUAL'
  ): Promise<boolean> => {
    try {
      const res = await fetch('/api/ai/classify-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partNumber, category, confidence, description, source }),
      });
      const data = await res.json();
      if (!res.ok) {
        addLog('DB_WRITE', `FAILED — ${partNumber}`, data.error ?? 'Unknown error');
        return false;
      }
      addLog('DB_WRITE', `SAVED — ${partNumber} → ${category} [${source}]`);
      return true;
    } catch (err) {
      addLog('DB_WRITE', `FAILED — ${partNumber}`, err instanceof Error ? err.message : String(err));
      return false;
    }
  };

  // ---------------------------------------------------------------------------
  // Row actions
  // ---------------------------------------------------------------------------

  const acceptRow = async (partNumber: string) => {
    const row = rowsRef.current.find(r => r.partNumber === partNumber);
    if (!row?.suggestion) return;

    addLog('USER_ACTION', `Accept: ${partNumber} → ${row.suggestion.category}`);
    updateRow(partNumber, { saving: true });
    const ok = await saveClassification(
      partNumber, row.suggestion.category, row.suggestion.confidence, row.description, 'AI'
    );
    updateRow(partNumber, { status: ok ? 'accepted' : 'suggested', savedCategory: ok ? row.suggestion.category : null, saving: false });
  };

  const rejectRow = (partNumber: string) => {
    addLog('USER_ACTION', `Reject: ${partNumber} — not stored`);
    updateRow(partNumber, { status: 'rejected' });
  };

  const commitOverride = async (partNumber: string) => {
    const row = rowsRef.current.find(r => r.partNumber === partNumber);
    if (!row) return;

    addLog('USER_ACTION', `Override: ${partNumber} → ${row.overrideValue} [MANUAL]`);
    updateRow(partNumber, { saving: true, overrideOpen: false });
    const ok = await saveClassification(
      partNumber, row.overrideValue, 1.0, row.description, 'MANUAL'
    );
    updateRow(partNumber, {
      status: ok ? 'overridden' : row.status,
      savedCategory: ok ? row.overrideValue : null,
      saving: false,
    });
  };

  // ---------------------------------------------------------------------------
  // Batch actions
  // ---------------------------------------------------------------------------

  const analyzeAllVisible = async () => {
    const targets = rowsRef.current
      .filter(r => r.status === 'idle' || r.status === 'rejected')
      .map(r => ({ partNumber: r.partNumber, description: r.description }));

    if (!targets.length) return;
    setBatchAnalyzing(true);
    addLog('USER_ACTION', `Batch analyze: ${targets.length} parts`);
    for (const t of targets) {
      await analyzeRow(t.partNumber, t.description);
    }
    setBatchAnalyzing(false);
  };

  const acceptHighConfidence = async () => {
    const eligible = rowsRef.current.filter(
      r => r.status === 'suggested' && r.suggestion && r.suggestion.confidence >= 0.85
    );
    if (!eligible.length) return;
    addLog('USER_ACTION', `Batch accept: ${eligible.length} rows ≥ 85% confidence`);
    for (const row of eligible) {
      await acceptRow(row.partNumber);
    }
  };

  // ---------------------------------------------------------------------------
  // Computed counts
  // ---------------------------------------------------------------------------

  const pending   = rows.filter(r => r.status === 'idle' || r.status === 'rejected').length;
  const suggested = rows.filter(r => r.status === 'suggested').length;
  const saved     = rows.filter(r => r.status === 'accepted' || r.status === 'overridden').length;
  const eligibleForBatchAccept = rows.filter(
    r => r.status === 'suggested' && r.suggestion && r.suggestion.confidence >= 0.85
  ).length;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <EMIPLayout>
      <div className="flex flex-col gap-6">

        {/* ── Header ── */}
        <div>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">🤖 AI Classification Review</h1>
              <p className="mt-1 text-sm text-gray-500">
                Phase 3H.25 — Human-in-the-loop. Every AI suggestion requires explicit approval before persistence.
              </p>
            </div>
            <button
              onClick={loadUnknownParts}
              disabled={loading}
              className="text-sm text-blue-600 hover:text-blue-800 underline disabled:opacity-50"
            >
              ↻ Refresh
            </button>
          </div>

          {/* Stats */}
          <div className="mt-4 grid grid-cols-4 gap-3">
            {[
              { label: 'Awaiting Review', value: pending,  color: 'text-gray-800' },
              { label: 'AI Suggested',   value: suggested, color: 'text-purple-700' },
              { label: 'Saved to DB',    value: saved,     color: 'text-green-700' },
              { label: 'Total UNKNOWN',  value: rows.length, color: 'text-blue-700' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-lg border border-gray-200 px-4 py-3">
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Batch controls */}
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <button
              onClick={analyzeAllVisible}
              disabled={batchAnalyzing || pending === 0}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {batchAnalyzing ? '⏳ Analyzing…' : `🔍 Analyze All Visible (${pending})`}
            </button>
            <button
              onClick={acceptHighConfidence}
              disabled={eligibleForBatchAccept === 0}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              ✅ Accept All ≥ 85% ({eligibleForBatchAccept})
            </button>
            <span className="text-xs text-gray-400 ml-auto">
              Governance: no auto-writes — all saves require explicit action
            </span>
          </div>
        </div>

        {/* ── Main split: table + log ── */}
        <div className="flex gap-4 items-start">

          {/* Table */}
          <div className="flex-1 min-w-0 bg-white rounded-xl border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
                Loading UNKNOWN components…
              </div>
            ) : loadError ? (
              <div className="flex items-center justify-center h-64 text-red-500 text-sm p-8 text-center">
                Error: {loadError}
              </div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                <div className="text-5xl mb-3">✅</div>
                <div className="font-medium text-gray-600">No unclassified components</div>
                <div className="text-sm mt-1">All UNKNOWN parts have been reviewed</div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-left">
                      <th className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Part Number</th>
                      <th className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Description</th>
                      <th className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Status</th>
                      <th className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">AI Suggestion</th>
                      <th className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Confidence</th>
                      <th className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.map(row => (
                      <tr
                        key={row.partNumber}
                        className={`hover:bg-gray-50 transition-colors ${
                          row.status === 'accepted' || row.status === 'overridden' ? 'opacity-55' : ''
                        }`}
                      >
                        {/* Part Number */}
                        <td className="px-4 py-3 font-mono text-xs text-gray-900 whitespace-nowrap">
                          {row.partNumber}
                        </td>

                        {/* Description */}
                        <td className="px-4 py-3 text-gray-600">
                          <span
                            className="block max-w-[200px] truncate"
                            title={row.description ?? ''}
                          >
                            {row.description
                              ? row.description
                              : <span className="text-gray-300 italic">—</span>}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <StatusBadge status={row.status} />
                        </td>

                        {/* AI Suggestion */}
                        <td className="px-4 py-3">
                          {row.suggestion ? (
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-purple-700">{row.suggestion.category}</span>
                              {row.suggestion.reason && (
                                <span
                                  title={row.suggestion.reason}
                                  className="text-gray-400 cursor-help text-base leading-none select-none"
                                >
                                  ℹ️
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                          {row.savedCategory && (row.status === 'accepted' || row.status === 'overridden') && (
                            <div className="text-xs text-gray-500 mt-0.5">
                              Saved: {row.savedCategory}
                            </div>
                          )}
                          {row.error && (
                            <div
                              className="text-xs text-red-500 mt-0.5 max-w-[180px] truncate"
                              title={row.error}
                            >
                              {row.error}
                            </div>
                          )}
                        </td>

                        {/* Confidence */}
                        <td className="px-4 py-3 min-w-[90px]">
                          {row.suggestion ? (
                            <>
                              <div className={`text-xs font-bold mb-1 ${confidenceTextColor(row.suggestion.confidence)}`}>
                                {(row.suggestion.confidence * 100).toFixed(0)}%
                              </div>
                              <div className="w-16 bg-gray-200 rounded-full h-1.5">
                                <div
                                  className={`h-1.5 rounded-full transition-all ${confidenceBarColor(row.suggestion.confidence)}`}
                                  style={{ width: `${row.suggestion.confidence * 100}%` }}
                                />
                              </div>
                            </>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          {row.saving ? (
                            <span className="text-xs text-gray-400 animate-pulse">Saving…</span>
                          ) : row.overrideOpen ? (
                            <div className="flex items-center gap-1.5">
                              <select
                                value={row.overrideValue}
                                onChange={e => updateRow(row.partNumber, { overrideValue: e.target.value as Category })}
                                className="text-xs border border-gray-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-orange-400"
                              >
                                {VALID_CATEGORIES.map(cat => (
                                  <option key={cat} value={cat}>{cat}</option>
                                ))}
                              </select>
                              <button
                                onClick={() => commitOverride(row.partNumber)}
                                className="px-2 py-1 bg-orange-500 text-white text-xs rounded hover:bg-orange-600 transition-colors"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => updateRow(row.partNumber, { overrideOpen: false })}
                                className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded hover:bg-gray-200 transition-colors"
                              >
                                ✕
                              </button>
                            </div>
                          ) : row.status === 'idle' || row.status === 'rejected' ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => analyzeRow(row.partNumber, row.description)}
                                className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-lg hover:bg-blue-100 border border-blue-200 transition-colors"
                              >
                                Analyze
                              </button>
                              <button
                                onClick={() => updateRow(row.partNumber, { overrideOpen: true })}
                                title="Manually classify"
                                className="px-2 py-1.5 text-gray-400 text-xs rounded hover:bg-gray-100 transition-colors"
                              >
                                ✏️
                              </button>
                            </div>
                          ) : row.status === 'analyzing' ? (
                            <span className="text-blue-400 text-xs font-medium tracking-widest animate-pulse">● ● ●</span>
                          ) : row.status === 'suggested' ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => acceptRow(row.partNumber)}
                                className="px-3 py-1.5 bg-green-500 text-white text-xs font-medium rounded-lg hover:bg-green-600 transition-colors"
                              >
                                ✅ Accept
                              </button>
                              <button
                                onClick={() => rejectRow(row.partNumber)}
                                title="Reject (local only)"
                                className="px-2 py-1.5 bg-red-50 text-red-600 text-xs rounded-lg hover:bg-red-100 border border-red-100 transition-colors"
                              >
                                ❌
                              </button>
                              <button
                                onClick={() => updateRow(row.partNumber, { overrideOpen: true })}
                                title="Override with manual category"
                                className="px-2 py-1.5 bg-gray-50 text-gray-500 text-xs rounded-lg hover:bg-gray-100 border border-gray-200 transition-colors"
                              >
                                ✏️
                              </button>
                            </div>
                          ) : (
                            /* accepted / overridden */
                            <button
                              onClick={() => updateRow(row.partNumber, { status: 'idle', suggestion: null, error: null })}
                              className="text-xs text-gray-400 hover:text-gray-600 underline"
                            >
                              Re-analyze
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Log panel ── */}
          <div className="w-80 flex-shrink-0 bg-gray-900 rounded-xl border border-gray-700 flex flex-col"
               style={{ maxHeight: 'calc(100vh - 300px)', minHeight: '420px' }}>
            <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between flex-shrink-0">
              <span className="text-sm font-semibold text-gray-300">Live Log</span>
              <button
                onClick={() => setLogs([])}
                className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
              >
                Clear
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 font-mono text-xs">
              {logs.length === 0 ? (
                <div className="text-gray-600 italic text-center mt-6">No activity yet</div>
              ) : (
                logs.map(entry => (
                  <div key={entry.id} className="border-l-2 border-gray-700 pl-2.5">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-gray-600 text-[10px]">{entry.ts}</span>
                      <span className={`font-bold text-[10px] ${logTypeStyle(entry.type)}`}>
                        [{entry.type}]
                      </span>
                    </div>
                    <div className="text-gray-300 break-all leading-relaxed">{entry.message}</div>
                    {entry.detail && (
                      <div className="text-gray-600 break-all mt-0.5 leading-relaxed">{entry.detail}</div>
                    )}
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </div>

        </div>
      </div>
    </EMIPLayout>
  );
}
