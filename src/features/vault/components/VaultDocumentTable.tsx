'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { VaultFilterState } from './VaultFilters';
import type { DocumentClassificationStatus } from '@/src/features/harness-work-instructions/services/skuService';

interface VaultDocumentRow {
  id: string;
  sku_id: string | null;
  filename: string;
  document_type: 'BOM' | 'CUSTOMER_DRAWING' | 'INTERNAL_DRAWING';
  sku: string | null;
  revision: string;
  status: 'CURRENT' | 'OBSOLETE' | 'UNKNOWN';
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

const statusColors: Record<string, string> = {
  CURRENT: 'bg-emerald-100 text-emerald-800',
  OBSOLETE: 'bg-gray-100 text-gray-600',
  UNKNOWN: 'bg-amber-100 text-amber-800',
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
  return Array.from(map.entries()).map(([groupKey, docs]) => ({
    groupKey,
    documents: docs.sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()),
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
    const destination = row.sku_id && row.sku ? `/sku/${encodeURIComponent(row.sku)}` : `/vault/document/${row.id}`;
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
            {group.documents.map((doc, index) => {
              const computedStatus = index === 0 ? 'CURRENT' : 'UNKNOWN';
              return (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => handleDocumentClick(doc)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-blue-50 cursor-pointer transition bg-white last:rounded-b-xl"
                >
                  <div className="flex-1 min-w-[200px]">
                    <p className="font-semibold text-gray-900">{doc.filename}</p>
                    <p className="text-xs text-gray-500">
                      Revision {doc.revision} · Uploaded {new Date(doc.uploaded_at).toLocaleString()}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColors[computedStatus]}`}>
                    {computedStatus}
                  </span>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${classificationBadges[doc.classification_status].tone}`}>
                    {classificationBadges[doc.classification_status].label}
                  </span>
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
