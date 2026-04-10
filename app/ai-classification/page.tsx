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
import { derivePatternPrefix } from '@/src/core/utils/patternTools';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_OPTIONS = [
  'WIRE',
  'TERMINAL',
  'CONNECTOR',
  'SEAL',
  'FERRULE',
  'HOUSING',
  'PLUG',
  'HARDWARE',
  'LABEL',
  'SLEEVING',
  'OTHER'
] as const;

const UI_MAX_RETRIES = 1;
const UI_RETRY_DELAY_MS = 2000;

type CategoryOption = typeof CATEGORY_OPTIONS[number];
type CanonicalCategory = 'WIRE' | 'TERMINAL' | 'CONNECTOR' | 'SEAL' | 'HARDWARE' | 'LABEL' | 'SLEEVING' | 'HOUSING' | 'UNKNOWN';

const CATEGORY_TO_CANONICAL: Record<CategoryOption, CanonicalCategory> = {
  WIRE: 'WIRE',
  TERMINAL: 'TERMINAL',
  CONNECTOR: 'CONNECTOR',
  SEAL: 'SEAL',
  FERRULE: 'TERMINAL',
  HOUSING: 'HOUSING',
  PLUG: 'CONNECTOR',
  HARDWARE: 'HARDWARE',
  LABEL: 'LABEL',
  SLEEVING: 'SLEEVING',
  OTHER: 'UNKNOWN'
};

const CANONICAL_TO_OPTION: Record<CanonicalCategory, CategoryOption> = {
  WIRE: 'WIRE',
  TERMINAL: 'TERMINAL',
  CONNECTOR: 'CONNECTOR',
  SEAL: 'SEAL',
  HARDWARE: 'HARDWARE',
  LABEL: 'LABEL',
  SLEEVING: 'SLEEVING',
  HOUSING: 'HOUSING',
  UNKNOWN: 'OTHER'
};
 
// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RowStatus = 'idle' | 'analyzing' | 'suggested' | 'rejected';
type LogType =
  | 'AI_REQUEST'
  | 'AI_RESPONSE'
  | 'AI_RETRY_UI'
  | 'USER_MODIFIED'
  | 'USER_ACTION'
  | 'CLASSIFICATION_SAVED'
  | 'PATTERN'
  | 'DB_WRITE';

interface ClassificationRow {
  partNumber: string;
  description: string | null;
  status: RowStatus;
  aiCategory: CanonicalCategory | null;
  aiConfidence: number | null;
  aiReason: string | null;
  selectedCategory: CategoryOption | '';
  saving: boolean;
  patternSaving: boolean;
  patternCreated: boolean;
  error: string | null;
}

