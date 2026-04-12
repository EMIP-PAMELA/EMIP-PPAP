import { useEffect, useMemo, useState } from 'react';
import type { CrossSourceValidationResult } from '@/src/utils/revisionCrossValidator';

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

  useEffect(() => {
    if (normalizedParts.length === 0) return;
    const missing = normalizedParts.filter(pn => !pending.has(pn) && validationMap[pn] === undefined);
    if (missing.length === 0) return;

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
        setPending(prev => {
          const next = new Set(prev);
          missing.forEach(pn => next.delete(pn));
          return next;
        });
      });

    return () => {
      cancelled = true;
    };
  }, [normalizedParts.join('|'), validationMap, pending]);

  return { validationMap, pending };
}
