'use client';

import React, { useCallback, useRef, useState } from 'react';
import type { ActionIntent } from '@/src/features/revision/hooks/useRecommendedFixActions';
import type { DocumentType } from '@/src/features/harness-work-instructions/services/skuService';
import type { RevisionValidationAuditMetadata, RevisionValidationSource } from '@/src/types/revisionValidation';
import { detectDocumentType } from '@/src/features/vault/utils/documentSignals';
import { extractEngineeringMasterRevision } from '@/src/utils/extractEngineeringMasterRevision';
import { extractRheemDrawingRevision } from '@/src/utils/extractRheemDrawingRevision';
import { extractApogeeDrawingRevision } from '@/src/utils/extractApogeeDrawingRevision';
import { extractRevisionSignal } from '@/src/utils/revisionParser';
import { compareRevisions } from '@/src/utils/revisionComparator';
import type { RevisionComparisonResult } from '@/src/utils/revisionComparator';
import UploadValidationBanner, { type UploadRevisionValidation } from './UploadValidationBanner';

interface VaultUploaderProps {
  preselectedSku?: string;
  docTypeHint?: string | null;
  expectedRevisionHint?: string | null;
  actionIntent?: ActionIntent | null;
  canonicalSourceHint?: string | null;
  onUploadComplete?: () => void;
}

type UploadStatus =
  | 'pending'
  | 'extracting'
  | 'ready_to_upload'
  | 'uploading'
  | 'awaiting_part_number'
  | 'awaiting_override'
  | 'needs_confirmation'
  | 'success'
  | 'error';

interface VaultUploadResult {
  classification?: string;
  documentType?: string;
  documentStatus?: 'CURRENT' | 'OBSOLETE' | 'UNKNOWN';
  sku?: { id: string; part_number: string };
  revision?: string;
  pipelineStatus?: 'READY' | 'PARTIAL';
  message?: string;
}

interface UploadQueueItem {
  id: string;
  file: File;
  fileName: string;
  size: number;
  status: UploadStatus;
  error?: string;
  message?: string;
  extractedText?: string;
  partNumberInput?: string;
  result?: VaultUploadResult;
  validation?: UploadRevisionValidation;
  overrideAccepted?: boolean;
  validationAudit?: RevisionValidationAuditMetadata;
  /** Phase 3H.31: values suggested by extraction — shown in confirmation UI. */
  proposedDocType?: DocumentType;
  proposedRevision?: string | null;
  /** Phase 3H.31: values confirmed by operator before operational commit. */
  confirmedDocType?: DocumentType;
  confirmedRevision?: string;
}

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes)) return '—';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

const statusStyles: Record<UploadStatus, string> = {
  pending: 'bg-gray-100 text-gray-600',
  extracting: 'bg-amber-100 text-amber-800',
  ready_to_upload: 'bg-blue-50 text-blue-700',
  uploading: 'bg-blue-100 text-blue-800',
  awaiting_part_number: 'bg-amber-100 text-amber-900',
  awaiting_override: 'bg-red-100 text-red-800',
  needs_confirmation: 'bg-orange-100 text-orange-900',
  success: 'bg-emerald-100 text-emerald-800',
  error: 'bg-red-100 text-red-800',
};

type ValidationExtractionResult = {
  revision: string | null;
  source: RevisionValidationSource;
};

const mapComparisonForPersistence = (comparison: RevisionComparisonResult | 'NO_EXPECTED'): RevisionComparisonResult => {
  if (comparison === 'NO_EXPECTED') return 'UNKNOWN';
  return comparison ?? 'UNKNOWN';
};

const createValidationAuditMetadata = (
  validation: UploadRevisionValidation,
  overrideUsed = false,
): RevisionValidationAuditMetadata => ({
  uploaded_revision: validation.extractedRevision ?? null,
  expected_revision: validation.expectedRevision ?? null,
  revision_comparison: mapComparisonForPersistence(validation.comparison),
  revision_validation_source: validation.validationSource ?? 'UNKNOWN',
  revision_override_used: overrideUsed,
  revision_validated_at: validation.validatedAt ?? new Date().toISOString(),
});