const RowItem = React.memo(function RowItem({
  row,
  analyzeLoading,
  onCategoryChange,
  onSave,
  onAnalyze,
  onPatternSave,
  onReject
}: RowItemProps) {
  const aiConfidence = typeof row.aiConfidence === 'number' ? row.aiConfidence : null;
  const selectionMatchesAI = Boolean(
    row.selectedCategory &&
    row.aiCategory &&
    CATEGORY_TO_CANONICAL[row.selectedCategory] === row.aiCategory
  );

  return (
    <tr
      id={`row-${row.partNumber}`}
      className="hover:bg-gray-50 transition-colors"
    >
      <td className="px-4 py-3 font-mono text-xs text-gray-900 whitespace-nowrap">
        {row.partNumber}
      </td>

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

      <td className="px-4 py-3 whitespace-nowrap">
        <StatusBadge status={row.status} />
      </td>

      <td className="px-4 py-3">
        {row.aiCategory ? (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-purple-700">{row.aiCategory}</span>
              {row.aiReason && (
                <span
                  title={row.aiReason}
                  className="text-gray-400 cursor-help text-base leading-none select-none"
                >
                  ℹ️
                </span>
              )}
            </div>
            {row.aiReason && (
              <div className="text-xs text-gray-500 line-clamp-2">
                {row.aiReason}
              </div>
            )}
          </div>
        ) : (
          <span className="text-gray-300 text-xs">—</span>
        )}
        {row.status !== 'suggested' && row.error && (
          <div className="text-xs text-red-500 mt-1 max-w-[200px] truncate" title={row.error}>
            {row.error}
          </div>
        )}
      </td>

      <td className="px-4 py-3 min-w-[90px]">
        {aiConfidence !== null ? (
          <>
            <div className={`text-xs font-bold mb-1 ${confidenceTextColor(aiConfidence)}`}>
              {(aiConfidence * 100).toFixed(0)}%
            </div>
            <div className="w-16 bg-gray-200 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all ${confidenceBarColor(aiConfidence)}`}
                style={{ width: `${aiConfidence * 100}%` }}
              />
            </div>
          </>
        ) : (
          <span className="text-gray-300 text-xs">—</span>
        )}
      </td>

      <td className="px-4 py-3 min-w-[200px]">
        <select
          value={row.selectedCategory}
          onChange={(e) => onCategoryChange(row.partNumber, e.target.value)}
          disabled={row.patternSaving}
          className="w-full text-xs border border-gray-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:bg-gray-50 disabled:text-gray-400"
        >
          <option value="">Select Category</option>
          {CATEGORY_OPTIONS.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        {row.aiCategory && row.selectedCategory && (
          <div className={`text-xs mt-1 ${selectionMatchesAI ? 'text-green-600' : 'text-orange-500'}`}>
            {selectionMatchesAI ? 'AI suggested this' : 'Manually changed'}
          </div>
        )}

        {row.status === 'suggested' && !row.selectedCategory && (
          <div className="text-xs text-gray-400 mt-1">Select a category to enable Save</div>
        )}

        {row.status === 'suggested' && row.error && (
          <div className="text-xs text-red-500 mt-1" title={row.error}>
            {row.error}
          </div>
        )}
      </td>

      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onSave(row.partNumber)}
              disabled={!row.selectedCategory || row.saving}
              className="px-3 py-1.5 bg-green-500 text-white text-xs font-medium rounded-lg hover:bg-green-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {row.saving ? 'Saving…' : '💾 Save'}
            </button>
            <button
              onClick={() => onAnalyze(row.partNumber, row.description)}
              disabled={analyzeLoading}
              className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-lg hover:bg-blue-100 border border-blue-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {analyzeLoading ? 'Analyzing…' : 'Analyze'}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPatternSave(row.partNumber)}
              disabled={!row.selectedCategory || row.patternSaving || row.patternCreated}
              className="px-3 py-1.5 bg-pink-100 text-pink-700 text-xs font-medium rounded-lg hover:bg-pink-200 border border-pink-200 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {row.patternSaving ? 'Saving pattern…' : row.patternCreated ? 'Pattern saved' : 'Save as Pattern'}
            </button>
            <button
              onClick={() => onReject(row.partNumber)}
              className="px-2 py-1.5 bg-red-50 text-red-600 text-xs rounded-lg hover:bg-red-100 border border-red-100 transition-colors"
            >
              ❌ Reject
            </button>
          </div>
        </div>
      </td>
    </tr>
  );
});

RowItem.displayName = 'RowItem';

interface LogEntry {
  id: number;
  ts: string;
  type: LogType;
  message: string;
  detail?: string;
}

interface RowItemProps {
  row: ClassificationRow;
  analyzeLoading: boolean;
  onCategoryChange: (partNumber: string, categoryValue: string) => void;
  onSave: (partNumber: string) => void;
  onAnalyze: (partNumber: string, description: string | null) => void;
  onPatternSave: (partNumber: string) => void;
  onReject: (partNumber: string) => void;
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
    case 'AI_RETRY_UI': return 'text-cyan-400';
    case 'USER_MODIFIED': return 'text-orange-400';
    case 'USER_ACTION': return 'text-yellow-400';
    case 'CLASSIFICATION_SAVED': return 'text-emerald-400';
    case 'PATTERN': return 'text-pink-400';
    case 'DB_WRITE':    return 'text-green-400';
  }

  return 'text-gray-400';
}

