'use client';

/**
 * AdaptivePipelineDebugPanel — Phase 3H.48 C10.1
 *
 * Read-only visual debug view for the adaptive drawing pipeline routing layer.
 * Shows the selected processing mode, signal scores, rationale, and what the
 * pipeline produced for each drawing.
 *
 * Governance:
 *   - UI ONLY. No data mutation, no pipeline calls, no side effects.
 *   - Collapsed by default — non-intrusive to normal workflow.
 *   - Safe to render when analysis is undefined (shows empty state).
 */

import React, { useState, useEffect } from 'react';
import type { AdaptiveDrawingAnalysis, DrawingProcessingMode } from '@/src/features/harness-work-instructions/services/adaptiveDrawingPipelineService';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  analysis?: AdaptiveDrawingAnalysis;
  hasStructuredData?: boolean;
  hasInterpretation?: boolean;
  hasCoverage?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function modeBadgeStyle(mode: DrawingProcessingMode): string {
  switch (mode) {
    case 'VECTOR_STRUCTURED': return 'bg-emerald-100 text-emerald-800';
    case 'RASTER_OCR':        return 'bg-blue-100 text-blue-800';
    case 'HYBRID_UNKNOWN':    return 'bg-amber-100 text-amber-800';
  }
}

function modeLabel(mode: DrawingProcessingMode): string {
  switch (mode) {
    case 'VECTOR_STRUCTURED': return 'VECTOR';
    case 'RASTER_OCR':        return 'RASTER / OCR';
    case 'HYBRID_UNKNOWN':    return 'HYBRID';
  }
}

function OutputFlag({ label, present }: { label: string; present: boolean }) {
  return (
    <div className="flex items-center gap-1.5 text-sm">
      <span className={present ? 'text-emerald-600 font-bold' : 'text-gray-400'}>
        {present ? '✔' : '✖'}
      </span>
      <span className={present ? 'text-gray-800' : 'text-gray-400'}>{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdaptivePipelineDebugPanel({
  analysis,
  hasStructuredData = false,
  hasInterpretation = false,
  hasCoverage       = false,
}: Props) {
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    console.log('[ADAPTIVE DEBUG VIEW]', {
      mode:   analysis?.mode,
      vector: analysis?.vectorSignalScore,
      raster: analysis?.rasterSignalScore,
    });
  }, [analysis]);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">Adaptive Pipeline</h2>
          {analysis && (
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${modeBadgeStyle(analysis.mode)}`}>
              {modeLabel(analysis.mode)}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(c => !c)}
          className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition"
        >
          {collapsed ? 'Show Pipeline Routing ▾' : 'Hide ▴'}
        </button>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      {!collapsed && (
        <div className="px-6 py-5 space-y-5">
          {!analysis ? (
            <p className="text-sm text-gray-500 italic">Adaptive analysis not available.</p>
          ) : (
            <>
              {/* ── Section 1: Mode Summary ──────────────────────────────────── */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
                  Mode Summary
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3">
                    <p className="text-xs text-gray-500 mb-0.5">Mode</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${modeBadgeStyle(analysis.mode)}`}>
                      {analysis.mode.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3">
                    <p className="text-xs text-gray-500 mb-0.5">Text Length</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {analysis.detectedTextLength.toLocaleString()} chars
                    </p>
                  </div>
                  <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3">
                    <p className="text-xs text-gray-500 mb-0.5">Vector Score</p>
                    <p className={`text-sm font-semibold ${analysis.vectorSignalScore > analysis.rasterSignalScore ? 'text-emerald-700' : 'text-gray-500'}`}>
                      {analysis.vectorSignalScore}
                      {analysis.vectorSignalScore > analysis.rasterSignalScore && (
                        <span className="ml-1 text-xs text-emerald-500">↑ winner</span>
                      )}
                    </p>
                  </div>
                  <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3">
                    <p className="text-xs text-gray-500 mb-0.5">Raster Score</p>
                    <p className={`text-sm font-semibold ${analysis.rasterSignalScore > analysis.vectorSignalScore ? 'text-blue-700' : 'text-gray-500'}`}>
                      {analysis.rasterSignalScore}
                      {analysis.rasterSignalScore > analysis.vectorSignalScore && (
                        <span className="ml-1 text-xs text-blue-400">↑ winner</span>
                      )}
                    </p>
                  </div>
                </div>
              </section>

              {/* ── Section 2: Rationale ─────────────────────────────────────── */}
              {analysis.rationale.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                    Why this decision
                  </h3>
                  <ul className="space-y-1">
                    {analysis.rationale.map((reason, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                        <span className="text-gray-400 mt-0.5 shrink-0">–</span>
                        {reason}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* ── Section 3: Pipeline Output ───────────────────────────────── */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                  Pipeline Output
                </h3>
                <div className="flex flex-wrap gap-4">
                  <OutputFlag label="Structured Data"   present={hasStructuredData} />
                  <OutputFlag label="Interpretation"    present={hasInterpretation} />
                  <OutputFlag label="Coverage"          present={hasCoverage} />
                </div>
              </section>
            </>
          )}
        </div>
      )}
    </div>
  );
}
