import React, { useEffect, useMemo, useState } from 'react';
import type { CrossSourceValidationResult } from '@/src/utils/revisionCrossValidator';
import type { RevisionRiskSummary } from '@/src/utils/revisionRiskAnalyzer';
import type { ExpectedDrawingSummary } from '@/src/features/harness-work-instructions/services/skuService';
import type { ReadinessTier, ConfidenceFactor } from '@/src/utils/skuReadinessEvaluator';
import RevisionStatusBadge from './RevisionStatusBadge';
import { useRecommendedFixActions } from '@/src/features/revision/hooks/useRecommendedFixActions';
import type { ActionIntent } from '@/src/features/revision/hooks/useRecommendedFixActions';

const SOURCE_LABEL: Record<string, { title: string; description: string }> = {
  BOM: { title: 'BOM (Engineering Master)', description: 'Header explicit identifier' },
  APOGEE: { title: 'Apogee Drawing', description: 'Revision record box (527-XXXX-010)' },
  RHEEM: { title: 'Rheem Drawing', description: "Title block 'REV PART NO.'" },
};

const COMPARISON_ICON: Record<string, string> = {
  CANONICAL: '⭐',
  EQUAL: '✅',
  GREATER: '⬆️',
  LESS: '⬇️',
  MISSING: '—',
  INCOMPARABLE: '❓',
  NO_CANONICAL: '…',
};

const FOCUS_LABELS: Record<string, { title: string; description: string }> = {
  diff: { title: 'Out-of-sync focus', description: 'Compare BOM vs. drawings to align revisions.' },
  conflict: { title: 'Conflict focus', description: 'Resolve competing canonical sources before proceeding.' },
  review: { title: 'Manual review focus', description: 'Normalize incomparable revisions or escalate for manual review.' },
};

const READINESS_TIER_LABEL: Record<ReadinessTier, string> = {
  READY: 'Ready',
  READY_WITH_WARNINGS: 'Ready with warnings',
  INCOMPLETE: 'Incomplete — missing required inputs',
  BLOCKED: 'Blocked — revision conflict',
};

const READINESS_TIER_STYLE: Record<ReadinessTier, string> = {
  READY: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  READY_WITH_WARNINGS: 'bg-amber-50 text-amber-700 border-amber-200',
  INCOMPLETE: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  BLOCKED: 'bg-red-50 text-red-700 border-red-200',
};

function confidenceDot(score: number): string {
  if (score >= 90) return '🟢';
  if (score >= 70) return '🟡';
  if (score >= 50) return '🟠';
  return '🔴';
}

function confidenceLabel(score: number): string {
  if (score >= 90) return 'High confidence';
  if (score >= 70) return 'Moderate confidence';
  if (score >= 50) return 'Low confidence';
  return 'Very low confidence';
}

const DRAWING_SOURCE_LABEL: Record<string, string> = {
  drawing_lookup: 'Drawing lookup (CSV)',
  sku_documents: 'Vault documents',
  fallback: 'Not available',
};

const RISK_BADGE: Record<string, string> = {
  HIGH: 'bg-red-50 text-red-700 border border-red-200',
  MEDIUM: 'bg-amber-50 text-amber-700 border border-amber-200',
  LOW: 'bg-blue-50 text-blue-700 border border-blue-200',
  NONE: 'bg-gray-100 text-gray-600 border border-gray-200',
};

interface Props {
  validation?: CrossSourceValidationResult | null;
  className?: string;
  partNumber?: string | null;
  focusIntent?: string | null;
  highlight?: boolean;
  expectedRevisionHint?: string | null;
  canonicalSourceHint?: string | null;
  actionIntent?: ActionIntent | null;
  defaultExpanded?: boolean;
  riskSummary?: RevisionRiskSummary | null;
  expectedDrawings?: ExpectedDrawingSummary | null;
  readinessTier?: ReadinessTier | null;
  confidenceScore?: number | null;
  confidenceFactors?: ConfidenceFactor[] | null;
}