function StatusBadge({ status }: { status: RowStatus }) {
  const map: Record<RowStatus, { cls: string; label: string }> = {
    idle:       { cls: 'bg-gray-100 text-gray-500',     label: 'Awaiting' },
    analyzing:  { cls: 'bg-blue-50 text-blue-600',      label: 'Analyzing…' },
    suggested:  { cls: 'bg-purple-50 text-purple-700',  label: 'Pending Save' },
    rejected:   { cls: 'bg-red-50 text-red-600',        label: '❌ Rejected' },
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
  const [loadingRows, setLoadingRows] = useState<Record<string, boolean>>({});
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [batchAnalyzing, setBatchAnalyzing] = useState(false);
  const [sessionSaved, setSessionSaved] = useState(0);
  const scrollYRef = useRef(0);
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
    setSessionSaved(0);
    try {
      const res = await fetch('/api/ai/unknowns');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const parts = (json.data as { partNumber: string; description: string | null }[]) ?? [];
      setRows(parts.map(p => ({
        partNumber: p.partNumber,
        description: p.description,
        status: 'idle',
        aiCategory: null,
        aiConfidence: null,
        aiReason: null,
        selectedCategory: '',
        saving: false,
        patternSaving: false,
        patternCreated: false,
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
    // Guard: skip if already analyzing or loading
    const current = rowsRef.current.find(r => r.partNumber === partNumber);
    if (!current || current.status === 'analyzing' || loadingRows[partNumber]) {
      return;
    }

    const part = partNumber.trim();
    updateRow(partNumber, { status: 'analyzing', error: null });
    setLoadingRows(prev => ({ ...prev, [partNumber]: true }));
    addLog('AI_REQUEST', `Classify ${part}`, `Description: ${description ?? 'N/A'}`);

    try {
      for (let attempt = 0; attempt <= UI_MAX_RETRIES; attempt++) {
        let res: Response;

        try {
          res = await fetch('/api/ai/classify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ partNumber, description }),
          });
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          addLog('AI_RESPONSE', `Network error — ${part}`, errMsg);
          updateRow(partNumber, { status: 'idle', error: errMsg });
          return;
        }

        if (res.status === 503) {
          if (attempt < UI_MAX_RETRIES) {
            addLog('AI_RETRY_UI', `Retrying part: ${part}`, `Attempt ${attempt + 2}`);
            await new Promise(resolve => setTimeout(resolve, UI_RETRY_DELAY_MS));
            continue;
          }

          updateRow(partNumber, { status: 'idle', error: 'AI busy — try again' });
          return;
        }

        const data = await res.json();

        if (!res.ok) {
          const errMsg: string = data.error ?? `HTTP ${res.status}`;
          addLog('AI_RESPONSE', `Error — ${part}`, errMsg);
          updateRow(partNumber, { status: 'idle', error: errMsg });
          return;
        }

        const pct = (data.confidence * 100).toFixed(0);
        addLog('AI_RESPONSE', `${part} → ${data.category} (${pct}%)`, data.reason);

        const aiCategory = (data.category as CanonicalCategory) ?? 'UNKNOWN';
        const existing = rowsRef.current.find(r => r.partNumber === partNumber);
        const preferredSelection = existing?.selectedCategory
          ? existing.selectedCategory
          : CANONICAL_TO_OPTION[aiCategory] ?? 'OTHER';

        updateRow(partNumber, {
          status: 'suggested',
          aiCategory,
          aiConfidence: data.confidence,
          aiReason: data.reason,
          selectedCategory: preferredSelection,
          error: null,
        });
        return;
      }
    } finally {
      setLoadingRows(prev => {
        if (!prev[partNumber]) return prev;
        const copy = { ...prev };
        delete copy[partNumber];
        return copy;
      });
    }
  };

  // ---------------------------------------------------------------------------
  // Manual selection helpers
  // ---------------------------------------------------------------------------

  const handleCategoryChange = (partNumber: string, categoryValue: string) => {
    if (categoryValue !== '' && !CATEGORY_OPTIONS.includes(categoryValue as CategoryOption)) {
      return;
    }

    const normalized: CategoryOption | '' = categoryValue === '' ? '' : (categoryValue as CategoryOption);
    const existing = rowsRef.current.find(r => r.partNumber === partNumber);
    if (existing && existing.selectedCategory === normalized) {
      return;
    }

    setRows(prev => prev.map(r => r.partNumber === partNumber ? { ...r, selectedCategory: normalized, error: null } : r));
    addLog('USER_MODIFIED', `${partNumber} selection`, normalized || 'Cleared selection');
  };

  const savePattern = async (partNumber: string) => {
    const row = rowsRef.current.find(r => r.partNumber === partNumber);
    if (!row || !row.selectedCategory) {
      updateRow(partNumber, { error: 'Select a category before saving a pattern.' });
      return;
    }

    const patternPrefix = derivePatternPrefix(partNumber);
    if (!patternPrefix) {
      updateRow(partNumber, { error: 'Part number too short for pattern.' });
      return;
    }

    const canonicalCategory = CATEGORY_TO_CANONICAL[row.selectedCategory];
    updateRow(partNumber, { patternSaving: true, error: null });

    try {
      const res = await fetch('/api/ai/patterns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pattern: patternPrefix,
          matchType: 'prefix',
          category: canonicalCategory,
          confidence: 1,
        })
      });

      const data = await res.json();
      if (!res.ok) {
        const detail = data.error ?? 'Unknown error';
        addLog('PATTERN', `Failed to create pattern for ${partNumber}`, detail);
        updateRow(partNumber, { patternSaving: false, error: detail });
        return;
      }

      addLog('PATTERN', `Pattern saved for ${partNumber}`, `${patternPrefix} → ${canonicalCategory}`);
      updateRow(partNumber, { patternSaving: false, patternCreated: true });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      addLog('PATTERN', `Failed to create pattern for ${partNumber}`, detail);
      updateRow(partNumber, { patternSaving: false, error: detail });
    } finally {
      // no-op
    }
  };

  const saveClassification = async (
    partNumber: string,
    category: string,
    confidence: number,
    description: string | null,
    source: 'AI' | 'AI_APPROVED' | 'MANUAL'
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

  const removeRowWithAnimation = (partNumber: string) => {
    if (typeof window !== 'undefined') {
      scrollYRef.current = window.scrollY;
      const rowElement = document.getElementById(`row-${partNumber}`);
      if (rowElement) {
        rowElement.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
        rowElement.style.opacity = '0';
        rowElement.style.transform = 'translateY(-4px)';
      }
    }

    setTimeout(() => {
      setRows(prev => prev.filter(r => r.partNumber !== partNumber));
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          window.scrollTo(0, scrollYRef.current);
        }, 0);
      }
    }, 200);
  };

  const saveRow = async (partNumber: string) => {
    const row = rowsRef.current.find(r => r.partNumber === partNumber);
    if (!row) return;

    if (!row.selectedCategory) {
      updateRow(partNumber, { error: 'Select a category before saving.' });
      return;
    }

    const canonicalCategory = CATEGORY_TO_CANONICAL[row.selectedCategory];
    const matchesAI = row.aiCategory ? canonicalCategory === row.aiCategory : false;
    const resolvedSource = matchesAI ? 'AI_APPROVED' : 'MANUAL';
    const resolvedConfidence = matchesAI && typeof row.aiConfidence === 'number'
      ? row.aiConfidence
      : 1.0;

    addLog('USER_ACTION', `Save requested: ${partNumber}`, `${canonicalCategory} [${resolvedSource}]`);
    updateRow(partNumber, { saving: true, error: null });

    const ok = await saveClassification(
      partNumber,
      canonicalCategory,
      resolvedConfidence,
      row.description,
      resolvedSource
    );

    if (!ok) {
      updateRow(partNumber, { saving: false });
      return;
    }

    setSessionSaved(count => count + 1);
    addLog(
      'CLASSIFICATION_SAVED',
      `part: ${partNumber}`,
      `selected: ${row.selectedCategory} | AI suggested: ${row.aiCategory ?? 'N/A'} | source: ${resolvedSource}`
    );

    removeRowWithAnimation(partNumber);
  };

  const rejectRow = (partNumber: string) => {
    addLog('USER_ACTION', `Reject: ${partNumber} — not stored`);
    updateRow(partNumber, { status: 'rejected', selectedCategory: '' });
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

  const saveHighConfidence = async () => {
    const eligible = rowsRef.current.filter(r => {
      if (r.status !== 'suggested') return false;
      if (!r.selectedCategory || typeof r.aiConfidence !== 'number' || !r.aiCategory) return false;
      const canonical = CATEGORY_TO_CANONICAL[r.selectedCategory];
      return canonical === r.aiCategory && r.aiConfidence >= 0.85;
    });

    if (!eligible.length) return;
    addLog('USER_ACTION', `Batch save: ${eligible.length} rows ≥ 85% confidence`);
    for (const row of eligible) {
      await saveRow(row.partNumber);
    }
  };

  // ---------------------------------------------------------------------------
  // Computed counts
  // ---------------------------------------------------------------------------

  const pending   = rows.filter(r => r.status === 'idle' || r.status === 'rejected').length;
  const suggested = rows.filter(r => r.status === 'suggested').length;
  const saved     = sessionSaved;
  const eligibleForBatchSave = rows.filter(r => {
    if (r.status !== 'suggested') return false;
    if (!r.selectedCategory || typeof r.aiConfidence !== 'number' || !r.aiCategory) return false;
    const canonical = CATEGORY_TO_CANONICAL[r.selectedCategory];
    return canonical === r.aiCategory && r.aiConfidence >= 0.85;
  }).length;

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
              onClick={saveHighConfidence}
              disabled={eligibleForBatchSave === 0}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              💾 Save All ≥ 85% ({eligibleForBatchSave})
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
                      <th className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Decision</th>
                      <th className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.map(row => (
                      <RowItem
                        key={row.partNumber}
                        row={row}
                        analyzeLoading={!!loadingRows[row.partNumber]}
                        onCategoryChange={handleCategoryChange}
                        onSave={saveRow}
                        onAnalyze={analyzeRow}
                        onPatternSave={savePattern}
                        onReject={rejectRow}
                      />
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
