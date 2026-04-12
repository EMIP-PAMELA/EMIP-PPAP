'use client';

import { useMemo, useState } from 'react';
import type { SKUReadinessResult, ReadinessTier } from '@/src/utils/skuReadinessEvaluator';
import type { CrossSourceValidationResult } from '@/src/utils/revisionCrossValidator';
import type { RevisionRiskSummary } from '@/src/utils/revisionRiskAnalyzer';
import RevisionSummaryCard from '@/src/features/revision/components/RevisionSummaryCard';
import { useRecommendedFixActions } from '@/src/features/revision/hooks/useRecommendedFixActions';
import type { ExpectedDrawingSummary } from '@/src/features/harness-work-instructions/services/skuService';

interface IssueEntry {
  scope: string;
  message: string;
  recommended: string;
  type: 'blocker' | 'warning';
}

interface LinkOrButtonProps {
  action: ReturnType<typeof useRecommendedFixActions>[number];
}

function LinkOrButton({ action }: LinkOrButtonProps) {
  const tone = action.severity === 'danger'
    ? 'bg-red-600 text-white hover:bg-red-700'
    : action.severity === 'warning'
      ? 'bg-amber-500 text-white hover:bg-amber-600'
      : 'bg-blue-600 text-white hover:bg-blue-700';

  if (action.href) {
    return (
      <a
        href={action.href}
        className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold shadow ${tone}`}
      >
        {action.label}
      </a>
    );
  }

  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold shadow ${tone}`}
      disabled
    >
      {action.label}
    </button>
  );
}

interface PPAPStatusBannerProps {
  partNumber?: string | null;
  readiness: SKUReadinessResult | null;
  revisionValidation: CrossSourceValidationResult | null;
  revisionRisk?: RevisionRiskSummary | null;
  expectedDrawings?: ExpectedDrawingSummary | null;
  loading: boolean;
  error: string | null;
}

const TONE = {
  ready: {
    container: 'border-emerald-200 bg-emerald-50',
    badge: 'bg-emerald-600 text-white',
    label: 'PPAP READY',
    icon: '✅',
  },
  risk: {
    container: 'border-amber-200 bg-amber-50',
    badge: 'bg-amber-500 text-white',
    label: 'PPAP AT RISK',
    icon: '⚠️',
  },
  blocked: {
    container: 'border-red-300 bg-red-50',
    badge: 'bg-red-600 text-white',
    label: 'PPAP BLOCKED',
    icon: '🛑',
  },
  unknown: {
    container: 'border-gray-200 bg-gray-100',
    badge: 'bg-gray-400 text-white',
    label: 'Readiness Unknown',
    icon: 'ℹ️',
  },
};

const TIER_LABEL: Record<ReadinessTier, string> = {
  READY: 'Ready',
  READY_WITH_WARNINGS: 'Ready with warnings',
  INCOMPLETE: 'Incomplete — missing required inputs',
  BLOCKED: 'Blocked — revision conflict',
};

const TIER_BADGE: Record<ReadinessTier, string> = {
  READY: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  READY_WITH_WARNINGS: 'bg-amber-50 text-amber-700 border border-amber-200',
  INCOMPLETE: 'bg-yellow-50 text-yellow-800 border border-yellow-200',
  BLOCKED: 'bg-red-50 text-red-700 border border-red-200',
};

function confidenceDot(score: number): string {
  if (score >= 90) return '🟢';
  if (score >= 70) return '🟡';
  if (score >= 50) return '🟠';
  return '🔴';
}

function collectIssues(readiness: SKUReadinessResult | null): { blockers: IssueEntry[]; warnings: IssueEntry[] } {
  if (!readiness) return { blockers: [], warnings: [] };

  const outputs = [
    { scope: 'Work Instructions', data: readiness.work_instructions },
    { scope: 'Traveler Package', data: readiness.traveler_package },
    { scope: 'Komax / Cut Sheet', data: readiness.komax_cut_sheet },
  ];

  const blockers: IssueEntry[] = [];
  const warnings: IssueEntry[] = [];

  outputs.forEach(({ scope, data }) => {
    if (!data) return;
    data.blockers.forEach(message => blockers.push({ scope, message, recommended: data.recommended_action, type: 'blocker' }));
    data.warnings.forEach(message => warnings.push({ scope, message, recommended: data.recommended_action, type: 'warning' }));
  });

  return { blockers, warnings };
}

