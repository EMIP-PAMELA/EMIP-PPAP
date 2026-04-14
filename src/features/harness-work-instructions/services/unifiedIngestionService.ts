import {
  ingestDocumentFirstFlow,
  type DocumentType,
  type SKUDocumentRecord,
  type SKURecord,
  getCurrentDocuments,
  loadExtractedText,
} from './skuService';
import type { RevisionValidationAuditMetadata } from '@/src/types/revisionValidation';
import type { CrossSourceValidationResult } from '@/src/utils/revisionCrossValidator';
import type { SKUReadinessResult } from '@/src/utils/skuReadinessEvaluator';
import { resolvePartNumberFromDrawing } from './drawingLookupService';
import { storeAliasMapping, resolveAliasFromDB } from './aliasService';
import { parseBOMToHWI } from '@/src/core/services/bomHWIAdapter';
import { ingestBOMFromVaultProjection, type IngestionMetadata } from '@/src/core/data/bom/ingestion';
import { ingestDrawingPdf } from './drawingIngestionService';
import { fuseDrawingWithBOM } from './drawingFusionService';
import { resolveEndpoints } from './endpointResolutionService';
import { buildProcessInstructions } from './processInstructionService';
import { loadFusionHints, persistLearningUsageEvents } from './learningService';
import type { HarnessInstructionJob } from '../types/harnessInstruction.schema';
import type { CanonicalDrawingDraft } from '../types/drawingDraft';
import type { ProcessInstructionBundle } from '../types/processInstructions';
import type { UploadDocumentResult } from './skuService';
import type { RevisionSource } from '@/src/utils/revisionParser';
import { analyzeFileIngestion } from './analyzeIngestion';
import type { DocumentExtractionEvidence } from '../types/extractionEvidence';
import type { IngestionAnalysisResult } from '@/src/features/vault/types/ingestionReview';
import { resolveWiresFromDrawing, mergeDrawingWiresIntoJob, isRheemDrawingModel, buildPinMap, type PinMapRow } from './wireResolutionService';
import { computeExtractionCoverage, type ExtractionCoverage } from './extractionCoverageService';
import { interpretRheemDrawingModel, type DrawingInterpretationResult } from './drawingInterpretationService';

type PipelineStatus = 'PARTIAL' | 'READY';

interface IngestAndProcessParams {
  file: File;
  documentType: DocumentType;
  extractedText?: string;
  partNumberOverride?: string;
  revisionOverride?: string;
  validationContext?: RevisionValidationAuditMetadata;
  /** Phase 3H.31: How this commit was authorized. Stored in extraction_evidence. */
  confirmationMode?: 'AUTO_VERIFIED' | 'USER_CONFIRMED' | 'ADMIN_CONFIRMED';
  /** Phase 3H.33: Operator audit trail. */
  confirmedBy?: string;
  confirmedAt?: string;
  analysisSnapshot?: Partial<IngestionAnalysisResult> | null;
  drawingNumberOverride?: string;
}

interface PipelineResult {
  status: PipelineStatus;
  job: HarnessInstructionJob | null;
  drawing: CanonicalDrawingDraft | null;
  processBundle: ProcessInstructionBundle | null;
  /** Phase 3H.44 C6: Deterministic pin map derived from resolved drawing wires. Empty for BOM-only SKUs. */
  pinMap?: PinMapRow[];
  /** Phase 3H.44 C7.1: Extraction coverage + gap detection metrics. Present only when a Rheem drawing was resolved. */
  coverage?: ExtractionCoverage;
  /** Phase 3H.47 C9: Structured interpretation of drawing wires/connectors. Additive diagnostics only. */
  interpretation?: DrawingInterpretationResult;
}

export interface UnifiedIngestionResult {
  sku: SKURecord;
  documents: SKUDocumentRecord[];
  revisionValidation: CrossSourceValidationResult;
  readiness: SKUReadinessResult;
  uploadResult: UploadDocumentResult;
  skuCreated: boolean;
  headerUpdated: boolean;
  pipeline: PipelineResult;
}

async function projectBOMToRepository(params: {
  document: SKUDocumentRecord;
  sku: SKURecord;
  providedText?: string | null;
}): Promise<void> {
  const { document, sku, providedText } = params;

  if (document.document_type !== 'BOM') {
    return;
  }

  if (document.storage_path == null) {
    console.warn('[BOM PROJECTION] Missing storage path for document', { documentId: document.id });
    return;
  }

  const text = providedText?.trim()?.length ? providedText : await loadExtractedText(document.storage_path);

  if (!text || text.trim().length === 0) {
    console.warn('[BOM PROJECTION] Missing BOM text for derived projection', { documentId: document.id });
    return;
  }

  const metadata: IngestionMetadata = {
    sourceReference: document.file_name,
    sourceType: 'engineering_master',
    revision: document.normalized_revision || document.revision,
    partNumber: sku.part_number,
    artifactUrl: document.file_url,
    artifactPath: document.storage_path,
  };

  console.log('[BOM PROJECTION] Writing derived bom_records from Vault ingestion', {
    documentId: document.id,
    skuId: sku.id,
    partNumber: sku.part_number,
    revision: metadata.revision,
  });

  try {
    await ingestBOMFromVaultProjection(text, metadata);
  } catch (err) {
    console.error('[BOM PROJECTION] Failed to persist derived BOM', {
      documentId: document.id,
      skuId: sku.id,
      error: err instanceof Error ? err.message : err,
    });
  }
}

