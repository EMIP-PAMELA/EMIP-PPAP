'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import EMIPLayout from '../layout/EMIPLayout';
import { getAllActiveBOMs } from '@/src/core/services/bomService';
import { getCopperUsageAcrossParts } from '@/src/features/copper-index/services/copperService';
import { useDashboardReadiness, type SKUReadinessSummary } from '@/src/features/dashboard/hooks/useDashboardReadiness';
import DecisionCard from '@/src/features/dashboard/components/DecisionCard';
import { useDashboardUserContext } from '@/src/features/dashboard/hooks/useDashboardUserContext';
import { isContextStale, relativeTime } from '@/src/features/dashboard/userContext';
import type { ReadinessTier } from '@/src/utils/skuReadinessEvaluator';

interface BomStats {
  activeBOMs: number;
  totalCopperWeight: number | null;
  totalComponents: number;
}

interface BasicSKU {
  part_number: string;
  description?: string | null;
  updated_at: string;
}

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

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-2">
      <div className="h-3 bg-gray-200 rounded w-2/3" />
      <div className="h-2 bg-gray-100 rounded w-1/2" />
    </div>
  );
}

function SKUCard({ summary }: { summary: SKUReadinessSummary }) {
  const topIssue = summary.issues.find(i => i.severity === 'critical') ?? summary.issues[0] ?? null;
  return (
    <Link
      href={`/sku/${encodeURIComponent(summary.part_number)}`}
      className="flex items-start justify-between gap-3 rounded-xl border border-gray-100 bg-white p-3 hover:bg-gray-50 hover:border-gray-200 transition group"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-700 truncate">{summary.part_number}</p>
        {summary.description && (
          <p className="text-xs text-gray-500 truncate">{summary.description}</p>
        )}
        {topIssue && (
          <p className="text-xs text-gray-600 mt-0.5 truncate">{topIssue.message}</p>
        )}
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className={`text-[10px] font-semibold rounded px-1.5 py-0.5 whitespace-nowrap ${TIER_BADGE[summary.readiness_tier]}`}>
          {TIER_LABEL[summary.readiness_tier]}
        </span>
        <span className="text-[10px] text-gray-500">
          {confidenceDot(summary.confidence_score)} {summary.confidence_score}%
        </span>
      </div>
    </Link>
  );
}

const SUGGESTED_ACTIONS: Array<{
  codes: string[];
  getLabel: (n: number) => string;
  cta: string;
  href: string;
  accent: string;
}> = [
  {
    codes: ['REVISION_CONFLICT'],
    getLabel: n => `${n} SKU${n > 1 ? 's' : ''} with revision conflict`,
    cta: 'Review SKUs',
    href: '/sku',
    accent: 'border-red-200 bg-red-50 text-red-800',
  },
  {
    codes: ['REVISION_OUT_OF_SYNC'],
    getLabel: n => `${n} SKU${n > 1 ? 's' : ''} with out-of-sync revision`,
    cta: 'Review SKUs',
    href: '/sku',
    accent: 'border-orange-200 bg-orange-50 text-orange-800',
  },
  {
    codes: ['MISSING_BOM'],
    getLabel: n => `${n} SKU${n > 1 ? 's' : ''} missing a BOM`,
    cta: 'Upload BOM',
    href: '/upload/bom',
    accent: 'border-amber-200 bg-amber-50 text-amber-800',
  },
  {
    codes: ['MISSING_CUSTOMER_DRAWING', 'MISSING_APOGEE_DRAWING'],
    getLabel: n => `${n} SKU${n > 1 ? 's' : ''} missing drawings`,
    cta: 'Upload Drawing',
    href: '/upload/drawing',
    accent: 'border-yellow-200 bg-yellow-50 text-yellow-800',
  },
];

