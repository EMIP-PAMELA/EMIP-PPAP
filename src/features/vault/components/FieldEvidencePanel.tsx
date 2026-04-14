'use client';

/**
 * FieldEvidencePanel — Phase 3H.49 C11.1
 *
 * Compact collapsible evidence transparency panel for a single resolved field.
 * Explains to the operator why a specific value was chosen: which source won,
 * what competing candidates existed, and what evidence supported the winner.
 *
 * Governance:
 *   - Read-only display. Does NOT affect field resolution or operator authority.
 *   - Additive only. Does not replace any existing UI element.
 *   - Badge colors match AUTHORITY_SOURCE_BADGES in UploadWorkbench (kept in sync).
 */

import React, { useState } from 'react';
import type {
  ResolvedField,
  FieldAuthoritySource,
  FieldCandidate,
} from '@/src/features/harness-work-instructions/services/fieldAuthorityResolver';

// ---------------------------------------------------------------------------
// Badge map — intentionally matches AUTHORITY_SOURCE_BADGES in UploadWorkbench
// ---------------------------------------------------------------------------

const AUTHORITY_BADGE: Record<FieldAuthoritySource, { label: string; className: string }> = {
  OPERATOR_CONFIRMED: { label: 'Confirmed by Operator', className: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  PARSED_DRAWING:     { label: 'Parsed Drawing',        className: 'bg-blue-100 text-blue-800 border-blue-300' },
  ADAPTIVE_VECTOR:    { label: 'Adaptive Vector',       className: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
  INTERPRETATION:     { label: 'Interpretation',        className: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  AI_ASSIST:          { label: 'AI Assist',             className: 'bg-purple-100 text-purple-900 border-purple-200' },
  HEURISTIC:          { label: 'Heuristic',             className: 'bg-amber-100 text-amber-900 border-amber-200' },
  FILENAME:           { label: 'From Filename',         className: 'bg-gray-100 text-gray-700 border-gray-200' },
  UNKNOWN:            { label: 'Unknown Source',        className: 'bg-gray-100 text-gray-600 border-gray-200' },
  TITLE_BLOCK_REGION: { label: 'Title Block Region',    className: 'bg-violet-100 text-violet-800 border-violet-300' },
  REVISION_REGION:    { label: 'Revision Record',       className: 'bg-rose-100 text-rose-800 border-rose-300' },
};

// ---------------------------------------------------------------------------
// Smart default-open heuristic
// ---------------------------------------------------------------------------

function computeDefaultOpen(resolved: ResolvedField | null | undefined, override?: boolean): boolean {
  if (override !== undefined) return override;
  if (!resolved) return false;
  if (resolved.source === 'UNKNOWN') return false;
  if (resolved.source === 'AI_ASSIST') return true;
  if (resolved.confidence < 0.75) return true;
  if (resolved.competingCandidates.length > 1) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Sub-component: single candidate row
// ---------------------------------------------------------------------------

function CandidateRow({ candidate, isWinner }: { candidate: FieldCandidate; isWinner: boolean }) {
  const badge = AUTHORITY_BADGE[candidate.source];
  const pct = typeof candidate.confidence === 'number'
    ? `${Math.round(candidate.confidence * 100)}%`
    : '—';
  return (
    <div className={`rounded border px-2 py-1.5 flex items-center justify-between gap-2 ${
      isWinner ? 'border-gray-200 bg-white' : 'border-gray-100 bg-white opacity-65'
    }`}>
      <span className={`font-mono text-[11px] truncate ${isWinner ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
        {candidate.value}
      </span>
      <div className="shrink-0 flex items-center gap-1.5">
        <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${badge.className}`}>
          {badge.label}
        </span>
        <span className="text-[10px] text-gray-400 tabular-nums">{pct}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface FieldEvidencePanelProps {
  label: string;
  resolved: ResolvedField | null | undefined;
  isOpenByDefault?: boolean;
}

export default function FieldEvidencePanel({
  label,
  resolved,
  isOpenByDefault,
}: FieldEvidencePanelProps) {
  const [open, setOpen] = useState(() => computeDefaultOpen(resolved, isOpenByDefault));

  const hasValue = Boolean(resolved?.value);
  const badge = AUTHORITY_BADGE[resolved?.source ?? 'UNKNOWN'];
  const confidencePct = typeof resolved?.confidence === 'number'
    ? `${Math.round(resolved.confidence * 100)}%`
    : '—';

  const winner = resolved
    ? { field: resolved.field, value: resolved.value!, source: resolved.source, confidence: resolved.confidence, evidence: resolved.evidence }
    : null;

  const otherCandidates: FieldCandidate[] = (resolved?.competingCandidates ?? []).filter(
    c => !(c.value === resolved?.value && c.source === resolved?.source),
  );

  if (!resolved || (resolved.source === 'UNKNOWN' && !resolved.value && otherCandidates.length === 0)) {
    return null;
  }

  return (
    <details
      open={open}
      onToggle={e => setOpen((e.target as HTMLDetailsElement).open)}
      className="mt-1.5"
    >
      <summary className="cursor-pointer list-none flex items-center gap-1 text-[10px] font-medium text-blue-600 hover:text-blue-800 select-none w-fit">
        Why this value?
        <span className="text-[9px]">{open ? '▲' : '▾'}</span>
      </summary>

      {open && (
        <div className="mt-1.5 rounded-lg border border-gray-200 bg-gray-50/80 p-2 space-y-2 text-[11px]">

          {/* ── Section A: Selected winner ─────────────────────────────── */}
          <div className="space-y-1">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Selected · {label}</p>

            {hasValue && winner ? (
              <div className="rounded border border-gray-200 bg-white px-2 py-1.5 space-y-1.5">
                {/* Value + source badge */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-mono font-semibold text-gray-900 break-all">{winner.value}</span>
                  <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${badge.className}`}>
                    {badge.label}
                  </span>
                </div>
                {/* Confidence */}
                <div className="text-[10px] text-gray-500">
                  Confidence: <span className="font-semibold tabular-nums">{confidencePct}</span>
                </div>
                {/* Evidence bullets */}
                {winner.evidence.length > 0 ? (
                  <ul className="pl-3 space-y-0.5">
                    {winner.evidence.map((ev, i) => (
                      <li key={i} className="list-disc text-gray-500">{ev}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[10px] text-gray-400 italic">No evidence details available</p>
                )}
                {/* Operator lock note */}
                {resolved!.source === 'OPERATOR_CONFIRMED' && (
                  <p className="text-[10px] text-emerald-700 font-semibold">
                    🔒 Confirmed by operator — overrides all other sources.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-gray-400 italic px-1 py-0.5">No resolved value</p>
            )}
          </div>

          {/* ── Section B: Other candidates ───────────────────────────── */}
          <div className="space-y-1">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Other candidates</p>
            {otherCandidates.length > 0 ? (
              otherCandidates.map((c, i) => (
                <CandidateRow key={`${c.value}-${c.source}-${i}`} candidate={c} isWinner={false} />
              ))
            ) : (
              <p className="text-[10px] text-gray-400 italic pl-1">No competing candidates</p>
            )}
          </div>

        </div>
      )}
    </details>
  );
}
