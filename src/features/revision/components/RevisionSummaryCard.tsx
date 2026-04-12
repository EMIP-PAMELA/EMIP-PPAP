import React, { useState } from 'react';
import type { CrossSourceValidationResult } from '@/src/utils/revisionCrossValidator';
import RevisionStatusBadge from './RevisionStatusBadge';

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

interface Props {
  validation?: CrossSourceValidationResult | null;
  className?: string;
}

export default function RevisionSummaryCard({ validation, className = '' }: Props) {
  const [showDetails, setShowDetails] = useState(false);

  if (!validation) {
    return (
      <section className={`rounded-2xl border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-500 ${className}`}>
        Revision status unavailable. Upload documents to begin validation.
      </section>
    );
  }

  const { status, canonical_revision, canonical_source, recommended_action, sources, comparisons, details, signals_used } = validation;

  return (
    <section className={`rounded-2xl border bg-white p-5 shadow-sm space-y-4 ${className}`}>
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

      <p className="text-sm text-gray-700">{recommended_action}</p>

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
