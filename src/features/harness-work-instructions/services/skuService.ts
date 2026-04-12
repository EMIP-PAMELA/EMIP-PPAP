import { getSupabaseServer } from '@/src/lib/supabaseServer';
import {
  evaluateRevisionSet,
  type RevisionEvaluationInput,
  type RevisionEvaluationResult,
  type RevisionState,
} from '@/src/utils/revisionEvaluator';
import { hashBuffer, hashText } from '../utils/documentHash';
import { summarizeLineDiff, type DocumentDiffSummary } from '../utils/documentDiff';

export type DocumentType = 'BOM' | 'CUSTOMER_DRAWING' | 'INTERNAL_DRAWING' | 'UNKNOWN';

export interface SKURecord {
  id: string;
  part_number: string;
  description: string | null;
  created_from: DocumentType | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentMetadata {
  part_number: string;
  revision?: string | null;
  description?: string | null;
  sourceType: DocumentType;
}

export interface DocumentFirstIngestResult {
  sku: SKURecord;
  skuCreated: boolean;
  headerUpdated: boolean;
  uploadResult: UploadDocumentResult;
}

const SOURCE_PRIORITY: Record<DocumentType, number> = {
  CUSTOMER_DRAWING: 3,
  INTERNAL_DRAWING: 2,
  BOM: 1,
  UNKNOWN: 0,
};

function getTextStoragePath(storagePath: string): string {
  return `${storagePath}${TEXT_OBJECT_SUFFIX}`;
}

async function storeExtractedText(storagePath: string, text?: string | null): Promise<string | null> {
  const supabase = createSupabaseAdmin();
  if (!text || text.trim().length === 0) return null;
  const textPath = getTextStoragePath(storagePath);
  const buffer = Buffer.from(text, 'utf8');
  const { error } = await supabase.storage.from(SKU_BUCKET).upload(textPath, buffer, {
    contentType: 'text/plain',
    upsert: true,
  });
  if (error) {
    console.warn('[HWI DOCUMENT TEXT STORE] Failed to persist extracted text', {
      storage_path: textPath,
      error: error.message,
    });
    return null;
  }
  return textPath;
}

export async function loadExtractedText(storagePath: string): Promise<string | null> {
  const supabase = createSupabaseAdmin();
  const textPath = getTextStoragePath(storagePath);
  const { data, error } = await supabase.storage.from(SKU_BUCKET).download(textPath);
  if (error || !data) {
    console.warn('[HWI EXTRACTED TEXT MISSING]', { storage_path: textPath, error: error?.message ?? 'no data' });
    return null;
  }
  const blobLike: Blob | ArrayBuffer = data as any;
  if (typeof (blobLike as Blob).text === 'function') {
    return (blobLike as Blob).text();
  }
  if (blobLike instanceof ArrayBuffer) {
    return Buffer.from(blobLike).toString('utf8');
  }
  if (typeof (blobLike as Blob).arrayBuffer === 'function') {
    const buffer = await (blobLike as Blob).arrayBuffer();
    return Buffer.from(buffer).toString('utf8');
  }
  return null;
}

export type DocumentClassificationStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'RESOLVED'
  | 'PARTIAL'
  | 'PARTIAL_MISMATCH'
  | 'NEEDS_REVIEW';

export interface SKUDocumentRecord {
  id: string;
  sku_id: string;
  document_type: DocumentType;
  revision: string;
  normalized_revision?: string | null;
  file_url: string;
  file_name: string;
  storage_path: string;
  uploaded_at: string;
  is_current: boolean;
  content_hash: string | null;
  extracted_text_hash: string | null;
  phantom_rev_flag: boolean;
  phantom_rev_note: string | null;
  phantom_diff_summary: DocumentDiffSummary | null;
  compared_to_document_id: string | null;
  classification_status: DocumentClassificationStatus;
  classification_attempts: number;
  last_classified_at: string | null;
  classification_confidence: number | null;
  classification_notes: string | null;
  inferred_part_number?: string | null;
  drawing_number?: string | null;
  revision_state?: RevisionState;
}

const SKU_BUCKET = 'sku-documents';
const TEXT_OBJECT_SUFFIX = '.extracted.txt';

function createSupabaseAdmin() {
  return getSupabaseServer();
}

export type UploadDocumentStatus = 'uploaded' | 'duplicate' | 'phantom_rev';

export interface UploadDocumentResult {
  status: UploadDocumentStatus;
  phantom_rev: boolean;
  message: string;
  diff_summary?: DocumentDiffSummary | null;
  document: SKUDocumentRecord;
}

export function normalizeDocumentType(type: string): DocumentType {
  const normalized = type.trim().toUpperCase();
  if (normalized === 'CUSTOMER') return 'CUSTOMER_DRAWING';
  if (normalized === 'INTERNAL') return 'INTERNAL_DRAWING';
  if (
    normalized === 'BOM' ||
    normalized === 'CUSTOMER_DRAWING' ||
    normalized === 'INTERNAL_DRAWING' ||
    normalized === 'UNKNOWN'
  ) {
    return normalized as DocumentType;
  }
  throw new Error(`Unsupported document type: ${type}`);
}

export async function createSKU(
  partNumber: string,
  description?: string,
  createdFrom?: DocumentType,
): Promise<SKURecord> {
  const supabase = createSupabaseAdmin();
  const payload = {
    part_number: partNumber.trim().toUpperCase(),
    description: description?.trim() || null,
    created_from: (createdFrom && createdFrom !== 'UNKNOWN') ? createdFrom : null,
  };

  const { data, error } = await supabase
    .from('sku')
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error('[HWI SKU CREATE] Failed', { error: error.message, part_number: payload.part_number });
    throw new Error(error.message);
  }

