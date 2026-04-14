/**
 * Wire Override Utilities — Phase 3H.44 C7.3
 *
 * User-confirmed corrections to pipeline wire values.
 * Overrides are persisted to localStorage and injected into pipeline output.
 *
 * Governance:
 *   - No pipeline, parser, or resolver modification.
 *   - Override injection is additive — wires without an override are unchanged.
 *   - Server persistence deferred to a future phase.
 *   - Override.pin maps to end_a.cavity (cavity/pin reference in EndTerminal schema).
 */

import type { WireInstance } from '@/src/features/harness-work-instructions/types/harnessInstruction.schema';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WireOverride {
  wireId: string;
  terminal?: string | null;
  length?: number | null;
  pin?: string | number | null;
}

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

export function overrideStorageKey(partNumber: string): string {
  return `wire_overrides_${partNumber}`;
}

export function loadOverrides(partNumber: string): Record<string, WireOverride> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(overrideStorageKey(partNumber));
    return raw ? (JSON.parse(raw) as Record<string, WireOverride>) : {};
  } catch {
    return {};
  }
}

export function saveOverrides(
  partNumber: string,
  overrides: Record<string, WireOverride>,
): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(overrideStorageKey(partNumber), JSON.stringify(overrides));
  } catch {
    // Ignore storage quota errors silently
  }
}

// ---------------------------------------------------------------------------
// Override injection
// ---------------------------------------------------------------------------

/**
 * Apply user-confirmed wire overrides to a WireInstance array.
 * User edits are treated as highest authority (provenance → manual, confidence → 1.0).
 * Wires without an override are returned unchanged.
 *
 * Field mapping:
 *   override.terminal → end_a.terminal_part_number
 *   override.length   → cut_length
 *   override.pin      → end_a.cavity  (connector cavity / pin reference)
 */
export function applyWireOverrides(
  wires: WireInstance[],
  overrides: Record<string, WireOverride>,
): WireInstance[] {
  if (Object.keys(overrides).length === 0) return wires;
  return wires.map(wire => {
    const override = overrides[wire.wire_id];
    if (!override) return wire;
    return {
      ...wire,
      cut_length:
        override.length !== undefined ? override.length : wire.cut_length,
      end_a: {
        ...wire.end_a,
        terminal_part_number:
          override.terminal !== undefined
            ? override.terminal
            : wire.end_a.terminal_part_number,
        cavity:
          override.pin !== undefined
            ? (override.pin !== null ? String(override.pin) : wire.end_a.cavity)
            : wire.end_a.cavity,
      },
      provenance: {
        ...wire.provenance,
        source_type: 'manual' as const,
        confidence: 1.0,
        note: 'User-confirmed override',
      },
    };
  });
}
