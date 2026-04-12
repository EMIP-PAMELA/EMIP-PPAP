import { ingestDocumentFirstFlow, type DocumentType, type SKUDocumentRecord, type SKURecord, getCurrentDocuments, loadExtractedText } from './skuService';
import type { CrossSourceValidationResult } from '@/src/utils/revisionCrossValidator';
import type { SKUReadinessResult } from '@/src/utils/skuReadinessEvaluator';
import { resolvePartNumberFromDrawing } from './drawingLookupService';
import { storeAliasMapping, resolveAliasFromDB } from './aliasService';
import { parseBOMToHWI } from '@/src/core/services/bomHWIAdapter';
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
import { extractDrawingNumberFromText } from '@/src/utils/extractDrawingNumber';

type PipelineStatus = 'PARTIAL' | 'READY';

interface IngestAndProcessParams {
  file: File;
  documentType: DocumentType;
  extractedText?: string;
  partNumberOverride?: string;
  revisionOverride?: string;
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
  const { file, documentType, extractedText, partNumberOverride, revisionOverride } = params;

  const normalizedType = documentType;
  const normalizedText = normalizeOptionalString(extractedText);
  let partNumber = normalizeOptionalString(partNumberOverride);
  let revision = normalizeOptionalString(revisionOverride);
  let description: string | null = null;

  if (normalizedType === 'BOM' && normalizedText) {
    const derivedPN = extractPartNumberFromText(normalizedText);
    if (!partNumber && derivedPN) partNumber = derivedPN;
    if (!revision) revision = deriveRevisionFromBOM(normalizedText);
    if (!description) description = deriveDescriptionFromBOM(normalizedText);
  } else if (normalizedText && normalizedType !== 'UNKNOWN') {
    const draft = ingestDrawingPdf({ drawingText: normalizedText, fileName: file.name });
    if (!partNumber && draft.drawing_number) partNumber = draft.drawing_number;
    if (!revision && draft.revision) revision = draft.revision;
    if (!description && draft.title) description = draft.title;
  }

  if (!partNumber && normalizedText) {
    const derivedPN = extractPartNumberFromText(normalizedText);
    if (derivedPN) partNumber = derivedPN;
  }

  const drawingNumber = normalizedText ? extractDrawingNumberFromText(normalizedText) : null;

  if (!partNumber && drawingNumber) {
    let resolved: string | null = null;
    try {
      resolved = await resolveAliasFromDB(drawingNumber);
    } catch (err) {
      console.warn('[HWI ALIAS DB LOOKUP ERROR]', err);
    }

    if (!resolved) {
      resolved = resolvePartNumberFromDrawing(drawingNumber);
    }

    if (resolved) {
      partNumber = resolved;
      console.log('[HWI RESOLUTION SUCCESS]', drawingNumber, '→', resolved);
      storeAliasMapping(drawingNumber, resolved).catch(err => {
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
    },
    file,
    normalizedText ?? undefined,
  );

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
