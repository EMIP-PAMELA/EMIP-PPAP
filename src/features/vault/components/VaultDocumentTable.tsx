'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { VaultFilterState } from './VaultFilters';
import type { DocumentClassificationStatus } from '@/src/features/harness-work-instructions/services/skuService';
import type { RevisionState } from '@/src/utils/revisionEvaluator';
import type { CrossSourceRevisionStatus } from '@/src/utils/revisionCrossValidator';
import type { ReadinessStatus } from '@/src/utils/skuReadinessEvaluator';
import RevisionStatusBadge from '@/src/features/revision/components/RevisionStatusBadge';
import type { ActionIntent } from '@/src/features/revision/hooks/useRecommendedFixActions';
import {
  resolveCanonicalDocuments,
  summarizeCanonicalResolution,
  CANONICAL_STATUS_SORT_ORDER,
  type CanonicalDocumentContext,
  type CanonicalDocumentResolution,
  type CanonicalDocumentStatus,
} from '@/src/features/revision/utils/resolveCanonicalDocuments';
import type { CrossSourceValidationResult } from '@/src/utils/revisionCrossValidator';
import type { DocumentExtractionEvidence } from '@/src/features/harness-work-instructions/types/extractionEvidence';
import { canonicalizePartNumber } from '@/src/utils/canonicalizePartNumber';

const readinessBadgeTone: Record<ReadinessStatus, string> = {
  READY:                'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  READY_LOW_CONFIDENCE: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  NEEDS_REVIEW:         'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  PARTIAL:              'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  BLOCKED:              'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
};

const readinessLabel: Record<ReadinessStatus, string> = {
  READY:                'Ready',
  READY_LOW_CONFIDENCE: 'Ready (Low Confidence)',
  NEEDS_REVIEW:         'Needs Review',
  PARTIAL:              'Partial',
  BLOCKED:              'Blocked',
};

interface VaultDocumentRow {
  id: string;
  sku_id: string | null;
  filename: string;
  document_type: 'BOM' | 'CUSTOMER_DRAWING' | 'INTERNAL_DRAWING';
  sku: string | null;
  /** Raw extracted or manual input — diagnostic only. */
  revision: string;
  normalized_revision?: string | null;
  /** Single authoritative revision for display. Never a sentinel string. */
  canonical_revision?: string | null;
  /** Which extraction path produced the stored revision (FILENAME, TEXT, TITLE_BLOCK, etc.). */
  revision_source?: string | null;
  revision_state: RevisionState;
  sku_revision_status?: CrossSourceRevisionStatus | null;
  sku_readiness_status?: ReadinessStatus | null;
  uploaded_at: string;
  pipeline_status?: string | null;
  message?: string | null;
  file_url?: string | null;
  extracted_text?: string | null;
  classification_status: DocumentClassificationStatus;
  classification_attempts: number;
  classification_confidence: number | null;
  classification_notes: string | null;
  last_classified_at: string | null;
  inferred_part_number: string | null;
  drawing_number: string | null;
  linked_documents_count: number;
  highest_confidence_link: { link_type: string; confidence_score: number } | null;
  conflict_flag: boolean;
  phantom_rev_flag?: boolean;
  phantom_rev_note?: string | null;
  /** Structured extraction evidence captured at ingestion time. Dev debug only. */
  extraction_evidence?: DocumentExtractionEvidence | null;
  linked_documents?: {
    document_id: string;
    filename: string;
    document_type: string;
    sku: string | null;
    link_type: string;
    confidence_score: number;
    signals_used?: string[];
  }[];
}

interface IssueContext {
  type: 'missing' | 'conflict';
  sources?: string[];
  docType?: VaultFilterState['documentType'];
  expectedRevision?: string | null;
  actionIntent?: ActionIntent | null;
}

interface PrefillContext {
  docType?: VaultFilterState['documentType'];
  expectedRevision?: string | null;
  actionIntent?: ActionIntent | null;
}

interface VaultDocumentTableProps {
  filters: VaultFilterState;
  issueContext?: IssueContext;
  prefillContext?: PrefillContext;
  viewMode: 'grid' | 'compact';
  refreshToken?: number;
}

