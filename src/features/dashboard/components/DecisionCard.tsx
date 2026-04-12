'use client';

/**
 * DecisionCard — primary Resume Work card for the dashboard.
 *
 * Shows the most relevant recent SKU alongside up to 2 inline corrective action
 * buttons so the user can begin remediation without first opening the SKU page.
 *
 * Design rules:
 *   - Max 2 action buttons to avoid clutter. Priority: critical/danger first, then warning.
 *   - VIEW_REVISION is omitted unless it is the only available action.
 *   - Each button appends ?actionSource=decision_card so downstream pages can show context.
 *   - All actions are navigation-based (no data mutations happen here).
 *   - Future direct-mutation actions can be plugged in at the same interface by
 *     adding an onClick alongside/instead of href.
 *   - Actions derive from useRecommendedFixActions which consumes existing
 *     revision validation + readiness results (no separate logic).
 *
 * Skeleton buttons are fixed-width during loading so the card height does not jump.
 */

import React, { useMemo } from 'react';
import Link from 'next/link';
import type { SKUReadinessSummary } from '../hooks/useDashboardReadiness';
import {
  useRecommendedFixActions,
  type RecommendedFixAction,
  type ActionIntent,
} from '@/src/features/revision/hooks/useRecommendedFixActions';
import type { ReadinessTier } from '@/src/utils/skuReadinessEvaluator';

