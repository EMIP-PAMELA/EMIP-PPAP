import { useEffect, useMemo, useRef, useState } from 'react';
import type { CrossSourceValidationResult } from '@/src/utils/revisionCrossValidator';
import { canonicalizePartNumber } from '@/src/utils/canonicalizePartNumber';

interface UseRevisionValidationMapResult {
  validationMap: Record<string, CrossSourceValidationResult | null | undefined>;
  pending: Set<string>;
}

export function useRevisionValidationMap(partNumbers: (string | null | undefined)[]): UseRevisionValidationMapResult {
  const normalizedKey = useMemo(() => partNumbers.map(pn => pn?.trim().toUpperCase() ?? '').join('|'), [partNumbers]);
  const normalizedParts = useMemo(() => {
    const unique = new Set<string>();
    normalizedKey
      .split('|')
      .map(entry => entry.trim())
      .filter(entry => entry.length > 0)
      .forEach(entry => unique.add(entry));
    return Array.from(unique.values());
  }, [normalizedKey]);

  const [validationMap, setValidationMap] = useState<Record<string, CrossSourceValidationResult | null | undefined>>({});
  const [pending, setPending] = useState<Set<string>>(new Set());
  const fetchedRef = useRef<Set<string>>(new Set());
  const inflightRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    console.log('[T23.6.39 PARAM TRACE]', {
      stage: 'HOOK_INPUT',
      file: 'src/features/revision/hooks/useRevisionValidationMap.ts',
      function: 'useRevisionValidationMap',
      routeParam: null,
      partNumber: normalizedParts,
      canonicalPartNumber: normalizedParts.map(pn => (pn ? canonicalizePartNumber(pn) : null)),
      note: 'Revision validation hook inputs prior to normalization',
    });
  }, [normalizedKey]);

  useEffect(() => {
    if (normalizedParts.length === 0) return;
    const missing = normalizedParts.filter(pn => !inflightRef.current.has(pn) && !fetchedRef.current.has(pn));
    if (missing.length === 0) return;

    console.log('[T23.6.47 LOOP TRACE]', {
      hook: 'useRevisionValidationMap',
      trigger: 'normalizedKey changed',
      missing,
      alreadyFetched: Array.from(fetchedRef.current),
      alreadyInflight: Array.from(inflightRef.current),
    });

    missing.forEach(pn => inflightRef.current.add(pn));
    let cancelled = false;
    setPending(prev => {
      const next = new Set(prev);
      missing.forEach(pn => next.add(pn));
      return next;
    });

    (async () => {
      const updates: Record<string, CrossSourceValidationResult | null> = {};
      for (const pn of missing) {
        if (cancelled) break;
        try {
          if (!pn || pn.toLowerCase() === 'undefined') {
            console.warn('[T23.6.47 BLOCKED INVALID FETCH]', { hook: 'useRevisionValidationMap', pn, reason: 'empty or literal undefined part number' });
            console.log('[T23.6.39 ROOT CAUSE]', {
              file: 'src/features/revision/hooks/useRevisionValidationMap.ts',
              function: 'useRevisionValidationMap',
              issue: 'partNumber is empty or "undefined" before fetch',
              validUpstreamValue: normalizedParts,
              brokenValue: pn,
              why: 'Document table requested validation for missing SKU identifier',
            });
            updates[pn] = null;
            continue;
          }
          console.log('[T23.6.39 FETCH TRACE]', {
            stage: 'FETCH_CALL',
            file: 'src/features/revision/hooks/useRevisionValidationMap.ts',
            function: 'useRevisionValidationMap',
            routeParam: null,
            partNumber: pn,
            canonicalPartNumber: canonicalizePartNumber(pn),
            url: `/api/sku/get?partNumber=${encodeURIComponent(pn)}`,
            blocked: false,
            note: 'Revision validation fetch',
          });
          console.log('[T23.6.37 TRACE]', {
            stage: 'API',
            function: 'useRevisionValidationMap',
            rawPart: pn,
            canonicalPart: canonicalizePartNumber(pn),
            outgoingValue: `/api/sku/get?partNumber=${pn}`,
            note: 'Fetching revision validation context',
          });
          const res = await fetch(`/api/sku/get?partNumber=${encodeURIComponent(pn)}`);
          const json = await res.json();
          if (res.ok && json.ok !== false) {
            updates[pn] = json.revision_validation ?? json.sku?.revision_validation ?? null;
          } else {
            updates[pn] = null;
          }
        } catch (err) {
          console.warn('[REVISION STATUS FETCH FAILED]', pn, err);
          updates[pn] = null;
        }
      }

      if (cancelled) return;
      setValidationMap(prev => {
        const next = { ...prev };
        Object.entries(updates).forEach(([pn, value]) => {
          next[pn] = value;
        });
        return next;
      });
    })()
      .catch(err => {
        console.error('[REVISION STATUS FETCH ERROR]', err);
      })
      .finally(() => {
        missing.forEach(pn => { inflightRef.current.delete(pn); fetchedRef.current.add(pn); });
        setPending(prev => {
          const next = new Set(prev);
          missing.forEach(pn => next.delete(pn));
          return next;
        });
      });

    return () => {
      cancelled = true;
    };
  }, [normalizedKey]);

  return { validationMap, pending };
}