const statusColors: Record<RevisionState, string> = {
  CURRENT:    'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  SUPERSEDED: 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-400',
  CONFLICT:   'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  UNKNOWN:    'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
};

type ExtractionStatus = 'parsed' | 'weak' | 'failed';

const extractionStatusBadge: Record<ExtractionStatus, { label: string; tone: string }> = {
  parsed: { label: '🟢 Parsed', tone: 'bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800' },
  weak:   { label: '🟡 Weak',   tone: 'bg-amber-50 text-amber-700 border border-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800' },
  failed: { label: '🔴 Failed', tone: 'bg-red-50 text-red-700 border border-red-100 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800' },
};

const CANONICAL_STATUS_BADGE: Record<CanonicalDocumentStatus, { label: string; tone: string }> = {
  CANONICAL: { label: '⭐ Canonical',        tone: 'bg-yellow-50 text-yellow-800 border border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800' },
  MATCHING:  { label: '✓ Matches expected', tone: 'bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800' },
  OUTDATED:  { label: '⚠ Outdated',          tone: 'bg-amber-50 text-amber-700 border border-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800' },
  CONFLICT:  { label: '🔥 Conflict',         tone: 'bg-red-50 text-red-700 border border-red-100 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800' },
  PENDING:   { label: '⏳ Pending SKU',       tone: 'bg-gray-100 text-gray-600 border border-gray-200 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600' },
  UNLINKED:  { label: '⚠ Unlinked',          tone: 'bg-orange-50 text-orange-700 border border-orange-100 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800' },
  UNKNOWN:   { label: '? Authority unknown', tone: 'bg-gray-100 text-gray-500 border border-gray-200 dark:bg-slate-700 dark:text-slate-500 dark:border-slate-600' },
};

const extractorLabel: Record<VaultDocumentRow['document_type'], string> = {
  BOM: 'BOM extractor',
  CUSTOMER_DRAWING: 'Rheem extractor',
  INTERNAL_DRAWING: 'Apogee extractor',
};

const statusAccent: Record<DocumentClassificationStatus, { bar: string; tint: string; tag?: string | null; emphasize?: boolean }> = {
  RESOLVED:         { bar: 'border-l-emerald-400', tint: 'bg-white',         tag: null,           emphasize: false },
  PENDING:          { bar: 'border-l-amber-400',   tint: 'bg-amber-50/30',   tag: 'Needs Input',  emphasize: false },
  PROCESSING:       { bar: 'border-l-blue-400',    tint: 'bg-blue-50/30',    tag: 'Processing',   emphasize: false },
  PARTIAL:          { bar: 'border-l-orange-500',  tint: 'bg-orange-50/40',  tag: 'Incomplete',   emphasize: true  },
  PARTIAL_MISMATCH: { bar: 'border-l-red-500',     tint: 'bg-red-50/40',     tag: 'Conflict',     emphasize: true  },
  NEEDS_REVIEW:     { bar: 'border-l-red-600',     tint: 'bg-red-50/40',     tag: 'Needs Review', emphasize: true  },
};

const classificationBadges: Record<DocumentClassificationStatus, { label: string; tone: string }> = {
  PENDING:          { label: '🟡 Pending',      tone: 'bg-amber-50 text-amber-800 border border-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800' },
  PROCESSING:       { label: '🔵 Processing',   tone: 'bg-blue-50 text-blue-700 border border-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800' },
  PARTIAL:          { label: '🟠 Partial',      tone: 'bg-orange-50 text-orange-800 border border-orange-100 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800' },
  PARTIAL_MISMATCH: { label: '🟠 Type Mismatch',tone: 'bg-orange-100 text-orange-900 border border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-700' },
  NEEDS_REVIEW:     { label: '🔴 Needs Review', tone: 'bg-red-50 text-red-800 border border-red-100 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800' },
  RESOLVED:         { label: '🟢 Resolved',     tone: 'bg-emerald-50 text-emerald-800 border border-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800' },
};

