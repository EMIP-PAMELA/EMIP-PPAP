import { NextRequest, NextResponse } from 'next/server';
import { ingestAndProcessDocument, UnifiedIngestionError } from '@/src/features/harness-work-instructions/services/unifiedIngestionService';
import type { DocumentType } from '@/src/features/harness-work-instructions/services/skuService';

function normalizeTextPreview(text: string, limit = 2000): string {
  return text.slice(0, limit).toUpperCase();
}

type Classification = {
  detected: DocumentType | 'UNKNOWN';
  signals: string[];
};

function detectDocumentType(extractedText: string, fileName: string): Classification {
  const text = normalizeTextPreview(extractedText);
  const signals: string[] = [];

  const bomIndicators = [/BILL OF MATERIAL/i, /BOM/i, /ITEM\s+NO\.?/i, /QTY/i, /COMPONENT\s+PART/i];
  const hasBOMSignal = bomIndicators.some(pattern => {
    const match = pattern.test(text);
    if (match) signals.push(`BOM:${pattern}`);
    return match;
  });
  if (hasBOMSignal || /BOM/i.test(fileName)) {
    return { detected: 'BOM', signals };
  }

  const internalIndicators = [/INTERNAL DRAWING/i, /DWG NO\.?/i, /DRAWING NUMBER/i, /MANUFACTURING DRAWING/i, /ENGINEERING DRAWING/i];
  const customerIndicators = [/CUSTOMER DRAWING/i, /CUSTOMER PART/i, /SUPPLIER DRAWING/i];

  const hasInternal = internalIndicators.some(pattern => {
    const match = pattern.test(text);
    if (match) signals.push(`INTERNAL:${pattern}`);
    return match;
  });
  const hasCustomer = customerIndicators.some(pattern => {
    const match = pattern.test(text);
    if (match) signals.push(`CUSTOMER:${pattern}`);
    return match;
  });

  if (hasInternal && !hasCustomer) {
    return { detected: 'INTERNAL_DRAWING', signals };
  }

  if (hasCustomer || /DRW/i.test(fileName) || /DWG/i.test(fileName)) {
    return { detected: 'CUSTOMER_DRAWING', signals };
  }

  signals.push('FALLBACK:CUSTOMER_DRAWING');
  return { detected: 'UNKNOWN', signals };
}

function materializeDocumentType(classification: DocumentType | 'UNKNOWN'): DocumentType {
  if (classification === 'BOM') return 'BOM';
  if (classification === 'INTERNAL_DRAWING') return 'INTERNAL_DRAWING';
  return 'CUSTOMER_DRAWING';
}

function computeDocumentStatus(
  classification: Classification,
  uploadResultStatus: string,
  documentIsCurrent: boolean,
): 'CURRENT' | 'OBSOLETE' | 'UNKNOWN' {
  if (classification.detected === 'UNKNOWN') return 'UNKNOWN';
  if (uploadResultStatus === 'duplicate' || !documentIsCurrent) return 'OBSOLETE';
  return 'CURRENT';
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file');
  const extractedTextField = formData.get('extracted_text');
  const partNumberOverride = formData.get('part_number_override');
  const skuHint = formData.get('sku_part_number');

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: 'file is required' }, { status: 400 });
  }

  const extractedText = typeof extractedTextField === 'string' ? extractedTextField : undefined;
  if (!extractedText || !extractedText.trim()) {
    return NextResponse.json({ ok: false, error: 'extracted_text is required' }, { status: 400 });
  }

  const classification = detectDocumentType(extractedText, file.name);
  const documentType = materializeDocumentType(classification.detected);

  console.log('[HWI DOC TYPE DETECTED]', {
    file_name: file.name,
    classification: classification.detected,
    document_type_used: documentType,
    signals: classification.signals,
  });

  try {
    const ingestionResult = await ingestAndProcessDocument({
      file,
      documentType,
      extractedText,
      partNumberOverride:
        typeof partNumberOverride === 'string' && partNumberOverride.trim().length > 0
          ? partNumberOverride
          : typeof skuHint === 'string' && skuHint.trim().length > 0
            ? skuHint
            : undefined,
    });

    const documentStatus = computeDocumentStatus(
      classification,
      ingestionResult.uploadResult.status,
      ingestionResult.uploadResult.document.is_current,
    );

    return NextResponse.json({
      ok: true,
      classification: classification.detected,
      document_type: documentType,
      document_status: documentStatus,
      sku: { id: ingestionResult.sku.id, part_number: ingestionResult.sku.part_number },
      document: ingestionResult.uploadResult.document,
      uploadResult: ingestionResult.uploadResult,
      pipeline_status: ingestionResult.pipeline.status,
      message: ingestionResult.uploadResult.message,
      signals: classification.signals,
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
    const message = err instanceof Error ? err.message : 'Unified ingest failed';
    console.error('[HWI VAULT UPLOAD ERROR]', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
