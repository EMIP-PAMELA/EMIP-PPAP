import { NextRequest, NextResponse } from 'next/server';
import { getSKU } from '@/src/features/harness-work-instructions/services/skuService';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const partNumber = searchParams.get('partNumber');

  if (!partNumber) {
    return NextResponse.json({ ok: false, error: 'partNumber query param is required' }, { status: 400 });
  }

  try {
    const record = await getSKU(partNumber);
    if (!record) {
      return NextResponse.json({ ok: false, error: 'SKU not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, ...record });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load SKU';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