  console.log('[HWI SKU CREATED]', { part_number: payload.part_number, id: data.id, created_from: createdFrom ?? null });
  return data as SKURecord;
}

export async function getSKU(partNumber: string): Promise<{ sku: SKURecord; documents: SKUDocumentRecord[] } | null> {
  const supabase = createSupabaseAdmin();
  const normalized = partNumber.trim().toUpperCase();
  const { data, error } = await supabase
    .from('sku')
    .select('id, part_number, description, created_from, created_at, updated_at, sku_documents(*)')
    .eq('part_number', normalized)
    .maybeSingle();

  if (error) {
    console.error('[HWI SKU FETCH] Failed', { part_number: normalized, error: error.message });
    throw new Error(error.message);
  }

  if (!data) return null;

  const { sku_documents, ...rest } = data as SKURecord & { sku_documents?: SKUDocumentRecord[] };
  const documents = attachRevisionStates((sku_documents ?? []) as SKUDocumentRecord[]);
  return {
    sku: rest,
    documents,
  };
}

export async function listSKUs(): Promise<SKURecord[]> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from('sku')
    .select('id, part_number, description, created_from, created_at, updated_at')
    .order('part_number', { ascending: true });

  if (error) {
    console.error('[HWI SKU LIST] Failed', { error: error.message });
    throw new Error(error.message);
  }

  return data as SKURecord[];
}

async function recomputeRevisionStates(
  skuId: string,
  type: DocumentType,
): Promise<Map<string, RevisionEvaluationResult>> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from('sku_documents')
    .select('id, revision, normalized_revision, uploaded_at')
    .eq('sku_id', skuId)
    .eq('document_type', type);

  if (error) {
    console.warn('[HWI REVISION STATE] Failed to load family', {
      sku_id: skuId,
      document_type: type,
      error: error.message,
    });
    return new Map();
  }

  const inputs: RevisionEvaluationInput[] = (data ?? []).map(row => ({
    documentId: row.id,
    revision: (row.revision as string | null) ?? null,
    normalizedRevision: (row.normalized_revision as string | null) ?? null,
    uploadedAt: (row.uploaded_at as string | null) ?? null,
  }));

  const evaluations = evaluateRevisionSet(inputs, {
    log: true,
    context: { sku_id: skuId, document_type: type },
  });

  await Promise.all(
    evaluations.map(evaluation =>
      supabase
        .from('sku_documents')
        .update({ is_current: evaluation.state === 'CURRENT' })
        .eq('id', evaluation.documentId),
    ),
  );

  return new Map(evaluations.map(evaluation => [evaluation.documentId, evaluation]));
}

