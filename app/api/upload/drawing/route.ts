import { NextRequest, NextResponse } from 'next/server';
import { ingestAndProcessDocument, UnifiedIngestionError } from '@/src/features/harness-work-instructions/services/unifiedIngestionService';
import { normalizeDocumentType, type DocumentType } from '@/src/features/harness-work-instructions/services/skuService';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file');
  const drawingTypeRaw = formData.get('drawing_type');
  const extractedTextField = formData.get('extracted_text');
  const manualPartNumber = formData.get('part_number');
  const manualRevision = formData.get('revision');

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: 'file is required' }, { status: 400 });
  }

  let documentType: DocumentType;
  try {
    documentType = normalizeDocumentType(
      typeof drawingTypeRaw === 'string' && drawingTypeRaw.trim() ? drawingTypeRaw.trim() : 'CUSTOMER_DRAWING',
    );
    if (documentType === 'BOM') {
      return NextResponse.json({ ok: false, error: 'Use /api/upload/bom for BOM documents' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid drawing_type' }, { status: 400 });
  }

  const extractedText = typeof extractedTextField === 'string' ? extractedTextField : undefined;
  if (!extractedText || !extractedText.trim()) {
    return NextResponse.json({ ok: false, error: 'extracted_text is required' }, { status: 400 });
  }

  try {
    const result = await ingestAndProcessDocument({
      file,
      documentType,
      extractedText,
      partNumberOverride: typeof manualPartNumber === 'string' ? manualPartNumber : undefined,
      revisionOverride: typeof manualRevision === 'string' ? manualRevision : undefined,
    });
    return NextResponse.json({
      ok: true,
      sku: { id: result.sku.id, part_number: result.sku.part_number },
      documents: result.documents,
      sku_created: result.skuCreated,
      header_updated: result.headerUpdated,
      status: result.uploadResult.status,
      phantom_rev: result.uploadResult.phantom_rev,
      message: result.uploadResult.message,
      diff_summary: result.uploadResult.diff_summary ?? null,
      document: result.uploadResult.document,
      pipeline_status: result.pipeline.status,
      job: result.pipeline.job,
      process_bundle: result.pipeline.processBundle,
    });
  } catch (err) {
    if (err instanceof UnifiedIngestionError) {
      if (err.code === 'MISSING_PART_NUMBER') {
        return NextResponse.json(
          { ok: false, error: err.message, needs_manual_part_number: true },
          { status: 422 },
        );
      }
      if (err.code === 'MISSING_TEXT') {
        return NextResponse.json({ ok: false, error: err.message }, { status: 400 });
      }
    }
    const message = err instanceof Error ? err.message : 'Drawing ingest failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
