import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/src/lib/supabaseServer';

type ResetTarget = {
  name: string;
  idColumn?: string;
  optional?: boolean;
};

const RESET_ORDER: ResetTarget[] = [
  { name: 'ingestion_items', optional: true },
  { name: 'ingestion_runs', optional: true },
  { name: 'document_links', optional: true },
  { name: 'sku_documents' },
  { name: 'documents', optional: true },
  { name: 'sku' },
  { name: 'revision_logs', optional: true },
];

function isMissingRelation(errorMessage: string | null | undefined) {
  return Boolean(errorMessage && errorMessage.toLowerCase().includes('relation') && errorMessage.toLowerCase().includes('does not exist'));
}

export async function POST() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { success: false, error: 'Reset endpoint is only available in development.' },
      { status: 403 },
    );
  }

  const supabase = getSupabaseServer();
  const tablesCleared: string[] = [];
  const skipped: { table: string; reason: string }[] = [];

  for (const target of RESET_ORDER) {
    const column = target.idColumn ?? 'id';
    const { error } = await supabase.from(target.name).delete().not(column, 'is', null);

    if (error) {
      const reason = error.message ?? 'Unknown Supabase error';
      if (target.optional && isMissingRelation(reason)) {
        skipped.push({ table: target.name, reason });
        continue;
      }

      return NextResponse.json(
        {
          success: false,
          error: `Failed to clear ${target.name}: ${reason}`,
          tablesCleared,
          skipped,
        },
        { status: 500 },
      );
    }

    tablesCleared.push(target.name);
  }

  return NextResponse.json({ success: true, tablesCleared, skipped });
}