export default function VaultUploader({ preselectedSku, docTypeHint, expectedRevisionHint, actionIntent, canonicalSourceHint, onUploadComplete }: VaultUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const updateItem = useCallback((id: string, patch: Partial<UploadQueueItem>) => {
    setQueue(prev => prev.map(item => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const uploadWithMetadata = useCallback(
    async (
      itemId: string,
      file: File,
      extractedText: string,
      options?: { overridePN?: string; validationAudit?: RevisionValidationAuditMetadata },
    ) => {
      updateItem(itemId, {
        status: 'uploading',
        error: undefined,
        message: 'Routing through ingestion pipeline…',
      });

      const fd = new FormData();
      fd.append('file', file);
      fd.append('extracted_text', extractedText);
      if (preselectedSku) {
        fd.append('sku_part_number', preselectedSku);
      }
      if (options?.overridePN && options.overridePN.trim()) {
        fd.append('part_number_override', options.overridePN.trim());
      }
      if (options?.validationAudit) {
        fd.append('validation_context', JSON.stringify(options.validationAudit));
      }

      try {
        const res = await fetch('/api/upload/document', { method: 'POST', body: fd });
        const json = await res.json();

        if (json.needs_manual_part_number) {
          updateItem(itemId, {
            status: 'awaiting_part_number',
            message: 'Manual part number required to continue.',
            partNumberInput: options?.overridePN ?? preselectedSku ?? '',
          });
          return;
        }

        if (!res.ok || !json.ok) {
          updateItem(itemId, {
            status: 'error',
            error: json.error ?? 'Upload failed',
            message: undefined,
          });
          return;
        }

        updateItem(itemId, {
          status: 'success',
          message: json.message ?? 'Document ingested successfully.',
          result: {
            classification: json.classification,
            documentType: json.document_type,
            documentStatus: json.document_status,
            sku: json.sku,
            revision: json.document?.revision,
            pipelineStatus: json.pipeline_status,
            message: json.uploadResult?.message ?? json.message,
          },
        });
        onUploadComplete?.();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Upload failed';
        updateItem(itemId, { status: 'error', error: errorMessage, message: undefined });
      }
    },
    [preselectedSku, updateItem],
  );

  const determineDocumentType = useCallback(
    (text: string, fileName: string): DocumentType => {
      if (docTypeHint && docTypeHint !== 'UNKNOWN') {
        return docTypeHint as DocumentType;
      }
      const classification = detectDocumentType(text, fileName);
      return classification.detected;
    },
    [docTypeHint],
  );

  const extractRevisionForDoc = useCallback(
    (docType: DocumentType, text: string, fileName: string): ValidationExtractionResult => {
      // Structured extractors only run when text is available
      if (text && text.trim().length > 0) {
        if (docType === 'BOM') {
          const result = extractEngineeringMasterRevision(text);
          return { revision: result.revision, source: 'BOM' };
        }

        if (docType === 'CUSTOMER_DRAWING') {
          const result = extractRheemDrawingRevision(text);
          if (result.isRheemTitleBlock) {
            return { revision: result.revision, source: 'RHEEM' };
          }
        }

        if (docType === 'INTERNAL_DRAWING') {
          const result = extractApogeeDrawingRevision(text);
          if (result.isApogeeDrawing) {
            return { revision: result.revision, source: 'APOGEE' };
          }
        }
      }

      // Generic fallback always runs — includes filename-based extraction when text is absent
      // so that the client validation banner matches what the server will persist.
      const generic = extractRevisionSignal({ extractedText: text || null, fileName });
      return { revision: generic.normalized, source: generic.normalized ? 'GENERIC' : 'UNKNOWN' };
    },
    [],
  );

  const buildValidation = useCallback(
    (docType: DocumentType, extraction: ValidationExtractionResult, capturedAt: string): UploadRevisionValidation => {
      const { revision: extractedRevision, source } = extraction;
      if (!expectedRevisionHint) {
        return {
          state: 'unavailable',
          comparison: 'NO_EXPECTED',
          extractedRevision,
          expectedRevision: null,
          message: 'No revision detected in document (likely missing text layer or unsupported format).',
          requiresOverride: false,
          docType,
          canonicalSource: canonicalSourceHint ?? undefined,
          validationSource: source,
          validatedAt: capturedAt,
        };
      }

      if (!extractedRevision) {
        return {
          state: 'unknown',
          comparison: 'UNKNOWN',
          extractedRevision,
          expectedRevision: expectedRevisionHint,
          message: 'Unable to detect revision from this document.',
          requiresOverride: false,
          docType,
          canonicalSource: canonicalSourceHint ?? undefined,
          validationSource: source,
          validatedAt: capturedAt,
        };
      }

      const comparison = compareRevisions(extractedRevision, expectedRevisionHint);

      if (comparison === 'EQUAL') {
        return {
          state: 'matching',
          comparison,
          extractedRevision,
          expectedRevision: expectedRevisionHint,
          message: 'Revision matches expected canonical value.',
          requiresOverride: false,
          docType,
          canonicalSource: canonicalSourceHint ?? undefined,
          validationSource: source,
          validatedAt: capturedAt,
        };
      }

      if (comparison === 'LESS') {
        return {
          state: 'warning',
          comparison,
          extractedRevision,
          expectedRevision: expectedRevisionHint,
          message: `Uploaded revision (${extractedRevision}) is older than expected (${expectedRevisionHint}). Consider updating before proceeding.`,
          requiresOverride: false,
          docType,
          canonicalSource: canonicalSourceHint ?? undefined,
          validationSource: source,
          validatedAt: capturedAt,
        };
      }

      if (comparison === 'GREATER') {
        return {
          state: 'conflict',
          comparison,
          extractedRevision,
          expectedRevision: expectedRevisionHint,
          message: `Uploaded revision (${extractedRevision}) is newer than canonical (${expectedRevisionHint}). Verify upstream documents before continuing.`,
          requiresOverride: true,
          docType,
          canonicalSource: canonicalSourceHint ?? undefined,
          validationSource: source,
          validatedAt: capturedAt,
        };
      }

      if (comparison === 'INCOMPARABLE') {
        return {
          state: 'conflict',
          comparison,
          extractedRevision,
          expectedRevision: expectedRevisionHint,
          message: 'Revision format differs from canonical value. Manual review recommended before continuing.',
          requiresOverride: true,
          docType,
          canonicalSource: canonicalSourceHint ?? undefined,
          validationSource: source,
          validatedAt: capturedAt,
        };
      }

      return {
        state: 'unknown',
        comparison,
        extractedRevision,
        expectedRevision: expectedRevisionHint,
        message: 'Revision comparison could not be determined.',
        requiresOverride: false,
        docType,
        canonicalSource: canonicalSourceHint ?? undefined,
        validationSource: source,
        validatedAt: capturedAt,
      };
    },
    [canonicalSourceHint, expectedRevisionHint],
  );

  const processFile = useCallback(
    async (itemId: string, file: File) => {
      updateItem(itemId, {
        status: 'extracting',
        message: 'Extracting text from document…',
        error: undefined,
      });

      try {
        const { extractTextFromPDF } = await import('@/src/features/documentEngine/utils/pdfToText');
        const extractedText = await extractTextFromPDF(file);
        const docType = determineDocumentType(extractedText, file.name);
        const extraction = extractRevisionForDoc(docType, extractedText, file.name);
        const capturedAt = new Date().toISOString();
        const validation = buildValidation(docType, extraction, capturedAt);
        const validationAudit = createValidationAuditMetadata(validation, false);

        // Phase 3H.31: Gate uncertain files — do NOT auto-commit UNKNOWN type or missing revision.
        const docTypeUncertain = docType === 'UNKNOWN';
        const revisionMissing  = !extraction.revision;
        const needsConfirmation = docTypeUncertain || revisionMissing;

        if (needsConfirmation) {
          updateItem(itemId, {
            extractedText,
            validation,
            validationAudit,
            status: 'needs_confirmation',
            message: docTypeUncertain
              ? 'Document type could not be determined. Confirm before uploading.'
              : 'Revision could not be extracted. Enter it before uploading.',
            proposedDocType: docType !== 'UNKNOWN' ? docType : undefined,
            proposedRevision: extraction.revision ?? null,
          });
          return;
        }

        updateItem(itemId, {
          extractedText,
          validation,
          validationAudit,
          status: validation.requiresOverride ? 'awaiting_override' : 'ready_to_upload',
          message: validation.message,
        });

        if (!validation.requiresOverride) {
          await uploadWithMetadata(itemId, file, extractedText, { validationAudit });
        }
      } catch (err) {
        console.error('[VaultUploader] extraction failed', err);
        updateItem(itemId, {
          status: 'error',
          error: 'Unable to extract text from this file. Please upload a valid PDF.',
          message: undefined,
        });
      }
    },
    [buildValidation, determineDocumentType, extractRevisionForDoc, updateItem, uploadWithMetadata],
  );

  const queueFiles = useCallback(
    (files: FileList | File[]) => {
      const selected = Array.from(files);
      if (selected.length === 0) return;

      const entries = selected.map(file => ({
        id: crypto.randomUUID(),
        file,
        fileName: file.name,
        size: file.size,
        status: 'pending' as UploadStatus,
      }));

      setQueue(prev => [...entries, ...prev]);
      entries.forEach(entry => processFile(entry.id, entry.file));
    },
    [processFile],
  );

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    if (event.dataTransfer?.files) {
      queueFiles(event.dataTransfer.files);
    }
  };

  const resolveValidationAudit = (item: UploadQueueItem, overrideUsed: boolean): RevisionValidationAuditMetadata | undefined => {
    if (item.validation) {
      return createValidationAuditMetadata(item.validation, overrideUsed);
    }
    if (item.validationAudit) {
      if (overrideUsed && item.validationAudit.revision_override_used !== true) {
        return { ...item.validationAudit, revision_override_used: true };
      }
      return item.validationAudit;
    }
    return undefined;
  };

  const handleManualSubmit = async (item: UploadQueueItem) => {
    if (!item.file || !item.extractedText || !item.partNumberInput?.trim()) return;
    const overridePN = item.partNumberInput.trim();
    const validationAudit = resolveValidationAudit(item, Boolean(item.validation?.requiresOverride && item.overrideAccepted));
    await uploadWithMetadata(item.id, item.file, item.extractedText, {
      overridePN,
      validationAudit,
    });
  };

  const handleOperationalConfirm = async (item: UploadQueueItem) => {
    if (!item.file || !item.extractedText) return;
    const docType = item.confirmedDocType ?? item.proposedDocType;
    if (!docType || docType === 'UNKNOWN') return;
    const overridePN = item.partNumberInput?.trim() || preselectedSku || undefined;
    if (!overridePN) {
      updateItem(item.id, { status: 'awaiting_part_number', message: 'Part number required to continue.' });
      return;
    }
    updateItem(item.id, { status: 'uploading', message: 'Committing verified document…' });
    const fd = new FormData();
    fd.append('file', item.file);
    fd.append('extracted_text', item.extractedText);
    fd.append('confirmed_document_type', docType);
    fd.append('confirmed_part_number', overridePN);
    if (item.confirmedRevision) fd.append('confirmed_revision', item.confirmedRevision);
    fd.append('confirmation_mode', 'USER_CONFIRMED');
    const validationAudit = resolveValidationAudit(item, false);
    if (validationAudit) fd.append('validation_context', JSON.stringify(validationAudit));
    try {
      const res  = await fetch('/api/upload/commit', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        updateItem(item.id, { status: 'error', error: json.error ?? 'Commit failed' });
        return;
      }
      updateItem(item.id, {
        status: 'success',
        message: json.message ?? 'Document committed.',
        result: { documentType: json.document_type, sku: json.sku, revision: json.document?.revision, message: json.message },
      });
      onUploadComplete?.();
    } catch (err) {
      updateItem(item.id, { status: 'error', error: err instanceof Error ? err.message : 'Commit failed' });
    }
  };

  const handleOverrideConfirm = async (item: UploadQueueItem) => {
    if (!item.file || !item.extractedText || !item.validation) return;
    const validationAudit = resolveValidationAudit(item, true);
    updateItem(item.id, { validationAudit });
    await uploadWithMetadata(item.id, item.file, item.extractedText, {
      overridePN: item.partNumberInput?.trim(),
      validationAudit,
    });
  };

  const contextChips: string[] = [];
  if (preselectedSku) contextChips.push(`SKU ${preselectedSku}`);
  if (docTypeHint) contextChips.push(docTypeHint.replace('_', ' '));
  if (expectedRevisionHint) contextChips.push(`Expected REV ${expectedRevisionHint}`);
  if (actionIntent === 'UPLOAD_MISSING_DOC') contextChips.push('Upload focus');

  return (
    <div className="space-y-2">
      <div
        onDragOver={event => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={event => {
          event.preventDefault();
          setIsDragging(false);
        }}
        onDrop={handleDrop}
        className={`flex items-center justify-between gap-4 rounded-xl border-2 border-dashed px-4 py-3 transition ${
          isDragging ? 'border-blue-500 bg-blue-50/60' : 'border-gray-300'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className={`text-sm font-medium ${isDragging ? 'text-blue-700' : 'text-gray-500'}`}>
            {isDragging ? 'Drop files to upload…' : 'Drag & drop PDFs here'}
          </span>
          {preselectedSku && (
            <span className="text-xs text-blue-600">
              → SKU <span className="font-semibold">{preselectedSku}</span>
            </span>
          )}
        </div>
        <button
          type="button"
          className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition"
          onClick={() => inputRef.current?.click()}
        >
          Select Files
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf"
          className="hidden"
          onChange={event => {
            if (event.target.files) {
              queueFiles(event.target.files);
              event.target.value = '';
            }
          }}
        />
      </div>

      {contextChips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] font-semibold text-blue-800">
          <span className="uppercase tracking-wide text-[10px] text-blue-500">Prefilled:</span>
          {contextChips.map(chip => (
            <span key={chip} className="rounded-full bg-white/70 px-2 py-0.5">
              {chip}
            </span>
          ))}
        </div>
      )}

      {queue.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Upload Queue</p>
            <span className="text-xs text-gray-400">{queue.length} file{queue.length === 1 ? '' : 's'}</span>
          </div>
          <ul className="space-y-1.5">
            {queue.map(item => (
              <li key={item.id} className="rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex-1 min-w-[200px]">
                    <p className="text-sm font-semibold text-gray-900">{item.fileName}</p>
                    <p className="text-xs text-gray-500">{formatBytes(item.size)}</p>
                  </div>
                  <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${statusStyles[item.status]}`}>
                    {item.status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>

                {item.message && item.status !== 'error' && (
                  <p className="mt-2 text-xs text-gray-500">{item.message}</p>
                )}
                {item.error && (
                  <p className="mt-2 text-xs text-red-600 font-semibold">{item.error}</p>
                )}

                {item.validation && (
                  <div className="mt-2">
                    <UploadValidationBanner
                      validation={item.validation}
                      overrideAccepted={item.overrideAccepted}
                      onOverrideToggle={checked => updateItem(item.id, { overrideAccepted: checked })}
                      onOverrideConfirm={() => handleOverrideConfirm(item)}
                      disabled={item.status === 'uploading'}
                    />
                  </div>
                )}

                {item.status === 'needs_confirmation' && (
                  <div className="mt-3 rounded-xl border border-orange-200 bg-orange-50 p-3 space-y-3">
                    <p className="text-xs font-semibold text-orange-900">
                      Manual confirmation required before upload
                    </p>
                    {/* Doc type selector */}
                    <div className="space-y-1">
                      <p className="text-xs text-orange-800 font-medium">Document type</p>
                      <div className="flex flex-wrap gap-2">
                        {(['BOM', 'CUSTOMER_DRAWING', 'INTERNAL_DRAWING'] as const).map(t => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => updateItem(item.id, { confirmedDocType: t })}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition ${
                              (item.confirmedDocType ?? item.proposedDocType) === t
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                            }`}
                          >
                            {t === 'BOM' ? 'BOM' : t === 'CUSTOMER_DRAWING' ? 'Customer Drawing' : 'Internal Drawing'}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Revision input */}
                    <div className="space-y-1">
                      <p className="text-xs text-orange-800 font-medium">Revision</p>
                      <input
                        type="text"
                        value={item.confirmedRevision ?? item.proposedRevision ?? ''}
                        onChange={e => updateItem(item.id, { confirmedRevision: e.target.value })}
                        placeholder="e.g. B, 02, Rev A"
                        className="w-full rounded-lg border border-orange-200 px-3 py-2 text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                      />
                    </div>
                    {/* Part number (required if no preselectedSku) */}
                    {!preselectedSku && (
                      <div className="space-y-1">
                        <p className="text-xs text-orange-800 font-medium">Part number</p>
                        <input
                          type="text"
                          value={item.partNumberInput ?? ''}
                          onChange={e => updateItem(item.id, { partNumberInput: e.target.value })}
                          placeholder="e.g. NH45-110858-01"
                          className="w-full rounded-lg border border-orange-200 px-3 py-2 text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                        />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => handleOperationalConfirm(item)}
                      disabled={!(item.confirmedDocType ?? item.proposedDocType) || (item.confirmedDocType ?? item.proposedDocType) === 'UNKNOWN'}
                      className="rounded-lg bg-orange-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 hover:bg-orange-800 transition"
                    >
                      Confirm &amp; Upload
                    </button>
                  </div>
                )}

                {item.status === 'awaiting_part_number' && (
                  <div className="mt-3 rounded-xl bg-amber-50 p-3 space-y-2">
                    <p className="text-xs font-semibold text-amber-800">
                      Unable to derive part number automatically. Provide it to continue.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="text"
                        value={item.partNumberInput ?? ''}
                        onChange={event => updateItem(item.id, { partNumberInput: event.target.value })}
                        placeholder="e.g. NH45-110858-01"
                        className="flex-1 min-w-[180px] rounded-lg border border-amber-200 px-3 py-2 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                      />
                      <button
                        type="button"
                        onClick={() => handleManualSubmit(item)}
                        disabled={!item.partNumberInput?.trim()}
                        className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        Continue Upload
                      </button>
                    </div>
                  </div>
                )}

                {item.status === 'success' && item.result && (
                  <div className="mt-3 grid gap-3 md:grid-cols-3 text-sm">
                    <div className="rounded-xl bg-gray-50 px-3 py-2">
                      <p className="text-[10px] uppercase text-gray-400">Classification</p>
                      <p className="font-semibold text-gray-800">
                        {item.result.documentType ?? '—'}
                        {item.result.classification && item.result.classification !== item.result.documentType && (
                          <span className="text-xs text-gray-500"> · {item.result.classification}</span>
                        )}
                      </p>
                    </div>
                    <div className="rounded-xl bg-gray-50 px-3 py-2">
                      <p className="text-[10px] uppercase text-gray-400">Part Number</p>
                      <p className="font-semibold text-gray-800">{item.result.sku?.part_number ?? '—'}</p>
                    </div>
                    <div className="rounded-xl bg-gray-50 px-3 py-2">
                      <p className="text-[10px] uppercase text-gray-400">Document Status</p>
                      <p className="font-semibold text-gray-800">{item.result.documentStatus ?? 'CURRENT'}</p>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