export default function PPAPStatusBanner({
  partNumber,
  readiness,
  revisionValidation,
  revisionRisk,
  expectedDrawings,
  loading,
  error,
}: PPAPStatusBannerProps) {
  const [showDetails, setShowDetails] = useState(false);

  const { blockers, warnings } = useMemo(() => collectIssues(readiness), [readiness]);
  const primaryIssue = blockers[0] ?? warnings[0] ?? null;
  const totalIssues = blockers.length + warnings.length;
  const additionalCount = primaryIssue ? totalIssues - 1 : 0;

  const actions = useRecommendedFixActions({ partNumber, readiness, revisionValidation });

  const statusTone = (() => {
    if (loading) return TONE.unknown;
    if (error || !readiness) return TONE.unknown;
    const tier = readiness.readiness_tier;
    if (tier === 'BLOCKED') return TONE.blocked;
    if (tier === 'INCOMPLETE' || tier === 'READY_WITH_WARNINGS') return TONE.risk;
    if (tier === 'READY') return TONE.ready;
    if (blockers.length > 0 || readiness.overall_status === 'BLOCKED') return TONE.blocked;
    if (warnings.length > 0 || readiness.overall_status === 'PARTIAL') return TONE.risk;
    return TONE.ready;
  })();

  const tierIssues = readiness?.issues ?? [];
  const criticalIssues = tierIssues.filter(i => i.severity === 'critical');
  const warningIssues = tierIssues.filter(i => i.severity === 'warning');

  const recommendedAction = primaryIssue?.recommended
    || readiness?.traveler_package.recommended_action
    || readiness?.komax_cut_sheet.recommended_action
    || readiness?.work_instructions.recommended_action
    || 'No outstanding actions.';

  const topRiskSignal = revisionRisk?.signals?.[0];
  const showRiskCallout = Boolean(revisionRisk && revisionRisk.aggregate_level && revisionRisk.aggregate_level !== 'NONE' && topRiskSignal);

  if (!partNumber) {
    return (
      <div className={`rounded-2xl border ${TONE.unknown.container} p-4 text-sm text-gray-700`}>
        Part number missing — readiness unavailable.
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`rounded-2xl border ${TONE.unknown.container} p-4 animate-pulse`}>
        <div className="h-4 bg-gray-200 rounded w-1/4 mb-2" />
        <div className="h-3 bg-gray-200 rounded w-1/2" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
        <strong>Readiness unavailable:</strong> {error}
      </div>
    );
  }

  if (!readiness) {
    return (
      <div className={`rounded-2xl border ${TONE.unknown.container} p-4 text-sm text-gray-700`}>
        Readiness status unavailable.
      </div>
    );
  }

  return (
    <section className={`rounded-2xl border ${statusTone.container} p-5 shadow-sm space-y-3`}>
      <div className="flex flex-wrap items-start gap-4">
        <span className="text-2xl" aria-hidden>
          {statusTone.icon}
        </span>
        <div className="flex-1 min-w-[220px] space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone.badge}`}>
              {statusTone.label}
            </span>
            <span className="text-xs uppercase tracking-[0.3em] text-gray-500">PPAP Readiness</span>
          </div>
          {readiness?.readiness_tier && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`inline-block rounded px-2 py-0.5 text-[11px] font-semibold ${TIER_BADGE[readiness.readiness_tier]}`}>
                {TIER_LABEL[readiness.readiness_tier]}
              </span>
              {typeof readiness.confidence_score === 'number' && (
                <span className="text-[11px] text-gray-600 font-medium">
                  {confidenceDot(readiness.confidence_score)} {readiness.confidence_score}% confidence
                </span>
              )}
            </div>
          )}
          {primaryIssue ? (
            <p className="text-sm text-gray-900 font-semibold">
              {primaryIssue.scope}: {primaryIssue.message}
              {additionalCount > 0 && (
                <span className="text-gray-500 font-normal"> (+{additionalCount} more)</span>
              )}
            </p>
          ) : (
            <p className="text-sm text-gray-700">No blockers detected.</p>
          )}
          <p className="text-sm text-gray-600">
            <span className="font-semibold">Action:</span> {recommendedAction}
          </p>
          {showRiskCallout && topRiskSignal && (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <p className="font-semibold">Historical revision risk · {revisionRisk?.aggregate_level}</p>
              <p className="mt-0.5 text-amber-900/80">{topRiskSignal.rationale}</p>
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowDetails(v => !v)}
        className="text-sm font-semibold text-blue-600 hover:text-blue-700"
      >
        {showDetails ? 'Hide details' : 'View details'}
      </button>

      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {actions.slice(0, 3).map(action => (
            <LinkOrButton key={action.id} action={action} />
          ))}
        </div>
      )}

      {showDetails && (
        <div className="space-y-4 text-sm text-gray-800">
          {tierIssues.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-gray-500">Readiness issues</p>
              {criticalIssues.map(issue => (
                <div key={issue.code} className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-800">
                  <span className="font-semibold shrink-0">Critical</span>
                  <span>{issue.message}</span>
                </div>
              ))}
              {warningIssues.map(issue => (
                <div key={issue.code} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
                  <span className="font-semibold shrink-0">Warning</span>
                  <span>{issue.message}</span>
                </div>
              ))}
            </div>
          )}
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Blockers</p>
            {blockers.length > 0 ? (
              <ul className="list-disc pl-5 space-y-1 mt-1">
                {blockers.map((issue, idx) => (
                  <li key={`blocker-${idx}`}>
                    <span className="font-semibold">{issue.scope}:</span> {issue.message}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-600">No blockers.</p>
            )}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Warnings</p>
            {warnings.length > 0 ? (
              <ul className="list-disc pl-5 space-y-1 mt-1">
                {warnings.map((issue, idx) => (
                  <li key={`warning-${idx}`}>
                    <span className="font-semibold">{issue.scope}:</span> {issue.message}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-600">No warnings.</p>
            )}
          </div>
          {revisionValidation && (
            <div className="border-t border-gray-200 pt-4">
              <RevisionSummaryCard
                validation={revisionValidation}
                partNumber={partNumber}
                riskSummary={revisionRisk}
                expectedDrawings={expectedDrawings}
                readinessTier={readiness?.readiness_tier ?? null}
                confidenceScore={readiness?.confidence_score ?? null}
                confidenceFactors={readiness?.confidence_factors ?? null}
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
