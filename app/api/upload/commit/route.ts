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
import {
  docTypeRequiresField,
  type IngestionAnalysisResult,
  type FieldToResolve,
} from '@/src/features/vault/types/ingestionReview';

const VALID_CONFIRMATION_MODES = ['AUTO_VERIFIED', 'USER_CONFIRMED', 'ADMIN_CONFIRMED'] as const;
type ConfirmationMode = (typeof VALID_CONFIRMATION_MODES)[number];

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file');
  const extractedTextField      = formData.get('extracted_text');
  const confirmedDocTypeRaw     = formData.get('confirmed_document_type');
  const confirmedPartNumber     = formData.get('confirmed_part_number');
  const confirmedRevision       = formData.get('confirmed_revision');
  const confirmedDrawingNumber  = formData.get('confirmed_drawing_number');
  const confirmationModeRaw     = formData.get('confirmation_mode');
  const validationContextField  = formData.get('validation_context');
  const confirmedByField        = formData.get('confirmed_by');
  const analysisSnapshotField   = formData.get('analysis_snapshot');

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: 'file is required' }, { status: 400 });
  }

  const trimValue = (value: FormDataEntryValue | null): string =>
    typeof value === 'string' ? value.trim() : '';

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

  const trimmedPartNumber = confirmedPartNumber.trim();
  const trimmedRevision = trimValue(confirmedRevision);
  const trimmedDrawingNumber = trimValue(confirmedDrawingNumber);

  if (docTypeRequiresField(documentType, 'revision') && !trimmedRevision) {
    return NextResponse.json(
      { ok: false, error: `Revision is required for ${documentType} documents.` },
      { status: 422 },
    );
  }

  const confirmationMode: ConfirmationMode = VALID_CONFIRMATION_MODES.includes(confirmationModeRaw as ConfirmationMode)
    ? (confirmationModeRaw as ConfirmationMode)
    : 'USER_CONFIRMED';

  const extractedText = typeof extractedTextField === 'string' && extractedTextField.trim().length > 0
    ? extractedTextField.trim()
    : undefined;

  let analysisSnapshot: IngestionAnalysisResult | null = null;
  if (typeof analysisSnapshotField === 'string' && analysisSnapshotField.trim().length > 0) {
    try {
      analysisSnapshot = JSON.parse(analysisSnapshotField) as IngestionAnalysisResult;
    } catch (err) {
      console.warn('[COMMIT] Failed to parse analysis_snapshot', err);
      return NextResponse.json(
        { ok: false, error: 'analysis_snapshot is malformed JSON' },
        { status: 422 },
      );
    }
  }

  if (!extractedText && !analysisSnapshot) {
    return NextResponse.json(
      { ok: false, error: 'Either extracted_text or analysis_snapshot must be provided for audit.' },
      { status: 422 },
    );
  }

  const validationContext: RevisionValidationAuditMetadata | undefined =
    typeof validationContextField === 'string'
      ? JSON.parse(validationContextField)
      : undefined;

  const confirmedBy = trimValue(confirmedByField)
    || (confirmationMode === 'ADMIN_CONFIRMED' ? 'ADMIN_BATCH_WORKBENCH' : 'OPERATIONAL_UPLOAD');
  const confirmedAt = new Date().toISOString();

  const confirmedFieldMap: Record<FieldToResolve, boolean> = {
    documentType: Boolean(documentType),
    partNumber: Boolean(trimmedPartNumber),
    revision: Boolean(trimmedRevision),
    drawingNumber: Boolean(trimmedDrawingNumber),
  };

  const operatorOverrideActive = confirmedFieldMap.partNumber || confirmedFieldMap.revision || confirmedFieldMap.drawingNumber;

  let confirmAnalysis: IngestionAnalysisResult | null = null;
  if (extractedText && !operatorOverrideActive) {
    try {
      const { analyzeFileIngestion } = await import('@/src/features/harness-work-instructions/services/analyzeIngestion');
      confirmAnalysis = await analyzeFileIngestion({
        fileName: file.name,
        fileSize: file.size,
        normalizedText: extractedText,
        forcedDocumentType: documentType,
        partNumberHint: trimmedPartNumber,
        revisionHint: trimmedRevision || null,
        drawingNumberHint: trimmedDrawingNumber || analysisSnapshot?.proposedDrawingNumber || null,
      });
    } catch (err) {
      console.error('[COMMIT] Unable to run verification analysis', err);
      return NextResponse.json(
        { ok: false, error: 'Internal analysis failed. Try again.' },
        { status: 500 },
      );
    }
  }

  if (docTypeRequiresField(documentType, 'drawingNumber')) {
    const drawingPresence = trimmedDrawingNumber
      || analysisSnapshot?.proposedDrawingNumber
      || confirmAnalysis?.proposedDrawingNumber;
    if (!drawingPresence) {
      return NextResponse.json(
        { ok: false, error: 'Drawing number is required for internal drawings. Provide or confirm it before committing.' },
        { status: 422 },
      );
    }
  }

  const blockingQuestions = [...(analysisSnapshot?.unresolvedQuestions ?? []), ...(confirmAnalysis?.unresolvedQuestions ?? [])]
    .filter(q => q.blocksCommit)
    .filter(q => {
      if (!q.fieldToResolve) return true;
      return !confirmedFieldMap[q.fieldToResolve as FieldToResolve];
    })
    .reduce<UnresolvedQuestionSummary[]>((acc, q) => {
      if (acc.some(existing => existing.id === q.id)) return acc;
      acc.push({ id: q.id, issueCode: q.issueCode, fieldToResolve: q.fieldToResolve, blocksCommit: q.blocksCommit });
      return acc;
    }, []);

  if (blockingQuestions.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Blocking questions remain unresolved. Resolve them in the workbench before committing.',
        blocking_questions: blockingQuestions,
      },
      { status: 422 },
    );
  }

  const snapshotToPersist: Partial<IngestionAnalysisResult> | null = analysisSnapshot ?? confirmAnalysis ?? null;

  try {
    const result = await ingestAndProcessDocument({
      file,
      documentType,
      extractedText,
      partNumberOverride: trimmedPartNumber,
      revisionOverride: trimmedRevision || undefined,
      drawingNumberOverride: trimmedDrawingNumber || undefined,
      validationContext,
      confirmationMode,
      confirmedBy,
      confirmedAt,
      analysisSnapshot: snapshotToPersist,
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

interface UnresolvedQuestionSummary {
  id: string;
  issueCode: string;
  fieldToResolve?: string;
  blocksCommit: boolean;
}
