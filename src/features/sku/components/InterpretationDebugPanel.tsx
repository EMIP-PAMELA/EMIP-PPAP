'use client';

/**
 * InterpretationDebugPanel — Phase 3H.47 C9.1
 *
 * Read-only visual debug view for the structured drawing interpretation layer.
 * Shows connector/wire counts, interpretation score, unresolved issues, and
 * per-wire evidence trails.
 *
 * Governance:
 *   - UI ONLY. No data mutation, no pipeline calls, no side effects.
 *   - Collapsed by default — non-intrusive to normal workflow.
 *   - Safe to render when interpretation is undefined (shows empty state).
 */

import React, { useState, useEffect } from 'react';
import type {
  DrawingInterpretationResult,
  InterpretedWire,
} from '@/src/features/harness-work-instructions/services/drawingInterpretationService';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  interpretation?: DrawingInterpretationResult;
  isHighlighted?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fromLabel(wire: InterpretedWire): string {
  const { connectorId, pin } = wire.from;
  if (connectorId && pin != null) return `${connectorId}-${pin}`;
  if (pin != null) return `Pin ${pin}`;
  return 'Unknown';
}

function toLabel(wire: InterpretedWire): string {
  return wire.to.terminalPartNumber ?? 'Unknown';
}

function scoreColor(s: number): string {
  if (s > 85) return 'bg-emerald-100 text-emerald-700';
  if (s > 70) return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
}

function confidenceColor(c: number): string {
  if (c > 0.85) return 'bg-emerald-100 text-emerald-700';
  if (c > 0.60) return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
}

function UnknownPill() {
  return (
    <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700">
      Unknown
    </span>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function InterpretationDebugPanel({ interpretation, isHighlighted }: Props) {
  const [collapsed, setCollapsed]       = useState(true);
  const [expandedWires, setExpandedWires] = useState<Set<string>>(new Set());

  useEffect(() => {
    console.log('[INTERPRETATION DEBUG VIEW]', {
      wires: interpretation?.wires.length,
      score: interpretation?.interpretationScore,
    });
  }, [interpretation]);

  const toggleWire = (wireId: string) => {
    setExpandedWires(prev => {
      const next = new Set(prev);
      next.has(wireId) ? next.delete(wireId) : next.add(wireId);
      return next;
    });
  };

  const score = interpretation?.interpretationScore ?? 0;

  return (
    <div
      className={`rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden transition-all duration-300${
        isHighlighted ? ' ring-2 ring-amber-400 shadow-lg shadow-amber-100' : ''
      }`}
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">Drawing Interpretation</h2>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${scoreColor(score)}`}>
            Score: {score}%
          </span>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(c => !c)}
          className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition"
        >
          {collapsed ? 'Show Interpretation ▾' : 'Hide ▴'}
        </button>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      {!collapsed && (
        <div className="px-6 py-5 space-y-6">
          {!interpretation ? (
            <p className="text-sm text-gray-500 italic">Interpretation not available.</p>
          ) : (
            <>
              {/* ── Section 1: Summary ──────────────────────────────────────── */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                  Summary
                </h3>
                <div className="flex flex-wrap gap-6 text-sm text-gray-700">
                  <div>
                    <span className="font-semibold text-gray-900">{interpretation.connectors.length}</span>
                    {' '}connector{interpretation.connectors.length !== 1 ? 's' : ''}
                  </div>
                  <div>
                    <span className="font-semibold text-gray-900">{interpretation.wires.length}</span>
                    {' '}wire{interpretation.wires.length !== 1 ? 's' : ''}
                  </div>
                  <div>
                    Score:{' '}
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${scoreColor(score)}`}>
                      {score}%
                    </span>
                  </div>
                </div>
              </section>

              {/* ── Section 2: Unresolved ────────────────────────────────────── */}
              {interpretation.unresolved.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                    Unresolved
                  </h3>
                  <ul className="space-y-1">
                    {interpretation.unresolved.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-amber-800">
                        <span className="text-amber-500 mt-0.5 shrink-0">⚠</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* ── Section 3: Wire Table ────────────────────────────────────── */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
                  Interpreted Wires
                </h3>
                {interpretation.wires.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No wires interpreted.</p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="w-full text-sm border-collapse">
                      <thead className="bg-gray-50">
                        <tr>
                          {['Wire ID', 'From', 'To', 'Length', 'Gauge', 'Color', 'Conf.', ''].map(h => (
                            <th
                              key={h}
                              className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 border-b border-gray-200"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {interpretation.wires.map(wire => {
                          const isExpanded = expandedWires.has(wire.wireId);
                          const from = fromLabel(wire);
                          const to   = toLabel(wire);
                          return (
                            <React.Fragment key={wire.wireId}>
                              <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                <td className="px-3 py-2 font-mono font-semibold text-gray-900">
                                  {wire.wireId}
                                </td>
                                <td className="px-3 py-2">
                                  {from === 'Unknown' ? <UnknownPill /> : (
                                    <span className="text-gray-700">{from}</span>
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  {to === 'Unknown' ? <UnknownPill /> : (
                                    <span className="text-gray-700">{to}</span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-gray-700">
                                  {wire.attributes.length != null
                                    ? `${wire.attributes.length}"`
                                    : <UnknownPill />}
                                </td>
                                <td className="px-3 py-2 text-gray-700">
                                  {wire.attributes.gauge ?? <UnknownPill />}
                                </td>
                                <td className="px-3 py-2 text-gray-700">
                                  {wire.attributes.color ?? <UnknownPill />}
                                </td>
                                <td className="px-3 py-2">
                                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${confidenceColor(wire.confidence)}`}>
                                    {Math.round(wire.confidence * 100)}%
                                  </span>
                                </td>
                                <td className="px-3 py-2">
                                  <button
                                    type="button"
                                    onClick={() => toggleWire(wire.wireId)}
                                    className="text-xs text-blue-500 hover:text-blue-700 transition"
                                    title={isExpanded ? 'Collapse evidence' : 'Expand evidence'}
                                  >
                                    {isExpanded ? '▴' : '▾'}
                                  </button>
                                </td>
                              </tr>

                              {isExpanded && (
                                <tr className="bg-gray-50 border-b border-gray-100">
                                  <td colSpan={8} className="px-4 py-3">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                                      <div>
                                        <p className="font-semibold text-gray-600 mb-1.5">Evidence</p>
                                        <ul className="space-y-0.5">
                                          {wire.evidence.map((e, i) => (
                                            <li key={i} className="flex gap-1.5 text-gray-500">
                                              <span className="text-gray-400 shrink-0">–</span>
                                              {e}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                      {wire.unresolvedFields.length > 0 && (
                                        <div>
                                          <p className="font-semibold text-amber-700 mb-1.5">Missing</p>
                                          <ul className="space-y-0.5">
                                            {wire.unresolvedFields.map((f, i) => (
                                              <li key={i} className="flex gap-1.5 text-amber-700">
                                                <span className="shrink-0">–</span>
                                                {f}
                                              </li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      )}
    </div>
  );
}
