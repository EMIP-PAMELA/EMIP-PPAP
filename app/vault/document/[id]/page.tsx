import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSupabaseServer } from '@/src/lib/supabaseServer';

interface DocumentDetail {
  id: string;
  file_name: string;
  document_type: string;
  classification_status: string;
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
       inferred_part_number,
       drawing_number,
       sku:sku_id (part_number)
      `,
    )
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[VAULT DOCUMENT PAGE] failed to load document', error.message);
    return null;
  }

  if (!data) return null;

  const skuRel = Array.isArray(data.sku) ? data.sku[0] : (data.sku as { part_number?: string } | null);
  return {
    id: data.id,
    file_name: data.file_name,
    document_type: data.document_type,
    classification_status: data.classification_status ?? 'PENDING',
    inferred_part_number: data.inferred_part_number ?? null,
    drawing_number: data.drawing_number ?? null,
    sku_part_number: skuRel?.part_number ?? null,
  };
}

export default async function VaultDocumentDetailPage({ params }: { params: { id: string } }) {
  const document = await loadDocument(params.id);
  if (!document) {
    notFound();
  }

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
        </div>
        <div>
          <p className="text-xs uppercase text-gray-400">SKU</p>
          <p className="text-lg font-semibold text-gray-900">{document.sku_part_number ?? 'Unlinked'}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-gray-400">Inferred Part Number</p>
          <p className="text-lg font-semibold text-gray-900">{document.inferred_part_number ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-gray-400">Drawing Number</p>
          <p className="text-lg font-semibold text-gray-900">{document.drawing_number ?? '—'}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-600">
        <p className="font-semibold text-gray-800">Manual linking tools coming next phase</p>
        <p className="mt-2 text-gray-600">
          This placeholder keeps the navigation functional while we build the assisted linking workspace. Use the SKU
          dashboard for now to review canonical documents.
        </p>
      </div>

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
