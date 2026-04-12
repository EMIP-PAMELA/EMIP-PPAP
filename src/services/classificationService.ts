import { getSupabaseServer } from '@/src/lib/supabaseServer';
import { loadExtractedText, type DocumentClassificationStatus } from '@/src/features/harness-work-instructions/services/skuService';
import { detectDocumentType } from '@/src/features/vault/utils/documentSignals';
import { resolveAliasFromDB, storeAliasMapping } from '@/src/features/harness-work-instructions/services/aliasService';
import { resolvePartNumberFromDrawing } from '@/src/features/harness-work-instructions/services/drawingLookupService';
import { linkDocument } from '@/src/services/linkingService';
import { extractPartNumberFromText } from '@/src/utils/extractPartNumber';
import { extractDrawingNumberFromText } from '@/src/utils/extractDrawingNumber';

export const MAX_ATTEMPTS = 3;

type ClassificationOutcome = {
  status: DocumentClassificationStatus;
  confidence: number | null;
  notes: string | null;
  retry: boolean;
};

type RawDocument = {
  id: string;
  sku_id: string | null;
  file_name: string;
  document_type: string;
  storage_path: string | null;
  classification_status: DocumentClassificationStatus;
  classification_attempts: number;
};

type SignalContext = {
  partNumber: string | null;
  drawingNumber: string | null;
  aliasResolution: string | null;
};

function deterministicPass(document: RawDocument, context: SignalContext): ClassificationOutcome | null {
  if (context.partNumber) {
    return {
      status: 'RESOLVED',
      confidence: 0.95,
      notes: `Deterministic pass: detected part number ${context.partNumber}.`,
      retry: false,
    };
  }

  if (context.aliasResolution) {
    return {
      status: 'RESOLVED',
      confidence: 0.9,
      notes: `Deterministic pass: alias resolved ${context.drawingNumber ?? 'UNKNOWN'} → ${context.aliasResolution}.`,
      retry: false,
    };
  }

  return null;
}

function heuristicPass(document: RawDocument, extractedText: string | null): ClassificationOutcome | null {
  if (!extractedText) {
    return {
      status: 'PARTIAL',
      confidence: null,
      notes: 'Missing extracted text — awaiting OCR backfill.',
      retry: true,
    };
  }

  const classification = detectDocumentType(extractedText, document.file_name);
  if (classification.detected !== 'UNKNOWN') {
    const matchesDeclared = classification.detected === document.document_type;
    return {
      status: matchesDeclared ? 'PARTIAL' : 'PARTIAL_MISMATCH',
      confidence: matchesDeclared ? 0.7 : 0.4,
      notes: matchesDeclared
        ? 'Heuristic pass: structure matches stored document type.'
        : 'Heuristic pass detected a mismatch between stored type and inferred type.',
      retry: true,
    };
  }

  if (extractedText.length > 20000) {
    return {
      status: 'PARTIAL',
      confidence: 0.5,
      notes: 'Heuristic pass: long-form document detected, further analysis required.',
      retry: true,
    };
  }

  return null;
}

function aiStubPass(): ClassificationOutcome {
  return {
    status: 'PARTIAL',
    confidence: 0.35,
    notes: 'AI classification stub executed — awaiting future model integration.',
    retry: true,
  };
}

async function runClassificationPasses(
  document: RawDocument,
  extractedText: string | null,
  context: SignalContext,
): Promise<ClassificationOutcome> {
  const deterministic = deterministicPass(document, context);
  if (deterministic) return deterministic;

  const heuristic = heuristicPass(document, extractedText);

  const aiFallback = aiStubPass();

  if (heuristic) {
    return heuristic.retry ? heuristic : { ...heuristic, retry: true };
  }

  return aiFallback;
}

