import type { HarnessConnectivityResult, WireEndpoint } from './harnessConnectivityService';
import { canonicalComponentKey } from './harnessTopologyService';

export type ComponentAuthorityKind = 'CONNECTOR' | 'TERMINAL' | 'OTHER';

export interface ComponentAuthoritySignals {
  fromBOM: boolean;
  operationType: string | null;
  fromWireAssoc: boolean;
  fromDrawingTable: boolean;
  fromHeaderBinding: boolean;
}

export interface ComponentAuthorityOption {
  canonicalId: string;
  displayName: string;
  cavities: string[];
  kind: ComponentAuthorityKind;
  signals?: ComponentAuthoritySignals;
  /** T23.6.87 forensic tag — tracks pipeline origin through all transformations. */
  __source?: string;
}

interface ComponentAccumulator {
  displayName: string;
  cavities: Set<string>;
  kind: ComponentAuthorityKind;
}

const KIND_PRIORITY: Record<ComponentAuthorityKind, number> = {
  CONNECTOR: 0,
  TERMINAL: 1,
  OTHER: 2,
};

function normalizeDisplayName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return raw;
  return trimmed;
}

function sortCavities(values: Set<string>): string[] {
  const arr = Array.from(values);
  return arr.sort((a, b) => {
    const na = Number(a);
    const nb = Number(b);
    const aIsNum = !Number.isNaN(na);
    const bIsNum = !Number.isNaN(nb);
    if (aIsNum && bIsNum) return na - nb;
    if (aIsNum) return -1;
    if (bIsNum) return 1;
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  });
}

function classifyEndpoint(endpoint: WireEndpoint): ComponentAuthorityKind {
  if (endpoint.terminationType === 'CONNECTOR_PIN') return 'CONNECTOR';
  if (endpoint.terminationType === 'TERMINAL') return 'TERMINAL';
  if (endpoint.cavity) return 'CONNECTOR';
  return 'OTHER';
}

function ingestEndpoint(map: Map<string, ComponentAccumulator>, endpoint: WireEndpoint): void {
  const component = endpoint.component?.trim();
  if (!component) return;
  const canonicalId = canonicalComponentKey(component);
  if (!canonicalId) return;
  const kind = classifyEndpoint(endpoint);
  const cavity = endpoint.cavity?.trim();
  if (!map.has(canonicalId)) {
    map.set(canonicalId, {
      displayName: normalizeDisplayName(component),
      cavities: cavity ? new Set([cavity]) : new Set<string>(),
      kind,
    });
    return;
  }
  const acc = map.get(canonicalId)!;
  if (KIND_PRIORITY[kind] < KIND_PRIORITY[acc.kind]) {
    acc.kind = kind;
  }
  if (cavity) acc.cavities.add(cavity);
  if (!acc.displayName && component) {
    acc.displayName = normalizeDisplayName(component);
  }
}

export function buildComponentAuthorityOptions(
  connectivity: HarnessConnectivityResult | null,
): ComponentAuthorityOption[] {
  if (!connectivity) return [];
  const map = new Map<string, ComponentAccumulator>();
  for (const wire of connectivity.wires) {
    ingestEndpoint(map, wire.from);
    ingestEndpoint(map, wire.to);
  }
  return Array.from(map.entries())
    .map(([canonicalId, acc]) => ({
      canonicalId,
      displayName: acc.displayName || canonicalId.toUpperCase(),
      cavities: sortCavities(acc.cavities),
      kind: acc.kind,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }));
}

export function mergeComponentAuthorityOptions(
  ...groups: ComponentAuthorityOption[][]
): ComponentAuthorityOption[] {
  const map = new Map<string, ComponentAuthorityOption>();
  for (const group of groups) {
    for (const option of group) {
      if (!map.has(option.canonicalId)) {
        map.set(option.canonicalId, option);
        continue;
      }
      const existing = map.get(option.canonicalId)!;
      const mergedCavities = new Set([...existing.cavities, ...option.cavities]);
      const kind = KIND_PRIORITY[option.kind] < KIND_PRIORITY[existing.kind] ? option.kind : existing.kind;
      map.set(option.canonicalId, {
        canonicalId: option.canonicalId,
        displayName: existing.displayName || option.displayName,
        cavities: Array.from(mergedCavities).sort((a, b) => {
          const na = Number(a);
          const nb = Number(b);
          const aIsNum = !Number.isNaN(na);
          const bIsNum = !Number.isNaN(nb);
          if (aIsNum && bIsNum) return na - nb;
          if (aIsNum) return -1;
          if (bIsNum) return 1;
          return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
        }),
        kind,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }));
}

export function isComponentAuthoritySelectionValid(
  canonicalId: string | null | undefined,
  options: ComponentAuthorityOption[],
): boolean {
  if (!canonicalId) return false;
  return options.some(opt => opt.canonicalId === canonicalId);
}

// ---------------------------------------------------------------------------
// T23.6.10: Cavity authority — full valid cavity set, not just observed pins
// ---------------------------------------------------------------------------

export type CavityAuthoritySource =
  /** Cavity list from a known connector-specific fallback table. */
  | 'FALLBACK_RULE'
  /** Cavity list derived solely from currently observed wire endpoints. */
  | 'OBSERVED_ONLY';

export interface CavityAuthority {
  canonicalId: string;
  cavities: string[];
  source: CavityAuthoritySource;
}

/**
 * Deterministic fallback cavity capacity for connectors used in this project
 * where upstream structured metadata is not yet available.
 *
 * Keyed by canonical component ID (output of canonicalComponentKey).
 * Only add entries that are verified — do NOT invent capacity.
 */
const CONNECTOR_CAVITY_FALLBACKS: Record<string, string[]> = {
  'phoenix:1700443': ['1', '2', '3', '4', '5', '6'],
};

/**
 * Returns the full valid cavity list for a connector, combining the fallback
 * capacity table (preferred) with the observed occupancy (always included).
 *
 * The returned list is the union of:
 *   - all cavities in CONNECTOR_CAVITY_FALLBACKS[canonicalId]  (if present)
 *   - all observed cavities from current wires
 *
 * Source is 'FALLBACK_RULE' when a known capacity entry exists;
 * 'OBSERVED_ONLY' when no fallback is available (dropdown will degrade to
 * free-text input — caller must handle that case).
 */
export function getCavityAuthority(canonicalId: string, observedCavities: string[]): CavityAuthority {
  const fallback = CONNECTOR_CAVITY_FALLBACKS[canonicalId];
  if (fallback) {
    console.log('[T23.6.10.2 FALLBACK HIT]', canonicalId);
    const merged = new Set([...fallback, ...observedCavities]);
    return {
      canonicalId,
      cavities: sortCavities(merged),
      source: 'FALLBACK_RULE',
    };
  }
  return {
    canonicalId,
    cavities: sortCavities(new Set(observedCavities)),
    source: 'OBSERVED_ONLY',
  };
}
