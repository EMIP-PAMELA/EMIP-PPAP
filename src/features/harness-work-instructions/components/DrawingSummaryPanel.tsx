/**
 * Harness Work Instruction Generator — Drawing Summary Panel
 * Phase HWI.8 — Drawing Ingestion Foundation
 *
 * Displays a compact summary of the CanonicalDrawingDraft produced by
 * drawingIngestionService. Intentionally read-only — no editing in this phase.
 */

'use client';

import React from 'react';
import type { CanonicalDrawingDraft, DraftFlag } from '../types/drawingDraft';
import type { DrawingType } from '../types/drawingTypes';

interface DrawingSummaryPanelProps {
  drawing: CanonicalDrawingDraft;
  onDismiss?: () => void;
}

const TYPE_BADGE: Record<DrawingType, { label: string; cls: string }> = {
  STRUCTURED_TABLE: { label: 'Structured Table', cls: 'bg-blue-100 text-blue-800' },
  SIMPLE_WIRE:      { label: 'Simple Wire',       cls: 'bg-green-100 text-green-800' },
  CALLOUT:          { label: 'Callout',            cls: 'bg-yellow-100 text-yellow-800' },
  HARNESS_LAYOUT:   { label: 'Harness Layout',     cls: 'bg-purple-100 text-purple-800' },
  UNKNOWN:          { label: 'Unknown',             cls: 'bg-gray-100 text-gray-600' },
};

const FLAG_CLS: Record<DraftFlag['flag_type'], string> = {
  warning:         'bg-orange-50 border-orange-200 text-orange-700',
  info:            'bg-blue-50 border-blue-200 text-blue-700',
  review_required: 'bg-red-50 border-red-200 text-red-700',
};

const FLAG_ICON: Record<DraftFlag['flag_type'], string> = {
  warning:         '⚠️',
  info:            'ℹ️',
  review_required: '🔍',
};

export default function DrawingSummaryPanel({ drawing, onDismiss }: DrawingSummaryPanelProps) {
  const badge = TYPE_BADGE[drawing.drawing_type];
  const unresolvedFlags = drawing.flags;

  return (
    <div className="border border-gray-200 rounded-lg bg-white shadow-sm text-xs overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-base">📐</span>
          <span className="font-semibold text-gray-700">
            Drawing: {drawing.drawing_number ?? '—'} · Rev {drawing.revision ?? '—'}
          </span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${badge.cls}`}>
            {badge.label}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-gray-400">
            {drawing.wire_rows.length} wire row{drawing.wire_rows.length !== 1 ? 's' : ''} ·{' '}
            {drawing.notes.length} note{drawing.notes.length !== 1 ? 's' : ''} ·{' '}
            {unresolvedFlags.length} flag{unresolvedFlags.length !== 1 ? 's' : ''}
          </span>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-gray-400 hover:text-gray-600 transition-colors font-medium"
              title="Dismiss drawing summary"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-0 divide-x divide-gray-100">

        {/* Metadata column */}
        <div className="flex-1 px-3 py-2 space-y-1 min-w-0">
          <div className="font-medium text-gray-500 mb-1.5">Metadata</div>
          <div className="flex gap-1.5">
            <span className="text-gray-400 shrink-0">Title:</span>
            <span className="text-gray-700 truncate">{drawing.title ?? '—'}</span>
          </div>
          <div className="flex gap-1.5">
            <span className="text-gray-400 shrink-0">Pages:</span>
            <span className="text-gray-700">~{drawing.source_pages}</span>
          </div>
          <div className="flex gap-1.5">
            <span className="text-gray-400 shrink-0">Source:</span>
            <span className="text-gray-700 truncate">{drawing.provenance.source_filename ?? '—'}</span>
          </div>
          <div className="flex gap-1.5">
            <span className="text-gray-400 shrink-0">Text:</span>
            <span className="text-gray-700">{drawing.provenance.text_length.toLocaleString()} chars</span>
          </div>
          {drawing.dimensions.length > 0 && (
            <div className="flex gap-1.5 flex-wrap pt-0.5">
              <span className="text-gray-400 shrink-0">Dims:</span>
              {drawing.dimensions.slice(0, 6).map((d, i) => (
                <span key={i} className="font-mono bg-gray-100 px-1 rounded">{d}</span>
              ))}
              {drawing.dimensions.length > 6 && (
                <span className="text-gray-400">+{drawing.dimensions.length - 6} more</span>
              )}
            </div>
          )}
        </div>

        {/* Wire rows preview */}
        {drawing.wire_rows.length > 0 && (
          <div className="flex-1 px-3 py-2 min-w-0">
            <div className="font-medium text-gray-500 mb-1.5">Wire Rows ({drawing.wire_rows.length})</div>
            <div className="space-y-0.5 max-h-28 overflow-y-auto">
              {drawing.wire_rows.slice(0, 8).map((row) => (
                <div key={row.row_index} className="flex gap-2 items-center">
                  <span className="font-mono text-gray-400 shrink-0 w-5">{row.wire_id ?? row.row_index}</span>
                  <span className="text-gray-600 shrink-0">{row.length != null ? `${row.length}"` : '—'}</span>
                  <span className="text-gray-500 shrink-0">{row.gauge ? `${row.gauge}ga` : '—'}</span>
                  <span className="text-gray-500 shrink-0">{row.color ?? '—'}</span>
                  <span className="text-gray-400 truncate font-mono">{row.aci_part_number ?? '—'}</span>
                </div>
              ))}
              {drawing.wire_rows.length > 8 && (
                <div className="text-gray-400 pt-0.5">+{drawing.wire_rows.length - 8} more rows</div>
              )}
            </div>
          </div>
        )}

        {/* Notes preview */}
        {drawing.notes.length > 0 && (
          <div className="w-52 shrink-0 px-3 py-2">
            <div className="font-medium text-gray-500 mb-1.5">Notes ({drawing.notes.length})</div>
            <div className="space-y-0.5 max-h-28 overflow-y-auto">
              {drawing.notes.slice(0, 5).map((n, i) => (
                <div key={i} className="text-gray-600 truncate">{n}</div>
              ))}
              {drawing.notes.length > 5 && (
                <div className="text-gray-400">+{drawing.notes.length - 5} more</div>
              )}
            </div>
          </div>
        )}

        {/* Flags column */}
        {unresolvedFlags.length > 0 && (
          <div className="w-60 shrink-0 px-3 py-2">
            <div className="font-medium text-gray-500 mb-1.5">Flags ({unresolvedFlags.length})</div>
            <div className="space-y-1 max-h-28 overflow-y-auto">
              {unresolvedFlags.map((f) => (
                <div
                  key={f.flag_id}
                  className={`px-2 py-1 rounded border text-[10px] leading-tight ${FLAG_CLS[f.flag_type]}`}
                >
                  <span className="mr-1">{FLAG_ICON[f.flag_type]}</span>
                  {f.message}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
