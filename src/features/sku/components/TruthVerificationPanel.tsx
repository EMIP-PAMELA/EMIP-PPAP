'use client';

/**
 * Truth Verification Panel — Phase 3H.44 C7.2 / C7.3
 *
 * Surfaces extraction gaps, allows user correction of missing wire fields,
 * and persists confirmed overrides to localStorage for pipeline injection.
 *
 * Governance:
 *   - UI ONLY. No modification of extraction, resolution, or pipeline logic.
 *   - Confirmed edits persist to localStorage; server persistence deferred.
 *   - Gracefully handles undefined coverage.
 */

import React, { useEffect, useState } from 'react';
import type { WireInstance } from '@/src/features/harness-work-instructions/types/harnessInstruction.schema';
import type { ExtractionCoverage } from '@/src/features/harness-work-instructions/services/extractionCoverageService';
import {
  type WireOverride,
  loadOverrides,
  saveOverrides,
} from '@/src/features/sku/utils/wireOverrides';

// ---------------------------------------------------------------------------
// Local edit record — keyed by wire_id (in-progress, not yet confirmed)
// ---------------------------------------------------------------------------

interface WireCorrection {
  terminal?: string;
  cut_length?: number | '';
  pin?: string;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TruthVerificationPanelProps {
  partNumber: string;
  coverage: ExtractionCoverage | undefined;
  wires: WireInstance[];
  onOverridesUpdated?: (overrides: Record<string, WireOverride>) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function coverageLabel(score: number): { label: string; tone: string } {
  if (score > 90) return { label: 'High',         tone: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
  if (score > 70) return { label: 'Moderate',     tone: 'text-amber-700 bg-amber-50 border-amber-200' };
  return           { label: 'Needs Review',        tone: 'text-red-700 bg-red-50 border-red-200' };
}

function isMissingTerminal(w: WireInstance): boolean {
  return !w.end_a.terminal_part_number && !w.end_b.terminal_part_number;
}

function isMissingLength(w: WireInstance): boolean {
  return w.cut_length == null;
}

function isMissingPin(w: WireInstance): boolean {
  return !w.end_a.connector_id && !w.end_b.connector_id;
}

function fieldClass(missing: boolean): string {
  return missing
    ? 'border-red-300 bg-red-50 text-red-900 placeholder-red-300 focus:border-red-500 focus:ring-red-200'
    : 'border-gray-200 bg-white text-gray-900 placeholder-gray-300 focus:border-blue-400 focus:ring-blue-100';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TruthVerificationPanel({
  partNumber,
  coverage,
  wires,
  onOverridesUpdated,
}: TruthVerificationPanelProps) {
  const [editedWires, setEditedWires]       = useState<Record<string, WireCorrection>>({});
  const [confirmedWires, setConfirmedWires] = useState<Record<string, WireOverride>>({});

  // Load persisted overrides from localStorage after hydration
  useEffect(() => {
    if (!partNumber) return;
    const saved = loadOverrides(partNumber);
    if (Object.keys(saved).length > 0) {
      setConfirmedWires(saved);
    }
  }, [partNumber]);

  // Show wires that are missing data OR have been confirmed (always visible when locked)
  const wiresNeedingAttention = wires.filter(
    w => isMissingLength(w) || isMissingTerminal(w) || isMissingPin(w) || Boolean(confirmedWires[w.wire_id]),
  );

  useEffect(() => {
    console.log('[TRUTH VERIFICATION]', {
      wiresNeedingAttention: wiresNeedingAttention.map(w => w.wire_id),
      editedWires,
    });
  }, [wiresNeedingAttention.length, editedWires]);

  function handleEdit<K extends keyof WireCorrection>(
    wireId: string,
    field: K,
    value: WireCorrection[K],
  ) {
    setEditedWires(prev => ({
      ...prev,
      [wireId]: { ...prev[wireId], [field]: value },
    }));
  }

  function confirmWire(wireId: string) {
    const wire       = wires.find(w => w.wire_id === wireId);
    if (!wire) return;
    const correction = editedWires[wireId] ?? {};

    const override: WireOverride = {
      wireId,
      terminal:
        correction.terminal !== undefined
          ? correction.terminal
          : (wire.end_a.terminal_part_number ?? undefined),
      length:
        correction.cut_length !== undefined && correction.cut_length !== ''
          ? Number(correction.cut_length)
          : (wire.cut_length ?? undefined),
      pin:
        correction.pin !== undefined
          ? correction.pin
          : (wire.end_a.connector_id ?? undefined),
    };

    const next = { ...confirmedWires, [wireId]: override };
    setConfirmedWires(next);
    saveOverrides(partNumber, next);
    onOverridesUpdated?.(next);

    console.log('[TRUTH LOCK APPLIED]', {
      overrides:     next,
      affectedWires: Object.keys(next),
    });
  }

  function unlockWire(wireId: string) {
    const next = { ...confirmedWires };
    delete next[wireId];
    setConfirmedWires(next);
    saveOverrides(partNumber, next);
    onOverridesUpdated?.(next);
  }

  const scoreInfo = coverage ? coverageLabel(coverage.coverageScore) : null;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-gray-400">Gap Detection</p>
          <h2 className="text-lg font-semibold text-gray-900">Extraction Quality</h2>
        </div>

        {coverage && scoreInfo && (
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${scoreInfo.tone}`}>
              {scoreInfo.label}
            </span>
            <span className="text-2xl font-bold text-gray-900">
              {coverage.coverageScore}
              <span className="text-base font-normal text-gray-400">%</span>
            </span>
          </div>
        )}

        {!coverage && (
          <span className="text-xs text-gray-400">Coverage data unavailable — run pipeline with a drawing</span>
        )}
      </div>

      {/* ── Issues ──────────────────────────────────────────────────────────── */}
      {coverage && coverage.issues.length > 0 && (
        <div className="px-6 py-3 border-b border-gray-100 bg-amber-50">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-1.5">Detected Gaps</p>
          <ul className="space-y-0.5">
            {coverage.issues.map(issue => (
              <li key={issue} className="flex items-start gap-1.5 text-sm text-amber-800">
                <span className="mt-0.5 shrink-0">⚠</span>
                <span>{issue}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Rows ────────────────────────────────────────────────────────────── */}
      {wiresNeedingAttention.length > 0 ? (
        <div className="divide-y divide-gray-100">
          {wiresNeedingAttention.map(wire => {
            const correction = editedWires[wire.wire_id] ?? {};
            const locked     = Boolean(confirmedWires[wire.wire_id]);
            const override   = confirmedWires[wire.wire_id];
            const missingLen  = isMissingLength(wire);
            const missingTerm = isMissingTerminal(wire);
            const missingPin  = isMissingPin(wire);

            if (locked && override) {
              return (
                <div key={wire.wire_id} className="px-6 py-4 bg-emerald-50/60">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="font-mono text-sm font-semibold text-gray-800">{wire.wire_id}</span>
                    <span className="text-xs text-gray-400">{wire.color ?? ''} {wire.gauge ?? ''}</span>
                    <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-200 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                      🔒 Locked (User Confirmed)
                    </span>
                    <button
                      type="button"
                      onClick={() => unlockWire(wire.wire_id)}
                      className="text-xs text-gray-400 hover:text-gray-600 underline"
                    >
                      Edit Again
                    </button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3 text-xs text-gray-600">
                    <div><span className="font-semibold uppercase tracking-wide text-gray-400">Terminal</span><br />{override.terminal ?? '—'}</div>
                    <div><span className="font-semibold uppercase tracking-wide text-gray-400">Length (mm)</span><br />{override.length ?? '—'}</div>
                    <div><span className="font-semibold uppercase tracking-wide text-gray-400">Connector / Pin</span><br />{override.pin ?? '—'}</div>
                  </div>
                </div>
              );
            }

            return (
              <div key={wire.wire_id} className="px-6 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="font-mono text-sm font-semibold text-gray-800">{wire.wire_id}</span>
                  <span className="text-xs text-gray-400">{wire.color ?? ''} {wire.gauge ?? ''}</span>
                  {(missingLen || missingTerm || missingPin) && (
                    <span className="ml-auto inline-flex items-center rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                      Needs attention
                    </span>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="space-y-1">
                    <span className={`text-xs font-semibold uppercase tracking-wide ${missingTerm && !correction.terminal ? 'text-red-600' : 'text-gray-500'}`}>
                      Terminal {missingTerm && !correction.terminal ? '⚠' : ''}
                    </span>
                    <input
                      type="text"
                      value={correction.terminal ?? wire.end_a.terminal_part_number ?? ''}
                      placeholder={missingTerm ? 'Enter terminal PN…' : wire.end_a.terminal_part_number ?? ''}
                      onChange={e => handleEdit(wire.wire_id, 'terminal', e.target.value)}
                      className={`w-full rounded-lg border px-3 py-1.5 text-sm outline-none ring-1 ring-transparent focus:ring-2 transition ${fieldClass(missingTerm && !correction.terminal)}`}
                    />
                  </label>

                  <label className="space-y-1">
                    <span className={`text-xs font-semibold uppercase tracking-wide ${missingLen && correction.cut_length === undefined ? 'text-red-600' : 'text-gray-500'}`}>
                      Length (mm) {missingLen && correction.cut_length === undefined ? '⚠' : ''}
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={correction.cut_length ?? wire.cut_length ?? ''}
                      placeholder={missingLen ? 'Enter length…' : String(wire.cut_length ?? '')}
                      onChange={e => handleEdit(wire.wire_id, 'cut_length', e.target.value === '' ? '' : Number(e.target.value))}
                      className={`w-full rounded-lg border px-3 py-1.5 text-sm outline-none ring-1 ring-transparent focus:ring-2 transition ${fieldClass(missingLen && correction.cut_length === undefined)}`}
                    />
                  </label>

                  <label className="space-y-1">
                    <span className={`text-xs font-semibold uppercase tracking-wide ${missingPin && !correction.pin ? 'text-red-600' : 'text-gray-500'}`}>
                      Connector / Pin {missingPin && !correction.pin ? '⚠' : ''}
                    </span>
                    <input
                      type="text"
                      value={correction.pin ?? wire.end_a.connector_id ?? ''}
                      placeholder={missingPin ? 'e.g. C1-3…' : wire.end_a.connector_id ?? ''}
                      onChange={e => handleEdit(wire.wire_id, 'pin', e.target.value)}
                      className={`w-full rounded-lg border px-3 py-1.5 text-sm outline-none ring-1 ring-transparent focus:ring-2 transition ${fieldClass(missingPin && !correction.pin)}`}
                    />
                  </label>
                </div>

                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => confirmWire(wire.wire_id)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition"
                  >
                    ✔ Confirm
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="px-6 py-6 text-center">
          <p className="text-sm font-semibold text-emerald-700">All wires have complete data</p>
          <p className="text-xs text-gray-400 mt-0.5">No corrections required at this time</p>
        </div>
      )}

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
        <p className="text-xs text-gray-500">
          {wiresNeedingAttention.length > 0
            ? `${wiresNeedingAttention.length} wire${wiresNeedingAttention.length > 1 ? 's' : ''} need review`
            : 'No wires need review'}
        </p>
        <p className="text-xs text-gray-400">Corrections are local only — persistence coming in a future phase</p>
      </div>
    </div>
  );
}
