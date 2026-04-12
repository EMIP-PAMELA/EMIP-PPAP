import React, { useState } from 'react';
import type { CrossSourceValidationResult } from '@/src/utils/revisionCrossValidator';
import RevisionStatusBadge from './RevisionStatusBadge';
import { useRecommendedFixActions } from '@/src/features/revision/hooks/useRecommendedFixActions';

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

interface Props {
  validation?: CrossSourceValidationResult | null;
  className?: string;
  partNumber?: string | null;
  focusIntent?: string | null;
  highlight?: boolean;
}

export default function RevisionSummaryCard({ validation, className = '', partNumber, focusIntent, highlight = false }: Props) {
  const [showDetails, setShowDetails] = useState(false);

  if (!validation) {
    return (
      <section className={`rounded-2xl border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-500 ${className}`}>
        Revision status unavailable. Upload documents to begin validation.
      </section>
    );
  }

  const { status, canonical_revision, canonical_source, recommended_action, sources, comparisons, details, signals_used } = validation;
  const actions = useRecommendedFixActions({ partNumber, revisionValidation: validation });
  const focusKey = focusIntent ? focusIntent.toLowerCase() : null;
  const focusInfo = focusKey ? FOCUS_LABELS[focusKey] ?? null : null;
  const highlightClasses = highlight ? 'ring-2 ring-blue-300 shadow-lg shadow-blue-100 animate-pulse' : '';

  return (
    <section className={`rounded-2xl border bg-white p-5 shadow-sm space-y-4 ${highlightClasses} ${className}`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <p className="text-xs uppercase tracking-[0.4em] text-gray-500">Revision Validation</p>
          <h2 className="text-xl font-semibold text-gray-900">Canonical Revision {canonical_revision ?? '—'}</h2>
          <p className="text-sm text-gray-600">
            {canonical_source ? `Source: ${SOURCE_LABEL[canonical_source]?.title ?? canonical_source}` : 'No canonical source selected'}
          </p>
        </div>
        <RevisionStatusBadge status={status} />
      </div>

      {focusInfo && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          <p className="font-semibold">{focusInfo.title}</p>
          <p className="text-[11px] text-blue-700">{focusInfo.description}</p>
        </div>
      )}

      <p className="text-sm text-gray-700">{recommended_action}</p>

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
          return (
            <div key={key} className="rounded-xl border border-gray-200 bg-gray-50/70 p-3">
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
                  <span key={signal} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
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
