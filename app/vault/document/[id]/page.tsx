import Link from 'next/link';
import { getSupabaseServer } from '@/src/lib/supabaseServer';
import type { DocumentClassificationStatus } from '@/src/features/harness-work-instructions/services/skuService';
import { getSKU } from '@/src/features/harness-work-instructions/services/skuService';
import type { ReadinessStatus } from '@/src/utils/skuReadinessEvaluator';
import { VaultCorrectionPanel } from '@/src/features/vault/components/VaultCorrectionPanel';

interface DocumentDetail {
  id: string;
  file_name: string;
  document_type: string;
  classification_status: DocumentClassificationStatus;
  classification_confidence: number | null;
  classification_notes: string | null;
  sku_id: string | null;
  inferred_part_number: string | null;
  drawing_number: string | null;
  sku_part_number: string | null;
}

async function loadDocument(id: string): Promise<DocumentDetail | null> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('sku_documents')
    .select(
      `id,
       file_name,
       document_type,
       classification_status,
       classification_confidence,
       classification_notes,
       sku_id,
       inferred_part_number,
       drawing_number,
       sku:sku_id (part_number)
      `,
    )
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[VAULT DOCUMENT PAGE] fetch failed', {
      documentId: id,
      supabaseError: error,
    });
    return null;
  }

  if (!data) return null;

  const skuRel = Array.isArray(data.sku) ? data.sku[0] : (data.sku as { part_number?: string } | null);
  return {
    id: data.id,
    file_name: data.file_name,
    document_type: data.document_type,
    classification_status: (data.classification_status ?? 'PENDING') as DocumentClassificationStatus,
    classification_confidence: data.classification_confidence ?? null,
    classification_notes: data.classification_notes ?? null,
    sku_id: data.sku_id ?? null,
    inferred_part_number: data.inferred_part_number ?? null,
    drawing_number: data.drawing_number ?? null,
    sku_part_number: skuRel?.part_number ?? null,
  };
}

export default async function VaultDocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const document = await loadDocument(id);
  if (!document) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 py-10">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-5 text-amber-900">
          <p className="text-sm font-semibold uppercase tracking-wide">Document not found</p>
          <p className="mt-2 text-base text-amber-900">Requested ID: {id}</p>
          <p className="mt-2 text-sm text-amber-800">
            This document may not exist, may not be accessible, or may still be pending reconciliation.
          </p>
          <Link
            href="/vault"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-800"
          >
            ← Back to Vault
          </Link>
        </div>
      </div>
    );
  }

  let skuReadinessStatus: ReadinessStatus | null = null;
  if (document.sku_part_number) {
    try {
      const skuRecord = await getSKU(document.sku_part_number);
      skuReadinessStatus = skuRecord?.sku?.readiness?.overall_status ?? null;
    } catch (err) {
      console.warn('[VAULT DOCUMENT PAGE] readiness lookup failed', err);
    }
  }

  const callouts: string[] = [];
  if (!document.inferred_part_number && !document.sku_part_number) {
    callouts.push('Missing part number');
  }
  if (!document.drawing_number) {
    callouts.push('Missing drawing number');
  }
  if (!document.sku_part_number) {
    callouts.push('Document not linked to SKU');
  }
  if (document.classification_status === 'NEEDS_REVIEW') {
    callouts.push('Manual review required');
  }
  if (skuReadinessStatus === 'BLOCKED') {
    callouts.push('Linked SKU readiness blocked');
  } else if (skuReadinessStatus === 'PARTIAL') {
    callouts.push('Linked SKU readiness partial');
  }

  const readinessBadgeTone: Record<ReadinessStatus, string> = {
    READY: 'bg-emerald-100 text-emerald-800',
    PARTIAL: 'bg-amber-100 text-amber-800',
    BLOCKED: 'bg-red-100 text-red-700',
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8 py-10">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.4em] text-blue-500">Vault Document</p>
        <h1 className="text-3xl font-bold text-gray-900">{document.file_name}</h1>
        <p className="text-sm text-gray-500">
          {document.document_type.replace('_', ' ')} · ID {document.id}
        </p>
      </div>

      <div className="grid gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm md:grid-cols-2">
        <div>
          <p className="text-xs uppercase text-gray-400">Classification</p>
          <p className="text-lg font-semibold text-gray-900">{document.classification_status}</p>
          {document.classification_confidence !== null && (
            <p className="text-sm text-gray-500">Confidence {document.classification_confidence.toFixed(2)}</p>
          )}
        </div>
        <div>
          <p className="text-xs uppercase text-gray-400">SKU</p>
          <p className="text-lg font-semibold text-gray-900">{document.sku_part_number ?? 'Unlinked'}</p>
        </div>
        {document.sku_part_number && skuReadinessStatus && (
          <div>
            <p className="text-xs uppercase text-gray-400">SKU Readiness</p>
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${readinessBadgeTone[skuReadinessStatus]}`}>
              {skuReadinessStatus}
            </span>
          </div>
        )}
        <div>
          <p className="text-xs uppercase text-gray-400">Inferred Part Number</p>
          <p className="text-lg font-semibold text-gray-900">{document.inferred_part_number ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-gray-400">Drawing Number</p>
          <p className="text-lg font-semibold text-gray-900">{document.drawing_number ?? '—'}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-600 space-y-3">
        <div className="flex flex-wrap gap-2">
          {callouts.length === 0 && <span className="text-xs text-emerald-600">No outstanding issues detected.</span>}
          {callouts.map(item => (
            <span key={item} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-700">
              {item}
            </span>
          ))}
        </div>
        {document.classification_notes && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Latest notes</p>
            <p className="text-sm text-gray-700 whitespace-pre-line">{document.classification_notes}</p>
          </div>
        )}
      </div>

      <VaultCorrectionPanel
        documentId={document.id}
        classificationStatus={document.classification_status}
        inferredPartNumber={document.inferred_part_number}
        drawingNumber={document.drawing_number}
        skuPartNumber={document.sku_part_number}
      />

      {document.sku_part_number && (
        <Link
          href={`/sku/${encodeURIComponent(document.sku_part_number)}`}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          Go to SKU dashboard →
        </Link>
      )}
    </div>
  );
}