function deriveRevisionFromBOM(text: string): string | null {
  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0 && l.length < 200);

  for (const line of lines.slice(0, 40)) {
    const m = line.match(
      /\b(?:REV(?:ISION)?|REVISION\s*LEVEL|REV\.?\s*NO\.?)[:\s.]*([A-Z0-9]{1,4})\b/i,
    );
    if (!m) continue;
    const candidate = m[1].toUpperCase();
    if (/^\d+$/.test(candidate)) continue;
    return candidate;
  }
  return null;
}

function deriveDescriptionFromBOM(text: string): string | null {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const titleRe = /WIRE\s+HARNESS|HARNESS\s+ASSY|CABLE\s+ASSY|WIRING\s+ASSEMBLY/i;
  for (const line of lines.slice(0, 80)) {
    if (titleRe.test(line) && line.length < 150) {
      return line.replace(/\s+/g, ' ').trim();
    }
  }
  return null;
}

function normalizeOptionalString(value?: string | null): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function generateProvisionalPartNumber(fileName: string): string {
  const base = fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[^A-Z0-9]/gi, '')
    .toUpperCase()
    .slice(0, 6);
  const suffix = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PENDING-${base || 'DOC'}-${suffix}${random}`;
}

async function buildPipelineFromDocuments(
  sku: SKURecord,
  documents: SKUDocumentRecord[],
  preBuiltBOMJob: HarnessInstructionJob | null = null,
): Promise<PipelineResult> {
  const bomDoc = documents.find(doc => doc.document_type === 'BOM');
  const drawingDoc =
    documents.find(doc => doc.document_type === 'INTERNAL_DRAWING') ||
    documents.find(doc => doc.document_type === 'CUSTOMER_DRAWING');

  if (!bomDoc || !drawingDoc) {
    return { status: 'PARTIAL', job: null, drawing: null, processBundle: null };
  }

  const [bomText, drawingText] = await Promise.all([
    loadExtractedText(bomDoc.storage_path),
    loadExtractedText(drawingDoc.storage_path),
  ]);

  // Phase 3H.44 C3: When a pre-built merged job is present, BOM text is not required
  // for job construction (already consumed upstream). Drawing text is always required.
  if (!drawingText || (!preBuiltBOMJob && !bomText)) {
    return { status: 'PARTIAL', job: null, drawing: null, processBundle: null };
  }

  // Phase 3H.44 C3: Use pre-merged job if provided; otherwise build from BOM text as usual.
  const job = preBuiltBOMJob ?? await parseBOMToHWI(bomText!, sku.part_number, bomDoc.revision);
  if (preBuiltBOMJob) {
    console.log('[WIRE AUTHORITY LAYER] Pre-merged BOM job injected — parseBOMToHWI bypassed');
  }
  const drawing = ingestDrawingPdf({ drawingText, fileName: drawingDoc.file_name });
  const hints = await loadFusionHints(drawing, job);
  const fused = fuseDrawingWithBOM(drawing, job, hints);
  const resolved = resolveEndpoints(fused, drawing, hints);
  const bundle = buildProcessInstructions(resolved, hints?.toolingOverrides, hints);

  await persistLearningUsageEvents(hints).catch(err => {
    console.warn('[HWI LEARNING] persist usage events failed (pipeline)', err);
  });

  return {
    status: 'READY',
    job: resolved,
    drawing,
    processBundle: bundle,
  };
}

export async function ingestAndProcessDocument(params: IngestAndProcessParams): Promise<UnifiedIngestionResult> {
  const {
    file,
    documentType,
    extractedText,
    partNumberOverride,
    revisionOverride,
    validationContext,
    confirmationMode,
    confirmedBy,
    confirmedAt,
    analysisSnapshot,
    drawingNumberOverride,
  } = params;

  const normalizedType = documentType;
  const normalizedText = normalizeOptionalString(extractedText);
  const operatorConfirmedPart = normalizeOptionalString(partNumberOverride);
  const operatorConfirmedRevision = normalizeOptionalString(revisionOverride);
  const operatorConfirmedDrawing = normalizeOptionalString(drawingNumberOverride);
  // ---------------------------------------------------------------------------
  // Phase 3H.40.B: Delegate resolution to analyzeFileIngestion for guardrail
  // enforcement (fieldLocks, filterFieldSignals, selectCandidateByOrder, audit).
  // ---------------------------------------------------------------------------
  const analysis = await analyzeFileIngestion({
    fileName: file.name,
    fileSize: file.size,
    normalizedText,
    partNumberHint: operatorConfirmedPart,
    revisionHint: operatorConfirmedRevision,
    drawingNumberHint: operatorConfirmedDrawing,
    forcedDocumentType: normalizedType !== 'UNKNOWN' ? normalizedType : null,
  });

  let partNumber = analysis.proposedPartNumber;
  let revision = analysis.proposedRevision;
  const drawingNumber = analysis.proposedDrawingNumber;
  const revisionSource = analysis.revisionSource as RevisionSource | null;

  // Description is not part of guardrail resolution — derive locally
  let description: string | null = null;
  if (normalizedType === 'BOM' && normalizedText) {
    description = deriveDescriptionFromBOM(normalizedText);
  } else if (normalizedText && normalizedType !== 'UNKNOWN') {
    const draft = ingestDrawingPdf({ drawingText: normalizedText, fileName: file.name });
    if (draft.title) description = draft.title;
  }

  // ---------------------------------------------------------------------------
  // Phase 3H.40.B: Augment extraction evidence with commit-specific metadata.
  // All signals, fragments, resolution_audit, and field_extractions come from
  // analyzeFileIngestion — no duplicate construction here.
  // ---------------------------------------------------------------------------
  const captureTimestamp = new Date().toISOString();
  const extractionEvidence: DocumentExtractionEvidence = {
    ...analysis.extractionEvidence,
    captured_at: captureTimestamp,
    confirmation_mode: confirmationMode ?? null,
    confirmation_details: confirmationMode
      ? {
          confirmed_by: confirmedBy ?? null,
          confirmed_at: confirmedAt ?? captureTimestamp,
          document_type: normalizedType,
          part_number: operatorConfirmedPart ?? partNumber ?? null,
          revision: operatorConfirmedRevision ?? revision ?? null,
          drawing_number: operatorConfirmedDrawing ?? drawingNumber ?? null,
        }
      : null,
    original_suggestions: analysisSnapshot
      ? {
          document_type: analysisSnapshot.proposedDocumentType ?? null,
          part_number: analysisSnapshot.proposedPartNumber ?? null,
          revision: analysisSnapshot.proposedRevision ?? null,
          drawing_number: analysisSnapshot.proposedDrawingNumber ?? null,
          doc_type_confidence: analysisSnapshot.docTypeConfidence ?? null,
        }
      : null,
    original_unresolved_questions: analysisSnapshot?.unresolvedQuestions?.map(q => ({
      id: q.id,
      issueCode: q.issueCode,
      fieldToResolve: q.fieldToResolve,
      blocksCommit: q.blocksCommit,
    })),
  };

  console.log('[ANALYZE vs COMMIT]', {
    file: file.name,
    analyze_part_number: analysis.proposedPartNumber,
    analyze_revision: analysis.proposedRevision,
    analyze_drawing_number: analysis.proposedDrawingNumber,
    commit_part_number: partNumber,
    commit_revision: revision,
    commit_drawing_number: drawingNumber,
    parity: analysis.proposedPartNumber === partNumber &&
            analysis.proposedRevision === revision &&
            analysis.proposedDrawingNumber === drawingNumber,
  });

  if (!partNumber && drawingNumber) {
    let resolvedPN: string | null = null;
    try {
      resolvedPN = await resolveAliasFromDB(drawingNumber);
    } catch (err) {
      console.warn('[HWI ALIAS DB LOOKUP ERROR]', err);
    }

    if (!resolvedPN) {
      resolvedPN = await resolvePartNumberFromDrawing(drawingNumber);
    }

    if (resolvedPN) {
      partNumber = resolvedPN;
      console.log('[HWI RESOLUTION SUCCESS]', drawingNumber, '→', resolvedPN);
      storeAliasMapping(drawingNumber, resolvedPN).catch(err => {
        console.warn('[HWI ALIAS STORE ERROR]', err);
      });
    } else {
      console.warn('[HWI UNRESOLVED DRAWING NUMBER]', drawingNumber);
    }
  }

  let usedFallback = false;
  if (!partNumber) {
    partNumber = generateProvisionalPartNumber(file.name);
    usedFallback = true;
  }

  if (!description) {
    description = usedFallback ? `Pending classification for ${file.name}` : null;
  }

  if (usedFallback) {
    console.warn('[HWI INGEST FALLBACK PN]', {
      file_name: file.name,
      provisional_part_number: partNumber,
    });
  }

  const ingestResult = await ingestDocumentFirstFlow(
    {
      part_number: partNumber,
      revision,
      description,
      sourceType: normalizedType,
      drawing_number: drawingNumber ?? null,
      revisionSource: revisionSource ?? undefined,
      revisionValidation: validationContext,
      extractionEvidence,
    },
    file,
    normalizedText ?? undefined,
  );

  const extractedPart = partNumber;
  const extractedRevision = revision ?? null;
  const matchedSku = ingestResult.sku.part_number;
  const documentId = ingestResult.uploadResult.document.id;

  console.log('[HWI INGEST IDENTITY]', {
    extractedPart,
    extractedRevision,
    matchedSku,
    documentId,
    skuCreated: ingestResult.skuCreated,
    usedFallbackPN: usedFallback,
    documentType: normalizedType,
    storedRevision: ingestResult.uploadResult.document.revision,
    normalizedRevision: ingestResult.uploadResult.document.normalized_revision ?? null,
  });

  if (usedFallback) {
    console.warn('[HWI UNLINKED DOCUMENT] Document could not be matched to a SKU — provisional part number assigned', {
      documentId,
      provisionalPart: extractedPart,
      fileName: file.name,
      documentType: normalizedType,
    });
  }

  if (ingestResult.uploadResult.status !== 'duplicate') {
    await projectBOMToRepository({
      document: ingestResult.uploadResult.document,
      sku: ingestResult.sku,
      providedText: normalizedText ?? null,
    });
  }

  const { documents, revision_validation, readiness } = await getCurrentDocuments(ingestResult.sku.id);

  // Phase 3H.44 C3: Pre-build wire authority injection.
  // Merge Rheem drawing wires into the BOM job BEFORE pipeline construction so that
  // fuseDrawingWithBOM and buildProcessInstructions see canonical merged data from the start.
  // BOM-only SKUs are unaffected: isRheemDrawingModel returns false for null/non-Rheem data.
  let preBuiltBOMJob: HarnessInstructionJob | null = null;
  let pinMapRows: PinMapRow[] = [];
  let coverage: ExtractionCoverage | undefined;
  let interpretation: DrawingInterpretationResult | undefined;
  if (isRheemDrawingModel(analysisSnapshot?.structuredData)) {
    const bomDoc = documents.find(d => d.document_type === 'BOM');
    if (bomDoc?.storage_path) {
      const bomText = await loadExtractedText(bomDoc.storage_path);
      if (bomText) {
        const rawBOMJob    = await parseBOMToHWI(bomText, ingestResult.sku.part_number, bomDoc.revision);
        const drawingWires = resolveWiresFromDrawing(analysisSnapshot.structuredData);
        coverage       = computeExtractionCoverage(analysisSnapshot.structuredData, drawingWires);
        interpretation = interpretRheemDrawingModel(analysisSnapshot.structuredData);
        preBuiltBOMJob = drawingWires.length > 0
          ? mergeDrawingWiresIntoJob(rawBOMJob, drawingWires)
          : rawBOMJob;

        // Phase 3H.44 C6: Build pin map from resolved drawing wires
        pinMapRows = buildPinMap(drawingWires);
        console.log('[PIN MAP BUILT]', {
          totalRows: pinMapRows.length,
          terminals: pinMapRows.filter(r => r.toType === 'TERMINAL').length,
          unknown:   pinMapRows.filter(r => r.toType === 'UNKNOWN').length,
        });

        console.log('[WIRE AUTHORITY LAYER]', {
          phase:            '3H.44C3',
          mode:             'pre-build',
          bomWireCount:     rawBOMJob.wire_instances.length,
          drawingWireCount: drawingWires.length,
          resolvedLengths:  preBuiltBOMJob.wire_instances.filter(w => w.cut_length !== null).length,
        });
      }
    }
  }

  const rawPipeline = await buildPipelineFromDocuments(ingestResult.sku, documents, preBuiltBOMJob);
  const pipeline: PipelineResult = {
    ...rawPipeline,
    ...(pinMapRows.length > 0 ? { pinMap: pinMapRows } : {}),
    ...(coverage       !== undefined ? { coverage }       : {}),
    ...(interpretation  !== undefined ? { interpretation } : {}),
  };

  return {
    sku: ingestResult.sku,
    documents,
    revisionValidation: revision_validation,
    readiness,
    uploadResult: ingestResult.uploadResult,
    skuCreated: ingestResult.skuCreated,
    headerUpdated: ingestResult.headerUpdated,
    pipeline,
  };
}

export async function runPipelineForSKU(sku: SKURecord, documents?: SKUDocumentRecord[]): Promise<PipelineResult> {
  const docs = documents ?? (await getCurrentDocuments(sku.id)).documents;
  return buildPipelineFromDocuments(sku, docs);
}
