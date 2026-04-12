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
  const allowed: DocumentClassificationStatus[] = [
    'PENDING',
    'PROCESSING',
    'RESOLVED',
    'PARTIAL',
    'PARTIAL_MISMATCH',
    'NEEDS_REVIEW',
  ];
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
  const includeLinks = searchParams.get('include_links') === 'true';

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
       inferred_part_number,
       drawing_number,
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
    if (error.message?.toLowerCase().includes('column')) {
      console.error('[VAULT DOCUMENTS] Schema drift detected — column missing in sku_documents', {
        supabaseError: error.message,
      });
    } else {
      console.error('[VAULT DOCUMENTS] Query failed', error.message);
    }
    return NextResponse.json(
      {
        documents: [],
        total: 0,
        error: 'Unable to load vault documents (schema verification required).',
      },
      { status: 500 },
    );
  }

  let baseRecords = (data ?? []).map(doc => {
    const skuRel = Array.isArray(doc.sku)
      ? doc.sku[0]
      : (doc.sku as { part_number?: string } | null);
    return {
      id: doc.id,
      sku_id: doc.sku_id,
      filename: doc.file_name,
      document_type: doc.document_type,
      sku: skuRel?.part_number ?? null,
      revision: doc.revision,
      status: doc.is_current ? 'CURRENT' : 'OBSOLETE',
      uploaded_at: doc.uploaded_at,
      pipeline_status: doc.phantom_rev_flag ? 'PARTIAL' : 'UNKNOWN',
      message: doc.phantom_rev_note ?? null,
      file_url: doc.file_url ?? null,
      classification_status: doc.classification_status as DocumentClassificationStatus,
      classification_attempts: doc.classification_attempts ?? 0,
      classification_confidence: doc.classification_confidence ?? null,
      classification_notes: doc.classification_notes ?? null,
      last_classified_at: doc.last_classified_at ?? null,
      inferred_part_number: doc.inferred_part_number ?? null,
      drawing_number: doc.drawing_number ?? null,
      linked_documents_count: 0,
      highest_confidence_link: null as { link_type: string; confidence_score: number } | null,
      conflict_flag: false,
      storage_path: doc.storage_path as string | null,
      extracted_text: null as string | null,
      linked_documents: undefined as
        | {
            document_id: string;
            filename: string;
            document_type: string;
            sku: string | null;
            link_type: string;
            confidence_score: number;
            signals_used?: string[];
          }[]
        | undefined,
    };
  });

  const missingSkuIds = baseRecords
    .filter(record => record.sku_id && !record.sku)
    .map(record => record.sku_id!)
    .filter((skuId, index, self) => self.indexOf(skuId) === index);

  if (missingSkuIds.length > 0) {
    const { data: skuRows, error: skuLookupError } = await supabase
      .from('sku')
      .select('id, part_number')
      .in('id', missingSkuIds);

    if (skuLookupError) {
      console.error('[VAULT DOCUMENTS] Failed to backfill SKU part numbers', skuLookupError.message);
    } else {
      const skuMap = new Map<string, string | null>();
      for (const row of skuRows ?? []) {
        skuMap.set(row.id, row.part_number ?? null);
      }
      baseRecords = baseRecords.map(record => {
        if (record.sku_id && !record.sku && skuMap.has(record.sku_id)) {
          return { ...record, sku: skuMap.get(record.sku_id) ?? null };
        }
        return record;
      });
    }
  }

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

  const linkStats = new Map<
    string,
    {
      count: number;
      conflict: boolean;
      highest: { link_type: string; confidence_score: number } | null;
      entries?: { otherId: string; link_type: string; confidence_score: number; signals_used?: string[] }[];
    }
  >();
  const docIds = baseRecords.map(record => record.id);
  let linkedDocMeta = new Map<
    string,
    { id: string; file_name: string; document_type: string; sku_part_number: string | null }
  >();

  if (docIds.length > 0) {
    const [{ data: linkRowsA, error: errA }, { data: linkRowsB, error: errB }] = await Promise.all([
      supabase
        .from('document_links')
        .select('document_id_a, document_id_b, link_type, confidence_score, signals_used')
        .in('document_id_a', docIds),
      supabase
        .from('document_links')
        .select('document_id_a, document_id_b, link_type, confidence_score, signals_used')
        .in('document_id_b', docIds),
    ]);

    if (!errA && !errB) {
      const combinedRows: LinkRow[] = [...(linkRowsA ?? []), ...(linkRowsB ?? [])];
      const uniqueRows: typeof combinedRows = [];
      const seen = new Set<string>();
      for (const row of combinedRows) {
        const key = `${row.document_id_a}-${row.document_id_b}`;
        if (seen.has(key)) continue;
        seen.add(key);
        uniqueRows.push(row);
      }

      const detailIds = new Set<string>();

      type LinkRow = {
        document_id_a: string;
        document_id_b: string;
        link_type: string;
        confidence_score: number;
        signals_used?: string[];
      };

      function register(docId: string, otherId: string, row: LinkRow) {
        if (!linkStats.has(docId)) {
          linkStats.set(docId, {
            count: 0,
            conflict: false,
            highest: null,
            entries: includeLinks ? [] : undefined,
          });
        }
        const stat = linkStats.get(docId)!;
        stat.count += 1;
        if (row.link_type === 'CONFLICT') {
          stat.conflict = true;
        }
        if (!stat.highest || row.confidence_score > stat.highest.confidence_score) {
          stat.highest = {
            link_type: row.link_type,
            confidence_score: row.confidence_score,
          };
        }
        if (includeLinks && stat.entries) {
          stat.entries.push({
            otherId,
            link_type: row.link_type,
            confidence_score: row.confidence_score,
            signals_used: row.signals_used ?? [],
          });
          detailIds.add(otherId);
        }
      }

      for (const row of uniqueRows) {
        register(row.document_id_a, row.document_id_b, row);
        register(row.document_id_b, row.document_id_a, row);
      }

      if (includeLinks && detailIds.size > 0) {
        const detailList = Array.from(detailIds);
        const { data: linkedDocs } = await supabase
          .from('sku_documents')
          .select('id, file_name, document_type, sku:sku_id(part_number)')
          .in('id', detailList);

        if (linkedDocs) {
          linkedDocMeta = new Map(
            linkedDocs.map(item => {
              const skuRel = Array.isArray(item.sku)
                ? (item.sku[0] as { part_number?: string } | undefined)
                : ((item.sku as { part_number?: string } | null) ?? null);
              return [
                item.id,
                {
                  id: item.id,
                  file_name: item.file_name,
                  document_type: item.document_type,
                  sku_part_number: skuRel?.part_number ?? null,
                },
              ] as [
                string,
                { id: string; file_name: string; document_type: string; sku_part_number: string | null },
              ];
            }),
          );
        }
      }
    }
  }

  const documents = baseRecords.map(record => {
    const stat = linkStats.get(record.id);
    const { storage_path, linked_documents: _linked, ...rest } = record;
    const response: any = {
      ...rest,
      linked_documents_count: stat?.count ?? 0,
      highest_confidence_link: stat?.highest ?? null,
      conflict_flag: stat?.conflict ?? false,
    };

    if (includeLinks && stat?.entries && stat.entries.length > 0) {
      response.linked_documents = stat.entries.map(entry => {
        const meta = linkedDocMeta.get(entry.otherId);
        return {
          document_id: entry.otherId,
          filename: meta?.file_name ?? 'Unknown document',
          document_type: meta?.document_type ?? 'UNKNOWN',
          sku: meta?.sku_part_number ?? null,
          link_type: entry.link_type,
          confidence_score: entry.confidence_score,
          signals_used: entry.signals_used ?? [],
        };
      });
    }

    return response;
  });

  return NextResponse.json({ documents, total: count ?? documents.length });
}
