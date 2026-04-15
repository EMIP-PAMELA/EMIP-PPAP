'use client';

/**
 * Upload Workbench — Phase 3H.31 (ADMIN_BATCH_WORKBENCH mode)
 *
 * Full-screen overlay for admin batch uploads. Files are analyzed before commit;
 * no uncertain document enters the DB until all BLOCKING questions are resolved.
 *
 * Flow:  DROP → EXTRACT TEXT → ANALYZE (advisory) → OPERATOR REVIEW → COMMIT (verified)
 */

import React, { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  docTypeRequiresField,
  type WorkbenchItem,
  type WorkbenchItemStatus,
  type IngestionAnalysisResult,
  type UnresolvedQuestion,
  type FieldToResolve,
} from '@/src/features/vault/types/ingestionReview';
import type { DocumentType } from '@/src/features/harness-work-instructions/services/skuService';
import type { FieldExtraction, FieldExtractionSource, EvidenceSignal } from '@/src/features/harness-work-instructions/types/extractionEvidence';
import { resolveDocumentFields, type FieldAuthoritySource } from '@/src/features/harness-work-instructions/services/fieldAuthorityResolver';
import FieldEvidencePanel from './FieldEvidencePanel';
import type { RegionOverlay } from '@/src/features/harness-work-instructions/types/documentRegionOverlay';
import DocumentOverlayViewer from './DocumentOverlayViewer';
import HarnessConnectivityPanel from './HarnessConnectivityPanel';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface UploadWorkbenchProps {
  onClose: () => void;
  onCommitComplete?: () => void;
  /** Optional SKU pre-fill for corrective workflow context. */
  preselectedSku?: string;
}