function groupBySkuAndType(
  documents: VaultDocumentRow[],
  resolutionMap?: Map<string, CanonicalDocumentResolution>,
): { groupKey: string; documents: VaultDocumentRow[] }[] {
  const map = new Map<string, VaultDocumentRow[]>();
  for (const doc of documents) {
    const key = `${doc.sku ?? 'UNLINKED'}-${doc.document_type}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(doc);
  }
  const classificationPriority: DocumentClassificationStatus[] = [
    'NEEDS_REVIEW', 'PARTIAL_MISMATCH', 'PARTIAL', 'PENDING', 'PROCESSING', 'RESOLVED',
  ];

  const getBestCanonicalOrder = (docs: VaultDocumentRow[]) =>
    Math.min(...docs.map(d => CANONICAL_STATUS_SORT_ORDER[resolutionMap?.get(d.id)?.status ?? 'UNKNOWN']));

  return Array.from(map.entries())
    .map(([groupKey, docs]) => ({
      groupKey,
      documents: docs.sort((a, b) => {
        if (resolutionMap) {
          const aOrder = CANONICAL_STATUS_SORT_ORDER[resolutionMap.get(a.id)?.status ?? 'UNKNOWN'];
          const bOrder = CANONICAL_STATUS_SORT_ORDER[resolutionMap.get(b.id)?.status ?? 'UNKNOWN'];
          if (aOrder !== bOrder) return aOrder - bOrder;
        }
        const classDiff = classificationPriority.indexOf(a.classification_status) - classificationPriority.indexOf(b.classification_status);
        if (classDiff !== 0) return classDiff;
        return new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime();
      }),
    }))
    .sort((a, b) =>
      resolutionMap ? getBestCanonicalOrder(a.documents) - getBestCanonicalOrder(b.documents) : 0,
    );
}

export default function VaultDocumentTable({ filters, issueContext, prefillContext, viewMode, refreshToken = 0 }: VaultDocumentTableProps) {
  const router = useRouter();
  const [documents, setDocuments] = useState<VaultDocumentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDevelopment = process.env.NODE_ENV === 'development';
  const [skuContext, setSkuContext] = useState<CanonicalDocumentContext | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function fetchDocuments() {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (filters.sku) params.set('sku', filters.sku);
      if (filters.documentType) params.set('document_type', filters.documentType);
      if (filters.status) params.set('status', filters.status);
      if (filters.classificationStatus) params.set('classification_status', filters.classificationStatus);
      if (filters.search) params.set('search', filters.search);
      params.set('limit', '100');

      try {
        const res = await fetch(`/api/vault/documents?${params.toString()}`, { signal: controller.signal });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error ?? 'Failed to load documents');
        }
        const json = await res.json();
        setDocuments(json.documents ?? []);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Failed to load documents');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchDocuments();
    return () => controller.abort();
  }, [filters.sku, filters.documentType, filters.status, filters.search, filters.classificationStatus, refreshToken]);

  // Fetch SKU-level canonical context when a specific SKU is filtered
  useEffect(() => {
    if (!filters.sku) {
      setSkuContext(null);
      return;
    }
    const controller = new AbortController();
    console.log('[T23.6.39 PARAM TRACE]', {
      stage: 'HOOK_INPUT',
      file: 'src/features/vault/components/VaultDocumentTable.tsx',
      function: 'VaultDocumentTable:fetchSku',
      routeParam: null,
      partNumber: filters.sku,
      canonicalPartNumber: canonicalizePartNumber(filters.sku),
      note: 'Vault filter provided SKU for context fetch',
    });
    const partParam = filters.sku ?? '';
    console.log('[T23.6.37 TRACE]', {
      stage: 'API',
      function: 'VaultDocumentTable:fetchSku',
      rawPart: partParam,
      canonicalPart: canonicalizePartNumber(partParam),
      outgoingValue: `/api/sku/get?partNumber=${partParam}`,
      note: 'Triggering SKU fetch from Vault table',
    });
    console.log('[T23.6.39 FETCH TRACE]', {
      stage: 'FETCH_CALL',
      file: 'src/features/vault/components/VaultDocumentTable.tsx',
      function: 'VaultDocumentTable:fetchSku',
      routeParam: null,
      partNumber: partParam,
      canonicalPartNumber: canonicalizePartNumber(partParam),
      url: `/api/sku/get?partNumber=${encodeURIComponent(partParam)}`,
      blocked: !partParam,
      note: 'Vault document table fetch',
    });
    fetch(`/api/sku/get?partNumber=${encodeURIComponent(partParam)}`, { signal: controller.signal })
      .then(res => (res.ok ? res.json() : null))
      .then(json => {
        if (!json?.ok || controller.signal.aborted) return;
        const validation: CrossSourceValidationResult | null =
          json.sku?.revision_validation ?? json.revision_validation ?? null;
        const expectedDrawings = json.sku?.expected_drawings ?? json.expected_drawings ?? null;
        if (!validation) { setSkuContext(null); return; }
        setSkuContext({
          skuCanonicalRevision: validation.canonical_revision,
          skuCanonicalSource: validation.canonical_source,
          comparisons: validation.comparisons ?? [],
          expectedApogeeDrawingNumber: expectedDrawings?.apogee?.drawing_number ?? null,
        });
      })
      .catch(() => { if (!controller.signal.aborted) setSkuContext(null); });
    return () => controller.abort();
  }, [filters.sku]);

  const resolutionMap = useMemo(() => {
    const map = new Map<string, CanonicalDocumentResolution>();
    for (const { doc, resolution } of resolveCanonicalDocuments(documents, skuContext)) {
      map.set(doc.id, resolution);
    }
    return map;
  }, [documents, skuContext]);

  const canonicalSummary = useMemo(() => {
    if (!skuContext) return null;
    return summarizeCanonicalResolution(Array.from(resolutionMap.values()), skuContext);
  }, [resolutionMap, skuContext]);

  const groupedDocuments = useMemo(
    () => groupBySkuAndType(documents, resolutionMap),
    [documents, resolutionMap],
  );
  const compactDocuments = useMemo(() => {
    if (skuContext) {
      return [...documents].sort((a, b) => {
        const aOrder = CANONICAL_STATUS_SORT_ORDER[resolutionMap.get(a.id)?.status ?? 'UNKNOWN'];
        const bOrder = CANONICAL_STATUS_SORT_ORDER[resolutionMap.get(b.id)?.status ?? 'UNKNOWN'];
        if (aOrder !== bOrder) return aOrder - bOrder;
        return new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime();
      });
    }
    return [...documents].sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());
  }, [documents, skuContext, resolutionMap]);

  const handleDocumentClick = (row: VaultDocumentRow) => {
    let destination = `/vault/document/${row.id}`;
    if (row.sku_id) {
      if (!row.sku || row.sku.toLowerCase() === 'undefined') {
        console.error('[ROUTING ERROR] sku_id without valid part_number', {
          documentId: row.id,
          sku_id: row.sku_id,
          sku: row.sku ?? null,
        });
        return;
      }
      destination = `/sku/${encodeURIComponent(row.sku)}`;
    }
    console.log('[ROUTING] Document click', {
      documentId: row.id,
      sku_id: row.sku_id,
      destination,
    });
    router.push(destination);
  };

  const expectedRevision = prefillContext?.expectedRevision ?? issueContext?.expectedRevision ?? null;

  const renderDocumentRow = (doc: VaultDocumentRow, options?: { compact?: boolean }) => {
    const compact = options?.compact ?? false;
    const revisionState = doc.revision_state ?? 'UNKNOWN';
    const accent = statusAccent[doc.classification_status];
    const isUnlinked = !doc.sku_id;
    const isPending = Boolean(doc.sku?.startsWith('PENDING-'));
    const partLabel = doc.sku ?? doc.inferred_part_number ?? '—';
    // canonical_revision is the ONLY approved revision source for display.
    // raw revision and normalized_revision are diagnostic only.
    const displayRevision = doc.canonical_revision ?? null;
    const revisionLabel = displayRevision ?? '—';
    const hasRevision = Boolean(displayRevision);
    const extractionStatus: ExtractionStatus = hasRevision
      ? doc.phantom_rev_flag
        ? 'weak'
        : 'parsed'
      : 'failed';

    const resolution = resolutionMap.get(doc.id) ?? null;
    const authorityBadge = (resolution && skuContext) ? CANONICAL_STATUS_BADGE[resolution.status] : null;

    if (isDevelopment && !doc.canonical_revision && (doc.normalized_revision || (doc.revision && doc.revision !== 'UNSPECIFIED'))) {
      console.warn('[VAULT CANONICAL REVISION NULL — raw/normalized suggest value exists]', {
        documentId: doc.id,
        raw_revision: doc.revision,
        normalized_revision: doc.normalized_revision ?? null,
        filename: doc.filename,
      });
    }
    const extractionBadgeTone = extractionStatusBadge[extractionStatus];
    const extractionSource = extractorLabel[doc.document_type] ?? 'Generic fallback';
    const debugPayload = isDevelopment
      ? {
          canonical_revision: doc.canonical_revision ?? null,
          raw_revision: doc.revision ?? null,
          normalized_revision: doc.normalized_revision ?? null,
          revision_source: doc.revision_source ?? null,
          expected_revision: expectedRevision ?? null,
          validation_status: doc.sku_revision_status ?? 'UNKNOWN',
          extractor: extractionSource,
          confidence: doc.classification_confidence ?? null,
          extraction_status: extractionStatus,
          classification_status: doc.classification_status,
          classification_notes: doc.classification_notes ?? null,
          drawing_number: doc.drawing_number ?? null,
          canonical_resolution: resolution
            ? { status: resolution.status, reason: resolution.reason, matchesExpectedRevision: resolution.matchesExpectedRevision, matchesExpectedDrawing: resolution.matchesExpectedDrawing }
            : null,
        }
      : null;

    return (
      <button
        key={doc.id}
        type="button"
        onClick={() => handleDocumentClick(doc)}
        className={`flex w-full flex-col gap-3 text-left transition hover:bg-blue-50 ${compact ? 'px-3 py-2' : 'px-3 py-3'} cursor-pointer last:rounded-b-xl border-l-4 ${accent.bar} ${accent.tint} ${accent.emphasize ? 'ring-1 ring-inset ring-red-200 shadow-sm' : ''}`}
      >
        <div className={`flex w-full ${compact ? 'flex-col gap-3 md:flex-row md:items-center' : 'flex-col gap-3 lg:flex-row lg:items-center'}`}>
          <div className="flex-1 min-w-[220px] space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className={`font-semibold ${accent.emphasize ? 'text-gray-900' : 'text-gray-800'}`}>{doc.filename}</p>
              {accent.tag && (
                <span className="text-[10px] uppercase tracking-wide text-gray-600 bg-white/70 px-2 py-0.5 rounded-full">
                  {accent.tag}
                </span>
              )}
              {isUnlinked && (
                <span className="text-[10px] font-semibold text-orange-700 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                  ⚠️ Not linked to SKU
                </span>
              )}
              {isPending && (
                <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                  ⏳ Pending SKU assignment
                </span>
              )}
            </div>
            {authorityBadge && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${authorityBadge.tone}`}>
                  {authorityBadge.label}
                </span>
                <span className="text-[11px] text-gray-500">{resolution!.reason}</span>
              </div>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
              <span className="font-semibold text-gray-700">Part:</span>
              <span>{partLabel}</span>
              <span className="font-semibold text-gray-700">Rev:</span>
              <span>{revisionLabel}</span>
              {expectedRevision && (
                <span>
                  <span className="font-semibold text-gray-700">Expected:</span> {expectedRevision}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-semibold ${extractionBadgeTone.tone}`}>
                {extractionStatusBadge[extractionStatus].label}
              </span>
              <span className="text-gray-500">{extractionSource}</span>
              <span className="text-gray-400">· Uploaded {new Date(doc.uploaded_at).toLocaleString()}</span>
            </div>
            {!hasRevision && (
              <p className="text-[11px] font-semibold text-red-600">
                No revision detected in document (missing text layer or unsupported format).
              </p>
            )}
            <p className="text-[11px] text-gray-600">State: {revisionState}</p>
            <div className="text-[11px] text-gray-500 flex flex-wrap gap-x-3 gap-y-1">
              {doc.inferred_part_number && <span>PN: {doc.inferred_part_number}</span>}
              {doc.drawing_number && <span>DRW: {doc.drawing_number}</span>}
              {Number.isFinite(doc.classification_confidence) && <span>Confidence: {doc.classification_confidence?.toFixed(2)}</span>}
              {doc.classification_attempts > 0 && <span>Attempts: {doc.classification_attempts}</span>}
            </div>
            <p className="text-[11px] text-gray-500 font-medium">
              {doc.classification_status === 'PENDING' && 'Awaiting classification'}
              {doc.classification_status === 'PROCESSING' && 'Classification in progress'}
              {doc.classification_status === 'PARTIAL' && 'Partial match — missing signals'}
              {doc.classification_status === 'PARTIAL_MISMATCH' && 'Conflicting signals detected'}
              {doc.classification_status === 'RESOLVED' && 'Classification resolved'}
              {doc.classification_status === 'NEEDS_REVIEW' && 'Manual review required'}
            </p>
            {doc.message && (
              <p className="text-[11px] text-amber-600 font-semibold">
                {doc.message}
              </p>
            )}
            {doc.classification_notes && (
              <p className="text-[11px] italic text-gray-400 line-clamp-2">{doc.classification_notes}</p>
            )}
            {doc.sku_revision_status && (
              <RevisionStatusBadge status={doc.sku_revision_status} showLabel={false} className="text-[11px]" />
            )}
            {doc.sku_readiness_status && doc.sku_readiness_status !== 'READY' && (
              <p className="text-[11px] text-amber-700 font-semibold">
                Readiness {readinessLabel[doc.sku_readiness_status]}
              </p>
            )}
            {isDevelopment && debugPayload && (
              <details
                className="rounded-lg bg-gray-900/80 p-2 text-[11px] text-emerald-200"
                onClick={(e) => { e.stopPropagation(); console.log('[T23.6.47 DEBUG CLICK]', { control: 'Extraction Debug', docId: doc.id, toggled: true, navigated: false }); }}
              >
                <summary className="cursor-pointer font-semibold">Extraction Debug</summary>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(debugPayload, null, 2)}</pre>
              </details>
            )}
            {isDevelopment && doc.extraction_evidence && (
              <details
                className="rounded-lg bg-gray-900/80 p-2 text-[11px] text-sky-200"
                onClick={(e) => { e.stopPropagation(); console.log('[T23.6.47 DEBUG CLICK]', { control: 'Evidence Chain', docId: doc.id, toggled: true, navigated: false }); }}
              >
                <summary className="cursor-pointer font-semibold">Evidence Chain</summary>
                <div className="mt-2 space-y-1">
                  <div className="text-sky-400 font-semibold">Document class: {doc.extraction_evidence.document_structure?.document_class_hint ?? '—'}</div>
                  <div className="text-sky-300">Revision signals:</div>
                  {doc.extraction_evidence.revision_signals.map((s, i) => (
                    <div key={i} className="ml-2 text-emerald-300">{s.source}: <span className="text-white">{s.value ?? 'null'}</span> (conf {s.confidence.toFixed(2)})</div>
                  ))}
                  {doc.extraction_evidence.revision_signals.length === 0 && <div className="ml-2 text-gray-500">no revision signals</div>}
                  <div className="text-sky-300">Drawing number signals:</div>
                  {doc.extraction_evidence.drawing_number_signals.map((s, i) => (
                    <div key={i} className="ml-2 text-emerald-300">{s.source}: <span className="text-white">{s.value ?? 'null'}</span> (conf {s.confidence.toFixed(2)})</div>
                  ))}
                  {doc.extraction_evidence.drawing_number_signals.length === 0 && <div className="ml-2 text-gray-500">no drawing signals</div>}
                  <div className="text-sky-300">Resolved: rev=<span className="text-white">{doc.extraction_evidence.resolved_revision ?? '—'}</span> [{doc.extraction_evidence.resolved_revision_source ?? '—'}] · drn=<span className="text-white">{doc.extraction_evidence.resolved_drawing_number ?? '—'}</span> [{doc.extraction_evidence.resolved_drawing_number_source ?? '—'}]</div>
                  {doc.extraction_evidence.document_structure && (
                    <div className="text-sky-300">Structure: title_block={String(doc.extraction_evidence.document_structure.has_title_block)} · connectors={String(doc.extraction_evidence.document_structure.has_connector_tables)} · wire_map={String(doc.extraction_evidence.document_structure.has_wire_mapping)}</div>
                  )}
                  <div className="text-gray-500 text-[10px]">captured {doc.extraction_evidence.captured_at}</div>
                </div>
              </details>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColors[revisionState]}`}>
              {revisionState}
            </span>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${classificationBadges[doc.classification_status].tone}`}>
              {classificationBadges[doc.classification_status].label}
            </span>
            {doc.sku_readiness_status && (
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${readinessBadgeTone[doc.sku_readiness_status]}`}>
                Readiness {readinessLabel[doc.sku_readiness_status]}
              </span>
            )}
            {doc.linked_documents_count > 0 && (
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                🔗 {doc.linked_documents_count}
              </span>
            )}
            {doc.conflict_flag && (
              <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">⚠️ Conflict</span>
            )}
            <span className="text-xs text-gray-500">{doc.document_type.replace('_', ' ')}</span>
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className={`space-y-2 ${prefillContext ? 'rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--surface-elevated)] p-3' : ''}`}>
      {canonicalSummary && (
        <div className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
          canonicalSummary.includes('conflict') || canonicalSummary.includes('No uploaded')
            ? 'border-red-200 bg-red-50 text-red-800'
            : canonicalSummary.includes('canonical document')
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : 'border-amber-200 bg-amber-50 text-amber-900'
        }`}>
          {canonicalSummary}
        </div>
      )}
      {issueContext && (
        <div className={`rounded-xl border px-3 py-2 text-xs font-semibold ${issueContext.type === 'missing' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-red-200 bg-red-50 text-red-800'}`}>
          Viewing documents in context of {issueContext.type === 'missing' ? 'missing revision sources' : 'revision conflicts'}.
          {issueContext.docType && <span className="ml-2 font-normal">Doc type filter: {issueContext.docType.replace('_', ' ')}</span>}
          {issueContext.expectedRevision && <span className="ml-2 font-normal">Expected REV {issueContext.expectedRevision}</span>}
        </div>
      )}

      {prefillContext && (prefillContext.expectedRevision || prefillContext.docType || prefillContext.actionIntent) && (
        <div className="rounded-xl border border-[color:var(--panel-border)] bg-[color:var(--surface-elevated)] px-3 py-2 text-xs text-blue-900">
          {prefillContext.expectedRevision && (
            <p>
              <span className="font-semibold">Expected revision:</span> {prefillContext.expectedRevision}
            </p>
          )}
          {prefillContext.docType && (
            <p className="mt-0.5">
              <span className="font-semibold">Document type locked:</span> {prefillContext.docType.replace('_', ' ')}
            </p>
          )}
          {prefillContext.actionIntent && (
            <p className="mt-0.5 text-[11px] uppercase tracking-wide text-blue-600">Intent: {prefillContext.actionIntent.replace(/_/g, ' ')}</p>
          )}
        </div>
      )}

      {loading && (
        <div className="rounded-xl border border-[color:var(--panel-border)] bg-[color:var(--surface-elevated)] px-3 py-2 text-sm text-gray-600">
          Loading documents…
        </div>
      )}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {!loading && !error && documents.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
          No documents found for the selected filters.
        </div>
      )}

      {viewMode === 'compact' ? (
        <div className="rounded-xl border border-[color:var(--panel-border)] bg-[color:var(--surface-elevated)] shadow-sm">
          <div className="divide-y divide-gray-200">
            {compactDocuments.map(doc => renderDocumentRow(doc, { compact: true }))}
          </div>
        </div>
      ) : (
        groupedDocuments.map(group => (
          <div key={group.groupKey} className="rounded-xl border border-[color:var(--panel-border)] bg-[color:var(--surface-elevated)] shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-200 bg-[color:var(--surface-elevated)] px-3 py-2 rounded-t-xl">
              <div className="flex items-center gap-3">
                <p className="text-sm font-semibold text-gray-900">{group.groupKey}</p>
                <p className="text-xs text-gray-400">{group.documents.length} doc{group.documents.length === 1 ? '' : 's'}</p>
              </div>
            </div>
            <div className="divide-y divide-gray-200">
              {group.documents.map(doc => renderDocumentRow(doc))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