function attachRevisionStates(documents: SKUDocumentRecord[]): SKUDocumentRecord[] {
  if (documents.length === 0) {
    return [];
  }

  const stateMap = new Map<string, RevisionState>();
  const groups = new Map<string, RevisionEvaluationInput[]>();

  for (const doc of documents) {
    const key = `${doc.sku_id ?? `UNLINKED-${doc.id}`}-${doc.document_type}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push({
      documentId: doc.id,
      revision: doc.revision,
      normalizedRevision: doc.normalized_revision ?? null,
      uploadedAt: doc.uploaded_at,
    });
  }

  groups.forEach((inputs, key) => {
    const evaluations = evaluateRevisionSet(inputs, { context: { family: key } });
    evaluations.forEach(result => stateMap.set(result.documentId, result.state));
  });

  return documents.map(doc => {
    const revisionState = stateMap.get(doc.id) ?? doc.revision_state ?? 'UNKNOWN';
    return {
      ...doc,
      revision_state: revisionState,
      is_current: revisionState === 'CURRENT',
    };
  });
}

export async function uploadDocument(
  skuId: string,
  file: File,
  type: DocumentType | string,
  revision: string,
  extractedText?: string,
): Promise<UploadDocumentResult> {
  const supabase = createSupabaseAdmin();
  const documentType = normalizeDocumentType(type);
  const timestamp = Date.now();
  const safeName = file.name.replace(/\s+/g, '-');
  const normalizedRevision = revision?.trim() || 'UNSPECIFIED';
  const storagePath = `${skuId}/${documentType}/${normalizedRevision}/${timestamp}-${safeName}`;

  const arrayBuffer = await file.arrayBuffer();
  const contentHash = hashBuffer(arrayBuffer);
  console.log('[HWI DOCUMENT HASHED]', {
    sku_id: skuId,
    document_type: documentType,
    revision: normalizedRevision,
    content_hash: contentHash,
  });

  let extractedTextHash: string | null = null;
  if (extractedText && extractedText.trim().length > 0) {
    extractedTextHash = hashText(extractedText);
  }

  const { data: existingDocsRaw, error: existingError } = await supabase
    .from('sku_documents')
    .select('*')
    .eq('sku_id', skuId)
    .eq('document_type', documentType)
    .eq('revision', normalizedRevision)
    .order('uploaded_at', { ascending: false });

  if (existingError) {
    console.error('[HWI DOCUMENT LOOKUP] Failed', {
      sku_id: skuId,
      document_type: documentType,
      revision: normalizedRevision,
      error: existingError.message,
    });
    throw new Error(existingError.message);
  }

  const existingDocs = (existingDocsRaw ?? []) as SKUDocumentRecord[];

  const duplicateDoc = existingDocs.find((doc: SKUDocumentRecord) => doc.content_hash && doc.content_hash === contentHash);
  if (duplicateDoc) {
    console.log('[HWI DUPLICATE DOCUMENT]', {
      sku_id: skuId,
      document_type: documentType,
      revision: normalizedRevision,
    });
    return {
      status: 'duplicate',
      phantom_rev: false,
      message: 'Document already exists with identical content',
      document: duplicateDoc,
    };
  }

  const phantomRev = existingDocs.length > 0;
  const phantomNote = phantomRev
    ? 'Possible undocumented functional change: same revision, different content'
    : null;
  let diffSummary: DocumentDiffSummary | null = null;
  let comparedDocumentId: string | null = null;

  const { error: uploadError } = await supabase
    .storage
    .from(SKU_BUCKET)
    .upload(storagePath, arrayBuffer, {
      contentType: file.type || 'application/pdf',
      upsert: false,
    });

  if (uploadError) {
    console.error('[HWI DOCUMENT UPLOAD] Storage failed', {
      sku_id: skuId,
      document_type: documentType,
      error: uploadError.message,
    });
    throw new Error(uploadError.message);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(SKU_BUCKET).getPublicUrl(storagePath);

  await storeExtractedText(storagePath, extractedText);

  if (phantomRev) {
    const baselineDoc = existingDocs[0];
    if (baselineDoc && extractedText && extractedText.trim().length > 0) {
      const previousText = await loadExtractedText(baselineDoc.storage_path);
      if (previousText) {
        diffSummary = summarizeLineDiff(previousText, extractedText);
        comparedDocumentId = baselineDoc.id;
        // Trust model note: revision metadata is advisory. Content hashes detect differences, and this summary aids
        // reviewers in judging significance — final approval remains with human engineers.
        console.log('[HWI DOCUMENT DIFF BUILT]', {
          sku_id: skuId,
          document_type: documentType,
          revision: normalizedRevision,
          compared_to_document_id: comparedDocumentId,
          changed_line_count: diffSummary.changed_line_count,
          likely_functional_change: diffSummary.likely_functional_change,
        });
      } else {
        console.log('[HWI DOCUMENT DIFF SKIPPED]', {
          reason: 'missing_previous_text',
          sku_id: skuId,
          document_type: documentType,
          revision: normalizedRevision,
        });
      }
    } else {
      console.log('[HWI DOCUMENT DIFF SKIPPED]', {
        reason: 'missing_extracted_text',
        sku_id: skuId,
        document_type: documentType,
        revision: normalizedRevision,
      });
    }
  }

  const payload = {
    sku_id:        skuId,
    document_type: documentType,
    revision:      normalizedRevision,
    normalized_revision: normalizedRevision,
    file_url:      publicUrl,
    file_name:     file.name,
    storage_path:  storagePath,
    is_current:    true,
    content_hash:        contentHash,
    extracted_text_hash: extractedTextHash,
    phantom_rev_flag:    phantomRev,
    phantom_rev_note:    phantomNote,
    phantom_diff_summary: diffSummary,
    compared_to_document_id: comparedDocumentId,
    classification_status: 'PENDING' as DocumentClassificationStatus,
  };

  const { data, error } = await supabase
    .from('sku_documents')
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error('[HWI DOCUMENT PERSIST] Failed', { error: error.message, payload });
    throw new Error(error.message);
  }

  await supabase
    .from('sku')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', skuId);

  if (phantomRev) {
    console.warn('[HWI PHANTOM REV DETECTED]', {
      sku_id: skuId,
      document_type: documentType,
      revision: normalizedRevision,
      previous_document_id: existingDocs?.[0]?.id ?? null,
      new_document_id: data.id,
    });
  }

  const evaluationMap = await recomputeRevisionStates(skuId, documentType);
  const evaluation = evaluationMap.get((data as SKUDocumentRecord).id);
  const revisionState = evaluation?.state ?? 'UNKNOWN';
  const documentRecord: SKUDocumentRecord = {
    ...(data as SKUDocumentRecord),
    revision_state: revisionState,
    is_current: revisionState === 'CURRENT',
  };

  console.log('[HWI DOCUMENT UPLOADED]', {
    sku_id: skuId,
    document_type: documentType,
    revision: normalizedRevision,
    storage_path: payload.storage_path,
  });

  return {
    status: phantomRev ? 'phantom_rev' : 'uploaded',
    phantom_rev: phantomRev,
    message: phantomRev
      ? '⚠️ Possible Phantom Revision Detected — same revision, different content uploaded. Review for undocumented functional changes.'
      : 'Document uploaded and marked as current source of truth.',
    diff_summary: diffSummary,
    document: documentRecord,
  };
}

export async function getCurrentDocuments(skuId: string): Promise<SKUDocumentRecord[]> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from('sku_documents')
    .select('*')
    .eq('sku_id', skuId)
    .eq('is_current', true)
    .order('document_type', { ascending: true });

  if (error) {
    console.error('[HWI SKU DOCS] Failed to fetch current documents', { sku_id: skuId, error: error.message });
    throw new Error(error.message);
  }

  const records = data as SKUDocumentRecord[];
  console.log('[HWI CURRENT DOCS]', {
    sku_id: skuId,
    count: records.length,
    types: records.map(d => d.document_type),
    revisions: records.map(d => d.revision),
  });
  return attachRevisionStates(records);
}

export async function setCurrentDocument(documentId: string): Promise<SKUDocumentRecord | null> {
  const supabase = createSupabaseAdmin();
  const { data: doc, error: fetchError } = await supabase
    .from('sku_documents')
    .select('*')
    .eq('id', documentId)
    .single();

  if (fetchError) {
    console.error('[HWI DOC CURRENT] Failed to load document', { document_id: documentId, error: fetchError.message });
    throw new Error(fetchError.message);
  }

  await recomputeRevisionStates(doc.sku_id, doc.document_type as DocumentType);

  const { data, error } = await supabase
    .from('sku_documents')
    .select('*')
    .eq('id', documentId)
    .single();

  if (error) {
    console.error('[HWI DOC CURRENT] Failed to refresh document', { document_id: documentId, error: error.message });
    throw new Error(error.message);
  }

  return attachRevisionStates([data as SKUDocumentRecord])[0];
}

export async function getOrCreateSKUFromDocument(
  meta: DocumentMetadata,
): Promise<{ sku: SKURecord; created: boolean }> {
  const normalizedPN = meta.part_number.trim().toUpperCase();

  const existing = await getSKU(normalizedPN);
  if (existing) {
    console.log('[HWI SKU MATCHED]', {
      part_number: normalizedPN,
      sku_id: existing.sku.id,
      sourceType: meta.sourceType,
      revision: meta.revision ?? null,
    });
    return { sku: existing.sku, created: false };
  }

  const sku = await createSKU(normalizedPN, meta.description ?? undefined, meta.sourceType);
  console.log('[HWI SKU AUTO-CREATED]', {
    part_number: normalizedPN,
    sku_id: sku.id,
    sourceType: meta.sourceType,
    revision: meta.revision ?? null,
  });
  return { sku, created: true };
}

export async function updateSKUHeaderIfAllowed(
  skuId: string,
  currentCreatedFrom: DocumentType | null,
  incomingSource: DocumentType,
  updates: { description?: string | null },
): Promise<boolean> {
  const supabase = createSupabaseAdmin();
  const currentPriority = currentCreatedFrom ? (SOURCE_PRIORITY[currentCreatedFrom] ?? 0) : 0;
  const incomingPriority = SOURCE_PRIORITY[incomingSource] ?? 0;

  if (incomingPriority < currentPriority) {
    console.log('[HWI SKU HEADER SKIPPED]', {
      sku_id: skuId,
      reason: 'incoming_source_lower_priority',
      current: currentCreatedFrom,
      incoming: incomingSource,
    });
    return false;
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.description !== undefined && updates.description !== null) {
    patch.description = updates.description;
  }
  if (incomingPriority >= currentPriority && incomingSource !== 'UNKNOWN') {
    patch.created_from = incomingSource;
  }

  const { error } = await supabase.from('sku').update(patch).eq('id', skuId);
  if (error) {
    console.warn('[HWI SKU HEADER UPDATE FAILED]', { sku_id: skuId, error: error.message });
    return false;
  }

  console.log('[HWI SKU HEADER UPDATED]', {
    sku_id: skuId,
    incoming: incomingSource,
    fields: Object.keys(patch).filter(k => k !== 'updated_at'),
  });
  return true;
}

export async function ingestDocumentFirstFlow(
  meta: DocumentMetadata,
  file: File,
  extractedText?: string,
): Promise<DocumentFirstIngestResult> {
  const { sku, created } = await getOrCreateSKUFromDocument(meta);

  const headerUpdated = await updateSKUHeaderIfAllowed(
    sku.id,
    sku.created_from ?? null,
    meta.sourceType,
    { description: meta.description ?? null },
  );

  const uploadResult = await uploadDocument(
    sku.id,
    file,
    meta.sourceType,
    meta.revision ?? 'UNSPECIFIED',
    extractedText,
  );

  console.log('[HWI DOCUMENT-FIRST INGEST]', {
    part_number: meta.part_number,
    sku_id: sku.id,
    sourceType: meta.sourceType,
    revision: meta.revision ?? 'UNSPECIFIED',
    sku_created: created,
    header_updated: headerUpdated,
    upload_status: uploadResult.status,
  });

  return { sku, skuCreated: created, headerUpdated, uploadResult };
}
