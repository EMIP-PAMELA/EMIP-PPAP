import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/src/lib/supabaseServer';
import { loadExtractedText, type DocumentClassificationStatus } from '@/src/features/harness-work-instructions/services/skuService';

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 25;

function normalizeDocumentType(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  if (normalized === 'BOM') return 'BOM';
  if (normalized === 'CUSTOMER_DRAWING' || normalized === 'CUSTOMER') return 'CUSTOMER_DRAWING';
  if (normalized === 'INTERNAL_DRAWING' || normalized === 'INTERNAL') return 'INTERNAL_DRAWING';
  return null;
}

function parseStatus(value: string | null): 'CURRENT' | 'OBSOLETE' | 'UNKNOWN' | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  if (normalized === 'CURRENT' || normalized === 'OBSOLETE' || normalized === 'UNKNOWN') {
    return normalized as 'CURRENT' | 'OBSOLETE' | 'UNKNOWN';
  }
  return null;
}

function parseClassificationStatus(value: string | null): DocumentClassificationStatus | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  const allowed: DocumentClassificationStatus[] = ['PENDING', 'PROCESSING', 'RESOLVED', 'PARTIAL', 'NEEDS_REVIEW'];
  return allowed.includes(normalized as DocumentClassificationStatus)
    ? (normalized as DocumentClassificationStatus)
    : null;
}

export async function GET(request: NextRequest) {
  const supabase = getSupabaseServer();
  const { searchParams } = new URL(request.url);

  const rawLimit = Number(searchParams.get('limit'));
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), MAX_LIMIT) : DEFAULT_LIMIT;
  const rawOffset = Number(searchParams.get('offset'));
  const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? rawOffset : 0;

  const skuFilterRaw = searchParams.get('sku');
  const skuFilter = skuFilterRaw ? skuFilterRaw.trim().toUpperCase() : null;
  const documentTypeFilter = normalizeDocumentType(searchParams.get('document_type'));
  const statusFilter = parseStatus(searchParams.get('status'));
  const classificationStatusFilter = parseClassificationStatus(searchParams.get('classification_status'));
  const search = searchParams.get('search');
  const documentId = searchParams.get('id');
  const includeText = searchParams.get('include_text') === 'true';

  let skuIdFilter: string | null = null;
  if (skuFilter) {
    const { data: skuRow, error: skuError } = await supabase
      .from('sku')
      .select('id, part_number')
      .eq('part_number', skuFilter)
      .maybeSingle();

    if (skuError) {
      console.error('[VAULT DOCUMENTS] Failed to resolve SKU filter', skuError.message);
      return NextResponse.json({ documents: [], total: 0, error: skuError.message }, { status: 500 });
    }

    if (!skuRow) {
      return NextResponse.json({ documents: [], total: 0 });
    }

    skuIdFilter = skuRow.id;
  }

  let query = supabase
    .from('sku_documents')
    .select(
      `id,
       file_name,
       document_type,
       revision,
       sku_id,
       uploaded_at,
       is_current,
       phantom_rev_flag,
       phantom_rev_note,
       file_url,
       classification_status,
       classification_attempts,
       classification_confidence,
       classification_notes,
       last_classified_at,
       sku:sku_id (part_number),
       storage_path
      `,
      { count: 'exact' },
    )
    .order('uploaded_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (skuIdFilter) {
    query = query.eq('sku_id', skuIdFilter);
  }

  if (documentId) {
    query = query.eq('id', documentId);
  }

  if (documentTypeFilter) {
    query = query.eq('document_type', documentTypeFilter);
  }

  if (statusFilter) {
    if (statusFilter === 'CURRENT') {
      query = query.eq('is_current', true);
    } else if (statusFilter === 'OBSOLETE') {
      query = query.eq('is_current', false);
    } else {
      query = query.is('is_current', null);
    }
  }

  if (classificationStatusFilter) {
    query = query.eq('classification_status', classificationStatusFilter);
  }

  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    query = query.or(`file_name.ilike.${term},revision.ilike.${term}`);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('[VAULT DOCUMENTS] Query failed', error.message);
    return NextResponse.json({ documents: [], total: 0, error: error.message }, { status: 500 });
  }

  const baseRecords = (data ?? []).map(doc => {
    const skuRel = Array.isArray(doc.sku)
      ? doc.sku[0]
      : (doc.sku as { part_number?: string } | null);
    return {
      id: doc.id,
      filename: doc.file_name,
      document_type: doc.document_type,
      sku: skuRel?.part_number ?? null,
      revision: doc.revision,
      status: doc.is_current ? 'CURRENT' : 'OBSOLETE',
      created_at: doc.uploaded_at,
      pipeline_status: doc.phantom_rev_flag ? 'PARTIAL' : 'UNKNOWN',
      message: doc.phantom_rev_note ?? null,
      file_url: doc.file_url ?? null,
      classification_status: doc.classification_status as DocumentClassificationStatus,
      classification_attempts: doc.classification_attempts ?? 0,
      classification_confidence: doc.classification_confidence ?? null,
      classification_notes: doc.classification_notes ?? null,
      last_classified_at: doc.last_classified_at ?? null,
      storage_path: doc.storage_path as string | null,
      extracted_text: null as string | null,
    };
  });

  if (includeText) {
    for (const record of baseRecords) {
      if (documentId && record.id !== documentId) continue;
      if (!record.storage_path) continue;
      try {
        record.extracted_text = await loadExtractedText(record.storage_path);
      } catch (err) {
        console.warn('[VAULT DOCUMENTS] Failed to load extracted text', { document_id: record.id, error: err });
      }
    }
  }

  const documents = baseRecords.map(({ storage_path, ...rest }) => rest);

  return NextResponse.json({ documents, total: count ?? documents.length });
}
