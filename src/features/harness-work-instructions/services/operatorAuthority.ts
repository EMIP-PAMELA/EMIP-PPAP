import type { WireConnectivity } from './harnessConnectivityService';

/**
 * Detects whether a wire originates from an operator override/addition.
 * Falls back to rawText + wireId heuristics so legacy data remains compatible.
 */
export function isOperatorWire(wire: WireConnectivity | null | undefined): boolean {
  if (!wire) return false;

  const raw = wire.rawText ?? '';
  if (raw.includes('[OPERATOR')) return true;

  const maybeSource = (wire as { source?: string }).source;
  if (typeof maybeSource === 'string' && maybeSource.toUpperCase().includes('OPERATOR')) {
    return true;
  }

  if ((wire as { isOverride?: boolean }).isOverride === true) {
    return true;
  }

  if (wire.wireId?.startsWith('op-')) {
    return true;
  }

  return false;
}

export function logOperatorAuthority(
  wire: WireConnectivity | null | undefined,
  context: string,
  extra?: Record<string, unknown>,
): void {
  if (!wire) return;
  console.log('[T23.6.18 AUTHORITY]', {
    wire: wire.wireId,
    context,
    ...extra,
  });
}
