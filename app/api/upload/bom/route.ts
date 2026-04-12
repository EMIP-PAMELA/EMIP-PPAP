import { NextRequest, NextResponse } from 'next/server';
import { ingestAndProcessDocument } from '@/src/features/harness-work-instructions/services/unifiedIngestionService';
import { classifyDocument } from '@/src/services/classificationService';

export async function POST(request: NextRequest) {
  // Governance: all BOM uploads must flow through Vault so bom_records stays derived-only.
  const formData = await request.formData();
  const file = formData.get('file');
  const manualPartNumber = formData.get('part_number');
  const manualRevision = formData.get('revision');
  const extractedTextField = formData.get('extracted_text');

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: 'file is required' }, { status: 400 });
  }

  const extractedText = typeof extractedTextField === 'string' ? extractedTextField : undefined;
  const normalizedText = extractedText && extractedText.trim().length > 0 ? extractedText : undefined;

  try {
    const result = await ingestAndProcessDocument({
      file,
      documentType: 'BOM',
      extractedText: normalizedText,
      partNumberOverride: typeof manualPartNumber === 'string' ? manualPartNumber : undefined,
      revisionOverride: typeof manualRevision === 'string' ? manualRevision : undefined,
    });

    classifyDocument(result.uploadResult.document.id).catch(err => {
      console.error('[CLASSIFICATION] async trigger failed', err);
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
    const message = err instanceof Error ? err.message : 'BOM ingest failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
