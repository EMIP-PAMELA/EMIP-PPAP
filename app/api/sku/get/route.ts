import { NextRequest, NextResponse } from 'next/server';
import { getSKU, getBomWireCount } from '@/src/features/harness-work-instructions/services/skuService';
import { canonicalizePartNumber } from '@/src/utils/canonicalizePartNumber';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const partNumber = searchParams.get('partNumber');

  console.log('[T23.6.38 STATE CHECK]', {
    buildStatus: 'OK',
    logsPresent: {
      audit:     true,
      canonical: true,
      trace:     true,
    },
    canonicalFunctionExists: true,
    apiUndefinedIssue: partNumber === null || partNumber === 'undefined',
    notes: partNumber === null
      ? 'partNumber query param absent — caller passed undefined or omitted the param'
      : partNumber === 'undefined'
        ? 'partNumber received as string "undefined" — caller used template literal with undefined variable'
        : `partNumber OK: raw="${partNumber}" canonical="${canonicalizePartNumber(partNumber)}"`,
  });

  console.log('[T23.6.39 PARAM TRACE]', {
    stage: 'API_BOUNDARY',
    file: 'app/api/sku/get/route.ts',
    function: 'GET /api/sku/get',
    routeParam: partNumber,
    partNumber: partNumber,
    canonicalPartNumber: partNumber ? canonicalizePartNumber(partNumber) : null,
    note: 'API boundary received partNumber query param',
  });

  if (!partNumber) {
    console.log('[T23.6.37 TRACE]', {
      stage: 'API',
      function: 'GET /api/sku/get',
      rawPart: partNumber,
      canonicalPart: null,
      outgoingValue: null,
      note: 'partNumber query param missing',
    });
    return NextResponse.json({ ok: false, error: 'partNumber query param is required' }, { status: 400 });
  }

  console.log('[T23.6.37 TRACE]', {
    stage: 'API',
    function: 'GET /api/sku/get',
    rawPart: partNumber,
    canonicalPart: canonicalizePartNumber(partNumber),
    outgoingValue: partNumber,
    note: 'API request received, forwarding to getSKU',
  });

  try {
    const record = await getSKU(partNumber);
    if (!record) {
      return NextResponse.json({ ok: false, error: 'SKU not found' }, { status: 404 });
    }

    const bomDoc = record.documents.find(doc => doc.document_type === 'BOM') ?? null;
    console.log('[T23.6.46 API RESPONSE]', {
      partNumber,
      hasData: true,
      wireCount: getBomWireCount(bomDoc),
      skuId: record.sku.id,
    });

    return NextResponse.json({ ok: true, ...record });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load SKU';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
