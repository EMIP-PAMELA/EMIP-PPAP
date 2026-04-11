'use client';

import React, { useCallback, useRef, useState } from 'react';

interface VaultUploaderProps {
  preselectedSku?: string;
}

type UploadStatus =
  | 'pending'
  | 'extracting'
  | 'uploading'
  | 'awaiting_part_number'
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
  uploading: 'bg-blue-100 text-blue-800',
  awaiting_part_number: 'bg-amber-100 text-amber-900',
  success: 'bg-emerald-100 text-emerald-800',
  error: 'bg-red-100 text-red-800',
};

export default function VaultUploader({ preselectedSku }: VaultUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const updateItem = useCallback((id: string, patch: Partial<UploadQueueItem>) => {
    setQueue(prev => prev.map(item => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const uploadWithMetadata = useCallback(
    async (itemId: string, file: File, extractedText: string, overridePN?: string) => {
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
      if (overridePN && overridePN.trim()) {
        fd.append('part_number_override', overridePN.trim());
      }

      try {
        const res = await fetch('/api/upload/document', { method: 'POST', body: fd });
        const json = await res.json();

        if (json.needs_manual_part_number) {
          updateItem(itemId, {
            status: 'awaiting_part_number',
            message: 'Manual part number required to continue.',
            partNumberInput: overridePN ?? preselectedSku ?? '',
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
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Upload failed';
        updateItem(itemId, { status: 'error', error: errorMessage, message: undefined });
      }
    },
    [preselectedSku, updateItem],
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
        updateItem(itemId, { extractedText });
        await uploadWithMetadata(itemId, file, extractedText);
      } catch (err) {
        console.error('[VaultUploader] extraction failed', err);
        updateItem(itemId, {
          status: 'error',
          error: 'Unable to extract text from this file. Please upload a valid PDF.',
          message: undefined,
        });
      }
    },
    [updateItem, uploadWithMetadata],
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

  const handleManualSubmit = async (item: UploadQueueItem) => {
    if (!item.file || !item.extractedText || !item.partNumberInput?.trim()) return;
    await uploadWithMetadata(item.id, item.file, item.extractedText, item.partNumberInput.trim());
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
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
          className={`rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
            isDragging ? 'border-blue-500 bg-blue-50/60 text-blue-700' : 'border-gray-300 text-gray-500'
          }`}
        >
          <div className="space-y-3">
            <p className="text-sm font-medium">Drag & drop documents here</p>
            <p className="text-xs text-gray-400">
              PDFs preferred. The vault automatically detects BOMs vs drawings and routes them through the pipeline.
            </p>
            <div className="flex justify-center">
              <button
                type="button"
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                onClick={() => inputRef.current?.click()}
              >
                Select Files
              </button>
            </div>
            {preselectedSku && (
              <p className="text-xs text-blue-700">
                Tagged to SKU <span className="font-semibold">{preselectedSku}</span>
              </p>
            )}
          </div>
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
        <p className="text-xs text-gray-500">
          All uploads are persisted even if the system cannot immediately classify them. Missing part numbers will prompt a
          manual entry per file.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">Upload Queue</h3>
          <span className="text-xs text-gray-500">{queue.length} file{queue.length === 1 ? '' : 's'}</span>
        </div>

        {queue.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">
            No files uploaded yet.
          </div>
        ) : (
          <ul className="space-y-3">
            {queue.map(item => (
              <li key={item.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
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
        )}
      </div>
    </div>
  );
}
