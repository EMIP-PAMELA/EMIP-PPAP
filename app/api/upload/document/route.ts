/**
 * LEGACY ROUTE — Phase 3H.31 Deprecation Notice
 *
 * This route (POST /api/upload/document) performs auto-classification and auto-commit
 * in a single step WITHOUT a verification gate. It is DEPRECATED as the primary admin
 * upload path following Phase 3H.31 (Verified Ingestion Pivot).
 *
 * Replacement paths:
 *   POST /api/upload/analyze  — Phase A: extract signals, build evidence, surface questions
 *   POST /api/upload/commit   — Phase B: commit only after operator confirms verified values
 *
 * This route is retained temporarily for:
 *   - backward-compat callers that already pass reliable confirmed values
 *   - internal regression testing
 *   - BOM/drawing upload routes that may still call ingestAndProcessDocument directly
 *
 * GOVERNANCE: Do not add new callers to this route. Route new UI code through
 * /api/upload/analyze → review → /api/upload/commit.
 *
 * TODO Phase 3H.32+: Remove this route once all callers are migrated.
 */
import { NextRequest, NextResponse } from 'next/server';
import { ingestAndProcessDocument } from '@/src/features/harness-work-instructions/services/unifiedIngestionService';
import type { DocumentType } from '@/src/features/harness-work-instructions/services/skuService';
import type { RevisionState } from '@/src/utils/revisionEvaluator';
import { detectDocumentType, materializeDocumentType, type VaultDocumentClassification } from '@/src/features/vault/utils/documentSignals';
import { classifyDocument } from '@/src/services/classificationService';

function computeDocumentStatus(
  classification: VaultDocumentClassification,
  uploadResultStatus: string,
  revisionState: RevisionState | undefined,
): RevisionState {
  if (classification.detected === 'UNKNOWN') return 'UNKNOWN';
  if (uploadResultStatus === 'duplicate') return 'SUPERSEDED';
  return revisionState ?? 'UNKNOWN';
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file');
  const extractedTextField = formData.get('extracted_text');
  const partNumberOverride = formData.get('part_number_override');
  const skuHint = formData.get('sku_part_number');
  const validationContextField = formData.get('validation_context');

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: 'file is required' }, { status: 400 });
  }

  const extractedText = typeof extractedTextField === 'string' ? extractedTextField : undefined;
  const normalizedText = extractedText && extractedText.trim().length > 0 ? extractedText : undefined;

  const classification = normalizedText
    ? detectDocumentType(normalizedText, file.name)
    : { detected: 'UNKNOWN', signals: ['NO_TEXT_AVAILABLE'] } satisfies VaultDocumentClassification;
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
      extractedText: normalizedText,
      partNumberOverride:
        typeof partNumberOverride === 'string' && partNumberOverride.trim().length > 0
          ? partNumberOverride
          : typeof skuHint === 'string' && skuHint.trim().length > 0
            ? skuHint
            : undefined,
      validationContext:
        typeof validationContextField === 'string'
          ? JSON.parse(validationContextField)
          : undefined,
    });

    classifyDocument(ingestionResult.uploadResult.document.id).catch(err => {
      console.error('[CLASSIFICATION] async trigger failed', err);
    });

    const documentStatus = computeDocumentStatus(
      classification,
      ingestionResult.uploadResult.status,
      ingestionResult.uploadResult.document.revision_state,
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
    const message = err instanceof Error ? err.message : 'Unified ingest failed';
    console.error('[HWI VAULT UPLOAD ERROR]', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
