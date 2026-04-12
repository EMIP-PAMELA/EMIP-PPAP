import { getSupabaseServer } from '@/src/lib/supabaseServer';
import { normalizePartNumber } from '@/src/core/utils/normalizePartNumber';

const drawingCache = new Map<string, string | null>();
const partDrawingCache = new Map<string, string | null>();

function normalizeDrawingNumber(input: string): string {
  const trimmed = input.trim().toUpperCase();
  if (/^\d{3}-\d{4}-\d{3}$/.test(trimmed)) {
    return trimmed;
  }

  const digits = trimmed.replace(/[^0-9]/g, '');
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  return trimmed;
}

export async function resolveDrawingForPart(partNumber: string): Promise<string | null> {
  const normalized = normalizePartNumber(partNumber) ?? partNumber.trim().toUpperCase();
  if (partDrawingCache.has(normalized)) {
    return partDrawingCache.get(normalized) ?? null;
  }

  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('drawing_lookup')
    .select('drawing_number')
    .eq('part_number', normalized)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('[HWI DRAWING LOOKUP PART ERROR]', { part_number: normalized, error: error.message });
    partDrawingCache.set(normalized, null);
    return null;
  }

  if (data?.drawing_number) {
    console.log('[HWI DRAWING LOOKUP PART HIT]', { part_number: normalized, drawing_number: data.drawing_number });
    partDrawingCache.set(normalized, data.drawing_number);
    return data.drawing_number;
  }

  partDrawingCache.set(normalized, null);
  return null;
}

export async function resolvePartNumberFromDrawing(drawingNumber: string): Promise<string | null> {
  const normalized = normalizeDrawingNumber(drawingNumber);
  if (drawingCache.has(normalized)) {
    return drawingCache.get(normalized) ?? null;
  }

  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('drawing_lookup')
    .select('part_number')
    .eq('drawing_number', normalized)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('[HWI DRAWING LOOKUP ERROR]', { drawing_number: normalized, error: error.message });
    drawingCache.set(normalized, null);
    return null;
  }

  if (data?.part_number) {
    console.log('[HWI DRAWING LOOKUP HIT]', { drawing_number: normalized, part_number: data.part_number });
    drawingCache.set(normalized, data.part_number);
    return data.part_number;
  }

  console.log('[HWI DRAWING LOOKUP MISS]', normalized);
  drawingCache.set(normalized, null);
  return null;
}
