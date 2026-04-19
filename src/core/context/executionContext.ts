export type ExecutionMode = 'sku_view' | 'pipeline' | 'copper';

export const getExecutionMode = (): ExecutionMode => {
  if (typeof window === 'undefined') return 'pipeline';

  const path = window.location.pathname || '';
  if (path.includes('/copper')) return 'copper';
  if (path.includes('/sku/')) return 'sku_view';

  return 'pipeline';
};