function renderCandidateDropdown(
  candidates: FieldCandidate[],
  onSelect: (value: string) => void,
): React.ReactNode {
  if (!candidates.length) return null;
  return (
    <div className="border-t border-gray-200 pt-2">
      <div className="text-[11px] font-semibold text-gray-500 mb-1">Other detected values</div>
      <div className="flex flex-col gap-1">
        {candidates.map(candidate => (
          <button
            key={candidate.id}
            type="button"
            onClick={() => onSelect(candidate.value)}
            className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1 text-left text-[11px] text-gray-700 hover:border-blue-300 hover:bg-blue-50"
          >
            {candidate.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function getFieldExtractionFor(analysis: IngestionAnalysisResult | undefined, key: FieldKey): FieldExtraction | null {
  const target = FIELD_TO_EXTRACTION[key];
  return analysis?.extractionEvidence?.field_extractions?.find(fe => fe.field === target) ?? null;
}

function confidenceInputClasses(level: ConfidenceLevel, fallback: string, missing: boolean): string {
  if (missing) return 'border-red-400 bg-red-50';
  if (level === 'high') return 'border-emerald-300 bg-white';
  if (level === 'medium') return 'border-amber-300 bg-white';
  if (level === 'low') return 'border-red-300 bg-red-50';
  return fallback;
}

function acceptButtonClasses(level: ConfidenceLevel): string {
  if (level === 'high') return 'bg-emerald-600 text-white hover:bg-emerald-700';
  if (level === 'medium') return 'bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100';
  return 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed';
}

const truncateSnippet = (value: string, max = 90) => (value.length > max ? `${value.slice(0, max).trim()}…` : value);

function buildCandidatesFromSignals(signals?: EvidenceSignal[]): FieldCandidate[] {
  if (!signals) return [];
  const seen = new Set<string>();
  const candidates: FieldCandidate[] = [];
  signals.forEach((signal, idx) => {
    if (!signal.value) return;
    const dedupeKey = `${signal.value}-${signal.source}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    candidates.push({
      id: `${signal.source}-${idx}`,
      value: signal.value,
      label: `${signal.value} — ${signal.source} (${Math.round(signal.confidence * 100)}%)`,
    });
  });
  return candidates;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DOC_TYPE_LABELS: Record<string, string> = {
  BOM: 'BOM',
  CUSTOMER_DRAWING: 'Customer Drawing',
  INTERNAL_DRAWING: 'Internal Drawing',
  UNKNOWN: '—',
};

type StrictDocumentType = 'BOM' | 'CUSTOMER_DRAWING' | 'INTERNAL_DRAWING';

type UploadMode = 'MIXED' | StrictDocumentType;

const MODE_OPTIONS: { label: string; value: UploadMode }[] = [
  { label: 'Mixed', value: 'MIXED' },
  { label: 'BOM', value: 'BOM' },
  { label: 'Customer Drawing', value: 'CUSTOMER_DRAWING' },
  { label: 'Internal Drawing', value: 'INTERNAL_DRAWING' },
];

const DOC_TYPE_OPTIONS: { label: string; value: StrictDocumentType }[] = [
  { label: 'BOM', value: 'BOM' },
  { label: 'Customer Drawing', value: 'CUSTOMER_DRAWING' },
  { label: 'Internal Drawing', value: 'INTERNAL_DRAWING' },
];

const STATUS_BADGE: Record<WorkbenchItemStatus, string> = {
  queued:          'bg-gray-100 text-gray-600',
  extracting:      'bg-amber-100 text-amber-800',
  analyzing:       'bg-blue-100 text-blue-700',
  ready_to_commit: 'bg-emerald-100 text-emerald-800',
  needs_review:    'bg-orange-100 text-orange-800',
  committing:      'bg-blue-100 text-blue-800',
  committed:       'bg-emerald-600 text-white',
  failed:          'bg-red-100 text-red-800',
};

const STATUS_LABEL: Record<WorkbenchItemStatus, string> = {
  queued:          'Queued',
  extracting:      'Extracting…',
  analyzing:       'Analyzing…',
  ready_to_commit: 'Ready',
  needs_review:    'Needs Review',
  committing:      'Committing…',
  committed:       'Committed',
  failed:          'Failed',
};

type FieldKey = 'partNumber' | 'revision' | 'drawingNumber';
type FieldCandidate = { id: string; value: string; label: string };

interface FieldSectionConfig {
  key: FieldKey;
  label: string;
  required: boolean;
  placeholder: string;
  missing: boolean;
  shouldRender: boolean;
  value: string;
  suggestedValue: string | null;
  operatorConfirmed: boolean;
  confidence: number | null;
  extraction: FieldExtraction | null;
  warning?: string | null;
  candidates: FieldCandidate[];
}

const FIELD_TO_EXTRACTION: Record<FieldKey, FieldExtraction['field']> = {
  partNumber: 'PART_NUMBER',
  revision: 'REVISION',
  drawingNumber: 'DRAWING_NUMBER',
};

type ConfirmableField = 'documentType' | FieldKey;

const FIELD_TO_RESOLVE: Record<ConfirmableField, FieldToResolve | null> = {
  documentType: 'documentType',
  partNumber: 'partNumber',
  revision: 'revision',
  drawingNumber: 'drawingNumber',
};

const SOURCE_BADGES: Record<FieldExtractionSource | 'UNKNOWN', { label: string; className: string }> = {
  AI:        { label: 'AI Suggestion',   className: 'bg-purple-100 text-purple-900 border border-purple-200' },
  OCR:       { label: 'Extracted',       className: 'bg-blue-100 text-blue-900 border border-blue-200' },
  USER:      { label: 'User Confirmed',  className: 'bg-emerald-100 text-emerald-800 border border-emerald-200' },
  USER_CONFIRMED: { label: 'Confirmed by Operator', className: 'bg-emerald-100 text-emerald-800 border border-emerald-300' },
  FILENAME:  { label: 'From Filename',  className: 'bg-gray-100 text-gray-700 border border-gray-200' },
  HEURISTIC: { label: 'Heuristic',      className: 'bg-amber-100 text-amber-900 border border-amber-200' },
  UNKNOWN:   { label: 'Unknown Source', className: 'bg-gray-100 text-gray-600 border border-gray-200' },
};

const AUTHORITY_SOURCE_BADGES: Record<FieldAuthoritySource, { label: string; className: string }> = {
  OPERATOR_CONFIRMED: { label: 'Confirmed by Operator', className: 'bg-emerald-100 text-emerald-800 border border-emerald-300' },
  PARSED_DRAWING:     { label: 'Parsed Drawing',        className: 'bg-blue-100 text-blue-800 border border-blue-300' },
  ADAPTIVE_VECTOR:    { label: 'Adaptive Vector',       className: 'bg-cyan-100 text-cyan-800 border border-cyan-200' },
  INTERPRETATION:     { label: 'Interpretation',        className: 'bg-indigo-100 text-indigo-800 border border-indigo-200' },
  AI_ASSIST:          { label: 'AI Assist',             className: 'bg-purple-100 text-purple-900 border border-purple-200' },
  HEURISTIC:          { label: 'Heuristic',             className: 'bg-amber-100 text-amber-900 border border-amber-200' },
  FILENAME:           { label: 'From Filename',         className: 'bg-gray-100 text-gray-700 border border-gray-200' },
  UNKNOWN:            { label: 'Unknown Source',        className: 'bg-gray-100 text-gray-600 border border-gray-200' },
  TITLE_BLOCK_REGION:      { label: 'Title Block Region',     className: 'bg-violet-100 text-violet-800 border border-violet-300' },
  REVISION_REGION:         { label: 'Revision Record',        className: 'bg-rose-100 text-rose-800 border border-rose-300' },
  TITLE_BLOCK_OCR_CROP:    { label: 'Title Block OCR Crop',   className: 'bg-teal-100 text-teal-800 border border-teal-300' },
  TITLE_BLOCK_VISION_CROP: { label: 'Title Block Vision Crop',className: 'bg-sky-100 text-sky-800 border border-sky-300' },
  AI_VISION:               { label: 'AI Vision Parse',        className: 'bg-fuchsia-100 text-fuchsia-900 border border-fuchsia-300' },
};

type ConfidenceLevel = 'high' | 'medium' | 'low' | 'unknown';

interface ConfidenceMeta {
  level: ConfidenceLevel;
  label: string;
  message: string;
  pillClass: string;
  textClass: string;
}

function describeConfidence(value?: number | null): ConfidenceMeta {
  if (typeof value !== 'number') {
    return {
      level: 'unknown',
      label: 'Confidence unavailable',
      message: 'No confidence score supplied — verify manually.',
      pillClass: 'bg-gray-100 text-gray-600',
      textClass: 'text-gray-500',
    };
  }
  if (value >= 0.9) {
    return {
      level: 'high',
      label: 'High confidence',
      message: 'High confidence — safe to accept after quick visual check.',
      pillClass: 'bg-emerald-100 text-emerald-800',
      textClass: 'text-emerald-700',
    };
  }
  if (value >= 0.6) {
    return {
      level: 'medium',
      label: 'Medium confidence',
      message: 'Review recommended — verify against the source region.',
      pillClass: 'bg-amber-100 text-amber-900',
      textClass: 'text-amber-700',
    };
  }
  return {
    level: 'low',
    label: 'Low confidence',
    message: 'Low confidence — require manual verification before confirming.',
    pillClass: 'bg-red-100 text-red-800',
    textClass: 'text-red-600',
  };
}

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCommitValues(item: WorkbenchItem): {
  documentType: string;
  partNumber: string;
  revision: string;
  drawingNumber: string;
} {
  return {
    documentType:  item.confirmedDocumentType ?? '',
    partNumber:    item.confirmedPartNumber ?? '',
    revision:      item.confirmedRevision ?? '',
    drawingNumber: item.confirmedDrawingNumber ?? '',
  };
}

function isItemReady(item: WorkbenchItem): boolean {
  const dt = item.confirmedDocumentType;
  if (!dt) return false;
  if (!item.confirmedPartNumber?.trim()) return false;
  if (docTypeRequiresField(dt, 'revision') && !item.confirmedRevision?.trim()) return false;
  if (docTypeRequiresField(dt, 'drawingNumber') && !item.confirmedDrawingNumber?.trim()) return false;
  const blocking = item.analysis?.unresolvedQuestions.filter(
    q => q.blocksCommit && !item.answers[q.id]?.trim(),
  ) ?? [];
  return blocking.length === 0;
}

// ---------------------------------------------------------------------------
// QuestionCard sub-component
// ---------------------------------------------------------------------------

function QuestionCard({
  question,
  answer,
  onAnswer,
}: {
  question: UnresolvedQuestion;
  answer: string;
  onAnswer: (value: string) => void;
}) {
  const isBlocking = question.blocksCommit;
  const resolved = Boolean(answer && answer.trim());

  return (
    <div className={`rounded-xl border p-3 space-y-2 ${isBlocking ? 'border-orange-200 bg-orange-50' : 'border-amber-100 bg-amber-50'}`}>
      <div className="flex items-start gap-2">
        <span className={`mt-0.5 shrink-0 text-xs font-bold rounded-full px-2 py-0.5 ${isBlocking ? 'bg-orange-200 text-orange-900' : 'bg-amber-200 text-amber-900'}`}>
          {isBlocking ? 'BLOCKING' : 'WARNING'}
        </span>
        <p className="text-sm text-gray-800">{question.promptText}</p>
        {resolved && <span className="ml-auto shrink-0 text-emerald-600 text-sm font-bold">✓</span>}
      </div>

      {question.fieldToResolve === 'documentType' && (
        <div className="flex flex-wrap gap-2">
          {(['BOM', 'CUSTOMER_DRAWING', 'INTERNAL_DRAWING'] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => onAnswer(t)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition ${
                answer === t
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
              }`}
            >
              {DOC_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      )}

      {(question.fieldToResolve === 'revision' || question.fieldToResolve === 'partNumber') && (
        <div className="flex gap-2">
          <input
            type="text"
            value={answer}
            onChange={e => onAnswer(e.target.value)}
            placeholder={question.fieldToResolve === 'revision' ? 'e.g. B, 02, Rev A' : 'e.g. NH45-110858-01'}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
          {question.suggestedValue && !answer && (
            <button
              type="button"
              onClick={() => onAnswer(question.suggestedValue!)}
              className="text-xs text-blue-600 underline whitespace-nowrap"
            >
              Use "{question.suggestedValue}"
            </button>
          )}
        </div>
      )}

      {question.suggestedValue && question.fieldToResolve !== 'revision' && question.fieldToResolve !== 'partNumber' && (
        <p className="text-xs text-gray-500">
          Suggested by extraction: <span className="font-semibold">{question.suggestedValue}</span>
        </p>
      )}

    </div>
  );
}

// ---------------------------------------------------------------------------
// Evidence panel sub-component
// ---------------------------------------------------------------------------

const FIELD_EXTRACTION_COLORS: Record<string, string> = {
  REVISION: 'text-red-700 bg-red-50 border-red-200',
  PART_NUMBER: 'text-blue-700 bg-blue-50 border-blue-200',
  DRAWING_NUMBER: 'text-green-700 bg-green-50 border-green-200',
};

function EvidencePanel({
  evidence,
  onRegionSelect,
  activeRegionId,
}: {
  evidence: IngestionAnalysisResult['extractionEvidence'];
  onRegionSelect?: (regionId: string) => void;
  activeRegionId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const regions = evidence.document_structure?.regions ?? [];
  const findRegion = (id: string | null) => regions.find(r => r.id === id);

  return (
    <details open={open} onToggle={e => setOpen((e.target as HTMLDetailsElement).open)}
      className="rounded-xl border border-gray-200 bg-gray-50 text-xs">
      <summary className="cursor-pointer px-3 py-2 font-semibold text-gray-600 select-none">
        Evidence Chain {open ? '▲' : '▼'}
      </summary>
      {open && (
        <div className="px-3 pb-3 space-y-3 text-gray-700">
          <div className="text-sky-600 font-semibold">
            Document class: {evidence.document_structure?.document_class_hint ?? '—'}
          </div>

          {/* Field extractions — primary traceability view */}
          {evidence.field_extractions?.length ? (
            <div className="space-y-1">
              <div className="font-medium text-gray-500">Extracted fields</div>
              {evidence.field_extractions.map(fe => {
                const region = findRegion(fe.sourceRegionId);
                const tone = FIELD_EXTRACTION_COLORS[fe.field] ?? 'text-gray-700 bg-gray-50 border-gray-200';
                const isActive = activeRegionId !== null && fe.sourceRegionId === activeRegionId;
                return (
                  <button
                    key={fe.field}
                    type="button"
                    disabled={!fe.sourceRegionId}
                    onClick={() => fe.sourceRegionId && onRegionSelect?.(fe.sourceRegionId)}
                    className={`w-full rounded-lg border px-2 py-1.5 text-left transition ${
                      isActive ? 'ring-2 ring-blue-400' : ''
                    } ${tone} ${fe.sourceRegionId ? 'hover:opacity-90 cursor-pointer' : 'cursor-default opacity-70'}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[11px]">{fe.field.replace('_', ' ')}</span>
                      <span className="text-[10px]">{Math.round(fe.confidence * 100)}% · {fe.source}</span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="font-mono text-[11px] font-semibold">{fe.value ?? '—'}</span>
                      {region
                        ? <span className="text-[10px] underline decoration-dotted">{region.label.replace('_', ' ')} ↗</span>
                        : <span className="text-[10px] text-gray-400">full-text fallback</span>
                      }
                    </div>
                  </button>
                );
              })}
            </div>
          ) : null}

          {/* Raw signals */}
          <div className="space-y-1">
            <div className="font-medium text-gray-500">Revision signals</div>
            {evidence.revision_signals.length === 0
              ? <div className="text-gray-400">none detected</div>
              : evidence.revision_signals.map((s, i) => (
                <div key={i} className="ml-2">
                  <span className="text-blue-600">{s.source}</span>:{' '}
                  <span className="font-semibold">{s.value ?? 'null'}</span>{' '}
                  <span className="text-gray-400">(conf {s.confidence.toFixed(2)})</span>
                </div>
              ))
            }
          </div>
          <div className="space-y-1">
            <div className="font-medium text-gray-500">Part number signals</div>
            {!evidence.part_number_signals?.length
              ? <div className="text-gray-400">none detected</div>
              : evidence.part_number_signals.map((s, i) => (
                <div key={i} className="ml-2">
                  <span className="text-blue-600">{s.source}</span>:{' '}
                  <span className="font-semibold">{s.value ?? 'null'}</span>{' '}
                  <span className="text-gray-400">(conf {s.confidence.toFixed(2)})</span>
                  {s.ignored_reason && (
                    <span className="ml-1 text-red-500">— {s.ignored_reason}</span>
                  )}
                </div>
              ))
            }
          </div>
          <div className="space-y-1">
            <div className="font-medium text-gray-500">Drawing number signals</div>
            {evidence.drawing_number_signals.length === 0
              ? <div className="text-gray-400">none detected</div>
              : evidence.drawing_number_signals.map((s, i) => (
                <div key={i} className="ml-2">
                  <span className="text-blue-600">{s.source}</span>:{' '}
                  <span className="font-semibold">{s.value ?? 'null'}</span>{' '}
                  <span className="text-gray-400">(conf {s.confidence.toFixed(2)})</span>
                  {s.ignored_reason && (
                    <span className="ml-1 text-red-500">— {s.ignored_reason}</span>
                  )}
                </div>
              ))
            }
          </div>

          {evidence.discarded_signals?.length ? (
            <div className="space-y-1">
              <div className="font-medium text-gray-500">Ignored signals</div>
              {evidence.discarded_signals.map((entry, idx) => (
                <div key={idx} className="ml-2">
                  <div className="text-[11px] font-semibold text-gray-600">{entry.field} — {entry.reason}</div>
                  {entry.signals.map((signal, i) => (
                    <div key={i} className="text-[11px] text-gray-500">
                      {signal.source}: {signal.value ?? 'null'}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : null}

          {evidence.document_structure && (
            <div className="text-gray-500">
              Structure: title_block={String(evidence.document_structure.has_title_block)} ·
              connectors={String(evidence.document_structure.has_connector_tables)} ·
              wire_map={String(evidence.document_structure.has_wire_mapping)}
            </div>
          )}
          {regions.length > 0 && (
            <div className="space-y-1">
              <div className="font-medium text-gray-500">Detected regions ({regions.length})</div>
              {regions.map(region => (
                <button
                  key={region.id}
                  type="button"
                  onClick={() => onRegionSelect?.(region.id)}
                  className={`w-full rounded-lg border px-2 py-1 text-left transition ${
                    activeRegionId === region.id ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-200'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] font-semibold text-gray-700">
                    <span>{region.label.replace('_', ' ')}</span>
                    <span>{Math.round(region.confidence * 100)}%</span>
                  </div>
                  <div className="text-[10px] text-gray-500">
                    box=({region.boundingBox.x.toFixed(2)}, {region.boundingBox.y.toFixed(2)}) · {region.boundingBox.width.toFixed(2)}w × {region.boundingBox.height.toFixed(2)}h
                  </div>
                  {region.extractedText && (
                    <p className="text-[10px] text-gray-400 line-clamp-2">{region.extractedText}</p>
                  )}
                  <p className="text-[10px] text-gray-400">source: {region.source}</p>
                </button>
              ))}
            </div>
          )}
          <div className="text-gray-400">captured {evidence.captured_at}</div>
        </div>
      )}
    </details>
  );
}

// ---------------------------------------------------------------------------
// Parsed Drawing Data Panel (Phase 3H.43.X)
// ---------------------------------------------------------------------------

interface ParsedWire { id: string; length: number | null; gauge: string | null; color: string | null; pin: number | null }
interface ParsedConnector { manufacturer: string | null; partNumber: string | null; torque: string | null; color: string | null }
interface ParsedNotes { tolerances: string[]; instructions: string[] }
interface ParsedQuality { wireTableDetected: boolean; connectorTableDetected: boolean; titleBlockDetected: boolean; wireCount: number; connectorCount: number; toleranceCount: number }

function ParsedDrawingDataPanel({ data }: { data: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  const wires = (data.wires ?? []) as ParsedWire[];
  const connectors = (data.connectors ?? []) as ParsedConnector[];
  const notes = (data.notes ?? { tolerances: [], instructions: [] }) as ParsedNotes;
  const quality = data.parseQuality as ParsedQuality | undefined;
  const partNumber = data.partNumber as string | null;
  const revision = data.revision as string | null;
  const description = data.description as string | null;

  const wireCount = wires.length;
  const connectorCount = connectors.length;
  const hasData = wireCount > 0 || connectorCount > 0 || notes.tolerances.length > 0;

  return (
    <details open={open} onToggle={e => setOpen((e.target as HTMLDetailsElement).open)}
      className="rounded-xl border border-indigo-200 bg-indigo-50/50 text-xs">
      <summary className="cursor-pointer px-3 py-2 font-semibold text-indigo-700 select-none flex items-center gap-2">
        <span>Parsed Drawing Data</span>
        {hasData && <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] text-indigo-800">{wireCount}W · {connectorCount}C</span>}
        <span className="ml-auto text-[10px] text-indigo-400">{open ? '▲' : '▼'}</span>
      </summary>
      {open && (
        <div className="px-3 pb-3 space-y-3 text-gray-700">
          {/* Header fields */}
          <div className="flex flex-wrap gap-3 text-[11px]">
            {partNumber && <div><span className="font-semibold text-gray-500">PN:</span> <span className="font-mono font-semibold">{partNumber}</span></div>}
            {revision && <div><span className="font-semibold text-gray-500">Rev:</span> <span className="font-mono font-semibold">{revision}</span></div>}
            {description && <div><span className="font-semibold text-gray-500">Desc:</span> <span className="text-gray-600">{description}</span></div>}
          </div>

          {/* Parse quality summary */}
          {quality && (
            <div className="flex flex-wrap gap-2 text-[10px]">
              <span className={`rounded-full px-2 py-0.5 font-semibold ${quality.titleBlockDetected ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'}`}>
                Title Block {quality.titleBlockDetected ? '✓' : '✗'}
              </span>
              <span className={`rounded-full px-2 py-0.5 font-semibold ${quality.wireTableDetected ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'}`}>
                Wire Table {quality.wireTableDetected ? '✓' : '✗'}
              </span>
              <span className={`rounded-full px-2 py-0.5 font-semibold ${quality.connectorTableDetected ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'}`}>
                Connectors {quality.connectorTableDetected ? '✓' : '✗'}
              </span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 font-semibold text-gray-600">
                {quality.toleranceCount} tolerance{quality.toleranceCount !== 1 ? 's' : ''}
              </span>
            </div>
          )}

          {/* Wire table */}
          {wireCount > 0 && (
            <div>
              <div className="font-semibold text-gray-500 mb-1">Wire Table ({wireCount})</div>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-[11px]">
                  <thead className="bg-gray-100 text-gray-500 uppercase text-[10px]">
                    <tr>
                      <th className="px-2 py-1 text-left">ID</th>
                      <th className="px-2 py-1 text-right">Length</th>
                      <th className="px-2 py-1 text-left">Gauge</th>
                      <th className="px-2 py-1 text-left">Color</th>
                      <th className="px-2 py-1 text-right">Pin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wires.slice(0, 50).map((w, idx) => (
                      <tr key={idx} className="border-t border-gray-100 hover:bg-indigo-50/40">
                        <td className="px-2 py-0.5 font-mono font-semibold">{w.id}</td>
                        <td className="px-2 py-0.5 text-right font-mono">{w.length !== null ? w.length.toFixed(2) : '—'}</td>
                        <td className="px-2 py-0.5">{w.gauge ?? '—'}</td>
                        <td className="px-2 py-0.5">{w.color ?? '—'}</td>
                        <td className="px-2 py-0.5 text-right">{w.pin !== null ? w.pin : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {wireCount > 50 && <div className="px-2 py-1 text-[10px] text-gray-400">Showing first 50 of {wireCount} wires</div>}
              </div>
            </div>
          )}

          {/* Connector table */}
          {connectorCount > 0 && (
            <div>
              <div className="font-semibold text-gray-500 mb-1">Connectors ({connectorCount})</div>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-[11px]">
                  <thead className="bg-gray-100 text-gray-500 uppercase text-[10px]">
                    <tr>
                      <th className="px-2 py-1 text-left">Manufacturer</th>
                      <th className="px-2 py-1 text-left">Part Number</th>
                      <th className="px-2 py-1 text-left">Torque</th>
                      <th className="px-2 py-1 text-left">Color</th>
                    </tr>
                  </thead>
                  <tbody>
                    {connectors.map((c, idx) => (
                      <tr key={idx} className="border-t border-gray-100 hover:bg-indigo-50/40">
                        <td className="px-2 py-0.5">{c.manufacturer ?? '—'}</td>
                        <td className="px-2 py-0.5 font-mono">{c.partNumber ?? '—'}</td>
                        <td className="px-2 py-0.5">{c.torque ?? '—'}</td>
                        <td className="px-2 py-0.5">{c.color ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Notes */}
          {(notes.tolerances.length > 0 || notes.instructions.length > 0) && (
            <div>
              <div className="font-semibold text-gray-500 mb-1">Notes</div>
              {notes.tolerances.length > 0 && (
                <div className="mb-1">
                  <div className="text-[10px] font-semibold text-amber-700 mb-0.5">Wire Length Tolerances</div>
                  {notes.tolerances.map((t, idx) => (
                    <div key={idx} className="text-[11px] text-gray-600 ml-2">{t}</div>
                  ))}
                </div>
              )}
              {notes.instructions.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold text-gray-600 mb-0.5">Instructions</div>
                  {notes.instructions.map((n, idx) => (
                    <div key={idx} className="text-[11px] text-gray-600 ml-2">{n}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!hasData && (
            <div className="text-[11px] text-gray-400">No structured data extracted from this drawing.</div>
          )}
        </div>
      )}
    </details>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function UploadWorkbench({ onClose, onCommitComplete, preselectedSku }: UploadWorkbenchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems]         = useState<WorkbenchItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [filter, setFilter]       = useState<'all' | 'needs_review' | 'ready' | 'committed'>('all');
  const [uploadMode, setUploadMode] = useState<UploadMode>('MIXED');
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [activeRegionId, setActiveRegionId] = useState<string | null>(null);
  const [debugFallbackCrops, setDebugFallbackCrops] = useState<Record<string, string>>({});

  const updateItem = useCallback((id: string, patch: Partial<WorkbenchItem>) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...patch } : item));
  }, []);

  const setConfirmedField = useCallback((
    itemId: string,
    field: ConfirmableField,
    rawValue: string,
  ) => {
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const patch: Partial<WorkbenchItem> = {};
      const value = typeof rawValue === 'string' ? rawValue : '';

      if (field === 'documentType') {
        patch.confirmedDocumentType = value ? (value as WorkbenchItem['confirmedDocumentType']) : undefined;
      } else if (field === 'partNumber') {
        patch.confirmedPartNumber = value;
      } else if (field === 'revision') {
        patch.confirmedRevision = value;
      } else if (field === 'drawingNumber') {
        patch.confirmedDrawingNumber = value;
      }

      const nextOperatorConfirmed = { ...item.operatorConfirmed, [field]: true };
      patch.operatorConfirmed = nextOperatorConfirmed;

      const questionField = FIELD_TO_RESOLVE[field];
      if (questionField && item.analysis) {
        const filteredQuestions = item.analysis.unresolvedQuestions.filter(q => q.fieldToResolve !== questionField);
        if (filteredQuestions.length !== item.analysis.unresolvedQuestions.length) {
          patch.analysis = { ...item.analysis, unresolvedQuestions: filteredQuestions };
        }
      }

      const updated = { ...item, ...patch };
      patch.status = isItemReady(updated) ? 'ready_to_commit' : 'needs_review';

      console.log('[CONFIRM OVERRIDE]', {
        file: item.file.name,
        field,
        value,
        locked: true,
      });

      return { ...item, ...patch };
    }));
  }, []);

  const focusRegion = useCallback((regionId?: string | null) => {
    if (!regionId) return;
    setActiveRegionId(regionId);
  }, []);

  const openEvidenceAtRegion = useCallback((regionId?: string | null) => {
    if (!regionId) return;
    setActiveRegionId(regionId);
    setOverlayOpen(true);
  }, []);

  const answerQuestion = useCallback((itemId: string, question: UnresolvedQuestion, value: string) => {
    setItems(prev => prev.map(item => (
      item.id === itemId
        ? { ...item, answers: { ...item.answers, [question.id]: value } }
        : item
    )));
    if (value.trim() && question.fieldToResolve) {
      setConfirmedField(itemId, question.fieldToResolve, value);
    }
  }, [setConfirmedField]);

  const processFile = useCallback(async (id: string, file: File, forcedType?: StrictDocumentType) => {
    updateItem(id, { status: 'extracting' });

    let extractedText: string | undefined;
    try {
      const { extractTextFromPDF } = await import('@/src/features/documentEngine/utils/pdfToText');
      extractedText = await extractTextFromPDF(file);
    } catch {
      updateItem(id, { status: 'failed', error: 'Failed to extract text from PDF.' });
      return;
    }

    updateItem(id, { status: 'analyzing', extractedText });

    // C12.2: For INTERNAL_DRAWING, generate coordinate-filtered region text and
    // a cropped title block image for targeted OCR/vision extraction.
    const isLikelyInternal = forcedType === 'INTERNAL_DRAWING' ||
      (extractedText != null && /\b527-\d{4}-010\b/.test(extractedText));

    const TB_REGION = { x: 0.55, y: 0.78, w: 0.42, h: 0.20 };
    let titleBlockRegionText: string[] | null = null;
    let titleBlockCropDataUrl: string | null   = null;

    if (isLikelyInternal) {
      const blobUrl = URL.createObjectURL(file);
      try {
        const [{ extractPDFRegionText }, { renderPdfToImage }, { cropImageRegion }] = await Promise.all([
          import('@/src/utils/extractPDFRegionText'),
          import('@/src/utils/renderPdfToImage'),
          import('@/src/utils/cropImageRegion'),
        ]);
        const [regionLines, fullImage] = await Promise.all([
          extractPDFRegionText(file, TB_REGION).catch(() => null),
          renderPdfToImage(blobUrl).catch(() => null),
        ]);
        if (regionLines?.length)     titleBlockRegionText  = regionLines;
        if (fullImage)               titleBlockCropDataUrl = await cropImageRegion(fullImage, TB_REGION).catch(() => null);
        console.log('[C12.2 CROP DISPATCH]', {
          file: file.name,
          regionLines: regionLines?.length ?? 0,
          cropDataUrlLength: titleBlockCropDataUrl?.length ?? 0,
        });
      } catch (err) {
        console.warn('[C12.2 CROP DISPATCH] Non-fatal crop step failed', err);
      } finally {
        URL.revokeObjectURL(blobUrl);
      }
    }

    // C12.4: Fallback region extraction — runs when the 45-PN was NOT found in the primary
    // OCR text AND the document type is INTERNAL_DRAWING. This covers both cases where
    // isLikelyInternal=true (527 DRN present but PN absent) and isLikelyInternal=false
    // (title block not reached by primary OCR at all).
    // Region: bottom 25% / right 50% of page — the assumed Apogee title block position.
    const TB_FALLBACK_REGION = { x: 0.40, y: 0.65, w: 0.60, h: 0.35 };
    let titleBlockFallbackText: string[] | null = null;
    let titleBlockFallbackCropUrl: string | null = null;

    const partNumberFound = extractedText != null && /\b45-\d{5,6}-\d{2,4}\b/.test(extractedText);
    if (!partNumberFound && forcedType === 'INTERNAL_DRAWING') {
      const blobUrl = URL.createObjectURL(file);
      try {
        const [{ extractPDFRegionText }, { renderPdfToImage }, { cropImageRegion }] = await Promise.all([
          import('@/src/utils/extractPDFRegionText'),
          import('@/src/utils/renderPdfToImage'),
          import('@/src/utils/cropImageRegion'),
        ]);
        const [fallbackLines, fullImage] = await Promise.all([
          extractPDFRegionText(file, TB_FALLBACK_REGION).catch(() => null),
          renderPdfToImage(blobUrl).catch(() => null),
        ]);
        if (fallbackLines?.length) titleBlockFallbackText   = fallbackLines;
        if (fullImage)             titleBlockFallbackCropUrl = await cropImageRegion(fullImage, TB_FALLBACK_REGION).catch(() => null);
        console.log('[C12.4 DEBUG] Fallback OCR Lines:', titleBlockFallbackText);
        console.log('[C12.4 DEBUG] Fallback Crop Generated:', !!titleBlockFallbackCropUrl);
        console.log('[C12.4 FALLBACK DISPATCH]', {
          file: file.name,
          fallbackLines: fallbackLines?.length ?? 0,
          fallbackCropLength: titleBlockFallbackCropUrl?.length ?? 0,
        });
        if (titleBlockFallbackCropUrl) {
          setDebugFallbackCrops(prev => ({ ...prev, [id]: titleBlockFallbackCropUrl! }));
        }
      } catch (err) {
        console.warn('[C12.4 FALLBACK DISPATCH] Non-fatal fallback crop step failed', err);
      } finally {
        URL.revokeObjectURL(blobUrl);
      }
    }

    try {
      const fd = new FormData();
      fd.append('file', file);
      if (extractedText)             fd.append('extracted_text',          extractedText);
      if (preselectedSku)            fd.append('part_number_hint',         preselectedSku);
      if (forcedType)                fd.append('forced_document_type',     forcedType);
      if (titleBlockRegionText)      fd.append('title_block_region_text',         JSON.stringify(titleBlockRegionText));
      if (titleBlockCropDataUrl)     fd.append('title_block_crop',                titleBlockCropDataUrl);
      if (titleBlockFallbackText)    fd.append('title_block_fallback_region_text', JSON.stringify(titleBlockFallbackText));
      if (titleBlockFallbackCropUrl) fd.append('title_block_fallback_crop',        titleBlockFallbackCropUrl);

      const res  = await fetch('/api/upload/analyze', { method: 'POST', body: fd });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        updateItem(id, { status: 'failed', error: json.error ?? 'Analysis failed.' });
        return;
      }

      const analysis: IngestionAnalysisResult = json.analysis;

      // C11: Run field authority resolver to promote Parsed Drawing PN/Rev above
      // the heuristic pipeline — fixes the case where Rheem title-block sanity
      // filtering drops the PN before it can reach the confirm field.
      const arrivedResolved = resolveDocumentFields({
        parsedDrawingData:   analysis.structuredData,
        heuristicCandidates: [
          ...(!analysis.partNumberIsProvisional && analysis.proposedPartNumber ? [{
            field: 'partNumber' as const,
            value: analysis.proposedPartNumber,
            source: 'HEURISTIC' as const,
            confidence: analysis.partNumberConfidence ?? 0.5,
          }] : []),
          ...(analysis.proposedRevision ? [{
            field: 'revision' as const,
            value: analysis.proposedRevision,
            source: 'HEURISTIC' as const,
            confidence: analysis.revisionConfidence ?? 0.5,
          }] : []),
        ],
        filename:             analysis.fileName,
        currentDocType:       analysis.proposedDocumentType,
        titleBlockResult:     analysis.titleBlockRegionResult  ?? null,
        visionResult:         analysis.visionParsedResult      ?? null,
        titleBlockCropResult: analysis.titleBlockCropResult    ?? null,
      });

      const confirmedDocumentType = forcedType ?? (analysis.proposedDocumentType !== 'UNKNOWN'
        ? (analysis.proposedDocumentType as WorkbenchItem['confirmedDocumentType'])
        : undefined);
      const confirmedPartNumber =
        arrivedResolved.partNumber.value
        ?? (!analysis.partNumberIsProvisional ? analysis.proposedPartNumber : undefined)
        ?? preselectedSku
        ?? undefined;
      const confirmedRevision = arrivedResolved.revision.value ?? analysis.proposedRevision ?? undefined;
      const confirmedDrawingNumber = analysis.proposedDrawingNumber ?? undefined;
      const meetsFields = Boolean(
        confirmedDocumentType &&
        confirmedPartNumber?.trim() &&
        (!docTypeRequiresField(confirmedDocumentType, 'revision') || confirmedRevision?.trim()) &&
        (!docTypeRequiresField(confirmedDocumentType, 'drawingNumber') || confirmedDrawingNumber?.trim()),
      );
      const status: WorkbenchItemStatus =
        (meetsFields && analysis.readyToCommit) ? 'ready_to_commit' : 'needs_review';
      updateItem(id, {
        analysis,
        status,
        confirmedDocumentType,
        confirmedPartNumber,
        confirmedRevision,
        confirmedDrawingNumber,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Analysis request failed.';
      updateItem(id, { status: 'failed', error: msg });
    }
  }, [preselectedSku, updateItem]);

  const queueFiles = useCallback((files: FileList | File[]) => {
    const selected = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.pdf'));
    if (selected.length === 0) return;
    const entries: WorkbenchItem[] = selected.map(file => ({
      id: crypto.randomUUID(),
      file,
      status: 'queued' as WorkbenchItemStatus,
      answers: {},
      confirmedDocumentType: uploadMode !== 'MIXED' ? uploadMode : undefined,
    }));
    setItems(prev => [...prev, ...entries]);
    entries.forEach(e => processFile(e.id, e.file, uploadMode !== 'MIXED' ? uploadMode : undefined));
    if (!selectedId && entries.length > 0) setSelectedId(entries[0].id);
  }, [processFile, selectedId, uploadMode]);

  const commitItem = useCallback(async (item: WorkbenchItem) => {
    if (!isItemReady(item)) return;
    const { documentType, partNumber, revision, drawingNumber } = getCommitValues(item);
    updateItem(item.id, { status: 'committing' });

    try {
      const fd = new FormData();
      fd.append('file', item.file);
      if (item.extractedText) fd.append('extracted_text', item.extractedText);
      fd.append('confirmed_document_type', documentType);
      fd.append('confirmed_part_number', partNumber);
      if (revision) fd.append('confirmed_revision', revision);
      if (drawingNumber) fd.append('confirmed_drawing_number', drawingNumber);
      fd.append('confirmation_mode', 'ADMIN_CONFIRMED');
      fd.append('confirmed_by', 'ADMIN_BATCH_WORKBENCH');
      if (item.analysis) fd.append('analysis_snapshot', JSON.stringify(item.analysis));

      const res  = await fetch('/api/upload/commit', { method: 'POST', body: fd });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        updateItem(item.id, { status: 'failed', error: json.error ?? 'Commit failed.' });
        return;
      }

      updateItem(item.id, {
        status: 'committed',
        confirmationMode: 'ADMIN_CONFIRMED',
        commitResult: { ok: true, sku: json.sku, message: json.message },
      });
      onCommitComplete?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Commit request failed.';
      updateItem(item.id, { status: 'failed', error: msg });
    }
  }, [onCommitComplete, updateItem]);

  const commitAllVerified = useCallback(async () => {
    const ready = items.filter(i => i.status === 'ready_to_commit' && isItemReady(i));
    for (const item of ready) {
      await commitItem(item);
    }
  }, [items, commitItem]);

  // --- Derived state ---
  const counts = useMemo(() => ({
    all:          items.length,
    needs_review: items.filter(i => i.status === 'needs_review').length,
    ready:        items.filter(i => i.status === 'ready_to_commit').length,
    committed:    items.filter(i => i.status === 'committed').length,
  }), [items]);

  const filteredItems = useMemo(() => {
    if (filter === 'all') return items;
    if (filter === 'needs_review') return items.filter(i => i.status === 'needs_review');
    if (filter === 'ready') return items.filter(i => i.status === 'ready_to_commit');
    if (filter === 'committed') return items.filter(i => i.status === 'committed');
    return items;
  }, [items, filter]);

  const selectedItem = items.find(i => i.id === selectedId) ?? null;
  const nonCommitted = items.filter(i => i.status !== 'committed' && i.status !== 'committing');
  const canCommitAll = counts.ready > 0 && nonCommitted.every(i => i.status === 'ready_to_commit');
  const blockedCount = nonCommitted.filter(i => i.status !== 'ready_to_commit').length;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="fixed inset-0 z-50 flex h-screen flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b bg-gray-50 px-6 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <h2 className="text-lg font-bold text-gray-900 whitespace-nowrap">Upload Workbench</h2>
          <span className="text-gray-300">·</span>
          <p className="text-sm text-gray-500">Analyze → Review → Commit verified files only</p>
          {preselectedSku && (
            <span className="rounded-full bg-blue-50 px-3 py-0.5 text-xs font-semibold text-blue-700">
              SKU: {preselectedSku}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-600">
            <span>Upload mode:</span>
            <div className="flex gap-1">
              {MODE_OPTIONS.map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setUploadMode(option.value)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                    uploadMode === option.value ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-gray-100 px-4 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-200 transition"
          >
            ✕ Close
          </button>
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={e => { e.preventDefault(); setIsDragging(false); }}
        onDrop={e => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer?.files) queueFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`mx-6 mt-4 flex cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed py-6 transition shrink-0 ${
          isDragging ? 'border-blue-500 bg-blue-50/60' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
        }`}
      >
        <div className="text-center">
          <p className={`text-sm font-semibold ${isDragging ? 'text-blue-700' : 'text-gray-500'}`}>
            {isDragging ? 'Drop PDFs to queue for analysis…' : 'Drop PDFs here or click to browse'}
          </p>
          <p className="mt-0.5 text-xs text-gray-400">Files will be analyzed before any DB write</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf"
          className="hidden"
          onChange={e => {
            if (e.target.files) {
              queueFiles(e.target.files);
              e.target.value = '';
            }
          }}
        />
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0 gap-0 overflow-hidden">
        {/* Left: queue list */}
        <div className="flex w-2/3 min-w-0 flex-col border-r">
          {selectedItem && items.some(i => i.status === 'needs_review') && (
            <div className="flex flex-wrap gap-2 border-b px-4 py-2 shrink-0 bg-amber-50 text-xs items-center">
              <span className="font-semibold text-amber-800 shrink-0">Apply to all needs-review:</span>
              {getCommitValues(selectedItem).partNumber && (
                <button
                  type="button"
                  onClick={() => {
                    const value = getCommitValues(selectedItem).partNumber;
                    items
                      .filter(i => i.status === 'needs_review')
                      .forEach(i => setConfirmedField(i.id, 'partNumber', value));
                  }}
                  className="rounded-full bg-amber-200 px-2.5 py-0.5 font-semibold text-amber-900 hover:bg-amber-300 transition"
                >
                  Part # "{getCommitValues(selectedItem).partNumber}"
                </button>
              )}
              {getCommitValues(selectedItem).revision && (
                <button
                  type="button"
                  onClick={() => {
                    const value = getCommitValues(selectedItem).revision;
                    items
                      .filter(i => i.status === 'needs_review')
                      .forEach(i => setConfirmedField(i.id, 'revision', value));
                  }}
                  className="rounded-full bg-amber-200 px-2.5 py-0.5 font-semibold text-amber-900 hover:bg-amber-300 transition"
                >
                  Rev "{getCommitValues(selectedItem).revision}"
                </button>
              )}
              {selectedItem.confirmedDocumentType && (
                <button
                  type="button"
                  onClick={() => {
                    const value = selectedItem.confirmedDocumentType ?? '';
                    if (!value) return;
                    items
                      .filter(i => i.status === 'needs_review')
                      .forEach(i => setConfirmedField(i.id, 'documentType', value));
                  }}
                  className="rounded-full bg-amber-200 px-2.5 py-0.5 font-semibold text-amber-900 hover:bg-amber-300 transition"
                >
                  Type "{DOC_TYPE_LABELS[selectedItem.confirmedDocumentType]}"
                </button>
              )}
            </div>
          )}

          <div className="flex gap-1 border-b px-4 py-2 shrink-0 bg-white">
            {(['all', 'needs_review', 'ready', 'committed'] as const).map(mode => (
              <button
                key={mode}
                type="button"
                onClick={() => setFilter(mode)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  filter === mode ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {mode === 'all'
                  ? `All (${counts.all})`
                  : mode === 'needs_review'
                    ? `Needs Review (${counts.needs_review})`
                    : mode === 'ready'
                      ? `Ready (${counts.ready})`
                      : `Committed (${counts.committed})`}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">File</th>
                  <th className="px-3 py-2 text-left font-semibold">Type</th>
                  <th className="px-3 py-2 text-left font-semibold">Part #</th>
                  <th className="px-3 py-2 text-left font-semibold">Rev</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map(item => {
                  const vals = getCommitValues(item);
                  const isSelected = item.id === selectedId;
                  const currentDocType = item.confirmedDocumentType ?? vals.documentType ?? '';
                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedId(item.id)}
                      className={`border-b cursor-pointer transition ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                    >
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-gray-900 truncate max-w-[220px]" title={item.file.name}>
                          {item.file.name}
                        </p>
                        <p className="text-xs text-gray-400">{formatBytes(item.file.size)}</p>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-700 whitespace-nowrap">
                        <select
                          className={`rounded-lg border bg-white px-2 py-1 text-xs font-semibold ${
                            !currentDocType ? 'border-red-400 text-red-700' : 'border-gray-300'
                          }`}
                          value={currentDocType}
                          onChange={e => {
                            const nextValue = e.target.value;
                            if (!nextValue) {
                              updateItem(item.id, {
                                confirmedDocumentType: undefined,
                                operatorConfirmed: { ...item.operatorConfirmed, documentType: false },
                                status: 'needs_review',
                              });
                              return;
                            }
                            const typed = nextValue as StrictDocumentType;
                            setConfirmedField(item.id, 'documentType', typed);
                            processFile(item.id, item.file, typed);
                          }}
                        >
                          <option value="">—</option>
                          {DOC_TYPE_OPTIONS.map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        {item.operatorConfirmed?.documentType
                          ? <span className="ml-1 text-[10px] font-semibold text-emerald-700">✓</span>
                          : currentDocType ? <span className="ml-1 text-[10px] text-amber-600">~</span> : null}
                      </td>
                      <td className="px-3 py-2.5 text-xs font-mono text-gray-700">
                        <span className={!vals.partNumber && item.status !== 'queued' && item.status !== 'extracting' && item.status !== 'analyzing' ? 'text-red-500' : ''}>
                          {vals.partNumber || '—'}
                        </span>
                        {vals.partNumber && (
                          <span className={`ml-1 text-[10px] font-semibold ${
                            item.operatorConfirmed?.partNumber ? 'text-emerald-700' : 'text-amber-600'
                          }`}>
                            {item.operatorConfirmed?.partNumber ? '✓' : '~'}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs font-mono text-gray-700">{vals.revision || '—'}</td>
                      <td className="px-3 py-2.5">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[item.status]}`}>
                          {STATUS_LABEL[item.status]}
                        </span>
                        {item.error && (
                          <p className="text-xs text-red-600 mt-0.5 truncate max-w-[120px]" title={item.error}>
                            {item.error}
                          </p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: detail panel */}
        <div className="flex w-[420px] min-w-[420px] flex-col overflow-y-auto">
          {!selectedItem ? (
            <div className="flex flex-1 items-center justify-center text-gray-400 text-sm p-8">Select a file to review</div>
          ) : (
            <div className="p-5 space-y-4">
              <div>
                <p className="text-base font-bold text-gray-900 truncate">{selectedItem.file.name}</p>
                <p className="text-xs text-gray-400">{formatBytes(selectedItem.file.size)}</p>
              </div>

              {/* Inline Confirmation Fields */}
              {(() => {
                const vals = getCommitValues(selectedItem);
                const dt = selectedItem.confirmedDocumentType;
                const needsDrawing = docTypeRequiresField(dt, 'drawingNumber');
                const needsRevision = docTypeRequiresField(dt, 'revision');
                const missingPart = dt && !vals.partNumber?.trim();
                const missingRevision = needsRevision && !vals.revision?.trim();
                const missingDrawing = needsDrawing && !vals.drawingNumber?.trim();
                const analysis = selectedItem.analysis;
                const regionList = analysis?.extractionEvidence?.document_structure?.regions ?? [];
                const regionMap = new Map<string, RegionOverlay>(regionList.map(region => [region.id, region] as [string, RegionOverlay]));
                const partCandidates = buildCandidatesFromSignals(analysis?.extractionEvidence?.part_number_signals);
                const revisionCandidates = buildCandidatesFromSignals(analysis?.extractionEvidence?.revision_signals);
                const drawingCandidates = buildCandidatesFromSignals(analysis?.extractionEvidence?.drawing_number_signals);

                const partExtraction = getFieldExtractionFor(analysis, 'partNumber');
                const revisionExtraction = getFieldExtractionFor(analysis, 'revision');
                const drawingExtraction = getFieldExtractionFor(analysis, 'drawingNumber');

                // C11: Re-run resolver in render for up-to-date suggestedValue + source badge.
                const renderResolved = resolveDocumentFields({
                  operatorConfirmed: {
                    partNumber:   selectedItem.operatorConfirmed?.partNumber   ? (selectedItem.confirmedPartNumber   ?? undefined) : undefined,
                    revision:     selectedItem.operatorConfirmed?.revision     ? (selectedItem.confirmedRevision     ?? undefined) : undefined,
                    documentType: selectedItem.operatorConfirmed?.documentType ? (selectedItem.confirmedDocumentType ?? undefined) : undefined,
                  },
                  parsedDrawingData:   analysis?.structuredData,
                  heuristicCandidates: [
                    ...(!analysis?.partNumberIsProvisional && analysis?.proposedPartNumber ? [{
                      field: 'partNumber' as const,
                      value: analysis.proposedPartNumber,
                      source: 'HEURISTIC' as const,
                      confidence: analysis.partNumberConfidence ?? 0.5,
                    }] : []),
                    ...(analysis?.proposedRevision ? [{
                      field: 'revision' as const,
                      value: analysis.proposedRevision,
                      source: 'HEURISTIC' as const,
                      confidence: analysis.revisionConfidence ?? 0.5,
                    }] : []),
                  ],
                  filename:         selectedItem.file.name,
                  currentDocType:   selectedItem.confirmedDocumentType ?? analysis?.proposedDocumentType,
                  titleBlockResult: analysis?.titleBlockRegionResult ?? null,
                  visionResult:     analysis?.visionParsedResult      ?? null,
                });

                const sections: FieldSectionConfig[] = [
                  {
                    key: 'partNumber' as const,
                    label: 'Part Number',
                    required: true,
                    placeholder: 'e.g. NH45-110858-01',
                    missing: Boolean(missingPart),
                    shouldRender: true,
                    value: vals.partNumber,
                    suggestedValue: renderResolved.partNumber.value ?? analysis?.proposedPartNumber ?? null,
                    operatorConfirmed: Boolean(selectedItem.operatorConfirmed?.partNumber),
                    confidence: renderResolved.partNumber.source !== 'UNKNOWN' ? renderResolved.partNumber.confidence : (analysis?.partNumberConfidence ?? partExtraction?.confidence ?? null),
                    extraction: partExtraction,
                    warning: (analysis?.partNumberIsProvisional && !partExtraction?.locked) ? 'Extraction could not resolve part number — enter manually.' : null,
                    candidates: partCandidates,
                  },
                  {
                    key: 'revision' as const,
                    label: 'Revision',
                    required: Boolean(needsRevision),
                    placeholder: 'e.g. B, 02, Rev A',
                    missing: Boolean(missingRevision),
                    shouldRender: Boolean(needsRevision || analysis?.proposedRevision),
                    value: vals.revision,
                    suggestedValue: renderResolved.revision.value ?? analysis?.proposedRevision ?? null,
                    operatorConfirmed: Boolean(selectedItem.operatorConfirmed?.revision),
                    confidence: renderResolved.revision.source !== 'UNKNOWN' ? renderResolved.revision.confidence : (analysis?.revisionConfidence ?? revisionExtraction?.confidence ?? null),
                    extraction: revisionExtraction,
                    warning: null,
                    candidates: revisionCandidates,
                  },
                  {
                    key: 'drawingNumber' as const,
                    label: 'Drawing Number',
                    required: Boolean(needsDrawing),
                    placeholder: 'e.g. DWG-45-1085',
                    missing: Boolean(missingDrawing),
                    shouldRender: Boolean(needsDrawing || analysis?.proposedDrawingNumber),
                    value: vals.drawingNumber,
                    suggestedValue: analysis?.proposedDrawingNumber ?? null,
                    operatorConfirmed: Boolean(selectedItem.operatorConfirmed?.drawingNumber),
                    confidence: drawingExtraction?.confidence ?? null,
                    extraction: drawingExtraction,
                    warning: null,
                    candidates: drawingCandidates,
                  },
                ].filter(section => section.shouldRender);

                const renderFieldSection = (section: FieldSectionConfig) => {
                  const operatorExtraction: FieldExtraction | null = section.operatorConfirmed
                    ? {
                        field: FIELD_TO_EXTRACTION[section.key],
                        value: section.value ?? null,
                        confidence: 1,
                        sourceRegionId: null,
                        source: 'USER_CONFIRMED',
                        locked: true,
                      }
                    : null;
                  const baseExtraction = operatorExtraction ?? section.extraction;
                  const region = baseExtraction?.sourceRegionId
                    ? regionMap.get(baseExtraction.sourceRegionId) ?? null
                    : null;
                  const isLocked = section.operatorConfirmed || Boolean(baseExtraction?.locked && section.value === (baseExtraction?.value ?? '').trim());
                  const resolvedSrc = renderResolved[section.key as 'partNumber' | 'revision']?.source;
                  const badge = operatorExtraction
                    ? AUTHORITY_SOURCE_BADGES.OPERATOR_CONFIRMED
                    : (resolvedSrc && resolvedSrc !== 'HEURISTIC' && resolvedSrc !== 'UNKNOWN')
                      ? AUTHORITY_SOURCE_BADGES[resolvedSrc]
                      : SOURCE_BADGES[baseExtraction?.source ?? 'UNKNOWN'];
                  const effectiveConfidence = section.operatorConfirmed ? 1 : section.confidence;
                  const confidenceMeta = describeConfidence(effectiveConfidence);
                  const snippet = region?.extractedText ?? baseExtraction?.value ?? null;
                  const value = section.value ?? '';
                  const suggestionAvailable = Boolean(section.suggestedValue);
                  const showAcceptButton = suggestionAvailable && !section.operatorConfirmed;
                  const showConfirmButton = Boolean(value.trim()) && !section.operatorConfirmed;
                  const viewSourceEnabled = Boolean(baseExtraction?.sourceRegionId && region) && !section.operatorConfirmed;
                  const statusChip = section.operatorConfirmed
                    ? { label: 'Confirmed', className: 'bg-emerald-100 text-emerald-800' }
                    : value
                      ? { label: 'Suggested', className: 'bg-amber-100 text-amber-800' }
                      : section.required
                        ? { label: 'Required', className: 'bg-red-100 text-red-700' }
                        : { label: 'Optional', className: 'bg-gray-100 text-gray-600' };
                  const viewSourceTone = confidenceMeta.level === 'medium'
                    ? 'border border-amber-300 text-amber-800 hover:bg-amber-50'
                    : 'border border-blue-200 text-blue-700 hover:bg-blue-50';
                  const confidenceValue = section.operatorConfirmed
                    ? '100%'
                    : typeof section.confidence === 'number'
                      ? `${Math.round(section.confidence * 100)}%`
                      : '—';
                  const descriptiveMessage = section.operatorConfirmed
                    ? 'Confirmed by operator — treated as authoritative.'
                    : isLocked
                      ? 'Resolved from authoritative source — no review required.'
                      : confidenceMeta.message;
                  const messageClass = section.operatorConfirmed || isLocked ? 'text-emerald-700' : confidenceMeta.textClass;
                  const showLowConfidenceNotice = confidenceMeta.level === 'low' && !section.operatorConfirmed && !isLocked;

                  return (
                    <div key={section.key} className="rounded-lg border border-gray-200 bg-white/60 px-3 py-2 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                            {section.label}
                            {section.required && <span className="text-red-500">*</span>}
                          </label>
                          <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusChip.className}`}>
                            {statusChip.label}
                          </span>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>
                          {badge.label}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className={`rounded-full px-2 py-0.5 font-semibold ${confidenceMeta.pillClass}`}>
                          Confidence: {confidenceValue} · {confidenceMeta.label}
                        </span>
                        <button
                          type="button"
                          onClick={() => viewSourceEnabled && openEvidenceAtRegion(baseExtraction?.sourceRegionId)}
                          disabled={!viewSourceEnabled}
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold transition ${viewSourceEnabled ? viewSourceTone : 'border border-gray-200 text-gray-400 cursor-not-allowed opacity-60'}`}
                        >
                          View Source
                        </button>
                      </div>
                      <p className={`text-[11px] ${messageClass}`}>
                        {descriptiveMessage}
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={value}
                          placeholder={section.placeholder}
                          onChange={e => setConfirmedField(selectedItem.id, section.key, e.target.value)}
                          onFocus={() => focusRegion(baseExtraction?.sourceRegionId ?? null)}
                          className={`flex-1 rounded-lg border px-3 py-1.5 text-sm font-mono focus:ring-2 focus:ring-blue-100 ${confidenceInputClasses(confidenceMeta.level, 'border-gray-300 bg-white', section.missing)}`}
                        />
                        {showAcceptButton && (
                          <button
                            type="button"
                            onClick={() => {
                              if (!section.suggestedValue) return;
                              setConfirmedField(selectedItem.id, section.key, section.suggestedValue);
                            }}
                            className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${acceptButtonClasses(confidenceMeta.level)}`}
                          >
                            Accept
                          </button>
                        )}
                        {showConfirmButton && (
                          <button
                            type="button"
                            onClick={() => setConfirmedField(selectedItem.id, section.key, value)}
                            className="shrink-0 rounded-lg border border-emerald-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                          >
                            Confirm
                          </button>
                        )}
                      </div>
                      {section.warning && !isLocked && !section.operatorConfirmed && (
                        <p className="text-[10px] text-orange-600">{section.warning}</p>
                      )}
                      {showLowConfidenceNotice && (
                        <p className="text-[10px] text-red-600 font-semibold">Low confidence — verify manually before confirming.</p>
                      )}
                      {snippet && (
                        <p className="text-[11px] truncate text-gray-500">
                          <span className="font-semibold">Source snippet:</span>{' '}
                          {truncateSnippet(snippet)}
                        </p>
                      )}
                      {renderCandidateDropdown(section.candidates, candidateValue => {
                        setConfirmedField(selectedItem.id, section.key, candidateValue);
                      })}
                      {/* C11.1: Field evidence transparency panel */}
                      {(section.key === 'partNumber' || section.key === 'revision') && (
                        <FieldEvidencePanel
                          label={section.label}
                          resolved={renderResolved[section.key]}
                        />
                      )}
                    </div>
                  );
                };

                return (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 space-y-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Confirm Fields</p>
                    <div className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-[11px] text-purple-900">
                      Values below are AI-assisted suggestions. Please confirm before committing.
                    </div>
                    {sections.length ? sections.map(renderFieldSection) : (
                      <p className="text-xs text-gray-500">Set a document type to receive extraction suggestions.</p>
                    )}

                    {/* Extraction summary + overlay trigger */}
                    <div className="border-t border-gray-200 pt-2 text-[10px] text-gray-400 space-y-1">
                      {analysis && (
                        <p>Extraction type suggestion: <span className="font-semibold text-gray-600">{DOC_TYPE_LABELS[analysis.proposedDocumentType]}</span> ({Math.round(analysis.docTypeConfidence * 100)}% confidence)</p>
                      )}
                      {/* C11.1: Document type authority evidence */}
                      {renderResolved.documentType && (
                        <FieldEvidencePanel
                          label="Document Type"
                          resolved={renderResolved.documentType}
                        />
                      )}
                      {analysis?.extractionEvidence?.document_structure?.regions?.length ? (
                        <button
                          type="button"
                          onClick={() => {
                            const firstRegion = analysis?.extractionEvidence?.document_structure?.regions?.[0]?.id ?? null;
                            setActiveRegionId(firstRegion);
                            setOverlayOpen(true);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100"
                        >
                          View Extraction Overlay ({analysis.extractionEvidence.document_structure!.regions!.length})
                        </button>
                      ) : (
                        <p className="text-[10px] text-gray-500">No overlay regions detected.</p>)
                      }
                    </div>
                  </div>
                );
              })()}

              {selectedItem.analysis?.unresolvedQuestions.length ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Resolution required</p>
                  {selectedItem.analysis.unresolvedQuestions.map(q => (
                    <QuestionCard
                      key={q.id}
                      question={q}
                      answer={selectedItem.answers[q.id] ?? ''}
                      onAnswer={value => answerQuestion(selectedItem.id, q, value)}
                    />
                  ))}
                </div>
              ) : null}

              {selectedItem.analysis?.extractionEvidence ? (
                <EvidencePanel
                  evidence={selectedItem.analysis.extractionEvidence}
                  onRegionSelect={regionId => {
                    setActiveRegionId(regionId);
                    setOverlayOpen(true);
                  }}
                  activeRegionId={activeRegionId}
                />
              ) : null}

              {debugFallbackCrops[selectedItem.id] && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontWeight: 600 }}>C12.4 Debug — Fallback Crop</div>
                  <img
                    src={debugFallbackCrops[selectedItem.id]}
                    alt="Fallback Crop"
                    style={{ width: '100%', border: '1px solid #ccc' }}
                  />
                </div>
              )}

              {selectedItem.analysis?.structuredData ? (
                <ParsedDrawingDataPanel data={selectedItem.analysis.structuredData} />
              ) : null}

              {selectedItem.analysis ? (
                <HarnessConnectivityPanel
                  connectivity={selectedItem.analysis.harnessConnectivity}
                  reconciliation={selectedItem.analysis.harnessReconciliation}
                />
              ) : null}

              {selectedItem.analysis ? (
                <details
                  open
                  className="mt-4 rounded-xl border border-gray-200 bg-gray-50 text-xs shadow-sm"
                >
                  <summary className="cursor-pointer px-3 py-2 font-semibold text-gray-700 select-none">
                    Raw Extraction Debug
                  </summary>
                  <div className="px-3 pb-3">
                    <pre style={{ maxHeight: 400, overflow: 'auto', fontSize: 11 }}>
                      {JSON.stringify(selectedItem.analysis, null, 2)}
                    </pre>
                  </div>
                </details>
              ) : null}

              {selectedItem.status === 'ready_to_commit' ? (
                <button
                  type="button"
                  onClick={() => commitItem(selectedItem)}
                  className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition"
                >
                  Commit This File
                </button>
              ) : null}

              {selectedItem.status === 'committed' && selectedItem.commitResult ? (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
                  <p className="font-semibold">Committed</p>
                  <p className="text-xs mt-0.5">SKU: {selectedItem.commitResult.sku?.part_number ?? '—'}</p>
                  {selectedItem.commitResult.message ? (
                    <p className="text-xs mt-0.5 text-emerald-600">{selectedItem.commitResult.message}</p>
                  ) : null}
                </div>
              ) : null}

              {selectedItem.status === 'failed' && selectedItem.error ? (
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
                  <p className="font-semibold">Failed</p>
                  <p className="text-xs mt-0.5">{selectedItem.error}</p>
                  <button
                    type="button"
                    onClick={() => {
                      updateItem(selectedItem.id, { status: 'queued', error: undefined });
                      processFile(selectedItem.id, selectedItem.file, uploadMode !== 'MIXED' ? uploadMode : undefined);
                    }}
                    className="mt-2 text-xs font-semibold text-red-700 underline"
                  >
                    Retry Analysis
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {items.length > 0 && (
        <div className="flex items-center justify-between border-t bg-gray-50 px-6 py-3">
          <p className="text-xs text-gray-500">
            {counts.ready} ready · {counts.needs_review} need review · {counts.committed} committed
            {blockedCount > 0 && (
              <span className="ml-2 font-semibold text-orange-600">{blockedCount} blocked</span>
            )}
          </p>
          <button
            type="button"
            onClick={commitAllVerified}
            disabled={!canCommitAll}
            className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            Commit All Verified ({counts.ready})
          </button>
        </div>
      )}

      {overlayOpen && selectedItem && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-gray-800">Extraction Overlay</p>
                <p className="text-xs text-gray-500">Visualizing first page regions · {selectedItem.file.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setOverlayOpen(false)}
                className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-200"
              >
                Close
              </button>
            </div>
            <div className="p-4">
              {selectedItem.analysis?.extractionEvidence?.document_structure?.regions?.length ? (
                <DocumentOverlayViewer
                  file={selectedItem.file}
                  regions={selectedItem.analysis.extractionEvidence.document_structure.regions}
                  activeRegionId={activeRegionId}
                  onRegionFocus={setActiveRegionId}
                />
              ) : (
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-12 text-center text-sm text-gray-500">
                  No regions available for this document.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
