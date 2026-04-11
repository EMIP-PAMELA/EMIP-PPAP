import { ingestDocumentFirstFlow, type DocumentType, type SKUDocumentRecord, type SKURecord, getCurrentDocuments, loadExtractedText } from './skuService';
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

type PipelineStatus = 'PARTIAL' | 'READY';

export class UnifiedIngestionError extends Error {
  constructor(public code: 'MISSING_PART_NUMBER' | 'MISSING_TEXT', message: string) {
    super(message);
  }
}

function extractDrawingNumber(text: string): string | null {
  const lines = text.split('\n').slice(0, 50);
  const regex = /\b\d{3}-\d{4}-\d{3}\b/;

  for (const line of lines) {
    const match = line.match(regex);
    if (match) return match[0];
  }

  return null;
}

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
  uploadResult: UploadDocumentResult;
  skuCreated: boolean;
  headerUpdated: boolean;
  pipeline: PipelineResult;
}

const WEAK_PN_TOKENS = new Set([
  'REV', 'DWG', 'DRW', 'NOTE', 'ITEM', 'DOC', 'PAGE', 'SHEET', 'DATE',
  'APP', 'CHK', 'ENG', 'TITLE', 'SIZE', 'SCALE', 'ZONE', 'CAGE', 'FSCM',
]);

function derivePartNumberFromBOM(text: string): string | null {
  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0 && l.length < 200);

  const patterns: RegExp[] = [
    /\b(\d{3}-\d{4,5}-\d{3,4}[A-Z]?)\b/,
    /\b([A-Z]{2,6}-\d{4,6}(?:-[A-Z0-9]{1,5})?)\b/,
    /part\s*(?:number|no\.?|#)\s*[:\s]+([A-Z0-9]{2}[A-Z0-9\-]{4,})/i,
  ];

  for (const line of lines.slice(0, 50)) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (!match) continue;
      const candidate = match[1].trim().toUpperCase();
      if (candidate.length < 6) continue;
      if (WEAK_PN_TOKENS.has(candidate)) continue;
      if (/^[A-Z]-/i.test(candidate)) continue;
      return candidate;
    }
  }
  return null;
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

function ensurePartNumber(partNumber: string | null | undefined): string {
  if (!partNumber || !partNumber.trim()) {
    throw new UnifiedIngestionError('MISSING_PART_NUMBER', 'Unable to derive part number from document');
  }
  return partNumber.trim().toUpperCase();
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

  if (!extractedText || extractedText.trim().length === 0) {
    throw new UnifiedIngestionError('MISSING_TEXT', 'Extracted text is required for ingestion');
  }

  const normalizedType = documentType;
  let partNumber: string | null = partNumberOverride ?? null;
  let revision: string | null = revisionOverride ?? null;
  let description: string | null = null;

  if (normalizedType === 'BOM') {
    if (!partNumber) partNumber = derivePartNumberFromBOM(extractedText);
    if (!revision) revision = deriveRevisionFromBOM(extractedText);
    if (!description) description = deriveDescriptionFromBOM(extractedText);
  } else {
    const draft = ingestDrawingPdf({ drawingText: extractedText, fileName: file.name });
    if (!partNumber && draft.drawing_number) partNumber = draft.drawing_number;
    if (!revision && draft.revision) revision = draft.revision;
    if (!description && draft.title) description = draft.title;
  }

  if (!partNumber) {
    const drawingNumber = extractDrawingNumber(extractedText);
    if (drawingNumber) {
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
  }

  const ensuredPartNumber = ensurePartNumber(partNumber);

  const ingestResult = await ingestDocumentFirstFlow(
    {
      part_number: ensuredPartNumber,
      revision,
      description,
      sourceType: normalizedType,
    },
    file,
    extractedText,
  );

  const documents = await getCurrentDocuments(ingestResult.sku.id);
  const pipeline = await buildPipelineFromDocuments(ingestResult.sku, documents);

  return {
    sku: ingestResult.sku,
    documents,
    uploadResult: ingestResult.uploadResult,
    skuCreated: ingestResult.skuCreated,
    headerUpdated: ingestResult.headerUpdated,
    pipeline,
  };
}

export async function runPipelineForSKU(sku: SKURecord, documents?: SKUDocumentRecord[]): Promise<PipelineResult> {
  const docs = documents ?? await getCurrentDocuments(sku.id);
  return buildPipelineFromDocuments(sku, docs);
}
