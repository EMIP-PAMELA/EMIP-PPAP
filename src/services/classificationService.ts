import { getSupabaseServer } from '@/src/lib/supabaseServer';
import { loadExtractedText, type DocumentClassificationStatus } from '@/src/features/harness-work-instructions/services/skuService';
import { detectDocumentType } from '@/src/features/vault/utils/documentSignals';
import { resolveAliasFromDB, storeAliasMapping } from '@/src/features/harness-work-instructions/services/aliasService';
import { resolvePartNumberFromDrawing } from '@/src/features/harness-work-instructions/services/drawingLookupService';

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1500;

type ClassificationOutcome = {
  status: DocumentClassificationStatus;
  confidence: number | null;
  notes: string | null;
  retry: boolean;
};

type RawDocument = {
  id: string;
  file_name: string;
  document_type: string;
  storage_path: string | null;
  classification_status: DocumentClassificationStatus;
  classification_attempts: number;
};

const PART_NUMBER_PATTERNS = [
  /\b(\d{3}-\d{4,5}-\d{3,4}[A-Z]?)\b/, // 123-45678-123
  /\b([A-Z]{2,6}-\d{4,6}(?:-[A-Z0-9]{1,5})?)\b/, // NH45-110858-01
  /part\s*(?:number|no\.?|#)\s*[:\s]+([A-Z0-9]{2}[A-Z0-9\-]{4,})/i,
];

function extractPartNumber(text: string | null): string | null {
  if (!text) return null;
  const lines = text.split(/\r?\n/).slice(0, 100);
  for (const line of lines) {
    for (const pattern of PART_NUMBER_PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        const candidate = match[1]?.trim().toUpperCase();
        if (candidate && candidate.length >= 6 && candidate.length <= 40) {
          return candidate;
        }
      }
    }
  }
  return null;
}

function extractDrawingNumber(text: string | null): string | null {
  if (!text) return null;
  const lines = text.split(/\r?\n/).slice(0, 80);
  const regex = /\b\d{3}-\d{4}-\d{3}\b/;
  for (const line of lines) {
    const match = line.match(regex);
    if (match) return match[0];
  }
  return null;
}

async function deterministicPass(document: RawDocument, extractedText: string | null): Promise<ClassificationOutcome | null> {
  if (!extractedText) {
    return null;
  }

  const partNumber = extractPartNumber(extractedText);
  if (partNumber) {
    return {
      status: 'RESOLVED',
      confidence: 0.95,
      notes: `Deterministic pass: detected part number ${partNumber}.`,
      retry: false,
    };
  }

  const drawingNumber = extractDrawingNumber(extractedText);
  if (!drawingNumber) {
    return null;
  }

  try {
    const alias = (await resolveAliasFromDB(drawingNumber)) ?? resolvePartNumberFromDrawing(drawingNumber);
    if (alias) {
      storeAliasMapping(drawingNumber, alias).catch(err => {
        console.warn('[CLASSIFICATION] Alias save failed', err);
      });
      return {
        status: 'RESOLVED',
        confidence: 0.9,
        notes: `Deterministic pass: alias resolved ${drawingNumber} → ${alias}.`,
        retry: false,
      };
    }
  } catch (err) {
    console.warn('[CLASSIFICATION] Alias lookup failed', err);
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
      status: matchesDeclared ? 'PARTIAL' : 'PARTIAL',
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

async function runClassificationPasses(document: RawDocument, extractedText: string | null): Promise<ClassificationOutcome> {
  const deterministic = await deterministicPass(document, extractedText);
  if (deterministic) return deterministic;

  const heuristic = heuristicPass(document, extractedText);
  if (heuristic && heuristic.status === 'RESOLVED') return heuristic;

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

  const nextAttempts = attempts + 1;
  const outcome = await runClassificationPasses(document as RawDocument, extractedText);
  let statusToPersist: DocumentClassificationStatus = outcome.status;
  let shouldRetry = outcome.retry;

  if (statusToPersist !== 'RESOLVED') {
    if (shouldRetry && nextAttempts < MAX_ATTEMPTS) {
      statusToPersist = 'PENDING';
    } else if (nextAttempts >= MAX_ATTEMPTS) {
      statusToPersist = 'NEEDS_REVIEW';
      shouldRetry = false;
    }
  }

  await supabase
    .from('sku_documents')
    .update({
      classification_status: statusToPersist,
      classification_attempts: nextAttempts,
      classification_confidence: outcome.confidence,
      classification_notes: outcome.notes,
      last_classified_at: new Date().toISOString(),
    })
    .eq('id', documentId);

  if (shouldRetry && statusToPersist === 'PENDING') {
    const timer = setTimeout(() => {
      classifyDocument(documentId).catch(err => {
        console.error('[CLASSIFICATION] Retry failed', err);
      });
    }, RETRY_DELAY_MS);
    if (typeof timer === 'object' && typeof (timer as NodeJS.Timeout).unref === 'function') {
      (timer as NodeJS.Timeout).unref();
    }
  }
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