export default function RevisionSummaryCard({
  validation,
  className = '',
  partNumber,
  focusIntent,
  highlight = false,
  expectedRevisionHint,
  canonicalSourceHint,
  actionIntent,
  defaultExpanded = false,
  riskSummary,
  expectedDrawings,
  readinessTier,
  confidenceScore,
  confidenceFactors,
}: Props) {
  const [showDetails, setShowDetails] = useState(Boolean(defaultExpanded));
  const [showFactors, setShowFactors] = useState(false);

  useEffect(() => {
    if (defaultExpanded) {
      setShowDetails(true);
    }
  }, [defaultExpanded]);

  useEffect(() => {
    if (!actionIntent) return;
    if (actionIntent === 'RESOLVE_CONFLICT' || actionIntent === 'FIX_OUT_OF_SYNC' || actionIntent === 'REVIEW_INCOMPARABLE') {
      setShowDetails(true);
    }
  }, [actionIntent]);

  if (!validation) {
    return (
      <section className={`rounded-2xl border border-dashed border-[color:var(--panel-border)] bg-[color:var(--surface-elevated)] p-4 text-sm text-gray-500 ${className}`}>
        Revision status unavailable. Upload documents to begin validation.
      </section>
    );
  }

  const { status, canonical_revision, canonical_source, recommended_action, sources, comparisons, details, signals_used } = validation;
  const actions = useRecommendedFixActions({ partNumber, revisionValidation: validation });
  const focusKey = focusIntent ? focusIntent.toLowerCase() : null;
  const focusInfo = focusKey ? FOCUS_LABELS[focusKey] ?? null : null;
  const highlightClasses = highlight ? 'ring-2 ring-blue-300 shadow-lg shadow-blue-100 animate-pulse' : '';
  const expectedMatchesCanonical = useMemo(() => {
    if (!expectedRevisionHint || !canonical_revision) return true;
    return expectedRevisionHint.toUpperCase() === canonical_revision.toUpperCase();
  }, [expectedRevisionHint, canonical_revision]);
  const canonicalSourceLabel = canonical_source ? SOURCE_LABEL[canonical_source]?.title ?? canonical_source : null;
  const hintSourceLabel = canonicalSourceHint ? SOURCE_LABEL[canonicalSourceHint]?.title ?? canonicalSourceHint : null;
  const riskLevel = riskSummary?.aggregate_level ?? 'NONE';
  const showRiskBadge = Boolean(riskSummary && riskSummary.aggregate_level && riskSummary.aggregate_level !== 'NONE');
  const primaryRiskSignal = riskSummary?.signals?.[0];
  const expectedApogeeDrawing = expectedDrawings?.apogee?.drawing_number ?? null;
  const expectedDrawingSource = expectedDrawings?.apogee?.source ?? null;
  const tierLabel = readinessTier ? READINESS_TIER_LABEL[readinessTier] : null;
  const tierStyle = readinessTier ? READINESS_TIER_STYLE[readinessTier] : null;
  const hasConfidence = typeof confidenceScore === 'number';

  return (
    <section className={`rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--surface-elevated)] p-5 shadow-sm space-y-4 ${highlightClasses} ${className}`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <p className="text-xs uppercase tracking-[0.4em] text-gray-500">Revision Validation</p>
          {tierLabel && tierStyle && (
            <div className="flex items-center gap-1.5 flex-wrap mb-1">
              <span className={`inline-block rounded border px-2 py-0.5 text-[11px] font-semibold ${tierStyle}`}>
                {tierLabel}
              </span>
              {hasConfidence && (
                <span className="text-[11px] text-gray-500 font-medium">
                  {confidenceDot(confidenceScore!)} {confidenceScore}%
                </span>
              )}
            </div>
          )}
          <h2 className="text-xl font-semibold text-gray-900">Canonical Revision {canonical_revision ?? '—'}</h2>
          <p className="text-sm text-gray-600">
            {canonical_source ? `Source: ${SOURCE_LABEL[canonical_source]?.title ?? canonical_source}` : 'No canonical source selected'}
          </p>
          {hasConfidence && (
            <p className="text-xs text-gray-500 mt-0.5">
              {confidenceDot(confidenceScore!)} {confidenceScore}% — {confidenceLabel(confidenceScore!)}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <RevisionStatusBadge status={status} />
          {showRiskBadge && (
            <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${RISK_BADGE[riskLevel] ?? RISK_BADGE.NONE}`}>
              Historical Risk · {riskLevel}
            </span>
          )}
        </div>
      </div>

      {expectedRevisionHint && (
        <div
          className={`rounded-xl border px-3 py-2 text-xs ${expectedMatchesCanonical ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-red-200 bg-red-50 text-red-900'}`}
        >
          <p className="font-semibold">
            Expected revision {expectedRevisionHint}
            {hintSourceLabel && ` · ${hintSourceLabel}`}
          </p>
          {!expectedMatchesCanonical && canonical_revision && (
            <p className="text-[11px]">
              Canonical currently {canonical_revision}
              {canonicalSourceLabel && ` (${canonicalSourceLabel})`}. Update other sources to match before submitting.
            </p>
          )}
          {expectedMatchesCanonical && <p className="text-[11px]">Canonical already aligned — use this as confirmation when updating sources.</p>}
        </div>
      )}

      {focusInfo && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          <p className="font-semibold">{focusInfo.title}</p>
          <p className="text-[11px] text-blue-700">{focusInfo.description}</p>
        </div>
      )}

      <p className="text-sm text-gray-700">{recommended_action}</p>

      {hasConfidence && confidenceFactors && confidenceFactors.length > 0 && (
        <div className="rounded-xl border border-[color:var(--panel-border)] bg-[color:var(--surface-elevated)] px-3 py-2 text-xs">
          <button
            type="button"
            onClick={() => setShowFactors(v => !v)}
            className="flex items-center gap-1.5 font-semibold text-gray-700 hover:text-gray-900 w-full text-left"
          >
            <span>{confidenceDot(confidenceScore!)} {confidenceScore}% confidence — {confidenceLabel(confidenceScore!)}</span>
            <span className="ml-auto text-gray-400">{showFactors ? '▲' : '▼'}</span>
          </button>
          {showFactors && (
            <ul className="mt-2 space-y-1">
              {confidenceFactors.map(factor => (
                <li key={factor.code} className="flex justify-between items-baseline gap-2 text-gray-700">
                  <span>{factor.description}</span>
                  <span className="shrink-0 font-semibold text-red-600">{factor.impact}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {showRiskBadge && primaryRiskSignal && (
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <p className="font-semibold">Historical pattern: {primaryRiskSignal.signal_type.replace(/_/g, ' ')}</p>
          <p className="mt-0.5 text-amber-900/90">{primaryRiskSignal.rationale}</p>
        </div>
      )}

      <div className="rounded-xl border border-[color:var(--panel-border)] bg-[color:var(--surface-elevated)] px-3 py-2 text-xs text-gray-800">
        <p className="font-semibold">Expected Apogee Drawing</p>
        <p className="mt-0.5 text-sm text-gray-900">{expectedApogeeDrawing ?? 'Not available'}</p>
        {expectedDrawingSource && (
          <p className="text-[11px] text-gray-500">
            Source: {DRAWING_SOURCE_LABEL[expectedDrawingSource] ?? expectedDrawingSource}
          </p>
        )}
      </div>

      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {actions.slice(0, 2).map(action => (
            action.href ? (
              <a
                key={action.id}
                href={action.href}
                className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold ${action.severity === 'danger' ? 'bg-red-600 text-white hover:bg-red-700' : action.severity === 'warning' ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
              >
                {action.label}
              </a>
            ) : (
              <button
                key={action.id}
                type="button"
                className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold cursor-not-allowed opacity-70 ${action.severity === 'danger' ? 'bg-red-600 text-white' : action.severity === 'warning' ? 'bg-amber-500 text-white' : 'bg-blue-600 text-white'}`}
                disabled
              >
                {action.label}
              </button>
            )
          ))}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        {(['BOM', 'APOGEE', 'RHEEM'] as const).map(key => {
          const snapshot = sources?.[key];
          const comparison = comparisons?.find(entry => entry.source === key)?.comparison ?? 'MISSING';
          const icon = COMPARISON_ICON[comparison] ?? '•';
          const title = SOURCE_LABEL[key]?.title ?? key;
          const note = SOURCE_LABEL[key]?.description;
          const emphasize = (() => {
            if (!focusKey) return false;
            if (focusKey === 'conflict') return comparison === 'GREATER' || comparison === 'LESS';
            if (focusKey === 'diff') return comparison === 'GREATER' || comparison === 'LESS';
            if (focusKey === 'review') return comparison === 'INCOMPARABLE';
            return false;
          })();
          return (
            <div
              key={key}
              className={`rounded-xl border bg-[color:var(--surface-elevated)] p-3 ${emphasize ? 'border-blue-300 ring-1 ring-blue-200 shadow-sm' : 'border-[color:var(--panel-border)]'}`}
            >
              <p className="text-xs uppercase tracking-widest text-gray-500">{title}</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl" aria-hidden>{icon}</span>
                <p className="text-lg font-semibold text-gray-900">{snapshot?.revision ?? '—'}</p>
              </div>
              <p className="text-xs text-gray-500">{note}</p>
              {comparison === 'GREATER' && <p className="text-xs text-red-600 font-medium mt-1">Ahead of canonical</p>}
              {comparison === 'LESS' && <p className="text-xs text-amber-600 font-medium mt-1">Behind canonical</p>}
              {comparison === 'INCOMPARABLE' && <p className="text-xs text-orange-600 font-medium mt-1">Incomparable</p>}
              {comparison === 'MISSING' && <p className="text-xs text-gray-500 mt-1">Missing</p>}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setShowDetails(v => !v)}
        className="text-sm font-semibold text-blue-600 hover:text-blue-700"
      >
        {showDetails ? 'Hide details' : 'Show details'}
      </button>

      {showDetails && (
        <div className="space-y-3 text-sm text-gray-700">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Comparisons</p>
            {details?.length ? (
              <ul className="list-disc pl-4 space-y-1">
                {details.map((detail, idx) => (
                  <li key={`${detail}-${idx}`}>{detail}</li>
                ))}
              </ul>
            ) : (
              <p>All authoritative sources aligned.</p>
            )}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Signals Used</p>
            {signals_used?.length ? (
              <div className="flex flex-wrap gap-2">
                {signals_used.map(signal => (
                  <span key={signal} className="rounded-full bg-[color:var(--panel-bg)] px-3 py-1 text-xs font-semibold text-[color:var(--text-secondary)]">
                    {signal}
                  </span>
                ))}
              </div>
            ) : (
              <p>No authoritative extraction signals recorded.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
