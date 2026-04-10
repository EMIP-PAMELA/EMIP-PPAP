/**
 * Phase 3H.25 — AI Classification Review Dashboard
 *
 * Returns unique UNKNOWN components from active BOM records
 * that have not yet been classified in component_classification_map.
 */

import { NextResponse } from 'next/server';
import { supabase } from '@/src/lib/supabaseClient';

function normalizePart(p: string | null | undefined): string | null {
  if (!p) return null;
  const n = p.trim().toUpperCase();
  return n.length ? n : null;
}

export async function GET() {
  // Step 1: Fetch unique UNKNOWN components from active BOM records
  const { data: bomData, error: bomError } = await supabase
    .from('bom_records')
    .select('component_part_number, description')
    .eq('category', 'UNKNOWN')
    .eq('is_active', true);

  if (bomError) {
    console.error('[/api/ai/unknowns] BOM query failed', bomError);
    return NextResponse.json({ error: bomError.message }, { status: 500 });
  }

  // Deduplicate: first description seen wins per part number
  const uniqueMap = new Map<string, string | null>();
  for (const record of bomData ?? []) {
    const pn = normalizePart(record.component_part_number);
    if (!pn) continue;
    if (!uniqueMap.has(pn)) {
      uniqueMap.set(pn, (record.description as string | null) ?? null);
    }
  }

  // Step 2: Load already-classified part numbers from component_classification_map
  const { data: mapData, error: mapError } = await supabase
    .from('component_classification_map')
    .select('part_number');

  if (mapError) {
    console.warn('[/api/ai/unknowns] Could not load classification map — returning all unknowns', mapError);
  }

  const alreadyClassified = new Set<string>();
  for (const row of mapData ?? []) {
    const pn = normalizePart(row.part_number as string | null);
    if (pn) alreadyClassified.add(pn);
  }

  // Step 3: Filter out already-classified parts and sort
  const result = Array.from(uniqueMap.entries())
    .filter(([pn]) => !alreadyClassified.has(pn))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([partNumber, description]) => ({ partNumber, description }));

  return NextResponse.json({ data: result, total: result.length });
}
