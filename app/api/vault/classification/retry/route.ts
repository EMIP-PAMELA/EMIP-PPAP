import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/src/lib/supabaseServer';
import { classifyDocument, MAX_ATTEMPTS } from '@/src/services/classificationService';

const BATCH_LIMIT = 20;

const RETRYABLE_STATUSES = ['PENDING', 'PARTIAL', 'PARTIAL_MISMATCH'];

export async function POST() {
  const supabase = getSupabaseServer();

  const { data, error } = await supabase
    .from('sku_documents')
    .select('id, classification_status, classification_attempts')
    .in('classification_status', RETRYABLE_STATUSES)
    .lt('classification_attempts', MAX_ATTEMPTS)
    .order('classification_attempts', { ascending: true })
    .limit(BATCH_LIMIT);

  if (error) {
    console.error('[CLASSIFICATION RETRY] Failed to query retryable documents', error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const candidates = data ?? [];

  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, triggered: 0, message: 'No retryable documents found.' });
  }

  let triggered = 0;
  const failures: { id: string; error: string }[] = [];

  for (const doc of candidates) {
    try {
      await classifyDocument(doc.id);
      triggered += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.warn('[CLASSIFICATION RETRY] classifyDocument failed', { id: doc.id, error: message });
      failures.push({ id: doc.id, error: message });
    }
  }

  console.log('[CLASSIFICATION RETRY] Batch complete', { triggered, failures: failures.length });

  return NextResponse.json({
    ok: true,
    triggered,
    failures,
    message: `Triggered ${triggered} classification(s). ${failures.length} failure(s).`,
  });
}
