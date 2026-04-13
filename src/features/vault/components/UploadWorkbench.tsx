'use client';

/**
 * Upload Workbench — Phase 3H.31 (ADMIN_BATCH_WORKBENCH mode)
 *
 * Full-screen overlay for admin batch uploads. Files are analyzed before commit;
 * no uncertain document enters the DB until all BLOCKING questions are resolved.
 *
 * Flow:  DROP → EXTRACT TEXT → ANALYZE (advisory) → OPERATOR REVIEW → COMMIT (verified)
 */

import React, { useCallback, useRef, useState, useMemo } from 'react';
import type {
  WorkbenchItem,
  WorkbenchItemStatus,
  IngestionAnalysisResult,
  UnresolvedQuestion,
} from '@/src/features/vault/types/ingestionReview';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface UploadWorkbenchProps {
  onClose: () => void;
  onCommitComplete?: () => void;
  /** Optional SKU pre-fill for corrective workflow context. */
  preselectedSku?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DOC_TYPE_LABELS: Record<string, string> = {
  BOM: 'BOM',
  CUSTOMER_DRAWING: 'Customer Drawing',
  INTERNAL_DRAWING: 'Internal Drawing',
  UNKNOWN: '—',
};

const STATUS_BADGE: Record<WorkbenchItemStatus, string> = {
  queued:          'bg-gray-100 text-gray-600',
  extracting:      'bg-amber-100 text-amber-800',
  analyzing:       'bg-blue-100 text-blue-700',
  ready_to_commit: 'bg-emerald-100 text-emerald-800',
  needs_review:    'bg-orange-100 text-orange-800',
  committing:      'bg-blue-100 text-blue-800',
  committed:       'bg-emerald-600 text-white',
  failed:          'bg-red-100 text-red-800',
};

const STATUS_LABEL: Record<WorkbenchItemStatus, string> = {
  queued:          'Queued',
  extracting:      'Extracting…',
  analyzing:       'Analyzing…',
  ready_to_commit: 'Ready',
  needs_review:    'Needs Review',
  committing:      'Committing…',
  committed:       'Committed',
  failed:          'Failed',
};

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCommitValues(item: WorkbenchItem): {
  documentType: string;
  partNumber: string;
  revision: string;
} {
  const a = item.analysis;
  return {
    documentType: item.confirmedDocumentType
      ?? (a?.proposedDocumentType !== 'UNKNOWN' ? (a?.proposedDocumentType ?? '') : ''),
    partNumber:   item.confirmedPartNumber   ?? (!a?.partNumberIsProvisional ? (a?.proposedPartNumber ?? '') : ''),
    revision:     item.confirmedRevision     ?? (a?.proposedRevision ?? ''),
  };
}

function isItemCommittable(item: WorkbenchItem): boolean {
  if (!item.analysis) return false;
  const { documentType, partNumber } = getCommitValues(item);
  if (!documentType || documentType === 'UNKNOWN') return false;
  if (!partNumber) return false;
  const blockingUnanswered = item.analysis.unresolvedQuestions.filter(q => {
    if (!q.blocksCommit) return false;
    const answer = item.answers[q.id];
    return !answer || !answer.trim();
  });
  return blockingUnanswered.length === 0;
}

// ---------------------------------------------------------------------------
// QuestionCard sub-component
// ---------------------------------------------------------------------------

function QuestionCard({
  question,
  answer,
  onAnswer,
}: {
  question: UnresolvedQuestion;
  answer: string;
  onAnswer: (value: string) => void;
}) {
  const isBlocking = question.blocksCommit;
  const resolved = Boolean(answer && answer.trim());

  return (
    <div className={`rounded-xl border p-3 space-y-2 ${isBlocking ? 'border-orange-200 bg-orange-50' : 'border-amber-100 bg-amber-50'}`}>
      <div className="flex items-start gap-2">
        <span className={`mt-0.5 shrink-0 text-xs font-bold rounded-full px-2 py-0.5 ${isBlocking ? 'bg-orange-200 text-orange-900' : 'bg-amber-200 text-amber-900'}`}>
          {isBlocking ? 'BLOCKING' : 'WARNING'}
        </span>
        <p className="text-sm text-gray-800">{question.promptText}</p>
        {resolved && <span className="ml-auto shrink-0 text-emerald-600 text-sm font-bold">✓</span>}
      </div>

      {question.fieldToResolve === 'documentType' && (
        <div className="flex flex-wrap gap-2">
          {(['BOM', 'CUSTOMER_DRAWING', 'INTERNAL_DRAWING'] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => onAnswer(t)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition ${
                answer === t
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
              }`}
            >
              {DOC_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      )}

      {(question.fieldToResolve === 'revision' || question.fieldToResolve === 'partNumber') && (
        <div className="flex gap-2">
          <input
            type="text"
            value={answer}
            onChange={e => onAnswer(e.target.value)}
            placeholder={question.fieldToResolve === 'revision' ? 'e.g. B, 02, Rev A' : 'e.g. NH45-110858-01'}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
          {question.suggestedValue && !answer && (
            <button
              type="button"
              onClick={() => onAnswer(question.suggestedValue!)}
              className="text-xs text-blue-600 underline whitespace-nowrap"
            >
              Use "{question.suggestedValue}"
            </button>
          )}
        </div>
      )}

      {question.suggestedValue && question.fieldToResolve !== 'revision' && question.fieldToResolve !== 'partNumber' && (
        <p className="text-xs text-gray-500">
          Suggested by extraction: <span className="font-semibold">{question.suggestedValue}</span>
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Evidence panel sub-component
// ---------------------------------------------------------------------------

function EvidencePanel({ evidence }: { evidence: IngestionAnalysisResult['extractionEvidence'] }) {
  const [open, setOpen] = useState(false);
  return (
    <details open={open} onToggle={e => setOpen((e.target as HTMLDetailsElement).open)}
      className="rounded-xl border border-gray-200 bg-gray-50 text-xs">
      <summary className="cursor-pointer px-3 py-2 font-semibold text-gray-600 select-none">
        Evidence Chain {open ? '▲' : '▼'}
      </summary>
      {open && (
        <div className="px-3 pb-3 space-y-1 text-gray-700">
          <div className="text-sky-600 font-semibold">
            Document class: {evidence.document_structure?.document_class_hint ?? '—'}
          </div>
          <div className="font-medium text-gray-500 mt-2">Revision signals</div>
          {evidence.revision_signals.length === 0
            ? <div className="text-gray-400">none detected</div>
            : evidence.revision_signals.map((s, i) => (
              <div key={i} className="ml-2">
                <span className="text-blue-600">{s.source}</span>:{' '}
                <span className="font-semibold">{s.value ?? 'null'}</span>{' '}
                <span className="text-gray-400">(conf {s.confidence.toFixed(2)})</span>
              </div>
            ))
          }
          <div className="font-medium text-gray-500 mt-2">Drawing number signals</div>
          {evidence.drawing_number_signals.length === 0
            ? <div className="text-gray-400">none detected</div>
            : evidence.drawing_number_signals.map((s, i) => (
              <div key={i} className="ml-2">
                <span className="text-blue-600">{s.source}</span>:{' '}
                <span className="font-semibold">{s.value ?? 'null'}</span>{' '}
                <span className="text-gray-400">(conf {s.confidence.toFixed(2)})</span>
              </div>
            ))
          }
          {evidence.document_structure && (
            <div className="mt-2 text-gray-500">
              Structure: title_block={String(evidence.document_structure.has_title_block)} ·
              connectors={String(evidence.document_structure.has_connector_tables)} ·
              wire_map={String(evidence.document_structure.has_wire_mapping)}
            </div>
          )}
          <div className="text-gray-400 mt-1">captured {evidence.captured_at}</div>
        </div>
      )}
    </details>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function UploadWorkbench({ onClose, onCommitComplete, preselectedSku }: UploadWorkbenchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems]         = useState<WorkbenchItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [filter, setFilter]       = useState<'all' | 'needs_review' | 'ready' | 'committed'>('all');

  const updateItem = useCallback((id: string, patch: Partial<WorkbenchItem>) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...patch } : item));
  }, []);

  const answerQuestion = useCallback((itemId: string, questionId: string, value: string) => {
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const answers = { ...item.answers, [questionId]: value };
      // Apply answer to confirmed fields automatically
      const question = item.analysis?.unresolvedQuestions.find(q => q.id === questionId);
      if (!question) return { ...item, answers };
      const patch: Partial<WorkbenchItem> = { answers };
      if (question.fieldToResolve === 'documentType' && value) {
        patch.confirmedDocumentType = value as WorkbenchItem['confirmedDocumentType'];
      }
      if (question.fieldToResolve === 'revision' && value) {
        patch.confirmedRevision = value;
      }
      if (question.fieldToResolve === 'partNumber' && value) {
        patch.confirmedPartNumber = value;
      }
      // Recompute status
      const updated = { ...item, ...patch };
      const committable = isItemCommittable(updated);
      const hasQuestions = (updated.analysis?.unresolvedQuestions.length ?? 0) > 0;
      patch.status = committable ? 'ready_to_commit' : (hasQuestions ? 'needs_review' : item.status);
      return { ...item, ...patch };
    }));
  }, []);

  const processFile = useCallback(async (id: string, file: File) => {
    updateItem(id, { status: 'extracting' });

    let extractedText: string | undefined;
    try {
      const { extractTextFromPDF } = await import('@/src/features/documentEngine/utils/pdfToText');
      extractedText = await extractTextFromPDF(file);
    } catch {
      updateItem(id, { status: 'failed', error: 'Failed to extract text from PDF.' });
      return;
    }

    updateItem(id, { status: 'analyzing', extractedText });

    try {
      const fd = new FormData();
      fd.append('file', file);
      if (extractedText) fd.append('extracted_text', extractedText);
      if (preselectedSku) fd.append('part_number_hint', preselectedSku);

      const res  = await fetch('/api/upload/analyze', { method: 'POST', body: fd });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        updateItem(id, { status: 'failed', error: json.error ?? 'Analysis failed.' });
        return;
      }

      const analysis: IngestionAnalysisResult = json.analysis;
      const status: WorkbenchItemStatus = analysis.readyToCommit ? 'ready_to_commit' : 'needs_review';

      updateItem(id, {
        analysis,
        status,
        confirmedDocumentType: analysis.proposedDocumentType !== 'UNKNOWN'
          ? (analysis.proposedDocumentType as WorkbenchItem['confirmedDocumentType'])
          : undefined,
        confirmedPartNumber: (!analysis.partNumberIsProvisional && analysis.proposedPartNumber)
          ? analysis.proposedPartNumber
          : preselectedSku ?? undefined,
        confirmedRevision: analysis.proposedRevision ?? undefined,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Analysis request failed.';
      updateItem(id, { status: 'failed', error: msg });
    }
  }, [preselectedSku, updateItem]);

  const queueFiles = useCallback((files: FileList | File[]) => {
    const selected = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.pdf'));
    if (selected.length === 0) return;
    const entries: WorkbenchItem[] = selected.map(file => ({
      id: crypto.randomUUID(),
      file,
      status: 'queued' as WorkbenchItemStatus,
      answers: {},
    }));
    setItems(prev => [...prev, ...entries]);
    entries.forEach(e => processFile(e.id, e.file));
    if (!selectedId && entries.length > 0) setSelectedId(entries[0].id);
  }, [processFile, selectedId]);

  const commitItem = useCallback(async (item: WorkbenchItem) => {
    if (!isItemCommittable(item)) return;
    const { documentType, partNumber, revision } = getCommitValues(item);
    updateItem(item.id, { status: 'committing' });

    try {
      const fd = new FormData();
      fd.append('file', item.file);
      if (item.extractedText) fd.append('extracted_text', item.extractedText);
      fd.append('confirmed_document_type', documentType);
      fd.append('confirmed_part_number', partNumber);
      if (revision) fd.append('confirmed_revision', revision);
      fd.append('confirmation_mode', 'ADMIN_CONFIRMED');

      const res  = await fetch('/api/upload/commit', { method: 'POST', body: fd });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        updateItem(item.id, { status: 'failed', error: json.error ?? 'Commit failed.' });
        return;
      }

      updateItem(item.id, {
        status: 'committed',
        confirmationMode: 'ADMIN_CONFIRMED',
        commitResult: { ok: true, sku: json.sku, message: json.message },
      });
      onCommitComplete?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Commit request failed.';
      updateItem(item.id, { status: 'failed', error: msg });
    }
  }, [onCommitComplete, updateItem]);

  const commitAllVerified = useCallback(async () => {
    const ready = items.filter(i => i.status === 'ready_to_commit' && isItemCommittable(i));
    for (const item of ready) {
      await commitItem(item);
    }
  }, [items, commitItem]);

  // --- Derived state ---
  const counts = useMemo(() => ({
    all:          items.length,
    needs_review: items.filter(i => i.status === 'needs_review').length,
    ready:        items.filter(i => i.status === 'ready_to_commit').length,
    committed:    items.filter(i => i.status === 'committed').length,
  }), [items]);

  const filteredItems = useMemo(() => {
    if (filter === 'all') return items;
    if (filter === 'needs_review') return items.filter(i => i.status === 'needs_review');
    if (filter === 'ready') return items.filter(i => i.status === 'ready_to_commit');
    if (filter === 'committed') return items.filter(i => i.status === 'committed');
    return items;
  }, [items, filter]);

  const selectedItem = items.find(i => i.id === selectedId) ?? null;
  const canCommitAll = counts.ready > 0;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b bg-gray-50 px-6 py-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <h2 className="text-lg font-bold text-gray-900 whitespace-nowrap">Upload Workbench</h2>
          <span className="text-gray-300">·</span>
          <p className="text-sm text-gray-500">Analyze → Review → Commit verified files only</p>
          {preselectedSku && (
            <span className="rounded-full bg-blue-50 px-3 py-0.5 text-xs font-semibold text-blue-700">
              SKU: {preselectedSku}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {counts.all > 0 && (
            <div className="flex gap-2 text-xs">
              <span className="rounded-full bg-orange-100 px-2 py-0.5 font-semibold text-orange-800">
                {counts.needs_review} review
              </span>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">
                {counts.ready} ready
              </span>
              <span className="rounded-full bg-gray-200 px-2 py-0.5 font-semibold text-gray-700">
                {counts.committed} committed
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-gray-100 px-4 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-200 transition"
          >
            ✕ Close
          </button>
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={e => { e.preventDefault(); setIsDragging(false); }}
        onDrop={e => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer?.files) queueFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`mx-6 mt-4 flex cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed py-6 transition shrink-0 ${
          isDragging ? 'border-blue-500 bg-blue-50/60' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
        }`}
      >
        <div className="text-center">
          <p className={`text-sm font-semibold ${isDragging ? 'text-blue-700' : 'text-gray-500'}`}>
            {isDragging ? 'Drop PDFs to queue for analysis…' : 'Drop PDFs here or click to browse'}
          </p>
          <p className="mt-0.5 text-xs text-gray-400">Files will be analyzed before any DB write</p>
        </div>
        <input ref={inputRef} type="file" multiple accept=".pdf" className="hidden"
          onChange={e => { if (e.target.files) { queueFiles(e.target.files); e.target.value = ''; } }} />
      </div>

      {/* Body */}
      {items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-gray-400 text-sm">
          No files queued yet. Drop PDFs above to start.
        </div>
      ) : (
        <div className="flex flex-1 min-h-0 gap-0">
          {/* Left: queue list */}
          <div className="flex flex-col w-[55%] min-w-0 border-r">
            {/* Filter tabs */}
            <div className="flex gap-1 border-b px-4 py-2 shrink-0">
              {(['all', 'needs_review', 'ready', 'committed'] as const).map(tab => (
                <button key={tab} type="button" onClick={() => setFilter(tab)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    filter === tab ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {tab === 'all' ? `All (${counts.all})`
                    : tab === 'needs_review' ? `Needs Review (${counts.needs_review})`
                    : tab === 'ready' ? `Ready (${counts.ready})`
                    : `Committed (${counts.committed})`}
                </button>
              ))}
            </div>

            {/* File list */}
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold">File</th>
                    <th className="px-3 py-2 text-left font-semibold">Type</th>
                    <th className="px-3 py-2 text-left font-semibold">Rev</th>
                    <th className="px-3 py-2 text-left font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map(item => {
                    const vals = getCommitValues(item);
                    const isSelected = item.id === selectedId;
                    return (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedId(item.id)}
                        className={`border-b cursor-pointer transition ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                      >
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-gray-900 truncate max-w-[220px]" title={item.file.name}>
                            {item.file.name}
                          </p>
                          <p className="text-xs text-gray-400">{formatBytes(item.file.size)}</p>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-700 whitespace-nowrap">
                          {vals.documentType ? DOC_TYPE_LABELS[vals.documentType] ?? vals.documentType : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-xs font-mono text-gray-700">
                          {vals.revision || '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[item.status]}`}>
                            {STATUS_LABEL[item.status]}
                          </span>
                          {item.error && (
                            <p className="text-xs text-red-600 mt-0.5 truncate max-w-[120px]" title={item.error}>
                              {item.error}
                            </p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right: detail panel */}
          <div className="flex flex-col w-[45%] min-w-0 overflow-y-auto">
            {!selectedItem ? (
              <div className="flex flex-1 items-center justify-center text-gray-400 text-sm p-8">
                Select a file to review
              </div>
            ) : (
              <div className="p-5 space-y-4">
                <div>
                  <p className="text-base font-bold text-gray-900 truncate">{selectedItem.file.name}</p>
                  <p className="text-xs text-gray-400">{formatBytes(selectedItem.file.size)}</p>
                </div>

                {/* Proposed values summary (read-only from analysis) */}
                {selectedItem.analysis && (
                  <div className="rounded-xl bg-gray-50 border px-4 py-3 space-y-2 text-sm">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Suggested by extraction
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-xs text-gray-400">Document type</p>
                        <p className="font-semibold text-gray-800">
                          {DOC_TYPE_LABELS[selectedItem.analysis.proposedDocumentType]}
                          <span className="ml-1 text-xs font-normal text-gray-400">
                            ({Math.round(selectedItem.analysis.docTypeConfidence * 100)}%)
                          </span>
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Revision</p>
                        <p className="font-semibold font-mono text-gray-800">
                          {selectedItem.analysis.proposedRevision ?? '—'}
                          {selectedItem.analysis.proposedRevision && (
                            <span className="ml-1 text-xs font-normal font-sans text-gray-400">
                              ({Math.round(selectedItem.analysis.revisionConfidence * 100)}%)
                            </span>
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Part number</p>
                        <p className={`font-semibold font-mono text-sm ${selectedItem.analysis.partNumberIsProvisional ? 'text-orange-600' : 'text-gray-800'}`}>
                          {selectedItem.analysis.proposedPartNumber ?? '—'}
                          {selectedItem.analysis.partNumberIsProvisional && (
                            <span className="ml-1 text-xs font-normal font-sans text-orange-500">unresolved</span>
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Drawing number</p>
                        <p className="font-semibold font-mono text-gray-800">{selectedItem.analysis.proposedDrawingNumber ?? '—'}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Questions queue */}
                {(selectedItem.analysis?.unresolvedQuestions.length ?? 0) > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Resolution required
                    </p>
                    {selectedItem.analysis!.unresolvedQuestions.map(q => (
                      <QuestionCard
                        key={q.id}
                        question={q}
                        answer={selectedItem.answers[q.id] ?? ''}
                        onAnswer={value => answerQuestion(selectedItem.id, q.id, value)}
                      />
                    ))}
                  </div>
                )}

                {/* Evidence chain */}
                {selectedItem.analysis?.extractionEvidence && (
                  <EvidencePanel evidence={selectedItem.analysis.extractionEvidence} />
                )}

                {/* Per-file commit button (for targeted commit) */}
                {selectedItem.status === 'ready_to_commit' && (
                  <button
                    type="button"
                    onClick={() => commitItem(selectedItem)}
                    className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition"
                  >
                    Commit This File
                  </button>
                )}

                {selectedItem.status === 'committed' && selectedItem.commitResult && (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
                    <p className="font-semibold">Committed</p>
                    <p className="text-xs mt-0.5">SKU: {selectedItem.commitResult.sku?.part_number ?? '—'}</p>
                    {selectedItem.commitResult.message && (
                      <p className="text-xs mt-0.5 text-emerald-600">{selectedItem.commitResult.message}</p>
                    )}
                  </div>
                )}

                {selectedItem.status === 'failed' && selectedItem.error && (
                  <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
                    <p className="font-semibold">Failed</p>
                    <p className="text-xs mt-0.5">{selectedItem.error}</p>
                    <button
                      type="button"
                      onClick={() => { updateItem(selectedItem.id, { status: 'queued', error: undefined }); processFile(selectedItem.id, selectedItem.file); }}
                      className="mt-2 text-xs font-semibold text-red-700 underline"
                    >
                      Retry Analysis
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom commit bar */}
      {items.length > 0 && (
        <div className="border-t bg-gray-50 px-6 py-3 flex items-center justify-between shrink-0">
          <p className="text-xs text-gray-500">
            {counts.ready} file{counts.ready !== 1 ? 's' : ''} ready to commit ·{' '}
            {counts.needs_review} need{counts.needs_review !== 1 ? '' : 's'} review ·{' '}
            {counts.committed} committed
          </p>
          <button
            type="button"
            onClick={commitAllVerified}
            disabled={!canCommitAll}
            className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            Commit All Verified ({counts.ready})
          </button>
        </div>
      )}
    </div>
  );
}
