import { useEffect, useMemo, useState } from 'react';
import type { SKUReadinessResult } from '@/src/utils/skuReadinessEvaluator';
import type { CrossSourceValidationResult } from '@/src/utils/revisionCrossValidator';
import type { RevisionRiskSummary } from '@/src/utils/revisionRiskAnalyzer';

interface UseSkuReadinessResult {
  readiness: SKUReadinessResult | null;
  revisionValidation: CrossSourceValidationResult | null;
  revisionRisk: RevisionRiskSummary | null;
  loading: boolean;
  error: string | null;
}

export function useSkuReadiness(partNumber?: string | null): UseSkuReadinessResult {
  const normalizedPart = useMemo(() => {
    if (!partNumber) return null;
    const trimmed = partNumber.trim().toUpperCase();
    return trimmed.length > 0 ? trimmed : null;
  }, [partNumber]);

  const [state, setState] = useState<UseSkuReadinessResult>({
    readiness: null,
    revisionValidation: null,
    revisionRisk: null,
    loading: Boolean(normalizedPart),
    error: null,
  });

  useEffect(() => {
    if (!normalizedPart) {
      setState({ readiness: null, revisionValidation: null, revisionRisk: null, loading: false, error: null });
      return;
    }

    const controller = new AbortController();
    setState(prev => ({ ...prev, loading: true, error: null }));

    (async () => {
      try {
        const res = await fetch(`/api/sku/get?partNumber=${encodeURIComponent(normalizedPart)}`, {
          signal: controller.signal,
        });
        const json = await res.json();
        if (!res.ok || json.ok === false) {
          throw new Error(json.error ?? 'Failed to load readiness');
        }
        setState({
          readiness: json.readiness ?? json.sku?.readiness ?? null,
          revisionValidation: json.revision_validation ?? json.sku?.revision_validation ?? null,
          revisionRisk: json.revision_risk ?? json.sku?.revision_risk ?? null,
          loading: false,
          error: null,
        });
      } catch (err) {
        if (controller.signal.aborted) return;
        setState({ readiness: null, revisionValidation: null, revisionRisk: null, loading: false, error: err instanceof Error ? err.message : String(err) });
      }
    })();

    return () => controller.abort();
  }, [normalizedPart]);

  return state;
}