export default function EMIPDashboardPage() {
  const [bomStats, setBomStats] = useState<BomStats>({
    activeBOMs: 0,
    totalCopperWeight: null,
    totalComponents: 0,
  });
  const [copperLoading, setCopperLoading] = useState(false);
  const [skus, setSkus] = useState<BasicSKU[]>([]);
  const [skusLoading, setSkusLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);

  const partNumbers = useMemo(
    () => skus.map(s => s.part_number.trim().toUpperCase()).filter(Boolean),
    [skus],
  );

  const { summaries, isLoadingAny, loaded } = useDashboardReadiness(partNumbers);
  const { context: userCtx, ready: ctxReady } = useDashboardUserContext();

  useEffect(() => {
    (async () => {
      try {
        const boms = await getAllActiveBOMs();
        setBomStats(prev => ({
          ...prev,
          activeBOMs: boms.length,
          totalComponents: boms.reduce((sum, b) => sum + b.recordCount, 0),
        }));
        setStatsLoading(false);
        loadCopperAsync(boms);
      } catch {
        setStatsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/sku/list');
        const json = await res.json();
        if (json.ok) setSkus(json.skus ?? []);
      } catch {
        /* non-blocking */
      } finally {
        setSkusLoading(false);
      }
    })();
  }, []);

  const loadCopperAsync = async (boms: Awaited<ReturnType<typeof getAllActiveBOMs>>) => {
    setCopperLoading(true);
    try {
      const pns = boms.map(b => b.partNumber);
      if (pns.length > 0) {
        const agg = await getCopperUsageAcrossParts(pns);
        setBomStats(prev => ({ ...prev, totalCopperWeight: agg.totalCopperWeight ?? null }));
      }
    } catch {
      setBomStats(prev => ({ ...prev, totalCopperWeight: null }));
    } finally {
      setCopperLoading(false);
    }
  };

  const attentionItems = useMemo(
    () =>
      loaded
        .filter(s => s.readiness_tier === 'BLOCKED' || s.confidence_score < 60)
        .sort((a, b) => {
          if (a.readiness_tier === 'BLOCKED' && b.readiness_tier !== 'BLOCKED') return -1;
          if (b.readiness_tier === 'BLOCKED' && a.readiness_tier !== 'BLOCKED') return 1;
          return a.confidence_score - b.confidence_score;
        })
        .slice(0, 8),
    [loaded],
  );

  const inProgressItems = useMemo(
    () =>
      loaded
        .filter(
          s => s.readiness_tier === 'INCOMPLETE' || s.readiness_tier === 'READY_WITH_WARNINGS',
        )
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 8),
    [loaded],
  );

  const healthCounts = useMemo(() => {
    const counts: Record<ReadinessTier, number> = {
      READY: 0,
      READY_WITH_WARNINGS: 0,
      INCOMPLETE: 0,
      BLOCKED: 0,
    };
    loaded.forEach(s => { counts[s.readiness_tier]++; });
    return counts;
  }, [loaded]);

  const suggestedActions = useMemo(() => {
    const skusByCodes = new Map<string, Set<string>>();
    loaded.forEach(s => {
      s.issues.forEach(issue => {
        if (!skusByCodes.has(issue.code)) skusByCodes.set(issue.code, new Set());
        skusByCodes.get(issue.code)!.add(s.part_number);
      });
    });
    return SUGGESTED_ACTIONS.map(action => {
      const affected = new Set<string>();
      action.codes.forEach(code => {
        skusByCodes.get(code)?.forEach(pn => affected.add(pn));
      });
      return { ...action, count: affected.size };
    }).filter(a => a.count > 0);
  }, [loaded]);

  const totalLoaded = loaded.length;
  const totalSkus = partNumbers.length;

  const stale = ctxReady && isContextStale(userCtx);

  /**
   * Resume Work priority (deterministic):
   * 1. Last viewed SKU if still INCOMPLETE / BLOCKED / READY_WITH_WARNINGS
   * 2. Most recent in recentSkus with unresolved issues
   * 3. Most recent overall
   */
  const resumePrimary = useMemo<string | null>(() => {
    if (!ctxReady || userCtx.recentSkus.length === 0) return null;
    const recent = userCtx.recentSkus;
    const lastViewed = userCtx.lastViewedSkuPartNumber?.trim().toUpperCase();

    if (lastViewed) {
      const s = summaries[lastViewed];
      if (!s || s.loading || s.readiness_tier !== 'READY') return lastViewed;
    }

    const withIssues = recent.find(pn => {
      const s = summaries[pn];
      return s && !s.loading && s.readiness_tier !== 'READY';
    });
    if (withIssues) return withIssues;

    return recent[0] ?? null;
  }, [ctxReady, userCtx, summaries]);

  const resumeRecentList = useMemo<string[]>(() => {
    if (!ctxReady) return [];
    return userCtx.recentSkus.filter(pn => pn !== resumePrimary).slice(0, 4);
  }, [ctxReady, userCtx.recentSkus, resumePrimary]);

  return (
    <EMIPLayout>
      <div className="space-y-8">

        {/* Header */}
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">System Dashboard</h1>
            <p className="text-gray-500 mt-1 text-sm">
              {skusLoading
                ? 'Loading SKU inventory…'
                : isLoadingAny
                ? `Loading readiness — ${totalLoaded} / ${totalSkus} SKUs evaluated`
                : `${totalSkus} SKUs · readiness fully evaluated`}
            </p>
          </div>
          <Link
            href="/sku"
            className="shrink-0 text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline"
          >
            View all SKUs →
          </Link>
        </div>

        {/* RESUME WORK */}
        {ctxReady && (
          <section className={`rounded-2xl border shadow-sm p-5 ${
            stale ? 'border-gray-200 bg-gray-50' : 'border-blue-100 bg-blue-50'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  ↩ Resume Work
                </h2>
                {stale && (
                  <p className="text-xs text-gray-400 mt-0.5">Last activity over 30 days ago</p>
                )}
              </div>
              <span className="text-[10px] uppercase tracking-widest text-gray-400 border border-gray-200 bg-white rounded px-1.5 py-0.5">
                My Active Work
              </span>
            </div>

            {resumePrimary === null ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-white px-5 py-6 text-center">
                <p className="text-sm font-medium text-gray-500">No recent work yet</p>
                <p className="text-xs text-gray-400 mt-1">
                  Open a SKU to begin — it will appear here for quick resumption.
                </p>
                <Link
                  href="/sku"
                  className="mt-3 inline-block text-xs font-semibold text-blue-600 hover:underline"
                >
                  Browse SKU Vault →
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Primary Decision Card — inline corrective actions derived from readiness + revision validation */}
                <DecisionCard
                  partNumber={resumePrimary}
                  summary={summaries[resumePrimary]}
                  relativeTimeStr={userCtx.lastViewedAt ? relativeTime(userCtx.lastViewedAt) : undefined}
                  pendingWorkflowIntent={userCtx.pendingWorkflowIntent}
                />

                {/* Secondary recent SKU chips */}
                {resumeRecentList.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {resumeRecentList.map(pn => {
                      const s = summaries[pn];
                      const hasIssues = s && !s.loading && s.readiness_tier !== 'READY';
                      return (
                        <Link
                          key={pn}
                          href={`/sku/${encodeURIComponent(pn)}?from=resume`}
                          className="flex flex-col gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2.5 hover:border-blue-200 hover:bg-blue-50/40 transition group"
                        >
                          <p className="text-xs font-semibold text-gray-800 group-hover:text-blue-700 truncate">{pn}</p>
                          {s && !s.loading ? (
                            <span className={`self-start text-[10px] font-semibold rounded px-1.5 py-0.5 ${TIER_BADGE[s.readiness_tier]}`}>
                              {TIER_LABEL[s.readiness_tier]}
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-300 animate-pulse">…</span>
                          )}
                          <span className={`self-end text-[10px] font-semibold mt-auto ${
                            hasIssues ? 'text-amber-600' : 'text-blue-500'
                          }`}>
                            {hasIssues ? 'Fix →' : 'Continue →'}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <p className="text-xs uppercase tracking-widest text-gray-500 mb-1">Active BOMs</p>
            <p className="text-3xl font-bold text-green-600">
              {statsLoading ? <span className="text-gray-300 animate-pulse">—</span> : bomStats.activeBOMs}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <p className="text-xs uppercase tracking-widest text-gray-500 mb-1">Total Components</p>
            <p className="text-3xl font-bold text-blue-600">
              {statsLoading ? <span className="text-gray-300 animate-pulse">—</span> : bomStats.totalComponents.toLocaleString()}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <p className="text-xs uppercase tracking-widest text-gray-500 mb-1">Copper Weight (lbs)</p>
            <p className="text-3xl font-bold text-orange-500">
              {copperLoading ? (
                <span className="text-gray-300 animate-pulse">…</span>
              ) : bomStats.totalCopperWeight === null ? (
                <span className="text-gray-400 text-lg">N/A</span>
              ) : (
                bomStats.totalCopperWeight.toFixed(1)
              )}
            </p>
          </div>
        </div>

        {/* ATTENTION REQUIRED */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">
              🔴 Attention Required
            </h2>
            <span className="text-xs text-gray-400">
              {isLoadingAny && totalLoaded < totalSkus ? 'Evaluating…' : `${attentionItems.length} item${attentionItems.length !== 1 ? 's' : ''}`}
            </span>
          </div>
          {skusLoading || (isLoadingAny && attentionItems.length === 0 && totalLoaded === 0) ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : attentionItems.length === 0 ? (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-sm text-emerald-700">
              No SKUs require immediate attention.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {attentionItems.map(s => <SKUCard key={s.part_number} summary={s} />)}
            </div>
          )}
        </section>

        {/* IN PROGRESS */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">
              🟡 In Progress
            </h2>
            <span className="text-xs text-gray-400">
              {isLoadingAny && totalLoaded < totalSkus ? 'Evaluating…' : `${inProgressItems.length} item${inProgressItems.length !== 1 ? 's' : ''}`}
            </span>
          </div>
          {skusLoading || (isLoadingAny && inProgressItems.length === 0 && totalLoaded === 0) ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : inProgressItems.length === 0 ? (
            <div className="rounded-2xl border border-gray-100 bg-gray-50 px-5 py-4 text-sm text-gray-500">
              No SKUs currently in progress.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {inProgressItems.map(s => <SKUCard key={s.part_number} summary={s} />)}
            </div>
          )}
        </section>

        {/* SYSTEM HEALTH + SUGGESTED ACTIONS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* System Health */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <h2 className="text-base font-semibold text-gray-900 mb-4">System Health</h2>
            {isLoadingAny && totalLoaded === 0 ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => <div key={i} className="animate-pulse h-10 bg-gray-100 rounded-xl" />)}
              </div>
            ) : (
              <div className="space-y-2">
                {([
                  ['READY', 'bg-emerald-500', 'text-emerald-700', 'bg-emerald-50 border-emerald-200'],
                  ['READY_WITH_WARNINGS', 'bg-amber-400', 'text-amber-700', 'bg-amber-50 border-amber-200'],
                  ['INCOMPLETE', 'bg-yellow-400', 'text-yellow-800', 'bg-yellow-50 border-yellow-200'],
                  ['BLOCKED', 'bg-red-500', 'text-red-700', 'bg-red-50 border-red-200'],
                ] as const).map(([tier, barColor, textColor, bg]) => {
                  const count = healthCounts[tier];
                  const pct = totalLoaded > 0 ? Math.round((count / totalLoaded) * 100) : 0;
                  return (
                    <div key={tier} className={`rounded-xl border px-4 py-2.5 ${bg}`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`text-xs font-semibold ${textColor}`}>{TIER_LABEL[tier]}</span>
                        <span className={`text-sm font-bold ${textColor}`}>{count}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/60">
                        <div
                          className={`h-full rounded-full ${barColor} transition-all duration-500`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {totalLoaded > 0 && (
                  <p className="text-xs text-gray-400 pt-1">{totalLoaded} SKU{totalLoaded !== 1 ? 's' : ''} evaluated</p>
                )}
              </div>
            )}
          </section>

          {/* Suggested Actions */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Suggested Actions</h2>
            {isLoadingAny && suggestedActions.length === 0 ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => <div key={i} className="animate-pulse h-12 bg-gray-100 rounded-xl" />)}
              </div>
            ) : suggestedActions.length === 0 ? (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                No recommended actions — system looks healthy.
              </div>
            ) : (
              <div className="space-y-2">
                {suggestedActions.map(action => (
                  <div
                    key={action.codes.join('-')}
                    className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${action.accent}`}
                  >
                    <p className="text-xs font-medium">{action.getLabel(action.count)}</p>
                    <Link
                      href={action.href}
                      className="shrink-0 rounded-lg bg-white/80 border border-current px-3 py-1 text-xs font-semibold hover:bg-white transition"
                    >
                      {action.cta}
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* MESSAGES (stub — future authenticated dashboard integration) */}
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-gray-900">Messages</h2>
              <span className="text-[10px] font-semibold rounded-full bg-gray-100 text-gray-400 px-2 py-0.5">0</span>
            </div>
            <span className="text-[10px] uppercase tracking-widest text-gray-400 border border-gray-200 rounded px-1.5 py-0.5">Coming soon</span>
          </div>
          <p className="text-sm text-gray-400">
            Approval requests, assignment alerts, and escalation notifications will appear here once the user layer is active.
          </p>
        </section>

      </div>
    </EMIPLayout>
  );
}
