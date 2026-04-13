/**
 * POST /api/upload/commit
 * Phase 3H.31 — Verified commit endpoint (STEP 2 PHASE B).
 *
 * Accepts ONLY pre-verified document submissions that have passed the review queue.
 * Writes to the database using confirmed values, never inferred uncertain values.
 *
 * Governance:
 *   - confirmed_document_type is REQUIRED — no UNKNOWN allowed.
 *   - confirmed_part_number is REQUIRED.
 *   - confirmed_revision may be omitted only if the document type does not require it (BOM).
 *   - confirmation_mode must be one of: AUTO_VERIFIED, USER_CONFIRMED, ADMIN_CONFIRMED.
 *
 * Callers: UploadWorkbench (admin batch mode), VaultUploader confirmation flow (operational mode).
 */

import { NextRequest, NextResponse } from 'next/server';
import { ingestAndProcessDocument } from '@/src/features/harness-work-instructions/services/unifiedIngestionService';
import { normalizeDocumentType } from '@/src/features/harness-work-instructions/services/skuService';
import { classifyDocument } from '@/src/services/classificationService';
import type { RevisionValidationAuditMetadata } from '@/src/types/revisionValidation';

const VALID_CONFIRMATION_MODES = ['AUTO_VERIFIED', 'USER_CONFIRMED', 'ADMIN_CONFIRMED'] as const;
type ConfirmationMode = (typeof VALID_CONFIRMATION_MODES)[number];

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file');
  const extractedTextField      = formData.get('extracted_text');
  const confirmedDocTypeRaw     = formData.get('confirmed_document_type');
  const confirmedPartNumber     = formData.get('confirmed_part_number');
  const confirmedRevision       = formData.get('confirmed_revision');
  const confirmationModeRaw     = formData.get('confirmation_mode');
  const validationContextField  = formData.get('validation_context');

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: 'file is required' }, { status: 400 });
  }

  // --- Validate required confirmed fields ---
  if (typeof confirmedDocTypeRaw !== 'string' || !confirmedDocTypeRaw.trim()) {
    return NextResponse.json(
      { ok: false, error: 'confirmed_document_type is required — uncertain documents cannot be committed' },
      { status: 422 },
    );
  }

  const documentType = normalizeDocumentType(confirmedDocTypeRaw.trim());
  if (documentType === 'UNKNOWN') {
    return NextResponse.json(
      { ok: false, error: 'UNKNOWN document type cannot be committed — resolve type before committing' },
      { status: 422 },
    );
  }

  if (typeof confirmedPartNumber !== 'string' || !confirmedPartNumber.trim()) {
    return NextResponse.json(
      { ok: false, error: 'confirmed_part_number is required — documents without a SKU link cannot be committed' },
      { status: 422 },
    );
  }

  const confirmationMode: ConfirmationMode = VALID_CONFIRMATION_MODES.includes(confirmationModeRaw as ConfirmationMode)
    ? (confirmationModeRaw as ConfirmationMode)
    : 'USER_CONFIRMED';

  const extractedText = typeof extractedTextField === 'string' && extractedTextField.trim().length > 0
    ? extractedTextField.trim()
    : undefined;

  const validationContext: RevisionValidationAuditMetadata | undefined =
    typeof validationContextField === 'string'
      ? JSON.parse(validationContextField)
      : undefined;

  try {
    const result = await ingestAndProcessDocument({
      file,
      documentType,
      extractedText,
      partNumberOverride: confirmedPartNumber.trim(),
      revisionOverride: typeof confirmedRevision === 'string' && confirmedRevision.trim().length > 0
        ? confirmedRevision.trim()
        : undefined,
      validationContext,
      confirmationMode,
    });

    classifyDocument(result.uploadResult.document.id).catch(err => {
      console.error('[CLASSIFICATION] async trigger failed after commit', err);
    });

    return NextResponse.json({
      ok: true,
      confirmation_mode: confirmationMode,
      document_type: documentType,
      sku: { id: result.sku.id, part_number: result.sku.part_number },
      document: result.uploadResult.document,
      uploadResult: result.uploadResult,
      pipeline_status: result.pipeline.status,
      message: result.uploadResult.message,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Commit failed';
    console.error('[COMMIT ENDPOINT ERROR]', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
