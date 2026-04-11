import { getSupabaseServer } from '@/src/lib/supabaseServer';

const DRAWING_ALIAS_TYPE = 'DRAWING_NUMBER';

type AliasSource = 'LOOKUP' | 'LEARNED';

interface AliasRecordInput {
  alias_type: typeof DRAWING_ALIAS_TYPE;
  alias_value: string;
  part_number: string;
  source: AliasSource;
  confidence: number;
}

export async function storeAliasMapping(drawingNumber: string, partNumber: string): Promise<void> {
  const supabase = getSupabaseServer();
  const payload: AliasRecordInput = {
    alias_type: DRAWING_ALIAS_TYPE,
    alias_value: drawingNumber.trim().toUpperCase(),
    part_number: partNumber.trim().toUpperCase(),
    source: 'LEARNED',
    confidence: 1,
  };

  const { error } = await supabase
    .from('sku_aliases')
    .upsert(payload, { onConflict: 'alias_type,alias_value', ignoreDuplicates: true });

  if (error) {
    console.warn('[HWI ALIAS STORE FAILED]', {
      drawing_number: payload.alias_value,
      part_number: payload.part_number,
      error: error.message,
    });
    return;
  }

  console.log('[HWI ALIAS STORED]', {
    drawing_number: payload.alias_value,
    part_number: payload.part_number,
  });
}

export async function resolveAliasFromDB(drawingNumber: string): Promise<string | null> {
  const supabase = getSupabaseServer();
  const normalized = drawingNumber.trim().toUpperCase();

  const { data, error } = await supabase
    .from('sku_aliases')
    .select('part_number')
    .eq('alias_value', normalized)
    .single();

  if (error) {
    console.warn('[HWI ALIAS DB ERROR]', { drawing_number: normalized, error: error.message });
    return null;
  }

  if (data?.part_number) {
    console.log('[HWI ALIAS DB HIT]', normalized);
    return data.part_number;
  }

  console.log('[HWI ALIAS DB MISS]', normalized);
  return null;
}
