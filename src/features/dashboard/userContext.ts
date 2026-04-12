/**
 * Dashboard User Context — client-side localStorage persistence.
 *
 * Pre-auth continuity layer. No backend required.
 * Designed to evolve into real per-user personalization once authentication is added.
 *
 * What is stored:
 *   lastViewedSkuPartNumber — most recently visited SKU part number (normalised uppercase)
 *   lastViewedRoute         — canonical /sku/[part_number] route
 *   lastViewedAt            — ISO timestamp of the most recent SKU visit
 *   recentSkus              — ordered array (most recent first), deduped, capped at MAX_RECENT_SKUS
 *   pendingWorkflowIntent   — preserved from corrective-action query params
 *   lastDashboardAction     — last explicit dashboard action label (future use)
 *
 * Resume Work priority (deterministic, no randomness):
 *   1. Last viewed SKU if its readiness tier is not READY
 *   2. Most recent SKU in recentSkus with unresolved issues
 *   3. Most recent SKU overall
 *
 * Stale rule: context older than STALE_THRESHOLD_DAYS is demoted in the dashboard UI.
 * Storage: localStorage under key STORAGE_KEY. Falls back gracefully if unavailable.
 */

export type DashboardUserContext = {
  lastViewedSkuPartNumber?: string;
  lastViewedRoute?: string;
  lastViewedAt?: string;
  recentSkus: string[];
  pendingWorkflowIntent?: string;
  lastDashboardAction?: string;
};

const STORAGE_KEY = 'emip_dashboard_user_context_v1';
const MAX_RECENT_SKUS = 8;
const STALE_THRESHOLD_DAYS = 30;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function loadUserContext(): DashboardUserContext {
  if (!isBrowser()) return { recentSkus: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { recentSkus: [] };
    const parsed = JSON.parse(raw) as Partial<DashboardUserContext>;
    return {
      recentSkus: Array.isArray(parsed.recentSkus)
        ? (parsed.recentSkus as unknown[]).filter((x): x is string => typeof x === 'string' && x.length > 0)
        : [],
      lastViewedSkuPartNumber: typeof parsed.lastViewedSkuPartNumber === 'string' ? parsed.lastViewedSkuPartNumber : undefined,
      lastViewedRoute: typeof parsed.lastViewedRoute === 'string' ? parsed.lastViewedRoute : undefined,
      lastViewedAt: typeof parsed.lastViewedAt === 'string' ? parsed.lastViewedAt : undefined,
      pendingWorkflowIntent: typeof parsed.pendingWorkflowIntent === 'string' ? parsed.pendingWorkflowIntent : undefined,
      lastDashboardAction: typeof parsed.lastDashboardAction === 'string' ? parsed.lastDashboardAction : undefined,
    };
  } catch {
    return { recentSkus: [] };
  }
}

export function saveUserContext(ctx: DashboardUserContext): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ctx));
  } catch {
    /* storage quota exceeded or disabled — silent fail */
  }
}

/**
 * Record that the user visited a SKU page.
 * Updates lastViewedSkuPartNumber, lastViewedRoute, lastViewedAt, and recentSkus.
 * If intentOverride is provided, it replaces pendingWorkflowIntent.
 */
export function recordSkuVisit(partNumber: string, intentOverride?: string | null): void {
  const pn = partNumber.trim().toUpperCase();
  if (!pn) return;
  const ctx = loadUserContext();
  const recentSkus = [pn, ...ctx.recentSkus.filter(p => p !== pn)].slice(0, MAX_RECENT_SKUS);
  saveUserContext({
    ...ctx,
    lastViewedSkuPartNumber: pn,
    lastViewedRoute: `/sku/${encodeURIComponent(pn)}`,
    lastViewedAt: new Date().toISOString(),
    recentSkus,
    pendingWorkflowIntent: intentOverride ?? ctx.pendingWorkflowIntent,
  });
}

/**
 * Returns true if the stored context is older than STALE_THRESHOLD_DAYS.
 * Stale context is still shown in the dashboard but with a visual demotion.
 */
export function isContextStale(ctx: DashboardUserContext): boolean {
  if (!ctx.lastViewedAt) return false;
  try {
    const ageMs = Date.now() - new Date(ctx.lastViewedAt).getTime();
    return ageMs > STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

/**
 * Returns a human-readable relative time string for lastViewedAt.
 */
export function relativeTime(isoString?: string): string {
  if (!isoString) return '';
  try {
    const ms = Date.now() - new Date(isoString).getTime();
    const minutes = Math.floor(ms / 60_000);
    if (minutes < 2) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return `${Math.floor(days / 30)}mo ago`;
  } catch {
    return '';
  }
}
