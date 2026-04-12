import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/src/lib/supabaseServer';
import { classifyDocument } from '@/src/services/classificationService';
import { linkDocument } from '@/src/services/linkingService';
import { storeAliasMapping } from '@/src/features/harness-work-instructions/services/aliasService';

interface CorrectionRequest {
  action: 'apply_part_number' | 'link_sku' | 'save_alias' | 'reprocess';
  partNumber?: string;
  drawingNumber?: string;
}

function normalizePartNumber(value?: string | null): string | null {
  if (!value) return null;
  const cleaned = value.trim().toUpperCase();
  return cleaned.length === 0 ? null : cleaned;
}

async function appendCorrectionNote(documentId: string, supabase: ReturnType<typeof getSupabaseServer>, message: string) {
  const { data } = await supabase
    .from('sku_documents')
    .select('classification_notes')
    .eq('id', documentId)
    .maybeSingle();

  const timestamp = new Date().toISOString();
  const entry = `[CORRECTION ${timestamp}] ${message}`;
  const updatedNotes = data?.classification_notes ? `${data.classification_notes}\n${entry}` : entry;

  await supabase
    .from('sku_documents')
    .update({ classification_notes: updatedNotes })
    .eq('id', documentId);
}

async function reprocessDocument(documentId: string) {
  await classifyDocument(documentId);
  await linkDocument(documentId);
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = getSupabaseServer();
  const documentId = params.id;

  let payload: CorrectionRequest;
  try {
    payload = (await request.json()) as CorrectionRequest;
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
  }

  if (!payload?.action) {
    return NextResponse.json({ error: 'Action is required' }, { status: 400 });
  }

  try {
    if (payload.action === 'apply_part_number') {
      const normalized = normalizePartNumber(payload.partNumber);
      if (!normalized) {
        return NextResponse.json({ error: 'Part number is required' }, { status: 400 });
      }

      const { error: updateError } = await supabase
        .from('sku_documents')
        .update({ inferred_part_number: normalized })
        .eq('id', documentId);

      if (updateError) {
        throw new Error(updateError.message);
      }

      await appendCorrectionNote(documentId, supabase, `Operator applied part number ${normalized}.`);
      await reprocessDocument(documentId);
      return NextResponse.json({ message: 'Part number applied and pipelines re-run.' });
    }

    if (payload.action === 'link_sku') {
      const normalized = normalizePartNumber(payload.partNumber);
      if (!normalized) {
        return NextResponse.json({ error: 'SKU part number is required' }, { status: 400 });
      }

      const { data: sku, error: skuError } = await supabase
        .from('sku')
        .select('id')
        .eq('part_number', normalized)
        .maybeSingle();

      if (skuError) {
        throw new Error(skuError.message);
      }
      if (!sku?.id) {
        return NextResponse.json({ error: 'SKU not found' }, { status: 404 });
      }

      const { error: linkError } = await supabase
        .from('sku_documents')
        .update({ sku_id: sku.id, inferred_part_number: normalized })
        .eq('id', documentId);

      if (linkError) {
        throw new Error(linkError.message);
      }

      await appendCorrectionNote(documentId, supabase, `Linked to SKU ${normalized}.`);
      await reprocessDocument(documentId);
      return NextResponse.json({ message: 'Document linked to SKU and pipelines re-run.' });
    }

    if (payload.action === 'save_alias') {
      const normalizedPart = normalizePartNumber(payload.partNumber);
      const normalizedDrawing = payload.drawingNumber?.trim().toUpperCase() ?? null;
      if (!normalizedDrawing) {
        return NextResponse.json({ error: 'Drawing number is required to save alias' }, { status: 400 });
      }
      if (!normalizedPart) {
        return NextResponse.json({ error: 'Part number is required to save alias' }, { status: 400 });
      }

      await storeAliasMapping(normalizedDrawing, normalizedPart);
      await appendCorrectionNote(documentId, supabase, `Alias confirmed ${normalizedDrawing} → ${normalizedPart}.`);
      await linkDocument(documentId);
      return NextResponse.json({ message: 'Alias saved and linking refreshed.' });
    }

    if (payload.action === 'reprocess') {
      await reprocessDocument(documentId);
      return NextResponse.json({ message: 'Classification and linking re-run successfully.' });
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (err) {
    console.error('[VAULT CORRECTION] action failed', {
      action: payload.action,
      documentId,
      error: err,
    });
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Correction failed' }, { status: 500 });
  }
}
