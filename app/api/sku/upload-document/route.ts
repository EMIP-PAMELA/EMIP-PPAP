import { NextRequest, NextResponse } from 'next/server';
import { uploadDocument } from '@/src/features/harness-work-instructions/services/skuService';

export async function POST(request: NextRequest) {
  const formData = await request.formData();

  const skuId = formData.get('sku_id');
  const documentType = formData.get('document_type');
  const revision = formData.get('revision') ?? 'UNSPECIFIED';
  const extractedTextField = formData.get('extracted_text');
  const file = formData.get('file');

  if (!skuId || typeof skuId !== 'string') {
    return NextResponse.json({ ok: false, error: 'sku_id is required' }, { status: 400 });
  }

  if (!documentType || typeof documentType !== 'string') {
    return NextResponse.json({ ok: false, error: 'document_type is required' }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: 'file is required' }, { status: 400 });
  }

  try {
    const extractedText = typeof extractedTextField === 'string' ? extractedTextField : undefined;
    const result = await uploadDocument(
      skuId,
      file,
      documentType,
      typeof revision === 'string' ? revision : 'UNSPECIFIED',
      extractedText,
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to upload document';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
