'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReadinessTier, ReadinessIssue, SKUReadinessResult } from '@/src/utils/skuReadinessEvaluator';
import type { CrossSourceValidationResult } from '@/src/utils/revisionCrossValidator';

export interface SKUReadinessSummary {
  part_number: string;
  description: string | null;
  updated_at: string;
  readiness_tier: ReadinessTier;
  confidence_score: number;
  issues: ReadinessIssue[];
  /** Full SKUReadinessResult — passed to useRecommendedFixActions in DecisionCard */
  readiness_full: SKUReadinessResult | null;
  /** Revision cross-source validation result — passed to useRecommendedFixActions in DecisionCard */
  revision_validation: CrossSourceValidationResult | null;
  loading: boolean;
  error: string | null;
}

const BATCH_SIZE = 5;
const MAX_SKUS = 60;

export function useDashboardReadiness(partNumbers: string[]): {
  summaries: Record<string, SKUReadinessSummary>;
  isLoadingAny: boolean;
  loaded: SKUReadinessSummary[];
} {
  const [summaries, setSummaries] = useState<Record<string, SKUReadinessSummary>>({});
  const [pendingCount, setPendingCount] = useState(0);
  const inflight = useRef(new Set<string>());
  const cancelled = useRef(false);

  const key = partNumbers.slice(0, MAX_SKUS).join('|');

  useEffect(() => {
    cancelled.current = false;
    if (!key) return;

    const pns = key.split('|').filter(Boolean);
    const toFetch = pns.filter(pn => !inflight.current.has(pn));
    if (toFetch.length === 0) return;

    toFetch.forEach(pn => inflight.current.add(pn));

    setSummaries(prev => {
      const next = { ...prev };
      toFetch.forEach(pn => {
        if (!next[pn]) {
          next[pn] = {
            part_number: pn,
            description: null,
            updated_at: '',
            readiness_tier: 'INCOMPLETE',
            confidence_score: 0,
            issues: [],
            readiness_full: null,
            revision_validation: null,
            loading: true,
            error: null,
          };
        }
      });
      return next;
    });

    setPendingCount(c => c + toFetch.length);

    (async () => {
      for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
        if (cancelled.current) break;
        const batch = toFetch.slice(i, i + BATCH_SIZE);
        await Promise.allSettled(
          batch.map(async pn => {
            try {
              const res = await fetch(`/api/sku/get?partNumber=${encodeURIComponent(pn)}`);
              const json = await res.json();
              if (cancelled.current) return;
              setSummaries(prev => ({
                ...prev,
                [pn]: {
                  part_number: pn,
                  description: json.sku?.description ?? null,
                  updated_at: json.sku?.updated_at ?? '',
                  readiness_tier: (json.readiness?.readiness_tier ?? 'INCOMPLETE') as ReadinessTier,
                  confidence_score: json.readiness?.confidence_score ?? 0,
                  issues: json.readiness?.issues ?? [],
                  readiness_full: (json.readiness as SKUReadinessResult) ?? null,
                  revision_validation: (json.sku?.revision_validation as CrossSourceValidationResult) ?? null,
                  loading: false,
                  error: res.ok && json.ok !== false ? null : (json.error ?? 'Load failed'),
                },
              }));
            } catch {
              if (cancelled.current) return;
              setSummaries(prev => ({
                ...prev,
                [pn]: { ...prev[pn], loading: false, error: 'Network error' },
              }));
            } finally {
              setPendingCount(c => c - 1);
            }
          }),
        );
      }
    })();

    return () => {
      cancelled.current = true;
    };
  }, [key]);

  const loaded = Object.values(summaries).filter(s => !s.loading);

  return { summaries, isLoadingAny: pendingCount > 0, loaded };
}
