'use client';

import React from 'react';
import type { ActionIntent } from '@/src/features/revision/hooks/useRecommendedFixActions';

type IssueKind = 'missing' | 'conflict' | 'readiness' | 'incomparable' | 'diff';

type CorrectiveContextBannerProps = {
  intent?: ActionIntent | null;
  partNumber?: string | null;
  docType?: string | null;
  expectedRevision?: string | null;
  canonicalSource?: string | null;
  issueType?: IssueKind;
  location?: 'sku' | 'vault';
};

const DOC_TYPE_LABEL: Record<string, string> = {
  BOM: 'BOM',
  CUSTOMER_DRAWING: 'Customer Drawing',
  INTERNAL_DRAWING: 'Internal Drawing',
  APOGEE_DRAWING: 'Apogee Drawing',
  RHEEM_DRAWING: 'Rheem Drawing',
};

const SOURCE_LABEL: Record<string, string> = {
  BOM: 'BOM (Engineering Master)',
  APOGEE: 'Apogee Drawing',
  RHEEM: 'Rheem Drawing',
};

const INTENT_META: Record<ActionIntent, { icon: string; tone: string; title: string }> = {
  VIEW_REVISION: {
    icon: '👁️',
    tone: 'border-blue-200 bg-blue-50 text-blue-900',
    title: 'Contextual revision review',
  },
  FIX_OUT_OF_SYNC: {
    icon: '🛠️',
    tone: 'border-amber-200 bg-amber-50 text-amber-900',
    title: 'Resolving out-of-sync revisions',
  },
  RESOLVE_CONFLICT: {
    icon: '⚔️',
    tone: 'border-red-200 bg-red-50 text-red-900',
    title: 'Resolving revision conflict',
  },
  UPLOAD_MISSING_DOC: {
    icon: '⬆️',
    tone: 'border-amber-200 bg-amber-50 text-amber-900',
    title: 'Uploading missing document',
  },
  REVIEW_INCOMPARABLE: {
    icon: '🔍',
    tone: 'border-purple-200 bg-purple-50 text-purple-900',
    title: 'Normalizing incomparable revisions',
  },
  REVIEW_READINESS: {
    icon: '📋',
    tone: 'border-indigo-200 bg-indigo-50 text-indigo-900',
    title: 'Reviewing readiness blockers',
  },
};

const ISSUE_HINT: Record<IssueKind, string> = {
  missing: 'Focus is limited to missing sources until resolved.',
  conflict: 'Focus is limited to conflicted sources so you can reconcile canonicals first.',
  readiness: 'Highlighting readiness section for immediate action.',
  incomparable: 'Review formatting anomalies before re-ingesting.',
  diff: 'Compare differing revisions side-by-side to sync quickly.',
};

function humanizeDocType(docType?: string | null): string | undefined {
  if (!docType) return undefined;
  const key = docType.toUpperCase();
  return DOC_TYPE_LABEL[key] ?? DOC_TYPE_LABEL[`${key}_DRAWING`] ?? docType;
}

function humanizeSource(source?: string | null): string | undefined {
  if (!source) return undefined;
  return SOURCE_LABEL[source.toUpperCase()] ?? source;
}

export default function CorrectiveContextBanner({
  intent,
  partNumber,
  docType,
  expectedRevision,
  canonicalSource,
  issueType,
  location,
}: CorrectiveContextBannerProps) {
  if (!intent) return null;
  const meta = INTENT_META[intent];
  if (!meta) return null;
  const docLabel = humanizeDocType(docType);
  const sourceLabel = humanizeSource(canonicalSource);
  const chips = Array.from(new Set([
    partNumber ? `Part ${partNumber}` : null,
    docLabel ?? null,
    expectedRevision ? `Expected REV ${expectedRevision}` : null,
    sourceLabel ?? null,
    location ? `${location === 'vault' ? 'Vault' : 'SKU'} workflow` : null,
  ].filter(Boolean) as string[]));

  const issueNote = issueType ? ISSUE_HINT[issueType] : null;

  return (
    <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-sm ${meta.tone}`} role="status" aria-live="polite">
      <span className="text-xl" aria-hidden>
        {meta.icon}
      </span>
      <div className="space-y-1">
        <div className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-widest text-gray-500/80">Prefilled workflow</span>
          <p className="text-base font-semibold">{meta.title}</p>
        </div>
        {issueNote && <p className="text-xs opacity-80">{issueNote}</p>}
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {chips.map(chip => (
              <span key={chip} className="rounded-full bg-white/70 px-2.5 py-0.5 text-[11px] font-semibold text-current">
                {chip}
              </span>
            ))}
          </div>
        )}
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500/80">
          Prefilled from corrective action – review before submitting changes.
        </p>
      </div>
    </div>
  );
}
