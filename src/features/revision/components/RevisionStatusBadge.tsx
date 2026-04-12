import React from 'react';
import type { CrossSourceRevisionStatus } from '@/src/utils/revisionCrossValidator';

const STATUS_STYLES: Record<CrossSourceRevisionStatus, { tone: string; label: string }> = {
  SYNCHRONIZED: {
    tone: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
    label: 'Synchronized',
  },
  OUT_OF_SYNC: {
    tone: 'bg-amber-100 text-amber-800 border border-amber-200',
    label: 'Out of Sync',
  },
  CONFLICT: {
    tone: 'bg-red-100 text-red-700 border border-red-200',
    label: 'Conflict',
  },
  INCOMPLETE: {
    tone: 'bg-gray-100 text-gray-600 border border-gray-200',
    label: 'Incomplete',
  },
  INCOMPARABLE: {
    tone: 'bg-blue-100 text-blue-800 border border-blue-200',
    label: 'Incomparable',
  },
};

const DEFAULT_STYLE = {
  tone: 'bg-gray-100 text-gray-500 border border-gray-200',
  label: 'Status Unknown',
};

export interface RevisionStatusBadgeProps {
  status?: CrossSourceRevisionStatus | null;
  showLabel?: boolean;
  labelPrefix?: string;
  loading?: boolean;
  className?: string;
}

export default function RevisionStatusBadge({
  status,
  showLabel = true,
  labelPrefix,
  loading = false,
  className = '',
}: RevisionStatusBadgeProps) {
  const config = status ? STATUS_STYLES[status] : DEFAULT_STYLE;
  const label = loading ? 'Checking…' : config.label;
  const text = showLabel ? (labelPrefix ? `${labelPrefix}: ${label}` : label) : labelPrefix ?? '';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${config.tone} ${className}`.trim()}
      aria-live="polite"
    >
      {!loading && status === 'SYNCHRONIZED' && '✅'}
      {!loading && status === 'OUT_OF_SYNC' && '⚠️'}
      {!loading && status === 'CONFLICT' && '🛑'}
      {!loading && status === 'INCOMPLETE' && '⏳'}
      {!loading && status === 'INCOMPARABLE' && '❓'}
      {loading && '…'}
      {showLabel && <span>{text}</span>}
      {!showLabel && labelPrefix && <span>{labelPrefix}</span>}
    </span>
  );
}
