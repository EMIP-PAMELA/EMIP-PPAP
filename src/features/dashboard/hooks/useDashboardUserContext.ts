'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  loadUserContext,
  saveUserContext,
  type DashboardUserContext,
} from '../userContext';

interface UseDashboardUserContextResult {
  context: DashboardUserContext;
  /** true once localStorage has been read (safe to render) */
  ready: boolean;
  updateContext: (patch: Partial<DashboardUserContext>) => void;
}

export function useDashboardUserContext(): UseDashboardUserContextResult {
  const [context, setContext] = useState<DashboardUserContext>({ recentSkus: [] });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setContext(loadUserContext());
    setReady(true);
  }, []);

  const updateContext = useCallback((patch: Partial<DashboardUserContext>) => {
    setContext(prev => {
      const next = { ...prev, ...patch };
      saveUserContext(next);
      return next;
    });
  }, []);

  return { context, ready, updateContext };
}
