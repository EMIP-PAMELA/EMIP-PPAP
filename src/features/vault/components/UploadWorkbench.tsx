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
  type WireOperatorOverride,
} from '@/src/features/vault/types/ingestionReview';
import {
  revalidateWithOverrides,
  type OperatorRevalidationResult,
} from '@/src/features/harness-work-instructions/services/wireOperatorResolutionService';
import type { DocumentType } from '@/src/features/harness-work-instructions/services/skuService';
import type { FieldExtraction, FieldExtractionSource, EvidenceSignal } from '@/src/features/harness-work-instructions/types/extractionEvidence';
import { resolveDocumentFields, type FieldAuthoritySource } from '@/src/features/harness-work-instructions/services/fieldAuthorityResolver';
import FieldEvidencePanel from './FieldEvidencePanel';
import type { RegionOverlay } from '@/src/features/harness-work-instructions/types/documentRegionOverlay';
import DocumentOverlayViewer from './DocumentOverlayViewer';
import HarnessConnectivityPanel from './HarnessConnectivityPanel';
import { buildComponentAuthorityOptions, type ComponentAuthorityOption } from '@/src/features/harness-work-instructions/services/componentAuthorityService';
import SkuModelEditorPanel, { type SkuModelDeleteRequest, type ExternalEditorRequest } from './SkuModelEditorPanel';
import KomaxCutSheetPanel from './KomaxCutSheetPanel';
import SkuLifecycleHistoryPanel from './SkuLifecycleHistoryPanel';
import KomaxProgramPanel from './KomaxProgramPanel';
import ToolingPanel from './ToolingPanel';
import {
  recordSkuAuditEvent,
  recordSkuAuditSnapshot,
  normalizeSkuKey,
} from '@/src/features/harness-work-instructions/services/skuAuditService';
import type { OperatorWireModel } from '@/src/features/harness-work-instructions/services/skuModelEditService';
import {
  buildEffectiveHarnessState,
  type EffectiveHarnessState,
} from '@/src/features/harness-work-instructions/services/effectiveHarnessModelService';
import type { TopologyWarning } from '@/src/features/harness-work-instructions/services/harnessTopologyService';

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

type ProcessingState = 'idle' | 'upload_received' | 'processing' | 'finalizing' | 'complete' | 'error';

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

const clearTimeoutRef = (ref: React.MutableRefObject<number | null>) => {
  if (ref.current) {
    window.clearTimeout(ref.current);
    ref.current = null;
  }
};

