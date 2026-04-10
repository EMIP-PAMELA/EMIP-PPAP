import { NextResponse } from 'next/server';
import { listSKUs } from '@/src/features/harness-work-instructions/services/skuService';

export async function GET() {
  try {
    const skus = await listSKUs();
    return NextResponse.json({ ok: true, skus });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load SKUs';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