const TIER_LABEL: Record<ReadinessTier, string> = {
  READY: 'Ready',
  READY_WITH_WARNINGS: 'Ready with warnings',
  INCOMPLETE: 'Incomplete',
  BLOCKED: 'Blocked',
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

/** Human-readable short labels for action buttons — imperative, brief. */
const SHORT_LABEL: Partial<Record<ActionIntent, string>> = {
  RESOLVE_CONFLICT: 'Resolve Conflict',
  FIX_OUT_OF_SYNC: 'Fix Revision',
  REVIEW_INCOMPARABLE: 'Review Revision',
  REVIEW_READINESS: 'Review Readiness',
  VIEW_REVISION: 'View Revision',
};

function shortLabel(action: RecommendedFixAction): string {
  if (action.intent === 'UPLOAD_MISSING_DOC') {
    const dt = action.context?.documentType;
    if (dt === 'BOM') return 'Upload BOM';
    return 'Upload Drawing';
  }
  return SHORT_LABEL[action.intent] ?? action.label;
}

/**
 * Append ?actionSource=decision_card to the action href so downstream pages
 * can optionally show "Opened from dashboard action" context.
 */
function withActionSource(href?: string): string {
  if (!href) return '#';
  try {
    const url = new URL(href, 'http://x');
    url.searchParams.set('actionSource', 'decision_card');
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return href;
  }
}

const SEVERITY_BTN: Record<string, string> = {
  danger: 'bg-red-600 hover:bg-red-700 text-white border-transparent',
  warning: 'bg-amber-500 hover:bg-amber-600 text-white border-transparent',
  info: 'bg-blue-600 hover:bg-blue-700 text-white border-transparent',
};

type DecisionCardProps = {
  partNumber: string;
  summary: SKUReadinessSummary | undefined;
  relativeTimeStr?: string;
  pendingWorkflowIntent?: string;
};

export default function DecisionCard({
  partNumber,
  summary,
  relativeTimeStr,
  pendingWorkflowIntent,
}: DecisionCardProps) {
  const actions = useRecommendedFixActions({
    partNumber,
    readiness: summary?.readiness_full ?? null,
    revisionValidation: summary?.revision_validation ?? null,
  });

  /**
   * Select top 1–2 actionable CTAs.
   * Skip VIEW_REVISION unless it is the only available action.
   * Limit to 2 to maintain visual clarity.
   */
  const topActions = useMemo<RecommendedFixAction[]>(() => {
    if (!summary || summary.loading) return [];
    const primary = actions.filter(a => a.href && a.intent !== 'VIEW_REVISION');
    if (primary.length > 0) return primary.slice(0, 2);
    const fallback = actions.filter(a => a.href);
    return fallback.slice(0, 1);
  }, [actions, summary]);

  const topIssue =
    summary?.issues?.find(i => i.severity === 'critical') ??
    summary?.issues?.[0] ??
    null;

  const isLoading = !summary || summary.loading;

  return (
    <div className="rounded-xl border border-blue-200 bg-white shadow-sm">
      {/* Header row — fixed structure prevents layout shift while readiness loads */}
      <div className="flex items-start justify-between gap-4 px-4 pt-4 pb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-gray-900">{partNumber}</p>
            {relativeTimeStr && (
              <span className="text-[10px] text-gray-400">{relativeTimeStr}</span>
            )}
            {pendingWorkflowIntent && (
              <span className="text-[10px] rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 font-semibold">
                {pendingWorkflowIntent.replace(/_/g, ' ')}
              </span>
            )}
          </div>

          {/* Description + issue — shown when loaded */}
          {!isLoading && summary.description && (
            <p className="text-xs text-gray-500 truncate mt-0.5">{summary.description}</p>
          )}
          {!isLoading && topIssue && (
            <p className="text-xs text-red-600 font-medium mt-0.5 truncate">{topIssue.message}</p>
          )}
          {!isLoading && !topIssue && summary.readiness_tier === 'READY' && (
            <p className="text-xs text-emerald-600 mt-0.5">No outstanding issues</p>
          )}

          {/* Skeleton lines while loading */}
          {isLoading && (
            <div className="mt-1.5 space-y-1.5 animate-pulse">
              <div className="h-2.5 bg-gray-200 rounded w-48" />
              <div className="h-2 bg-gray-100 rounded w-32" />
            </div>
          )}
        </div>

        {/* Badge column */}
        <div className="flex flex-col items-end gap-1.5 shrink-0 pt-0.5">
          {isLoading ? (
            <div className="animate-pulse space-y-1.5">
              <div className="h-4 bg-gray-200 rounded w-20" />
              <div className="h-3 bg-gray-100 rounded w-14" />
            </div>
          ) : (
            <>
              <span
                className={`text-[10px] font-semibold rounded px-1.5 py-0.5 whitespace-nowrap ${TIER_BADGE[summary.readiness_tier]}`}
              >
                {TIER_LABEL[summary.readiness_tier]}
              </span>
              <span className="text-[10px] text-gray-500">
                {confidenceDot(summary.confidence_score)} {summary.confidence_score}%
              </span>
            </>
          )}
        </div>
      </div>

      {/* Action row — fixed min-height prevents card height jump */}
      <div className="flex items-center gap-2 flex-wrap px-4 pb-4 pt-2 min-h-[44px]">
        {isLoading ? (
          /* Skeleton buttons — same widths as typical rendered buttons */
          <>
            <div className="h-7 w-28 bg-gray-200 rounded-lg animate-pulse" />
            <div className="h-7 w-24 bg-gray-100 rounded-lg animate-pulse" />
          </>
        ) : topActions.length > 0 ? (
          <>
            {topActions.map(action => (
              <Link
                key={action.id}
                href={withActionSource(action.href)}
                className={`inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${SEVERITY_BTN[action.severity] ?? SEVERITY_BTN.info}`}
              >
                {shortLabel(action)}
              </Link>
            ))}
            <Link
              href={`/sku/${encodeURIComponent(partNumber)}?from=resume`}
              className="ml-auto text-xs font-semibold text-gray-400 hover:text-blue-600 hover:underline"
            >
              View Details →
            </Link>
          </>
        ) : (
          <>
            <p className="text-xs text-gray-400">No immediate actions required</p>
            <Link
              href={`/sku/${encodeURIComponent(partNumber)}?from=resume`}
              className="ml-auto text-xs font-semibold text-blue-600 hover:underline"
            >
              Open SKU →
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