const clearIntervalRef = (ref: React.MutableRefObject<number | null>) => {
  if (ref.current) {
    window.clearInterval(ref.current);
    ref.current = null;
  }
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
  const [wireOverrides,    setWireOverrides]    = useState<Record<string, WireOperatorOverride[]>>({});
  const [resolvedOutputs,  setResolvedOutputs]  = useState<Record<string, OperatorRevalidationResult>>({});
  const [skuAddedWires,   setSkuAddedWires]   = useState<Record<string, OperatorWireModel[]>>({});
  const [skuEditedWires,  setSkuEditedWires]  = useState<Record<string, OperatorWireModel[]>>({});
  const [skuDeletedIds,   setSkuDeletedIds]   = useState<Record<string, string[]>>({});
  const [skuEditorRequest, setSkuEditorRequest] = useState<ExternalEditorRequest | null>(null);
  const skuEditorRef = useRef<HTMLDivElement>(null);
  const [isWorkbenchActive, setIsWorkbenchActive] = useState(false);
  const workbenchRef = useRef<HTMLDivElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const itemCountRef = useRef(0);
  const [commitState, setCommitState] = useState<'idle' | 'loading' | 'success'>('idle');
  const commitResetRef = useRef<number | null>(null);
  const [processingState, setProcessingState] = useState<ProcessingState>('idle');
  const [processingPercent, setProcessingPercent] = useState(0);
  const [processingMessage, setProcessingMessage] = useState('');
  const [processingFileName, setProcessingFileName] = useState<string | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [activeProcessingItemId, setActiveProcessingItemId] = useState<string | null>(null);
  const activeProcessingItemRef = useRef<string | null>(null);
  const progressTimerRef = useRef<number | null>(null);
  const stageTransitionRef = useRef<number | null>(null);
  const completionTimeoutRef = useRef<number | null>(null);
  const pendingScrollAfterCompleteRef = useRef(false);
  const stateLogSignatureRef = useRef<string>('');

  const scrollWorkbenchIntoView = useCallback(() => {
    requestAnimationFrame(() => {
      workbenchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  const isWorkbenchInView = useCallback(() => {
    if (typeof window === 'undefined') return false;
    const rect = workbenchRef.current?.getBoundingClientRect();
    if (!rect) return false;
    return rect.top >= 0 && rect.top <= window.innerHeight * 0.9;
  }, []);

  const focusWorkbench = useCallback(() => {
    setIsWorkbenchActive(true);
    if (!isWorkbenchInView()) {
      scrollWorkbenchIntoView();
    }
  }, [isWorkbenchInView, scrollWorkbenchIntoView]);

  const startProgressInterval = useCallback((maxPercent: number) => {
    clearIntervalRef(progressTimerRef);
    progressTimerRef.current = window.setInterval(() => {
      setProcessingPercent(prev => {
        if (prev >= maxPercent) {
          clearIntervalRef(progressTimerRef);
          return prev;
        }
        const next = Math.min(prev + 1, maxPercent);
        return next;
      });
    }, 450);
  }, []);

  const enterProcessingStage = useCallback((nextState: ProcessingState, message: string, floorPercent: number, rampTarget?: number) => {
    setProcessingState(nextState);
    setProcessingMessage(message);
    setProcessingPercent(prev => Math.max(prev, floorPercent));
    if (typeof rampTarget === 'number') {
      startProgressInterval(rampTarget);
    } else {
      clearIntervalRef(progressTimerRef);
    }
  }, [startProgressInterval]);

  const beginProcessingFeedback = useCallback((fileName: string, itemId: string) => {
    clearIntervalRef(progressTimerRef);
    clearTimeoutRef(stageTransitionRef);
    clearTimeoutRef(completionTimeoutRef);
    setProcessingFileName(fileName);
    setProcessingPercent(0);
    setProcessingError(null);
    setActiveProcessingItemId(itemId);
    activeProcessingItemRef.current = itemId;
    pendingScrollAfterCompleteRef.current = true;
    enterProcessingStage('upload_received', 'File received', 5);
    stageTransitionRef.current = window.setTimeout(() => {
      enterProcessingStage('processing', 'Analyzing document…', 15, 75);
    }, 250);
  }, [enterProcessingStage]);

  const markProcessingFinalizing = useCallback(() => {
    enterProcessingStage('finalizing', 'Finalizing workspace…', 85, 95);
    clearTimeoutRef(stageTransitionRef);
    stageTransitionRef.current = window.setTimeout(() => {
      clearIntervalRef(progressTimerRef);
      setProcessingState('complete');
      setProcessingMessage('Processing complete');
      setProcessingPercent(100);
      completionTimeoutRef.current = window.setTimeout(() => {
        clearIntervalRef(progressTimerRef);
        clearTimeoutRef(stageTransitionRef);
        setProcessingState('idle');
        setProcessingPercent(0);
        setProcessingMessage('');
        setProcessingFileName(null);
        setProcessingError(null);
        setActiveProcessingItemId(null);
        activeProcessingItemRef.current = null;
      }, 4000);
    }, 900);
  }, [enterProcessingStage]);

  const markProcessingError = useCallback((message: string | null) => {
    clearIntervalRef(progressTimerRef);
    clearTimeoutRef(stageTransitionRef);
    clearTimeoutRef(completionTimeoutRef);
    pendingScrollAfterCompleteRef.current = false;
    setProcessingError(message);
    setProcessingState('error');
    setProcessingMessage(message ?? 'Processing failed');
    setProcessingPercent(prev => Math.max(prev, 15));
  }, []);

  useEffect(() => () => {
    clearIntervalRef(progressTimerRef);
    clearTimeoutRef(stageTransitionRef);
    clearTimeoutRef(completionTimeoutRef);
  }, []);

  useEffect(() => {
    if (processingState !== 'complete') return;
    if (!pendingScrollAfterCompleteRef.current) return;
    pendingScrollAfterCompleteRef.current = false;
    if (!isWorkbenchInView()) {
      scrollWorkbenchIntoView();
    }
  }, [processingState, isWorkbenchInView, scrollWorkbenchIntoView]);

  useEffect(() => {
    const signature = `${processingState}-${processingPercent}-${processingMessage}-${processingFileName ?? 'none'}-${processingError ?? 'none'}`;
    if (stateLogSignatureRef.current === signature) return;
    stateLogSignatureRef.current = signature;
    console.log('[T23.6.67 PROCESSING STATE]', {
      state: processingState,
      percent: processingPercent,
      message: processingMessage,
      fileName: processingFileName,
      error: processingError,
    });
  }, [processingState, processingPercent, processingMessage, processingFileName, processingError]);

  const collapseQueue = useCallback(() => {
    setIsWorkbenchActive(false);
  }, []);

  useEffect(() => {
    if (!isWorkbenchActive) {
      itemCountRef.current = items.length;
      return;
    }
    if (items.length === 0) return;
    const previously = itemCountRef.current;
    itemCountRef.current = items.length;
    if (items.length > previously) {
      scrollWorkbenchIntoView();
    }
  }, [items.length, isWorkbenchActive, scrollWorkbenchIntoView]);

  useEffect(() => {
    if (items.length === 0) {
      setSelectedId(null);
      setIsWorkbenchActive(false);
    }
  }, [items.length]);

  useEffect(() => () => {
    if (commitResetRef.current) {
      window.clearTimeout(commitResetRef.current);
      commitResetRef.current = null;
    }
  }, []);

  useEffect(() => {
    setCommitState('idle');
    if (commitResetRef.current) {
      window.clearTimeout(commitResetRef.current);
      commitResetRef.current = null;
    }
  }, [selectedId]);

  const handleSelectItem = useCallback((id: string, opts?: { focus?: boolean }) => {
    setSelectedId(id);
    if (opts?.focus === false) return;
    focusWorkbench();
  }, [focusWorkbench]);

  const updateItem = useCallback((id: string, patch: Partial<WorkbenchItem>) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...patch } : item));
  }, []);

  const handleOverrideSubmit = useCallback((itemId: string, override: WireOperatorOverride) => {
    const currentOverrides = wireOverrides[itemId] ?? [];
    const updatedOverrides = [
      ...currentOverrides.filter(o => o.wireId !== override.wireId),
      override,
    ];
    setWireOverrides(prev => ({ ...prev, [itemId]: updatedOverrides }));

    const item = items.find(i => i.id === itemId);
    const connectivity = item?.analysis?.harnessConnectivity;
    if (!connectivity) return;

    const result = revalidateWithOverrides({
      connectivity,
      overrides:      updatedOverrides,
      reconciliation: item?.analysis?.harnessReconciliation ?? null,
    });
    setResolvedOutputs(prev => ({ ...prev, [itemId]: result }));

    // Audit — fire-and-forget
    const skuKey = normalizeSkuKey(item?.confirmedPartNumber ?? item?.analysis?.proposedPartNumber ?? itemId);
    void recordSkuAuditEvent({
      skuKey,
      eventType: 'WIRE_OVERRIDE_APPLIED',
      actorType: 'UNKNOWN',
      actorName: 'Unknown Operator',
      summary:   `Wire override applied: ${override.wireId} (${override.mode})`,
      reason:    override.reason,
      payload:   { wireId: override.wireId, mode: override.mode },
    });
  }, [items, wireOverrides]);

  const handleSkuAddWire = useCallback((itemId: string, wire: OperatorWireModel) => {
    setSkuAddedWires(prev => {
      const current = prev[itemId] ?? [];
      return { ...prev, [itemId]: [...current.filter(w => w.id !== wire.id), wire] };
    });
    const item = items.find(i => i.id === itemId);
    const skuKey = normalizeSkuKey(item?.confirmedPartNumber ?? item?.analysis?.proposedPartNumber ?? itemId);
    void recordSkuAuditEvent({
      skuKey,
      eventType: 'SKU_WIRE_ADDED',
      actorType: 'UNKNOWN',
      actorName: 'Unknown Operator',
      summary:   `Wire added: ${wire.id}`,
      payload:   { wireId: wire.id },
    });
  }, [items]);

  const handleSkuEditWire = useCallback((itemId: string, wire: OperatorWireModel) => {
    setSkuEditedWires(prev => {
      const current = prev[itemId] ?? [];
      return { ...prev, [itemId]: [...current.filter(w => w.id !== wire.id), wire] };
    });
    const item = items.find(i => i.id === itemId);
    const skuKey = normalizeSkuKey(item?.confirmedPartNumber ?? item?.analysis?.proposedPartNumber ?? itemId);
    void recordSkuAuditEvent({
      skuKey,
      eventType: 'SKU_WIRE_EDITED',
      actorType: 'UNKNOWN',
      actorName: 'Unknown Operator',
      summary:   `Wire edited: ${wire.targetWireId ?? wire.id}`,
      payload:   { wireId: wire.targetWireId ?? wire.id, operatorId: wire.id },
    });
  }, [items]);

  const handleSkuDeleteWire = useCallback((itemId: string, request: SkuModelDeleteRequest) => {
    if (request.scope === 'operator') {
      setSkuAddedWires(prev => {
        const current = prev[itemId] ?? [];
        return { ...prev, [itemId]: current.filter(w => w.id !== request.operatorId) };
      });
      setSkuEditedWires(prev => {
        const current = prev[itemId] ?? [];
        return { ...prev, [itemId]: current.filter(w => w.id !== request.operatorId) };
      });
      return;
    }
    const { wireId, undo } = request;
    setSkuEditedWires(prev => {
      const current = prev[itemId] ?? [];
      return { ...prev, [itemId]: current.filter(w => w.targetWireId !== wireId) };
    });
    setSkuDeletedIds(prev => {
      const cur = prev[itemId] ?? [];
      const next = undo ? cur.filter(id => id !== wireId) : [...cur.filter(id => id !== wireId), wireId];
      return { ...prev, [itemId]: next };
    });
    if (!undo && wireId) {
      const item = items.find(i => i.id === itemId);
      const skuKey = normalizeSkuKey(item?.confirmedPartNumber ?? item?.analysis?.proposedPartNumber ?? itemId);
      void recordSkuAuditEvent({
        skuKey,
        eventType: 'SKU_WIRE_DELETED',
        actorType: 'UNKNOWN',
        actorName: 'Unknown Operator',
        summary:   `Wire deleted: ${wireId}`,
        payload:   { wireId },
      });
    }
  }, [items]);

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

    // Audit — fire-and-forget
    const auditItem = items.find(i => i.id === itemId);
    const skuKey = normalizeSkuKey(auditItem?.confirmedPartNumber ?? auditItem?.analysis?.proposedPartNumber ?? itemId);
    if (field === 'documentType') {
      void recordSkuAuditEvent({
        skuKey,
        eventType: 'DOC_TYPE_CONFIRMED',
        actorType: 'UNKNOWN',
        actorName: 'Unknown Operator',
        summary:   `Document type confirmed: ${rawValue}`,
        payload:   { field, value: rawValue },
      });
    } else {
      void recordSkuAuditEvent({
        skuKey,
        eventType: 'FIELD_CONFIRMED',
        actorType: 'UNKNOWN',
        actorName: 'Unknown Operator',
        summary:   `Field "${field}" confirmed: ${rawValue}`,
        payload:   { field, value: rawValue },
      });
    }
  }, [items]);

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
      if (activeProcessingItemRef.current === id) {
        markProcessingError('Failed to extract text from PDF.');
      }
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

    // C12.4: Fallback region extraction — runs when primary OCR is weak or the PN was not found.
    // Covers: (a) isLikelyInternal — 527 DRN detected or forcedType set; (b) isWeakExtraction —
    // sparse OCR (< MIN_EXTRACTION_LINES) or no strict 45-PN found in extracted text.
    //
    // T23.3.1: Text extraction uses full-page coverage so pdfjs coordinate-sorted output
    // captures all wire rows (including unlabeled/branch rows that primary OCR misses).
    // Image crop remains focused on the title block for vision-based PN detection (a small
    // crop is more reliable for Claude than a full-page image when searching for 45-xxxxxx-xx).
    const FULL_PAGE_REGION   = { x: 0, y: 0, w: 1, h: 1 };          // full-page text for wire recovery
    const TB_FALLBACK_REGION = { x: 0.40, y: 0.65, w: 0.60, h: 0.35 }; // title-block crop for vision PN
    let titleBlockFallbackText: string[] | null = null;
    let titleBlockFallbackCropUrl: string | null = null;

    // C12.4-R16: Weakness-aware fallback gate.
    // Fallback runs when:
    //   (a) primary OCR looks like an internal drawing (527 DRN present or forcedType set), OR
    //   (b) extraction is weak: fewer than MIN_EXTRACTION_LINES non-empty lines extracted, OR
    //       the strict 45-xxxxxx-xx part number was not found in primary OCR.
    // Only skips when OCR is strong (≥ threshold lines) AND the PN was already found AND
    // the document is not flagged as internal — meaning structured extraction is complete.
    // The server-side strict regex gate (/^45-\d{6}-\d{2}$/) still rejects false positives.
    const STRICT_PN_45_RE_CLIENT = /\b45-\d{6}-\d{2}\b/;
    const partNumberFoundStrict  = extractedText != null && STRICT_PN_45_RE_CLIENT.test(extractedText);
    const extractedLines = extractedText
      ? extractedText.split(/\r?\n/)
      : [];
    const extractedLineCount = extractedLines.filter(l => l.trim().length > 0).length;
    const MIN_EXTRACTION_LINES   = 20;
    const isWeakExtraction       =
      extractedLineCount < MIN_EXTRACTION_LINES ||
      !partNumberFoundStrict;
    const hasStructuredWireRows = extractedLines.some(line => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      if (/^W\d{1,4}/i.test(trimmed)) return true;
      if (/\b(AWG|WIRE|HARNESS|CABLE)\b/i.test(trimmed)) return true;
      if (/^-{3,}\s*[A-Z0-9]/.test(trimmed)) return true;
      return false;
    });

    console.log('[T23.6.42 STRUCTURE DETECT]', {
      hasStructuredWireRows,
      sampleLines: extractedLines.slice(0, 10),
    });

    const pipelineMode = forcedType ?? 'AUTO';
    let shouldRunC124Fallback  = isLikelyInternal || isWeakExtraction;

    if (isWeakExtraction) {
      shouldRunC124Fallback = !hasStructuredWireRows;
    }

    if (pipelineMode === 'BOM' && hasStructuredWireRows) {
      console.log('[T23.6.42 FORCE PARSER]', {
        reason: 'Structured BOM detected',
        pipelineMode,
        extractedLineCount,
      });
      shouldRunC124Fallback = false;
    }

    console.log('[T23.6.42 GATING DECISION]', {
      isWeakExtraction,
      shouldRunFallback: shouldRunC124Fallback,
      pipelineMode,
      hasWireIndicators: hasStructuredWireRows,
      decision: shouldRunC124Fallback ? 'fallback' : 'parser',
    });

    const c124TriggerDebug = {
      buildTag:              'C12.4-R16',
      forcedType:            forcedType ?? null,
      isLikelyInternal,
      extractedLineCount,
      partNumberFoundStrict,
      isWeakExtraction,
      shouldRunC124Fallback,
    };
    console.log('[C12.4 TRIGGER]', c124TriggerDebug);
    console.log('[C12.4] fallbackDecision', {
      extractedLines:     extractedLineCount,
      partNumberDetected: partNumberFoundStrict,
      decision:           shouldRunC124Fallback ? 'FORCED' : 'SKIPPED',
    });

    if (shouldRunC124Fallback) {
      const blobUrl = URL.createObjectURL(file);
      try {
        const [{ extractPDFRegionText }, { renderPdfToImage }, { cropImageRegion }] = await Promise.all([
          import('@/src/utils/extractPDFRegionText'),
          import('@/src/utils/renderPdfToImage'),
          import('@/src/utils/cropImageRegion'),
        ]);

        // T23.3.1: Log the exact regions being used before extraction.
        console.log('[C12.4 OCR REGION]', {
          textRegion:    FULL_PAGE_REGION,
          cropRegion:    TB_FALLBACK_REGION,
          cropMode:      'FULL_PAGE_TEXT',
          textAreaRatio: FULL_PAGE_REGION.w * FULL_PAGE_REGION.h,  // 1.0 = full page
          cropAreaRatio: Number((TB_FALLBACK_REGION.w * TB_FALLBACK_REGION.h).toFixed(3)),
        });

        const [fallbackLines, fullImage] = await Promise.all([
          extractPDFRegionText(file, FULL_PAGE_REGION).catch(() => null),  // T23.3.1: full page
          renderPdfToImage(blobUrl).catch(() => null),
        ]);
        if (fallbackLines?.length) titleBlockFallbackText   = fallbackLines;
        if (fullImage)             titleBlockFallbackCropUrl = await cropImageRegion(fullImage, TB_FALLBACK_REGION).catch(() => null);

        // T23.3.1: Post-extraction sanity check.
        const c124LineCount = fallbackLines?.length ?? 0;
        const c124CharCount = fallbackLines?.join('\n').length ?? 0;
        console.log('[C12.4 OCR RESULT]', {
          lineCount:  c124LineCount,
          charCount:  c124CharCount,
          firstLines: fallbackLines?.slice(0, 10) ?? [],
          cropMode:   'FULL_PAGE',
        });
        if (c124LineCount < 5) {
          console.warn('[C12.4 OCR WARNING] Fallback OCR returned suspiciously low line count', { lineCount: c124LineCount });
        }

        console.log('[C12.4 DEBUG] Fallback OCR Lines:', titleBlockFallbackText);
        console.log('[C12.4 DEBUG] Fallback Crop Generated:', !!titleBlockFallbackCropUrl);
        console.log('[C12.4 FALLBACK DISPATCH]', {
          file:               file.name,
          fallbackLines:      c124LineCount,
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
    } else {
      console.log('[C12.4 TRIGGER] Fallback skipped — strong extraction, PN found, not internal', c124TriggerDebug);
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
      fd.append('c124_trigger_debug', JSON.stringify(c124TriggerDebug));

      const res  = await fetch('/api/upload/analyze', { method: 'POST', body: fd });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        const errorMsg = json.error ?? 'Analysis failed.';
        updateItem(id, { status: 'failed', error: errorMsg });
        if (activeProcessingItemRef.current === id) {
          markProcessingError(errorMsg);
        }
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

      // Audit — fire-and-forget: upload event + ingestion baseline snapshot
      const uploadSkuKey = normalizeSkuKey(confirmedPartNumber ?? analysis.proposedPartNumber ?? id);
      const uploadEventType = confirmedDocumentType === 'BOM' ? 'BOM_UPLOADED' : 'DRAWING_UPLOADED';
      void recordSkuAuditEvent({
        skuKey:    uploadSkuKey,
        eventType: uploadEventType,
        actorType: 'SYSTEM',
        summary:   `${confirmedDocumentType ?? analysis.proposedDocumentType} uploaded: ${analysis.fileName}`,
        payload:   { fileName: analysis.fileName, fileSize: analysis.fileSize, docType: confirmedDocumentType ?? analysis.proposedDocumentType },
        sourceArtifactIds: [analysis.fileName],
      });
      void recordSkuAuditSnapshot({
        skuKey:       uploadSkuKey,
        snapshotType: 'INGESTION_BASELINE',
        effectiveState: {
          proposedDocumentType:  analysis.proposedDocumentType,
          proposedPartNumber:    analysis.proposedPartNumber,
          proposedRevision:      analysis.proposedRevision,
          wireCount:             analysis.harnessConnectivity?.wires.length ?? null,
          readyToCommit:         analysis.readyToCommit,
          unresolvedCount:       analysis.unresolvedQuestions.length,
          analyzedAt:            analysis.analyzedAt,
        },
        summary: `Ingestion baseline: ${analysis.fileName} (${analysis.harnessConnectivity?.wires.length ?? 0} wires)`,
      });
      if (activeProcessingItemRef.current === id) {
        markProcessingFinalizing();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Analysis request failed.';
      updateItem(id, { status: 'failed', error: msg });
      if (activeProcessingItemRef.current === id) {
        markProcessingError(msg);
      }
    }
  }, [markProcessingError, markProcessingFinalizing, preselectedSku, updateItem]);

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
    if (entries.length > 0) {
      handleSelectItem(entries[0].id, { focus: false });
      beginProcessingFeedback(entries[0].file.name, entries[0].id);
    }
  }, [beginProcessingFeedback, handleSelectItem, processFile, uploadMode]);

  const commitItem = useCallback(async (item: WorkbenchItem): Promise<boolean> => {
    if (!isItemReady(item)) return false;
    const { documentType, partNumber, revision, drawingNumber } = getCommitValues(item);
    updateItem(item.id, { status: 'committing' });

    const commitSkuKey = normalizeSkuKey(partNumber || item.id);

    // Audit: pre-commit event + PRE_COMMIT snapshot
    void recordSkuAuditEvent({
      skuKey:    commitSkuKey,
      eventType: 'SKU_READY_TO_COMMIT',
      actorType: 'UNKNOWN',
      actorName: 'Unknown Operator',
      summary:   `SKU ready to commit: ${partNumber} (${documentType})`,
      payload:   { partNumber, revision, documentType, drawingNumber },
    });
    void recordSkuAuditSnapshot({
      skuKey:       commitSkuKey,
      snapshotType: 'PRE_COMMIT',
      effectiveState: {
        partNumber,
        revision,
        documentType,
        drawingNumber,
        wireCount: item.analysis?.harnessConnectivity?.wires.length ?? null,
      },
      summary: `Pre-commit: ${partNumber} rev ${revision || 'UNSPECIFIED'}`,
    });

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
        return false;
      }

      updateItem(item.id, {
        status: 'committed',
        confirmationMode: 'ADMIN_CONFIRMED',
        commitResult: { ok: true, sku: json.sku, message: json.message },
      });

      // Audit: committed event + COMMITTED snapshot
      const committedSkuKey = normalizeSkuKey(json.sku?.part_number ?? partNumber);
      void recordSkuAuditEvent({
        skuKey:    committedSkuKey,
        eventType: 'SKU_COMMITTED',
        actorType: 'UNKNOWN',
        actorName: 'Unknown Operator',
        summary:   `SKU committed: ${committedSkuKey} rev ${revision || 'UNSPECIFIED'}`,
        payload:   { skuId: json.sku?.id, partNumber: committedSkuKey, revision, documentType },
      });
      void recordSkuAuditSnapshot({
        skuKey:       committedSkuKey,
        snapshotType: 'COMMITTED',
        effectiveState: {
          skuId:        json.sku?.id,
          partNumber:   committedSkuKey,
          revision,
          documentType,
          drawingNumber,
          wireCount:    item.analysis?.harnessConnectivity?.wires.length ?? null,
        },
        summary: `Committed: ${committedSkuKey} rev ${revision || 'UNSPECIFIED'} (skuId: ${json.sku?.id ?? 'unknown'})`,
      });

      // Audit: document attachment event — records the precise moment this doc type
      // was linked to the SKU. Enables "when was the BOM/drawing attached?" queries.
      const attachEventType =
        documentType === 'BOM'
          ? 'BOM_ATTACHED'
          : documentType === 'INTERNAL_DRAWING'
            ? 'APOGEE_DRAWING_ATTACHED'
            : 'CUSTOMER_DRAWING_ATTACHED';
      void recordSkuAuditEvent({
        skuKey:    committedSkuKey,
        eventType: attachEventType,
        actorType: 'USER',
        actorName: 'ADMIN_BATCH_WORKBENCH',
        summary:   `${documentType} attached to SKU ${committedSkuKey} rev ${revision || 'UNSPECIFIED'}`,
        payload: {
          skuId:        json.sku?.id,
          documentId:   json.document?.id,
          documentType,
          revision:     revision || null,
          drawingNumber: drawingNumber || null,
        },
      });

      onCommitComplete?.();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Commit request failed.';
      updateItem(item.id, { status: 'failed', error: msg });
      return false;
    }
  }, [onCommitComplete, updateItem]);

  const commitAllVerified = useCallback(async () => {
    const ready = items.filter(i => i.status === 'ready_to_commit' && isItemReady(i));
    for (const item of ready) {
      await commitItem(item);
    }
  }, [items, commitItem]);

  const selectedItem = useMemo(() => (
    selectedId ? items.find(i => i.id === selectedId) ?? null : null
  ), [items, selectedId]);

  const selectedCommitValues = useMemo(() => (
    selectedItem ? getCommitValues(selectedItem) : null
  ), [selectedItem]);

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
  }, [filter, items]);

  const effectiveState = useMemo<EffectiveHarnessState | null>(() => {
    if (!selectedItem?.analysis) return null;
    return buildEffectiveHarnessState({
      analysis:              selectedItem.analysis,
      operatorDocType:       selectedItem.confirmedDocumentType ?? null,
      operatorConfirmed:     selectedItem.operatorConfirmed,
      wireOperatorOverrides: wireOverrides[selectedId ?? ''] ?? [],
      skuAddedWires:         skuAddedWires[selectedId ?? ''] ?? [],
      skuEditedWires:        skuEditedWires[selectedId ?? ''] ?? [],
      skuDeletedWireIds:     skuDeletedIds[selectedId ?? ''] ?? [],
    });
  }, [selectedItem, selectedId, wireOverrides, skuAddedWires, skuEditedWires, skuDeletedIds]);

  const panelConnectivity = useMemo(() => (
    effectiveState?.effectiveConnectivity ?? selectedItem?.analysis?.harnessConnectivity ?? null
  ), [effectiveState?.effectiveConnectivity, selectedItem?.analysis?.harnessConnectivity]);

  const canonicalComponentOptions = selectedItem?.analysis?.canonicalComponentOptions ?? null;
  const canonicalComponentOptionsSource = selectedItem?.analysis?.canonicalComponentOptionsSource ?? null;

  console.warn('[TRACE C - WORKBENCH INPUT RAW]', {
    count: selectedItem?.analysis?.canonicalComponentOptions?.length,
    sample: selectedItem?.analysis?.canonicalComponentOptions?.slice(0, 5),
  });

  useEffect(() => {
    if (!selectedItem?.analysis) return;
    console.log('[T23.6.71B WORKBENCH PASSTHROUGH]', {
      canonicalCount: canonicalComponentOptions?.length ?? 0,
      source: canonicalComponentOptionsSource ?? 'UNAVAILABLE',
      itemId: selectedItem.id,
    });
  }, [selectedItem?.analysis, canonicalComponentOptions?.length, canonicalComponentOptionsSource, selectedItem?.id]);

  const { panelComponentOptions, panelComponentOptionsSource } = useMemo(() => {
    const incomingOptions: ComponentAuthorityOption[] = canonicalComponentOptions ?? [];

    const hasParserAuthority = incomingOptions.some(
      (o) => o && o.__source === 'PARSER_ORIGINAL'
    );

    let finalComponentOptions: ComponentAuthorityOption[];
    let finalSource: string;

    if (hasParserAuthority) {
      finalComponentOptions = incomingOptions;
      finalSource = 'PARSER_ORIGINAL';
      console.warn('[T23.6.91 PIPELINE LOCK]', {
        reason: 'Parser authority detected — fallback blocked',
        count: incomingOptions.length,
      });
    } else {
      finalComponentOptions = panelConnectivity ? buildComponentAuthorityOptions(panelConnectivity) : [];
      finalSource = panelConnectivity
        ? (effectiveState?.effectiveConnectivity ? 'EFFECTIVE_CONNECTIVITY_FALLBACK' : 'ANALYSIS_CONNECTIVITY_FALLBACK')
        : 'UNAVAILABLE';
      console.warn('[T23.6.91 FALLBACK USED]', {
        fallbackCount: finalComponentOptions.length,
      });
    }

    return { panelComponentOptions: finalComponentOptions, panelComponentOptionsSource: finalSource };
  }, [canonicalComponentOptions, panelConnectivity, effectiveState?.effectiveConnectivity]);

  console.warn('[TRACE D - WORKBENCH PROCESSED]', {
    count: panelComponentOptions?.length,
    sample: panelComponentOptions?.slice(0, 5),
  });

  // T23.6.94: Bypass lane — highest authority for reconciliation dropdowns.
  const bypassCanonicalOptions: ComponentAuthorityOption[] | null =
    selectedItem?.analysis?.bypassCanonicalComponentOptions ?? null;

  console.warn('[T23.6.94 WORKBENCH BYPASS INPUT]', {
    count: bypassCanonicalOptions?.length ?? 0,
    source: selectedItem?.analysis?.bypassCanonicalComponentOptionsSource ?? 'UNAVAILABLE',
  });

  const { bypassComponentOptions, bypassComponentOptionsSource } = useMemo(() => {
    // Priority 1: bypass lane (PARSER_BYPASS)
    if (bypassCanonicalOptions && bypassCanonicalOptions.length > 0) {
      return {
        bypassComponentOptions: bypassCanonicalOptions,
        bypassComponentOptionsSource: 'PARSER_BYPASS' as string,
      };
    }
    // Priority 2: existing canonical options (PARSER_ORIGINAL / SIMPLIFIED_BOM)
    if (canonicalComponentOptions && canonicalComponentOptions.length > 0) {
      return {
        bypassComponentOptions: canonicalComponentOptions,
        bypassComponentOptionsSource: canonicalComponentOptionsSource ?? 'SIMPLIFIED_BOM',
      };
    }
    // Priority 3: existing fallback path (topology / effective)
    return {
      bypassComponentOptions: panelComponentOptions,
      bypassComponentOptionsSource: panelComponentOptionsSource,
    };
  }, [bypassCanonicalOptions, canonicalComponentOptions, canonicalComponentOptionsSource, panelComponentOptions, panelComponentOptionsSource]);

  console.warn('[T23.6.94 WORKBENCH BYPASS OUTPUT]', {
    count: bypassComponentOptions?.length ?? 0,
    source: bypassComponentOptionsSource,
  });

  useEffect(() => {
    console.log('[T23.6.78 WORKBENCH INPUT]', {
      count: canonicalComponentOptions?.length,
      source: canonicalComponentOptionsSource,
    });
  }, [canonicalComponentOptions, canonicalComponentOptionsSource]);

  // T12.4: when effective state clears all blocking questions and required
  // document fields are present, promote the item status to ready_to_commit.
  useEffect(() => {
    if (!selectedId || !selectedItem?.analysis || !effectiveState) return;
    const dt = selectedItem.confirmedDocumentType;
    const pn = selectedItem.confirmedPartNumber?.trim();
    if (!dt || !pn) return;
    if (
      effectiveState.readyToCommit &&
      selectedItem.status !== 'ready_to_commit' &&
      selectedItem.status !== 'committing' &&
      selectedItem.status !== 'committed'
    ) {
      updateItem(selectedId, { status: 'ready_to_commit' });
    }
  }, [effectiveState, selectedId, selectedItem, updateItem]);

  const nonCommitted = items.filter(i => i.status !== 'committed' && i.status !== 'committing');
  const canCommitAll = counts.ready > 0 && nonCommitted.every(i => i.status === 'ready_to_commit');
  const blockedCount = nonCommitted.filter(i => i.status !== 'ready_to_commit').length;

  const handleCommitSelected = useCallback(async () => {
    if (!selectedItem || commitState === 'loading') return;
    setCommitState('loading');
    const success = await commitItem(selectedItem);
    if (!success) {
      setCommitState('idle');
      return;
    }
    setCommitState('success');
    commitResetRef.current = window.setTimeout(() => {
      setCommitState('idle');
      commitResetRef.current = null;
    }, 1500);
  }, [commitItem, commitState, selectedItem]);

  const WorkbenchMainArea: React.FC = () => (
    !selectedItem ? (
      <div className="flex flex-1 items-center justify-center py-16 text-sm text-gray-400">
        Select a file to review
      </div>
    ) : (
      <div className="w-full max-w-[1100px] mx-auto px-4 py-4">
        <div className="space-y-4">
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
          const regionList: RegionOverlay[] = analysis?.extractionEvidence?.document_structure?.regions ?? [];
          const regionMap = new Map<string, RegionOverlay>(
            regionList.map((region: RegionOverlay) => [region.id, region] as [string, RegionOverlay]),
          );
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

        {(() => {
          const unresolvedQuestions: UnresolvedQuestion[] = effectiveState?.unresolvedQuestions
            ?? selectedItem.analysis?.unresolvedQuestions
            ?? [];
          if (unresolvedQuestions.length === 0) return null;
          return (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Resolution required</p>
              {unresolvedQuestions.map((q: UnresolvedQuestion) => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  answer={selectedItem.answers[q.id] ?? ''}
                  onAnswer={value => answerQuestion(selectedItem.id, q, value)}
                />
              ))}
            </div>
          );
        })()}

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
            connectivity={effectiveState?.effectiveConnectivity ?? selectedItem.analysis.harnessConnectivity}
            reconciliation={selectedItem.analysis.harnessReconciliation}
            operatorOverrides={wireOverrides[selectedId ?? ''] ?? []}
            onOverrideSubmit={override => handleOverrideSubmit(selectedId ?? '', override)}
            resolvedDecision={effectiveState?.effectiveDecision ?? resolvedOutputs[selectedId ?? '']?.resolvedDecision ?? null}
            topology={effectiveState?.effectiveTopology ?? null}
            wireIdentities={effectiveState?.effectiveWireIdentities ?? null}
            onGraphWireClick={wireId => {
              setSkuEditorRequest({ type: 'edit', wireId });
              skuEditorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            onGraphMissingPinClick={({ component, cavity }) => {
              setSkuEditorRequest({ type: 'add', prefill: { fromComponent: component, fromCavity: cavity, fromTermination: 'CONNECTOR_PIN' } });
              skuEditorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            onGraphBranchClick={({ component, cavity, wireIds }) => {
              setSkuEditorRequest({ type: 'branch', wireIds, fromComponent: component, fromCavity: cavity });
              skuEditorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            componentOptions={bypassComponentOptions}
            componentOptionsSource={bypassComponentOptionsSource}
          />
        ) : null}

        {selectedItem.analysis?.harnessConnectivity ? (
          <div ref={skuEditorRef}>
            <SkuModelEditorPanel
              extractedConnectivity={selectedItem.analysis.harnessConnectivity}
              effectiveConnectivity={effectiveState?.effectiveConnectivity ?? null}
              effectiveDecision={effectiveState?.effectiveDecision ?? null}
              operatorAddedWires={skuAddedWires[selectedId ?? ''] ?? []}
              operatorEditedWires={skuEditedWires[selectedId ?? ''] ?? []}
              operatorDeletedWireIds={skuDeletedIds[selectedId ?? ''] ?? []}
              onAddWire={wire => handleSkuAddWire(selectedId ?? '', wire)}
              onEditWire={wire => handleSkuEditWire(selectedId ?? '', wire)}
              onDeleteWire={request => handleSkuDeleteWire(selectedId ?? '', request)}
              externalEditorRequest={skuEditorRequest}
              onExternalRequestConsumed={() => setSkuEditorRequest(null)}
              wireIdentities={effectiveState?.effectiveWireIdentities ?? null}
            />
          </div>
        ) : null}

        {effectiveState && (
          <KomaxCutSheetPanel
            effectiveState={effectiveState}
            partNumber={effectiveState.effectivePartNumber ?? undefined}
          />
        )}

        {effectiveState && (
          <KomaxProgramPanel effectiveState={effectiveState} />
        )}

        <ToolingPanel />

        <SkuLifecycleHistoryPanel
          skuKey={effectiveState?.effectivePartNumber ?? selectedItem?.confirmedPartNumber ?? null}
        />

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
                {JSON.stringify({
                  ...selectedItem.analysis,
                  effectiveDebug: effectiveState ? {
                    buildTag:                   'T12.4',
                    usingEffectiveConnectivity: (
                      (wireOverrides[selectedId ?? '']?.length ?? 0) +
                      (skuAddedWires[selectedId ?? '']?.length ?? 0) +
                      (skuEditedWires[selectedId ?? '']?.length ?? 0) +
                      (skuDeletedIds[selectedId ?? '']?.length ?? 0)
                    ) > 0,
                    effectiveDocType:            effectiveState.effectiveDocumentType,
                    effectiveDocTypeSource:      effectiveState.effectiveDocTypeSource,
                    effectiveWireCount:          effectiveState.effectiveConnectivity?.wires.length ?? null,
                    effectiveDecision:           effectiveState.effectiveDecision?.overallDecision ?? null,
                    unresolvedQuestionCount:     effectiveState.unresolvedQuestions.length,
                    blockingQuestionCount:       effectiveState.unresolvedQuestions.filter(q => q.blocksCommit).length,
                    readyToCommit:               effectiveState.readyToCommit,
                  } : null,
                }, null, 2)}
              </pre>
            </div>
          </details>
        ) : null}

        {/* T16.5 R7: topology commit-blocker panel */}
        {(() => {
          const blockingWarnings: TopologyWarning[] = (effectiveState?.effectiveTopology?.warnings?.filter(w => w.blocksCommit) ?? []) as TopologyWarning[];
          if (blockingWarnings.length === 0) return null;
          return (
            <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 space-y-1.5">
              <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">
                Commit blocked — topology issues must be resolved
              </p>
              {blockingWarnings.map((warning, idx) => (
                <p key={`${warning.code}-${idx}`} className="text-xs text-red-700">⚠ {warning.message}</p>
              ))}
            </div>
          );
        })()}

        {(selectedItem.status === 'ready_to_commit' || (
          effectiveState?.readyToCommit === true &&
          Boolean(selectedItem.confirmedDocumentType) &&
          Boolean(selectedItem.confirmedPartNumber?.trim())
        )) ? (
          <button
            type="button"
            onClick={handleCommitSelected}
            disabled={commitState === 'loading'}
            className={`w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white transition ${commitState === 'loading' ? 'animate-pulse opacity-90' : 'hover:bg-emerald-700'}`}
          >
            {commitState === 'loading'
              ? 'Committing…'
              : commitState === 'success'
                ? '✓ Committed'
                : 'Commit This File'}
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
      </div>
    )
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const hasItems = items.length > 0;
  const showFullQueue = hasItems && !isWorkbenchActive;
  const showCollapsedQueue = hasItems && isWorkbenchActive;
  const activeFileName = selectedItem?.file.name ?? (hasItems ? items[0].file.name : 'No file selected');
  const processingVisual = useMemo(() => {
    switch (processingState) {
      case 'idle':
        return null;
      case 'upload_received':
        return {
          stageLabel: 'FILE RECEIVED',
          icon: '📥',
          containerClass: 'border-blue-200 bg-blue-50 text-blue-900',
          barClass: 'bg-blue-500',
          badgeClass: 'bg-blue-100 text-blue-700',
          badgeText: 'Processing…',
        };
      case 'processing':
        return {
          stageLabel: 'ANALYZING',
          icon: '⚙️',
          containerClass: 'border-blue-200 bg-blue-50 text-blue-900',
          barClass: 'bg-blue-600',
          badgeClass: 'bg-blue-100 text-blue-700',
          badgeText: 'Processing…',
        };
      case 'finalizing':
        return {
          stageLabel: 'FINALIZING',
          icon: '🧩',
          containerClass: 'border-indigo-200 bg-indigo-50 text-indigo-900',
          barClass: 'bg-indigo-600',
          badgeClass: 'bg-indigo-100 text-indigo-800',
          badgeText: 'Staging…',
        };
      case 'complete':
        return {
          stageLabel: 'COMPLETE',
          icon: '✅',
          containerClass: 'border-emerald-200 bg-emerald-50 text-emerald-900',
          barClass: 'bg-emerald-500',
          badgeClass: 'bg-emerald-100 text-emerald-700',
          badgeText: 'Complete',
        };
      case 'error':
        return {
          stageLabel: 'PROCESSING ERROR',
          icon: '⚠️',
          containerClass: 'border-red-200 bg-red-50 text-red-900',
          barClass: 'bg-red-500',
          badgeClass: 'bg-red-100 text-red-700',
          badgeText: 'Error',
        };
      default:
        return null;
    }
  }, [processingState]);
  const processingBadgeClass = processingVisual?.badgeClass ?? '';

  const dropZoneBase = 'mx-6 mt-4 flex cursor-pointer items-center justify-center rounded-3xl border-[3px] border-dashed shadow-sm transition shrink-0';
  const dropZonePadding = isWorkbenchActive ? 'py-5' : 'py-8';
  const dropZoneTone = isDragging
    ? 'border-blue-500 bg-blue-50/90 opacity-100'
    : isWorkbenchActive
      ? 'border-gray-200 bg-gray-50/90 opacity-80'
      : 'border-blue-200/80 bg-gradient-to-br from-white via-white to-blue-50 hover:border-blue-400';
  const dropZoneClassName = `${dropZoneBase} ${dropZonePadding} ${dropZoneTone}`;

  const renderCollapsedQueueBar = () => (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm shadow-sm">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{counts.all} file{counts.all === 1 ? '' : 's'} loaded</p>
        <p className="text-sm font-semibold text-gray-900 truncate max-w-sm" title={activeFileName}>{activeFileName}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Ready: {counts.ready} · Needs review: {counts.needs_review}</span>
        <button
          type="button"
          onClick={collapseQueue}
          className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-semibold text-gray-700 hover:border-gray-400"
        >
          View Queue
        </button>
      </div>
    </div>
  );

  const renderFullQueueSection = () => (
    <section className="mt-4 rounded-3xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">Queued Files</p>
          <p className="text-xs text-gray-500">{counts.all} file{counts.all === 1 ? '' : 's'} total · {counts.needs_review} need review</p>
        </div>
        <button
          type="button"
          onClick={focusWorkbench}
          className="rounded-full bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
        >
          Focus Workbench
        </button>
      </div>

      {selectedItem && selectedCommitValues && items.some(i => i.status === 'needs_review') && (
        <div className="flex flex-wrap items-center gap-2 border-b bg-amber-50 px-6 py-3 text-xs">
          <span className="font-semibold text-amber-800">Apply to all needs-review:</span>
          {selectedCommitValues.partNumber && (
            <button
              type="button"
              onClick={() => {
                const value = selectedCommitValues.partNumber;
                items
                  .filter(i => i.status === 'needs_review')
                  .forEach(i => setConfirmedField(i.id, 'partNumber', value));
              }}
              className="rounded-full bg-amber-200 px-2.5 py-0.5 font-semibold text-amber-900 hover:bg-amber-300 transition"
            >
              Part # "{selectedCommitValues.partNumber}"
            </button>
          )}
          {selectedCommitValues.revision && (
            <button
              type="button"
              onClick={() => {
                const value = selectedCommitValues.revision;
                items
                  .filter(i => i.status === 'needs_review')
                  .forEach(i => setConfirmedField(i.id, 'revision', value));
              }}
              className="rounded-full bg-amber-200 px-2.5 py-0.5 font-semibold text-amber-900 hover:bg-amber-300 transition"
            >
              Rev "{selectedCommitValues.revision}"
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

      <div className="flex flex-wrap gap-1 border-b px-6 py-3">
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

      <div className="px-4 pb-4">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wide">
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
                    onClick={() => handleSelectItem(item.id)}
                    className={`border-b cursor-pointer transition ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  >
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-gray-900 truncate max-w-[260px]" title={item.file.name}>
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
    </section>
  );

  return (
    <div className="fixed inset-0 z-50 flex h-screen flex-col bg-white overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b bg-gray-50 px-6 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <h2 className="text-lg font-bold text-[color:var(--text-primary)] whitespace-nowrap">Upload Workbench</h2>
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
        ref={dropZoneRef}
        onDragOver={e => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          setIsDragging(true);
        }}
        onDragLeave={e => {
          e.preventDefault();
          setIsDragging(false);
        }}
        onDrop={e => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer?.files) queueFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={dropZoneClassName}
      >
        <div className="text-center">
          <p className={`text-base font-semibold tracking-wide ${isDragging ? 'text-blue-700' : 'text-blue-800'}`}>
            Drop BOMs or drawings here
          </p>
          <p className="mt-1 text-xs font-medium text-gray-500">Click to browse · secure pre-ingestion preview</p>
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
      <div className="flex-1 w-full px-6 py-4">
        {!hasItems ? (
          <div className="mt-6 rounded-3xl border border-dashed border-gray-300 bg-gray-50/80 px-6 py-16 text-center text-gray-500">
            <p className="text-sm font-semibold">Drop PDFs to begin</p>
          </div>
        ) : (
          <div className="pb-10">
            {processingVisual && (
              <div className={`mx-6 mt-3 rounded-2xl border px-4 py-3 shadow-sm transition ${processingVisual.containerClass}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold tracking-[0.3em] text-current uppercase">{processingVisual.stageLabel}</p>
                    <p className="text-sm font-bold text-current">{processingMessage || 'Working…'}</p>
                    {processingFileName && (
                      <p className="text-xs text-current/70">{processingFileName}</p>
                    )}
                    {processingError && (
                      <p className="text-xs font-semibold text-red-700">{processingError}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-xl">{processingVisual.icon}</div>
                    <p className="text-3xl font-black leading-none">{processingPercent}%</p>
                  </div>
                </div>
                <div className="mt-3 h-2 rounded-full bg-white/60 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ease-out ${processingVisual.barClass}`}
                    style={{ width: `${processingPercent}%` }}
                  />
                </div>
              </div>
            )}
            {showCollapsedQueue && renderCollapsedQueueBar()}
            {showFullQueue && renderFullQueueSection()}
            <section ref={workbenchRef} className="mt-4 rounded-3xl border border-gray-200 bg-white shadow-sm min-h-[55vh]">
              <WorkbenchMainArea />
            </section>
          </div>
        )}
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
