import { NextRequest, NextResponse } from 'next/server';
import { getSKU, getCurrentDocuments } from '@/src/features/harness-work-instructions/services/skuService';
import { runPipelineForSKU } from '@/src/features/harness-work-instructions/services/unifiedIngestionService';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const partNumber = searchParams.get('part_number');

  if (!partNumber) {
    return NextResponse.json({ ok: false, error: 'part_number is required' }, { status: 400 });
  }

  const result = await getSKU(partNumber);
  if (!result) {
    return NextResponse.json({ ok: false, error: 'SKU not found' }, { status: 404 });
  }

  const { documents, revision_validation, readiness } = await getCurrentDocuments(result.sku.id);
  const pipeline = await runPipelineForSKU(result.sku, documents);

  return NextResponse.json({
    ok: true,
    sku: result.sku,
    documents,
    revision_validation,
    readiness,
    pipeline_status:  pipeline.status,
    job:              pipeline.job,
    process_bundle:   pipeline.processBundle,
    coverage:         pipeline.coverage         ?? null,
    interpretation:   pipeline.interpretation   ?? null,
  });
}
