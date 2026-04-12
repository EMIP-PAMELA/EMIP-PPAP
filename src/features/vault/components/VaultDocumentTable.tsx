'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { VaultFilterState } from './VaultFilters';
import type { DocumentClassificationStatus } from '@/src/features/harness-work-instructions/services/skuService';
import type { RevisionState } from '@/src/utils/revisionEvaluator';
import type { CrossSourceRevisionStatus } from '@/src/utils/revisionCrossValidator';
import type { ReadinessStatus } from '@/src/utils/skuReadinessEvaluator';
import RevisionStatusBadge from '@/src/features/revision/components/RevisionStatusBadge';

const readinessBadgeTone: Record<ReadinessStatus, string> = {
  READY: 'bg-emerald-100 text-emerald-800',
  PARTIAL: 'bg-amber-100 text-amber-800',
  BLOCKED: 'bg-red-100 text-red-700',
};

const readinessLabel: Record<ReadinessStatus, string> = {
  READY: 'Ready',
  PARTIAL: 'Partial',
  BLOCKED: 'Blocked',
};

interface VaultDocumentRow {
  id: string;
  sku_id: string | null;
  filename: string;
  document_type: 'BOM' | 'CUSTOMER_DRAWING' | 'INTERNAL_DRAWING';
  sku: string | null;
  revision: string;
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

interface VaultDocumentTableProps {
  filters: VaultFilterState;
}

const statusColors: Record<RevisionState, string> = {
  CURRENT: 'bg-emerald-100 text-emerald-800',
  SUPERSEDED: 'bg-gray-100 text-gray-600',
  CONFLICT: 'bg-red-100 text-red-700',
  UNKNOWN: 'bg-amber-100 text-amber-800',
};

const statusAccent: Record<DocumentClassificationStatus, { bar: string; tint: string; tag?: string | null; emphasize?: boolean }> = {
  RESOLVED: { bar: 'bg-emerald-400', tint: 'bg-gray-50', tag: null, emphasize: false },
  PENDING: { bar: 'bg-amber-400', tint: 'bg-amber-50/40', tag: 'Needs Input', emphasize: false },
  PROCESSING: { bar: 'bg-blue-400', tint: 'bg-blue-50/40', tag: 'Processing', emphasize: false },
  PARTIAL: { bar: 'bg-orange-500', tint: 'bg-orange-50/50', tag: 'Incomplete', emphasize: true },
  PARTIAL_MISMATCH: { bar: 'bg-red-500', tint: 'bg-red-50/60', tag: 'Conflict', emphasize: true },
  NEEDS_REVIEW: { bar: 'bg-red-600', tint: 'bg-red-50/70', tag: 'Needs Review', emphasize: true },
};

const classificationBadges: Record<DocumentClassificationStatus, { label: string; tone: string }> = {
  PENDING: { label: '🟡 Pending', tone: 'bg-amber-50 text-amber-800 border border-amber-100' },
  PROCESSING: { label: '🔵 Processing', tone: 'bg-blue-50 text-blue-700 border border-blue-100' },
  PARTIAL: { label: '🟠 Partial', tone: 'bg-orange-50 text-orange-800 border border-orange-100' },
  PARTIAL_MISMATCH: { label: '🟠 Type Mismatch', tone: 'bg-orange-100 text-orange-900 border border-orange-200' },
  NEEDS_REVIEW: { label: '🔴 Needs Review', tone: 'bg-red-50 text-red-800 border border-red-100' },
  RESOLVED: { label: '🟢 Resolved', tone: 'bg-emerald-50 text-emerald-800 border border-emerald-100' },
};

function groupBySkuAndType(documents: VaultDocumentRow[]): { groupKey: string; documents: VaultDocumentRow[] }[] {
  const map = new Map<string, VaultDocumentRow[]>();
  for (const doc of documents) {
    const key = `${doc.sku ?? 'UNLINKED'}-${doc.document_type}`;
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(doc);
  }
  const priorityOrder: DocumentClassificationStatus[] = [
    'NEEDS_REVIEW',
    'PARTIAL_MISMATCH',
    'PARTIAL',
    'PENDING',
    'PROCESSING',
    'RESOLVED',
  ];

  return Array.from(map.entries()).map(([groupKey, docs]) => ({
    groupKey,
    documents: docs.sort((a, b) => {
      const priorityDiff = priorityOrder.indexOf(a.classification_status) - priorityOrder.indexOf(b.classification_status);
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime();
    }),
  }));
}

export default function VaultDocumentTable({ filters }: VaultDocumentTableProps) {
  const router = useRouter();
  const [documents, setDocuments] = useState<VaultDocumentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  }, [filters.sku, filters.documentType, filters.status, filters.search, filters.classificationStatus]);

  const groupedDocuments = useMemo(() => groupBySkuAndType(documents), [documents]);

  const handleDocumentClick = (row: VaultDocumentRow) => {
    let destination = `/vault/document/${row.id}`;
    if (row.sku_id) {
      if (!row.sku) {
        console.error('[ROUTING ERROR] sku_id without part_number', {
          documentId: row.id,
          sku_id: row.sku_id,
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

  return (
    <div className="space-y-2">
      {loading && (
        <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600">
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

      {groupedDocuments.map(group => (
        <div key={group.groupKey} className="rounded-xl border border-gray-300 bg-gray-50 shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-200 bg-white px-3 py-2 rounded-t-xl">
            <div className="flex items-center gap-3">
              <p className="text-sm font-semibold text-gray-900">{group.groupKey}</p>
              <p className="text-xs text-gray-400">{group.documents.length} doc{group.documents.length === 1 ? '' : 's'}</p>
            </div>
          </div>
          <div className="divide-y divide-gray-200">
            {group.documents.map(doc => {
              const revisionState = doc.revision_state ?? 'UNKNOWN';
              const accent = statusAccent[doc.classification_status];
              return (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => handleDocumentClick(doc)}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-blue-50 cursor-pointer transition last:rounded-b-xl border-l-4 ${accent.bar} ${accent.tint} ${accent.emphasize ? 'border border-red-200 shadow-sm' : 'border border-transparent'}`}
                >
                  <div className="flex-1 min-w-[200px] space-y-1">
                    <div className="flex items-center gap-2">
                      <p className={`font-semibold ${accent.emphasize ? 'text-gray-900' : 'text-gray-800'}`}>{doc.filename}</p>
                      {accent.tag && (
                        <span className="text-[10px] uppercase tracking-wide text-gray-600 bg-white/70 px-2 py-0.5 rounded-full">
                          {accent.tag}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      Revision {doc.revision} · Uploaded {new Date(doc.uploaded_at).toLocaleString()}
                    </p>
                    <p className="text-[11px] font-semibold text-gray-600">State: {revisionState}</p>
                    <div className="text-[11px] text-gray-500 flex flex-wrap gap-x-3 gap-y-1">
                      {doc.inferred_part_number && <span>PN: {doc.inferred_part_number}</span>}
                      {doc.drawing_number && <span>DRW: {doc.drawing_number}</span>}
                      {Number.isFinite(doc.classification_confidence) && (
                        <span>Confidence: {doc.classification_confidence?.toFixed(2)}</span>
                      )}
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
                    {doc.sku_revision_status && (
                      <RevisionStatusBadge
                        status={doc.sku_revision_status}
                        showLabel={false}
                        className="text-[11px]"
                      />
                    )}
                    {doc.sku_readiness_status && doc.sku_readiness_status !== 'READY' && (
                      <p className="text-[11px] text-amber-700 font-semibold">
                        Readiness {readinessLabel[doc.sku_readiness_status]}
                      </p>
                    )}
                    {doc.classification_notes && (
                      <p className="text-[11px] italic text-gray-400 line-clamp-2">
                        {doc.classification_notes}
                      </p>
                    )}
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColors[revisionState]}`}>
                    {revisionState}
                  </span>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${classificationBadges[doc.classification_status].tone}`}>
                    {classificationBadges[doc.classification_status].label}
                  </span>
                  {doc.sku_revision_status && <RevisionStatusBadge status={doc.sku_revision_status} showLabel={false} />}
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
                    <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                      ⚠️ Conflict
                    </span>
                  )}
                  <span className="text-xs text-gray-500">{doc.document_type.replace('_', ' ')}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