export async function classifyDocument(documentId: string): Promise<void> {
  const supabase = getSupabaseServer();
  const { data: document, error } = await supabase
    .from('sku_documents')
    .select(
      `id,
       sku_id,
       file_name,
       document_type,
       storage_path,
       classification_status,
       classification_attempts
      `,
    )
    .eq('id', documentId)
    .maybeSingle();

  if (error) {
    console.error('[CLASSIFICATION] Failed to load document', { documentId, error: error.message });
    return;
  }
  if (!document) {
    console.warn('[CLASSIFICATION] Document not found', { documentId });
    return;
  }

  if (document.classification_status === 'RESOLVED') {
    return;
  }

  const attempts = document.classification_attempts ?? 0;
  if (attempts >= MAX_ATTEMPTS && document.classification_status === 'NEEDS_REVIEW') {
    return;
  }

  await supabase
    .from('sku_documents')
    .update({ classification_status: 'PROCESSING' })
    .eq('id', documentId);

  let extractedText: string | null = null;
  if (document.storage_path) {
    try {
      extractedText = await loadExtractedText(document.storage_path);
    } catch (err) {
      console.warn('[CLASSIFICATION] Failed to load extracted text', err);
    }
  }

  const signalContext = await buildSignalContext(extractedText);

  const nextAttempts = attempts + 1;
  const outcome = await runClassificationPasses(document as RawDocument, extractedText, signalContext);
  let statusToPersist: DocumentClassificationStatus = outcome.status;

  if (statusToPersist !== 'RESOLVED') {
    if (nextAttempts >= MAX_ATTEMPTS) {
      statusToPersist = 'NEEDS_REVIEW';
    }
  }

  const inferredPartNumber = signalContext.partNumber ?? signalContext.aliasResolution ?? null;

  await supabase
    .from('sku_documents')
    .update({
      classification_status: statusToPersist,
      classification_attempts: nextAttempts,
      classification_confidence: outcome.confidence,
      classification_notes: outcome.notes,
      last_classified_at: new Date().toISOString(),
      inferred_part_number: inferredPartNumber,
      drawing_number: signalContext.drawingNumber ?? null,
    })
    .eq('id', documentId);

  if (inferredPartNumber) {
    await resolveProvisionalSku(documentId, document.sku_id, inferredPartNumber, supabase);
  }

  const hasLinkableSignals = Boolean(
    signalContext.partNumber ?? signalContext.aliasResolution ?? signalContext.drawingNumber,
  );
  if (statusToPersist === 'RESOLVED' || hasLinkableSignals) {
    linkDocument(documentId).catch(err => {
      console.error('[LINKING] async trigger failed', err);
    });
  }
}

async function resolveProvisionalSku(
  documentId: string,
  currentSkuId: string | null,
  inferredPartNumber: string,
  supabase: ReturnType<typeof getSupabaseServer>,
): Promise<void> {
  if (!currentSkuId) return;

  const { data: currentSku } = await supabase
    .from('sku')
    .select('id, part_number')
    .eq('id', currentSkuId)
    .maybeSingle();

  if (!currentSku?.part_number?.startsWith('PENDING-')) return;

  const normalized = inferredPartNumber.trim().toUpperCase();

  const { data: existing } = await supabase
    .from('sku')
    .select('id')
    .eq('part_number', normalized)
    .maybeSingle();

  let realSkuId = existing?.id ?? null;

  if (!realSkuId) {
    const { data: created, error } = await supabase
      .from('sku')
      .insert({ part_number: normalized })
      .select('id')
      .single();
    if (error) {
      console.warn('[CLASSIFICATION] Provisional SKU resolve: failed to create real SKU', {
        documentId,
        part_number: normalized,
        error: error.message,
      });
      return;
    }
    realSkuId = created.id;
  }

  const { error: reassignError } = await supabase
    .from('sku_documents')
    .update({ sku_id: realSkuId })
    .eq('id', documentId);

  if (reassignError) {
    console.warn('[CLASSIFICATION] Provisional SKU resolve: failed to reassign document', {
      documentId,
      realSkuId,
      error: reassignError.message,
    });
  } else {
    console.log('[CLASSIFICATION] Provisional SKU resolved', {
      documentId,
      part_number: normalized,
      realSkuId,
    });
  }
}

async function buildSignalContext(extractedText: string | null): Promise<SignalContext> {
  if (!extractedText) {
    return {
      partNumber: null,
      drawingNumber: null,
      aliasResolution: null,
    };
  }

  const partNumber = extractPartNumberFromText(extractedText);
  const drawingNumber = extractDrawingNumberFromText(extractedText);
  let aliasResolution: string | null = null;

  if (!partNumber && drawingNumber) {
    try {
      aliasResolution = (await resolveAliasFromDB(drawingNumber)) ?? (await resolvePartNumberFromDrawing(drawingNumber));
      if (!aliasResolution) {
        aliasResolution = null;
      } else if (aliasResolution && aliasResolution.length > 0) {
        await storeAliasMapping(drawingNumber, aliasResolution);
      }
    } catch (err) {
      console.warn('[CLASSIFICATION] Drawing alias resolution failed', err);
    }
  }

  return {
    partNumber: partNumber ?? null,
    drawingNumber: drawingNumber ?? null,
    aliasResolution,
  };
}

export async function manuallyClassify(
  documentId: string,
  data: {
    status: DocumentClassificationStatus;
    confidence?: number | null;
    notes?: string | null;
  },
): Promise<void> {
  const supabase = getSupabaseServer();
  await supabase
    .from('sku_documents')
    .update({
      classification_status: data.status,
      classification_confidence: data.confidence ?? null,
      classification_notes: data.notes ?? null,
      last_classified_at: new Date().toISOString(),
    })
    .eq('id', documentId);
}
