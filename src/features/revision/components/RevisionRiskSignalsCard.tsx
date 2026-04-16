import React from 'react';
import type {
  RevisionRiskSummary,
  RevisionRiskSignal,
  RevisionRiskSignalType,
} from '@/src/utils/revisionRiskAnalyzer';

interface RevisionRiskSignalsCardProps {
  risk?: RevisionRiskSummary | null;
  className?: string;
}

const SEVERITY_BADGE: Record<string, string> = {
  HIGH: 'bg-red-600 text-white',
  MEDIUM: 'bg-amber-500 text-white',
  LOW: 'bg-blue-600 text-white',
  NONE: 'bg-gray-300 text-gray-700',
};

const SIGNAL_LABEL: Record<RevisionRiskSignalType, { title: string; description: string }> = {
  REPEATED_OVERRIDE: {
    title: 'Repeated Overrides',
    description: 'Manual overrides are being used frequently to bypass validation',
  },
  FREQUENT_OUTDATED_UPLOADS: {
    title: 'Frequent Outdated Uploads',
    description: 'Uploads often contain revisions that are behind the expected baseline',
  },
  FREQUENT_CONFLICT_UPLOADS: {
    title: 'Frequent Conflicts',
    description: 'Uploads regularly arrive ahead of canonical or incomparable to it',
  },
  WEAK_REVISION_DETECTION: {
    title: 'Weak Revision Detection',
    description: 'Extractors struggle to capture revisions reliably for recent uploads',
  },
  LOW_SOURCE_RELIABILITY: {
    title: 'Low Source Reliability',
    description: 'One or more extraction paths are responsible for most validation issues',
  },
  RECENT_MANUAL_OVERRIDE: {
    title: 'Recent Manual Override',
    description: 'Most recent uploads required an override to proceed',
  },
  CHRONIC_INCOMPLETE_COVERAGE: {
    title: 'Chronic Incomplete Coverage',
    description: 'Uploads arrive without expected revision context or comparable sources',
  },
};

const STAT_LABELS: { key: keyof RevisionRiskSummary['stats']; label: string }[] = [
  { key: 'override_count', label: 'Overrides' },
  { key: 'outdated_upload_count', label: 'Outdated' },
  { key: 'conflict_upload_count', label: 'Conflicts' },
  { key: 'weak_detection_count', label: 'Weak Detection' },
];

function formatSignal(signal: RevisionRiskSignal): React.ReactNode {
  const meta = SIGNAL_LABEL[signal.signal_type];
  return (
    <li
      key={signal.signal_type}
      className="rounded-xl border border-[color:var(--panel-border)] bg-white/70 dark:bg-slate-700/60 px-4 py-3 shadow-sm"
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-gray-900">
          {meta?.title ?? signal.signal_type.replace(/_/g, ' ')}
        </p>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${SEVERITY_BADGE[signal.severity]}`}>
          {signal.severity}
        </span>
        <span className="text-xs text-gray-500">Count: {signal.count}</span>
      </div>
      <p className="mt-1 text-sm text-gray-700">{signal.rationale}</p>
      {signal.affected_sources && signal.affected_sources.length > 0 && (
        <p className="mt-1 text-xs font-semibold text-gray-500">
          Sources: {signal.affected_sources.join(', ')}
        </p>
      )}
      {meta?.description && (
        <p className="mt-2 text-xs text-gray-500">{meta.description}</p>
      )}
    </li>
  );
}

export default function RevisionRiskSignalsCard({ risk, className = '' }: RevisionRiskSignalsCardProps) {
  if (!risk) {
    return (
      <section className={`rounded-2xl border border-dashed border-[color:var(--panel-border)] bg-[color:var(--surface-elevated)] p-4 text-sm text-gray-500 ${className}`}>
        Historical revision risk not yet available. Upload history will populate this view.
      </section>
    );
  }

  const aggregate = risk.aggregate_level ?? 'NONE';
  const hasSignals = risk.signals.length > 0;
  const insufficientHistory = !risk.sufficient_history && !hasSignals;
  const lookbackLabel = `Last ${risk.lookback.uploads_considered} uploads (~${risk.lookback.days} days)`;
  const cutoffLabel = new Date(risk.lookback.cutoff).toLocaleDateString();

  return (
    <section className={`rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--surface-elevated)] p-5 shadow-sm space-y-4 ${className}`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <p className="text-xs uppercase tracking-[0.35em] text-gray-500">Historical Revision Risk</p>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">{aggregate === 'NONE' ? 'No active signals' : `${aggregate} risk`}</h2>
            <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${SEVERITY_BADGE[aggregate] ?? SEVERITY_BADGE.NONE}`}>
              {aggregate}
            </span>
          </div>
          <p className="text-xs text-gray-500">{lookbackLabel} · cutoff {cutoffLabel}</p>
        </div>
        <div className="text-xs text-gray-500">
          <p>Total uploads: {risk.stats.total_uploads}</p>
          <p>Considered: {risk.stats.considered_uploads}</p>
        </div>
      </div>

      {!hasSignals && !insufficientHistory && (
        <p className="text-sm text-gray-700">
          No recurring risk patterns detected within the current lookback window. Continue monitoring uploads for drift.
        </p>
      )}

      {insufficientHistory && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Not enough upload history ({risk.lookback.uploads_considered} events) to derive trend-based risk signals yet.
        </div>
      )}

      {hasSignals && (
        <ul className="space-y-3">
          {risk.signals.slice(0, 3).map(formatSignal)}
        </ul>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STAT_LABELS.map(({ key, label }) => (
          <div key={key} className="rounded-xl border border-[color:var(--panel-border)] bg-[color:var(--surface-elevated)] px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
            <p className="text-xl font-semibold text-[color:var(--text-primary)]">{risk.stats[key]}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
