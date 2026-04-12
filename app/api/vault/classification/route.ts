import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/src/lib/supabaseServer';

const PRIORITY: Record<string, number> = {
  NEEDS_REVIEW: 0,
  PENDING: 1,
  PROCESSING: 2,
  PARTIAL: 3,
  PARTIAL_MISMATCH: 3,
  RESOLVED: 4,
};

export async function GET() {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('sku_documents')
    .select(
      `id,
       file_name,
       document_type,
       classification_status,
       classification_attempts,
       classification_confidence,
       classification_notes,
       last_classified_at,
       sku:sku_id (part_number)
      `,
    )
    .neq('classification_status', 'RESOLVED');

  if (error) {
    console.error('[CLASSIFICATION QUEUE] Query failed', error.message);
    return NextResponse.json({ documents: [], error: error.message }, { status: 500 });
  }

  const documents = (data ?? [])
    .map(doc => {
      const skuRel = Array.isArray(doc.sku)
        ? doc.sku[0]
        : (doc.sku as { part_number?: string } | null);
      return {
        id: doc.id,
        filename: doc.file_name,
        document_type: doc.document_type,
        classification_status: doc.classification_status,
        classification_attempts: doc.classification_attempts,
        classification_confidence: doc.classification_confidence,
        classification_notes: doc.classification_notes,
        last_classified_at: doc.last_classified_at,
        sku: skuRel?.part_number ?? null,
      };
    })
    .sort((a, b) => {
      const left = PRIORITY[a.classification_status] ?? 5;
      const right = PRIORITY[b.classification_status] ?? 5;
      if (left !== right) return left - right;
      return (a.last_classified_at ?? '').localeCompare(b.last_classified_at ?? '');
    });

  return NextResponse.json({ documents });
}
