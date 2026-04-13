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
import { extractPartNumberFromText } from '@/src/utils/extractPartNumber';
import { extractDrawingNumberFromText, extractDrawingNumberFromFilename } from '@/src/utils/extractDrawingNumber';
import { extractEngineeringMasterIdentifiers, type EngineeringMasterIdentifiers } from '@/src/utils/extractEngineeringMasterIdentifiers';
import { extractEngineeringMasterRevision } from '@/src/utils/extractEngineeringMasterRevision';
import { extractRheemDrawingRevision } from '@/src/utils/extractRheemDrawingRevision';
import { extractApogeeDrawingRevision } from '@/src/utils/extractApogeeDrawingRevision';
import { extractRevisionSignal, type RevisionSource } from '@/src/utils/revisionParser';
import { resolveDocumentSignals } from '../utils/resolveDocumentSignals';

type PipelineStatus = 'PARTIAL' | 'READY';

interface IngestAndProcessParams {
  file: File;
  documentType: DocumentType;
  extractedText?: string;
  partNumberOverride?: string;
  revisionOverride?: string;
  validationContext?: RevisionValidationAuditMetadata;
}

interface PipelineResult {
  status: PipelineStatus;
  job: HarnessInstructionJob | null;
  drawing: CanonicalDrawingDraft | null;
  processBundle: ProcessInstructionBundle | null;
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

  if (!bomText || !drawingText) {
    return { status: 'PARTIAL', job: null, drawing: null, processBundle: null };
  }

  const job = await parseBOMToHWI(bomText, sku.part_number, bomDoc.revision);
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
  const { file, documentType, extractedText, partNumberOverride, revisionOverride, validationContext } = params;

  const normalizedType = documentType;
  const normalizedText = normalizeOptionalString(extractedText);
  let partNumber = normalizeOptionalString(partNumberOverride);
  let revision = normalizeOptionalString(revisionOverride);
  let description: string | null = null;
  let emIds: EngineeringMasterIdentifiers | null = null;
  let revisionSource: RevisionSource | null = null;

  if (normalizedType === 'BOM' && normalizedText) {
    // Deterministic Engineering Master identifier extraction — NH > 45 > PENDING; 527 → drawing_number only
    emIds = extractEngineeringMasterIdentifiers(normalizedText);
    if (!partNumber && emIds.canonicalPartNumber) partNumber = emIds.canonicalPartNumber;

    if (!revision) {
      // Engineering Master revision is taken from the explicit trailing revision field on the
      // repeated header line. Identifier suffixes like -JJ or -EE are part-number variants,
      // not revision tokens, and are never captured here.
      const emRev = extractEngineeringMasterRevision(normalizedText);
      if (emRev.isHeaderExplicit && emRev.revision) {
        revision = emRev.revision;
        revisionSource = 'HEADER_EXPLICIT';
      } else {
        // Generic fallback only — for non-EM BOMs or when header line is absent/malformed
        revision = deriveRevisionFromBOM(normalizedText);
        revisionSource = revision ? 'TEXT' : null;
      }
    }

    if (!description) description = deriveDescriptionFromBOM(normalizedText);
  } else if (normalizedText && normalizedType !== 'UNKNOWN') {
    const draft = ingestDrawingPdf({ drawingText: normalizedText, fileName: file.name });
    if (!partNumber && draft.drawing_number) partNumber = draft.drawing_number;
    if (!description && draft.title) description = draft.title;

    if (!revision) {
      const hasApogeePN = /\b527-\d{4}-010\b/.test(normalizedText);
      const hasRheemPN  = /\b45-\d{5,6}-\d{2,4}\b/.test(normalizedText);

      if (hasApogeePN) {
        // Apogee drawings store revision in the upper-right revision record box.
        // 527-XXXX-010 is the internal drawing number, not revision.
        // 45-* may appear as customer/Rheem number in the title area — never a revision.
        // Apogee revisions may be numeric (00–02) or alphabetic (A, B, LL).
        const apogeeRev = extractApogeeDrawingRevision(normalizedText);
        if (apogeeRev.isApogeeDrawing && apogeeRev.revision) {
          revision = apogeeRev.revision;
          revisionSource = 'REVISION_BOX_APOGEE';
        }
      } else if (hasRheemPN) {
        // Rheem drawings store revision in the title block using 'REV PART NO.' structure.
        // Revision is tied to the part number, not a standalone REV label.
        // Rheem path is skipped when Apogee (527-*) is detected, since Apogee drawings
        // also contain 45-* customer numbers that must not trigger the Rheem path.
        const rheemRev = extractRheemDrawingRevision(normalizedText);
        if (rheemRev.isRheemTitleBlock && rheemRev.revision) {
          revision = rheemRev.revision;
          revisionSource = 'TITLE_BLOCK_RHEEM';
        }
      }

      // Fallback to generic drawing ingestion revision (revision_source remains null → TEXT)
      if (!revision && draft.revision) revision = draft.revision;
    }
  }

  if (!partNumber && normalizedText && normalizedType !== 'BOM') {
    // Generic fallback only for non-BOM types; BOM falls through to PENDING provisioning
    const derivedPN = extractPartNumberFromText(normalizedText);
    if (derivedPN) partNumber = derivedPN;
  }

  // ---------------------------------------------------------------------------
  // Signal Resolution — Phase 3H.18
  // All extraction paths feed into resolveDocumentSignals. The engine selects the
  // highest-priority non-null signal for each field.
  // ---------------------------------------------------------------------------

  const drawingNumberFromText     = normalizedText ? extractDrawingNumberFromText(normalizedText) : null;
  const drawingNumberFromFilename = extractDrawingNumberFromFilename(file.name);

  // Explicit filename revision signal: captures Rev.XX from filename stem before delegating
  // to uploadDocument so that meta.revision and the INGEST IDENTITY log are always accurate.
  const filenameRevSignal = extractRevisionSignal({ fileName: file.name });
  const filenameRevision  = (filenameRevSignal.normalized && filenameRevSignal.parseSource !== 'UNKNOWN')
    ? filenameRevSignal.normalized
    : null;

  const isStructuredRevision =
    revisionSource === 'REVISION_BOX_APOGEE' ||
    revisionSource === 'TITLE_BLOCK_RHEEM'   ||
    revisionSource === 'HEADER_EXPLICIT';

  const resolved = resolveDocumentSignals({
    titleBlockRevision:  isStructuredRevision ? revision : null,
    textRevision:        !isStructuredRevision && revision ? revision : null,
    filenameRevision,
    emDrawingNumber:     emIds?.drawingNumber ?? null,
    textDrawingNumber:   drawingNumberFromText,
    filenameDrawingNumber: drawingNumberFromFilename,
  });

  // Apply resolved revision if it improves on what text extraction found
  if (resolved.revision.value && !revision) {
    revision = resolved.revision.value;
    if (resolved.revision.source === 'FILENAME') revisionSource = 'FILENAME';
  }

  const drawingNumber = resolved.drawingNumber.value;

  console.log('[SIGNAL RESOLUTION]', {
    file: file.name,
    revision:      { value: resolved.revision.value,      source: resolved.revision.source },
    drawingNumber: { value: resolved.drawingNumber.value, source: resolved.drawingNumber.source },
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
  const pipeline = await buildPipelineFromDocuments(ingestResult.sku, documents);

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
