'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { VaultFilterState } from './VaultFilters';
import type { DocumentClassificationStatus } from '@/src/features/harness-work-instructions/services/skuService';

interface VaultDocumentRow {
  id: string;
  filename: string;
  document_type: 'BOM' | 'CUSTOMER_DRAWING' | 'INTERNAL_DRAWING';
  sku: string | null;
  revision: string;
  status: 'CURRENT' | 'OBSOLETE' | 'UNKNOWN';
  created_at: string;
  pipeline_status?: string | null;
  message?: string | null;
  file_url?: string | null;
  extracted_text?: string | null;
  classification_status: DocumentClassificationStatus;
  classification_attempts: number;
  classification_confidence: number | null;
  classification_notes: string | null;
  last_classified_at: string | null;
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
    documents: docs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
  }));
}

export default function VaultDocumentTable({ filters }: VaultDocumentTableProps) {
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
  const [selected, setSelected] = useState<VaultDocumentRow | null>(null);
  const [detail, setDetail] = useState<VaultDocumentRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const openDetail = async (row: VaultDocumentRow) => {
    setSelected(row);
    setDetail(row);

    if (row.extracted_text && row.linked_documents) return;
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/vault/documents?id=${row.id}&include_text=true&include_links=true&limit=1`);
      if (!res.ok) throw new Error('Failed to load document');
      const json = await res.json();
      if (json.documents && json.documents[0]) {
        setDetail(json.documents[0]);
      }
    } catch (err) {
      console.warn('[VaultDocumentTable] detail load failed', err);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {loading && (
        <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
          Loading documents…
        </div>
      )}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {!loading && !error && documents.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">
          No documents found for the selected filters.
        </div>
      )}

      {groupedDocuments.map(group => (
        <div key={group.groupKey} className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">{group.groupKey}</p>
              <p className="text-xs text-gray-500">{group.documents.length} document(s)</p>
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {group.documents.map((doc, index) => {
              const computedStatus = index === 0 ? 'CURRENT' : 'UNKNOWN';
              return (
                <button
                  key={doc.id}
                  onClick={() => openDetail(doc)}
                  className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-gray-50"
                >
                  <div className="flex-1 min-w-[200px]">
                    <p className="font-semibold text-gray-900">{doc.filename}</p>
                    <p className="text-xs text-gray-500">
                      Revision {doc.revision} · Uploaded {new Date(doc.created_at).toLocaleString()}
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

      {selected && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4" onClick={() => { setSelected(null); setDetail(null); }}>
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-blue-500">Document Detail</p>
                <h2 className="text-2xl font-bold text-gray-900">{detail?.filename ?? selected.filename}</h2>
                <p className="text-sm text-gray-500">
                  {(detail ?? selected).document_type.replace('_', ' ')} · Revision {(detail ?? selected).revision}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setSelected(null); setDetail(null); }}
                className="rounded-full border border-gray-200 p-2 text-gray-500 hover:bg-gray-50"
              >
                ✕
              </button>
            </div>

            <dl className="mt-6 grid gap-4 md:grid-cols-2 text-sm">
              <div>
                <dt className="text-xs uppercase text-gray-400">SKU</dt>
                <dd className="font-semibold text-gray-900">{(detail ?? selected).sku ?? 'Unlinked'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-gray-400">Uploaded</dt>
                <dd className="font-semibold text-gray-900">{new Date((detail ?? selected).created_at).toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-gray-400">Status</dt>
                <dd className="font-semibold text-gray-900">{(detail ?? selected).status}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-gray-400">Pipeline</dt>
                <dd className="font-semibold text-gray-900">{(detail ?? selected).pipeline_status ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-gray-400">Classification</dt>
                <dd className="font-semibold text-gray-900">
                  {classificationBadges[(detail ?? selected).classification_status].label}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-gray-400">Attempts</dt>
                <dd className="font-semibold text-gray-900">{(detail ?? selected).classification_attempts}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-gray-400">Confidence</dt>
                <dd className="font-semibold text-gray-900">
                  {(detail ?? selected).classification_confidence != null
                    ? `${Math.round(((detail ?? selected).classification_confidence as number) * 100)}%`
                    : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-gray-400">Linked Documents</dt>
                <dd className="font-semibold text-gray-900">
                  {(detail ?? selected).linked_documents_count ?? 0}
                </dd>
              </div>
            </dl>

            {(detail ?? selected).message && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {(detail ?? selected).message}
              </div>
            )}

            {(detail ?? selected).classification_notes && (
              <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                {(detail ?? selected).classification_notes}
              </div>
            )}

            {(detail ?? selected).highest_confidence_link && (
              <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                Highest link: {(detail ?? selected).highest_confidence_link?.link_type ?? 'N/A'} ·
                Confidence {(detail ?? selected).highest_confidence_link?.confidence_score ?? 0}
              </div>
            )}

            {detailLoading && (
              <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                Loading extracted text…
              </div>
            )}

            {detail?.extracted_text && !detailLoading && (
              <div className="mt-4">
                <p className="text-xs uppercase text-gray-400 mb-1">Extracted Text</p>
                <pre className="max-h-[200px] overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700 whitespace-pre-wrap">
                  {detail.extracted_text}
                </pre>
              </div>
            )}

            {(detail ?? selected).linked_documents && (detail ?? selected).linked_documents!.length > 0 && (
              <div className="mt-4">
                <p className="text-xs uppercase text-gray-400 mb-2">Linked Documents</p>
                <div className="space-y-2">
                  {(detail ?? selected).linked_documents!.map(link => (
                    <div key={link.document_id} className="rounded-xl border border-gray-200 px-3 py-2 text-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">{link.filename}</p>
                          <p className="text-xs text-gray-500">
                            {link.document_type} · SKU {link.sku ?? '—'}
                          </p>
                        </div>
                        <span className="text-xs font-semibold text-gray-700">
                          {link.link_type} · {link.confidence_score}
                        </span>
                      </div>
                      {link.signals_used && link.signals_used.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-500">
                          {link.signals_used.map(signal => (
                            <span key={signal} className="rounded-full bg-gray-100 px-2 py-0.5">
                              {signal}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              {(detail ?? selected).sku && (
                <Link
                  href={`/sku/${encodeURIComponent((detail ?? selected).sku as string)}`}
                  className="rounded-xl border border-gray-200 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Open SKU →
                </Link>
              )}
              {(detail ?? selected).file_url && (
                <a
                  href={(detail ?? selected).file_url as string}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-blue-200 px-4 py-2 font-semibold text-blue-600 hover:bg-blue-50"
                >
                  View File →
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
