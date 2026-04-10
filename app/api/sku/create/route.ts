import { NextRequest, NextResponse } from 'next/server';
import { createSKU } from '@/src/features/harness-work-instructions/services/skuService';

export async function POST(request: NextRequest) {
  let body: { part_number?: string; description?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const partNumber = body.part_number?.trim();
  const description = body.description?.trim();

  if (!partNumber) {
    return NextResponse.json({ ok: false, error: 'part_number is required' }, { status: 400 });
  }

  try {
    const sku = await createSKU(partNumber, description);
    return NextResponse.json({ ok: true, sku });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create SKU';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
