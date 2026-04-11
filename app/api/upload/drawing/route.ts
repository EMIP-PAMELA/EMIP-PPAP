import { NextRequest, NextResponse } from 'next/server';
import { ingestDocumentFirstFlow, normalizeDocumentType, type DocumentMetadata, type DocumentType } from '@/src/features/harness-work-instructions/services/skuService';
import { ingestDrawingPdf } from '@/src/features/harness-work-instructions/services/drawingIngestionService';

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

  let partNumber: string | null =
    typeof manualPartNumber === 'string' && manualPartNumber.trim() ? manualPartNumber.trim().toUpperCase() : null;
  let revision: string | null =
    typeof manualRevision === 'string' && manualRevision.trim() ? manualRevision.trim() : null;
  let description: string | null = null;

  if (extractedText) {
    const draft = ingestDrawingPdf({ drawingText: extractedText, fileName: file.name });
    if (!partNumber && draft.drawing_number) {
      partNumber = draft.drawing_number.trim().toUpperCase();
    }
    if (!revision && draft.revision) {
      revision = draft.revision;
    }
    if (draft.title) {
      description = draft.title;
    }
  }

  if (!partNumber) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Could not derive part number from drawing. Please enter it manually.',
        needs_manual_part_number: true,
      },
      { status: 422 },
    );
  }

  const meta: DocumentMetadata = {
    part_number: partNumber,
    revision,
    description,
    sourceType: documentType,
  };

  try {
    const result = await ingestDocumentFirstFlow(meta, file, extractedText);
    return NextResponse.json({
      ok: true,
      sku: { id: result.sku.id, part_number: result.sku.part_number },
      sku_created: result.skuCreated,
      header_updated: result.headerUpdated,
      status: result.uploadResult.status,
      phantom_rev: result.uploadResult.phantom_rev,
      message: result.uploadResult.message,
      diff_summary: result.uploadResult.diff_summary ?? null,
      document: result.uploadResult.document,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Drawing ingest failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
