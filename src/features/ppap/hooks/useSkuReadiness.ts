import { useEffect, useMemo, useState } from 'react';
import type { SKUReadinessResult } from '@/src/utils/skuReadinessEvaluator';
import type { CrossSourceValidationResult } from '@/src/utils/revisionCrossValidator';
import type { ExpectedDrawingSummary } from '@/src/features/harness-work-instructions/services/skuService';
import type { RevisionRiskSummary } from '@/src/utils/revisionRiskAnalyzer';
import { canonicalizePartNumber } from '@/src/utils/canonicalizePartNumber';

interface UseSkuReadinessResult {
  readiness: SKUReadinessResult | null;
  revisionValidation: CrossSourceValidationResult | null;
  expectedDrawings: ExpectedDrawingSummary | null;
  revisionRisk: RevisionRiskSummary | null;
  loading: boolean;
  error: string | null;
}

export function useSkuReadiness(partNumber?: string | null): UseSkuReadinessResult {
  const normalizedPart = useMemo(() => {
    if (!partNumber) return null;
    const trimmed = partNumber.trim();
    if (trimmed.toLowerCase() === 'undefined') return null;
    return trimmed.length > 0 ? trimmed.toUpperCase() : null;
  }, [partNumber]);

  const [state, setState] = useState<UseSkuReadinessResult>({
    readiness: null,
    revisionValidation: null,
    expectedDrawings: null,
    revisionRisk: null,
    loading: Boolean(normalizedPart),
    error: null,
  });

  useEffect(() => {
    console.log('[T23.6.39 PARAM TRACE]', {
      stage: 'HOOK_INPUT',
      file: 'src/features/ppap/hooks/useSkuReadiness.ts',
      function: 'useSkuReadiness',
      routeParam: null,
      partNumber: partNumber ?? null,
      canonicalPartNumber: canonicalizePartNumber(partNumber ?? null),
      note: 'useSkuReadiness received part number prop',
    });
    console.log('[T23.6.47 LOOP TRACE]', {
      hook: 'useSkuReadiness',
      trigger: 'normalizedPart changed',
      normalizedPart,
      partNumber: partNumber ?? null,
    });
  }, [normalizedPart]);

  useEffect(() => {
    if (!normalizedPart) {
      setState({ readiness: null, revisionValidation: null, expectedDrawings: null, revisionRisk: null, loading: false, error: null });
      return;
    }

    const controller = new AbortController();
    setState(prev => ({ ...prev, loading: true, error: null }));

    (async () => {
      try {
        if (!normalizedPart || normalizedPart.toLowerCase() === 'undefined') {
          console.log('[T23.6.39 ROOT CAUSE]', {
            file: 'src/features/ppap/hooks/useSkuReadiness.ts',
            function: 'useSkuReadiness',
            issue: 'Normalized part number is empty/undefined before fetch',
            validUpstreamValue: partNumber,
            brokenValue: normalizedPart,
            why: 'PPAP readiness hook invoked without explicit SKU context',
          });
          setState({ readiness: null, revisionValidation: null, expectedDrawings: null, revisionRisk: null, loading: false, error: 'Missing part number' });
          return;
        }
        console.log('[T23.6.39 FETCH TRACE]', {
          stage: 'FETCH_CALL',
          file: 'src/features/ppap/hooks/useSkuReadiness.ts',
          function: 'useSkuReadiness',
          routeParam: null,
          partNumber: normalizedPart,
          canonicalPartNumber: canonicalizePartNumber(normalizedPart),
          url: `/api/sku/get?partNumber=${encodeURIComponent(normalizedPart)}`,
          blocked: false,
          note: 'useSkuReadiness fetch',
        });
        console.log('[T23.6.37 TRACE]', {
          stage: 'API',
          function: 'useSkuReadiness',
          rawPart: normalizedPart,
          canonicalPart: canonicalizePartNumber(normalizedPart),
          outgoingValue: `/api/sku/get?partNumber=${normalizedPart}`,
          note: 'Fetching SKU readiness context',
        });
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
          expectedDrawings: json.expected_drawings ?? json.sku?.expected_drawings ?? null,
          revisionRisk: json.revision_risk ?? json.sku?.revision_risk ?? null,
          loading: false,
          error: null,
        });
      } catch (err) {
        if (controller.signal.aborted) return;
        setState({ readiness: null, revisionValidation: null, expectedDrawings: null, revisionRisk: null, loading: false, error: err instanceof Error ? err.message : String(err) });
      }
    })();

    return () => controller.abort();
  }, [normalizedPart]);

  return state;
}
