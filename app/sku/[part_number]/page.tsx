'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import EMIPLayout from '../../layout/EMIPLayout';
import type {
  SKURecord,
  SKUDocumentRecord,
} from '@/src/features/harness-work-instructions/services/skuService';
import type { DocumentDiffSummary } from '@/src/features/harness-work-instructions/utils/documentDiff';
import { fuseDrawingWithBOM } from '@/src/features/harness-work-instructions/services/drawingFusionService';
import { resolveEndpoints } from '@/src/features/harness-work-instructions/services/endpointResolutionService';
import { buildProcessInstructions } from '@/src/features/harness-work-instructions/services/processInstructionService';
import { loadFusionHints, persistLearningUsageEvents } from '@/src/features/harness-work-instructions/services/learningService';
import type { CanonicalDrawingDraft } from '@/src/features/harness-work-instructions/types/drawingDraft';
import type { HarnessInstructionJob } from '@/src/features/harness-work-instructions/types/harnessInstruction.schema';

interface UploadFormState {
  type: 'BOM' | 'CUSTOMER_DRAWING' | 'INTERNAL_DRAWING';
  revision: string;
}

interface PipelineSummary {
  wires: number;
  pinMapRows: number;
  komaxSetup: number;
  pressSetup: number;
  generatedAt: string;
}

type StatusTone = 'success' | 'info' | 'warning';

async function extractTextFromUrl(fileUrl: string, fileName: string): Promise<string> {
  const res = await fetch(fileUrl);
  if (!res.ok) {
    throw new Error(`Failed to download document: ${res.statusText}`);
  }
  const blob = await res.blob();
  const file = new File([blob], fileName, { type: blob.type || 'application/pdf' });
  const { extractTextFromPDF } = await import('@/src/features/documentEngine/utils/pdfToText');
  return extractTextFromPDF(file);
}

export default function SKUDashboardPage() {
  const params = useParams<{ part_number: string }>();
  const partNumberParam = params?.part_number ? decodeURIComponent(params.part_number) : '';
  const [sku, setSku] = useState<SKURecord | null>(null);
  const [documents, setDocuments] = useState<SKUDocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [running, setRunning] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<PipelineSummary | null>(null);
  const [uploadForm, setUploadForm] = useState<UploadFormState>({ type: 'BOM', revision: 'A' });
  const [statusBanner, setStatusBanner] = useState<{ tone: StatusTone; text: string } | null>(null);
  const [recentDiffInsight, setRecentDiffInsight] = useState<{
    summary: DocumentDiffSummary | null;
    documentType: string;
    revision: string;
  } | null>(null);
  const [diffPanelOpen, setDiffPanelOpen] = useState(true);

  const partNumber = sku?.part_number ?? partNumberParam?.toUpperCase() ?? '';

  async function loadSKU() {
    if (!partNumberParam) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/sku/get?partNumber=${encodeURIComponent(partNumberParam)}`);
      const json = await res.json();
      if (!json.ok) {
        setMessage(json.error ?? 'Failed to load SKU');
        return;
      }
      setSku(json.sku as SKURecord);
      setDocuments(json.documents as SKUDocumentRecord[]);
      setMessage(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessage(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSKU();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partNumberParam]);

  const docByType = useMemo(() => {
    const map: Record<string, SKUDocumentRecord | null> = {
      BOM: null,
      CUSTOMER_DRAWING: null,
      INTERNAL_DRAWING: null,
    };
    for (const doc of documents) {
      if (doc.is_current) {
        map[doc.document_type] = doc;
      }
    }
    return map;
  }, [documents]);

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!sku) return;
    if (!selectedFile) {
      setMessage('Select a file to upload');
      return;
    }
    try {
      setUploading(true);
      setMessage(null);
      setStatusBanner(null);
      const formData = new FormData();
      formData.append('sku_id', sku.id);
      formData.append('document_type', uploadForm.type);
      formData.append('revision', uploadForm.revision || 'UNSPECIFIED');
      formData.append('file', selectedFile);

      try {
        const { extractTextFromPDF } = await import('@/src/features/documentEngine/utils/pdfToText');
        const extractedText = await extractTextFromPDF(selectedFile);
        if (extractedText && extractedText.trim().length > 0) {
          formData.append('extracted_text', extractedText);
        }
      } catch (hashErr) {
        console.warn('[HWI SKU UPLOAD] Failed to extract text for hashing (non-fatal)', hashErr);
      }

      const res = await fetch('/api/sku/upload-document', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? 'Upload failed');
      if (json.status === 'duplicate') {
        setStatusBanner({ tone: 'info', text: json.message ?? 'Document already exists with identical content.' });
        setRecentDiffInsight(null);
      } else if (json.status === 'phantom_rev') {
        setStatusBanner({ tone: 'warning', text: json.message ?? 'Possible phantom revision detected.' });
        setRecentDiffInsight({
          summary: (json.diff_summary as DocumentDiffSummary | undefined) ?? null,
          documentType: json.document?.document_type ?? uploadForm.type,
          revision: json.document?.revision ?? (uploadForm.revision || 'UNSPECIFIED'),
        });
        setDiffPanelOpen(true);
      } else {
        setStatusBanner({ tone: 'success', text: json.message ?? 'Document uploaded successfully.' });
        setRecentDiffInsight(null);
      }
      setSelectedFile(null);
      setSummary(null);
      await loadSKU();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessage(msg);
    } finally {
      setUploading(false);
    }
  }

  async function runPipeline() {
    if (!sku) return;
    try {
      setRunning(true);
      setMessage(null);
      setSummary(null);

      const res = await fetch(`/api/sku/get?partNumber=${encodeURIComponent(sku.part_number)}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? 'Failed to refresh SKU');

      const skuDocs: SKUDocumentRecord[] = json.documents;
      const currentBOM = skuDocs.find(d => d.document_type === 'BOM' && d.is_current);
      const currentDrawing =
        skuDocs.find(d => d.document_type === 'INTERNAL_DRAWING' && d.is_current) ||
        skuDocs.find(d => d.document_type === 'CUSTOMER_DRAWING' && d.is_current);

      if (!currentBOM) {
        throw new Error('Upload a BOM document before running the pipeline');
      }
      if (!currentDrawing) {
        throw new Error('Upload a drawing (internal or customer) before running the pipeline');
      }

      const [bomText, drawingText] = await Promise.all([
        extractTextFromUrl(currentBOM.file_url, currentBOM.file_name),
        extractTextFromUrl(currentDrawing.file_url, currentDrawing.file_name),
      ]);

      const bomResponse = await fetch('/api/harness-instructions/upload-bom', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          bomText,
          partNumber: sku.part_number,
          revision: currentBOM.revision,
          fileName: currentBOM.file_name,
        }),
      });
      const bomJson = await bomResponse.json();
      if (!bomJson.ok || !bomJson.job) {
        throw new Error(bomJson.error ?? 'BOM parsing failed');
      }

      const drawingResponse = await fetch('/api/harness-instructions/upload-drawing', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          drawingText,
          fileName: currentDrawing.file_name,
        }),
      });
      const drawingJson = await drawingResponse.json();
      if (!drawingJson.ok || !drawingJson.drawing) {
        throw new Error(drawingJson.error ?? 'Drawing parsing failed');
      }

      const job: HarnessInstructionJob = bomJson.job;
      const drawing: CanonicalDrawingDraft = drawingJson.drawing;

      const hints = await loadFusionHints(drawing, job);
      const fused = fuseDrawingWithBOM(drawing, job, hints);
      const resolved = resolveEndpoints(fused, drawing, hints);
      const processBundle = buildProcessInstructions(resolved, hints?.toolingOverrides, hints);

      await persistLearningUsageEvents(hints).catch(err => {
        console.warn('[HWI LEARNING] persist usage events failed (SKU pipeline run)', err);
      });

      console.log('[HWI SKU PIPELINE RUN]', {
        sku_id: sku.id,
        part_number: sku.part_number,
        wires: resolved.wire_instances.length,
        pin_map_rows: resolved.pin_map_rows.length,
      });

      setSummary({
        wires: resolved.wire_instances.length,
        pinMapRows: resolved.pin_map_rows.length,
        komaxSetup: processBundle.komax_setup.length,
        pressSetup: processBundle.press_setup.length,
        generatedAt: processBundle.generated_at,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessage(msg);
    } finally {
      setRunning(false);
    }
  }

  const sectionDescription = (type: string) => {
    if (type === 'BOM') return 'Bill of Materials';
    if (type === 'CUSTOMER_DRAWING') return 'Customer Drawing';
    return 'Internal Drawing';
  };

  return (
    <EMIPLayout>
      <div className="space-y-10">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-[0.4em] text-blue-500">SKU MODEL</p>
          <h1 className="text-3xl font-bold text-gray-900">{partNumber || 'SKU Not Found'}</h1>
          <p className="text-gray-600 max-w-3xl">
            Persist BOMs and drawings for this SKU, track revisions, and execute the Harness Work Instruction pipeline
            directly from the vault.
          </p>
        </header>

        {statusBanner && (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              statusBanner.tone === 'warning'
                ? 'border-amber-200 bg-amber-50 text-amber-900'
                : statusBanner.tone === 'info'
                  ? 'border-blue-200 bg-blue-50 text-blue-900'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-900'
            }`}
          >
            {statusBanner.text}
          </div>
        )}

        {recentDiffInsight && (
          <div className="rounded-2xl border border-amber-200 bg-white shadow-sm">
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-amber-900">Possible Changes Detected</p>
                <p className="text-xs text-amber-700">
                  Phantom revision flagged on {sectionDescription(recentDiffInsight.documentType)} · Revision{' '}
                  {recentDiffInsight.revision}
                </p>
              </div>
              <button
                type="button"
                className="text-xs font-semibold text-amber-800 hover:text-amber-900"
                onClick={() => setDiffPanelOpen(open => !open)}
              >
                {diffPanelOpen ? 'Hide Summary' : 'View Summary'}
              </button>
            </div>
            {recentDiffInsight.summary ? (
              diffPanelOpen && (
                <div className="border-t border-amber-100 px-4 py-4 text-sm text-amber-900">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <p className="text-xs uppercase text-amber-600">Changed Lines</p>
                      <p className="text-lg font-semibold">{recentDiffInsight.summary.changed_line_count}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-amber-600">Likely Functional Change</p>
                      <p className="text-lg font-semibold">
                        {recentDiffInsight.summary.likely_functional_change ? 'YES' : 'NO'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-amber-600">Summary</p>
                      <p className="text-sm">{recentDiffInsight.summary.summary_message}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    {recentDiffInsight.summary.added_lines.length > 0 && (
                      <div>
                        <p className="text-xs uppercase text-amber-600">Added Lines</p>
                        <ul className="mt-2 space-y-1 rounded-lg bg-amber-50 p-3 font-mono text-xs text-amber-900">
                          {recentDiffInsight.summary.added_lines.map(line => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {recentDiffInsight.summary.removed_lines.length > 0 && (
                      <div>
                        <p className="text-xs uppercase text-amber-600">Removed Lines</p>
                        <ul className="mt-2 space-y-1 rounded-lg bg-amber-50 p-3 font-mono text-xs text-amber-900">
                          {recentDiffInsight.summary.removed_lines.map(line => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )
            ) : (
              <div className="border-t border-amber-100 px-4 py-4 text-sm text-amber-800">
                Phantom revision detected, but no text comparison was available.
              </div>
            )}
          </div>
        )}

        {message && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {message}
          </div>
        )}

        <section className="grid gap-6 lg:grid-cols-3">
          {(['BOM', 'CUSTOMER_DRAWING', 'INTERNAL_DRAWING'] as const).map(type => {
            const doc = docByType[type];
            return (
              <div key={type} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <p className="text-sm uppercase tracking-widest text-gray-500">{sectionDescription(type)}</p>
                {doc ? (
                  <div className="mt-4 space-y-2">
                    <p className="text-lg font-semibold text-gray-900">Revision {doc.revision}</p>
                    <p className="text-sm text-gray-600">{doc.file_name}</p>
                    <p className="text-xs text-gray-400">Uploaded {new Date(doc.uploaded_at).toLocaleString()}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      {doc.is_current ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                          Current
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-500">
                          Archived
                        </span>
                      )}
                      {doc.phantom_rev_flag && (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold text-amber-800">
                          PHANTOM REV
                        </span>
                      )}
                      {doc.phantom_diff_summary && (
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ${
                            doc.phantom_diff_summary.likely_functional_change
                              ? 'bg-red-50 text-red-700'
                              : 'bg-blue-50 text-blue-700'
                          }`}
                        >
                          {doc.phantom_diff_summary.likely_functional_change
                            ? 'Functional Change Likely'
                            : 'Minor/Unclear Change'}
                        </span>
                      )}
                    </div>
                    {doc.phantom_rev_flag && doc.phantom_rev_note && (
                      <p className="text-xs text-amber-600">{doc.phantom_rev_note}</p>
                    )}
                    {doc.phantom_rev_flag && !doc.phantom_diff_summary && (
                      <p className="text-xs text-amber-600">Diff summary unavailable for this upload.</p>
                    )}
                    {doc.phantom_diff_summary && (
                      <details className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
                        <summary className="cursor-pointer font-semibold">View summary</summary>
                        <p className="mt-1 text-amber-800">{doc.phantom_diff_summary.summary_message}</p>
                        <p className="mt-1 text-amber-800">
                          Δ Lines: {doc.phantom_diff_summary.changed_line_count} · Functional change:{' '}
                          {doc.phantom_diff_summary.likely_functional_change ? 'YES' : 'NO'}
                        </p>
                        <div className="mt-2 grid gap-2 md:grid-cols-2">
                          {doc.phantom_diff_summary.added_lines.length > 0 && (
                            <div>
                              <p className="text-[11px] uppercase text-amber-600">Added</p>
                              <ul className="mt-1 space-y-1 font-mono text-[11px]">
                                {doc.phantom_diff_summary.added_lines.map(line => (
                                  <li key={line}>{line}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {doc.phantom_diff_summary.removed_lines.length > 0 && (
                            <div>
                              <p className="text-[11px] uppercase text-amber-600">Removed</p>
                              <ul className="mt-1 space-y-1 font-mono text-[11px]">
                                {doc.phantom_diff_summary.removed_lines.map(line => (
                                  <li key={line}>{line}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </details>
                    )}
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex text-sm font-semibold text-blue-600 hover:text-blue-700"
                    >
                      View document →
                    </a>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-gray-500">No document uploaded yet.</p>
                )}
              </div>
            );
          })}
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Upload Document</h2>
                <p className="text-sm text-gray-500">Set a new source of truth. Latest upload becomes current automatically.</p>
              </div>
            </div>

            <form onSubmit={handleUpload} className="mt-4 space-y-4">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-gray-700">Document Type</span>
                <select
                  value={uploadForm.type}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, type: e.target.value as UploadFormState['type'] }))}
                  className="rounded-xl border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                >
                  <option value="BOM">BOM</option>
                  <option value="CUSTOMER_DRAWING">Customer Drawing</option>
                  <option value="INTERNAL_DRAWING">Internal Drawing</option>
                </select>
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-gray-700">Revision</span>
                <input
                  type="text"
                  value={uploadForm.revision}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, revision: e.target.value }))}
                  className="rounded-xl border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  placeholder="E.g. A1"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-gray-700">File</span>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                  className="rounded-xl border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-600"
                />
              </label>

              <button
                type="submit"
                disabled={uploading || !sku}
                className="w-full rounded-xl bg-blue-600 py-3 text-center text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-60"
              >
                {uploading ? 'Uploading...' : 'Upload & Mark Current'}
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Pipeline</h2>
                <p className="text-sm text-gray-500">Run the Harness Work Instruction pipeline from stored documents.</p>
              </div>
            </div>

            <button
              onClick={runPipeline}
              disabled={running || loading || !sku}
              className="w-full rounded-xl bg-emerald-600 py-3 text-center text-sm font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-60"
            >
              {running ? 'Generating…' : 'Generate Work Instructions'}
            </button>

            {summary && (
              <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900 space-y-1">
                <p className="font-semibold">Latest run</p>
                <p>Wire instances: {summary.wires}</p>
                <p>Pin map rows: {summary.pinMapRows}</p>
                <p>Komax setup entries: {summary.komaxSetup}</p>
                <p>Press setup entries: {summary.pressSetup}</p>
                <p className="text-xs text-emerald-700">Generated at {new Date(summary.generatedAt).toLocaleString()}</p>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Document Revisions</h2>
              <p className="text-sm text-gray-500">Full revision log per document type.</p>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="text-left text-sm text-gray-500">
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">Revision</th>
                  <th className="px-4 py-2">File</th>
                  <th className="px-4 py-2">Status / Integrity</th>
                  <th className="px-4 py-2">Uploaded</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {documents.map(doc => (
                  <tr key={doc.id}>
                    <td className="px-4 py-2 font-medium text-gray-900">{sectionDescription(doc.document_type)}</td>
                    <td className="px-4 py-2">{doc.revision}</td>
                    <td className="px-4 py-2">
                      <a href={doc.file_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-700">
                        {doc.file_name}
                      </a>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-2">
                        {doc.is_current ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                            Current
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-500">
                            Archived
                          </span>
                        )}
                        {doc.phantom_rev_flag && (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold text-amber-800">
                            PHANTOM REV
                          </span>
                        )}
                        {doc.phantom_diff_summary && (
                          <span
                            className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ${
                              doc.phantom_diff_summary.likely_functional_change
                                ? 'bg-red-50 text-red-700'
                                : 'bg-blue-50 text-blue-700'
                            }`}
                          >
                            {doc.phantom_diff_summary.likely_functional_change
                              ? 'Functional Change Likely'
                              : 'Minor/Unclear Change'}
                          </span>
                        )}
                      </div>
                      {doc.phantom_rev_flag && doc.phantom_rev_note && (
                        <p className="mt-1 text-xs text-amber-600">{doc.phantom_rev_note}</p>
                      )}
                      {doc.phantom_rev_flag && !doc.phantom_diff_summary && (
                        <p className="mt-1 text-xs text-amber-600">Diff summary unavailable for this upload.</p>
                      )}
                      {doc.phantom_diff_summary && (
                        <details className="mt-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
                          <summary className="cursor-pointer font-semibold">View summary</summary>
                          <p className="mt-1 text-amber-800">{doc.phantom_diff_summary.summary_message}</p>
                          <p className="mt-1 text-amber-800">
                            Δ Lines: {doc.phantom_diff_summary.changed_line_count} · Functional change:{' '}
                            {doc.phantom_diff_summary.likely_functional_change ? 'YES' : 'NO'}
                          </p>
                          <div className="mt-2 grid gap-2 md:grid-cols-2">
                            {doc.phantom_diff_summary.added_lines.length > 0 && (
                              <div>
                                <p className="text-[11px] uppercase text-amber-600">Added</p>
                                <ul className="mt-1 space-y-1 font-mono text-[11px]">
                                  {doc.phantom_diff_summary.added_lines.map(line => (
                                    <li key={line}>{line}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {doc.phantom_diff_summary.removed_lines.length > 0 && (
                              <div>
                                <p className="text-[11px] uppercase text-amber-600">Removed</p>
                                <ul className="mt-1 space-y-1 font-mono text-[11px]">
                                  {doc.phantom_diff_summary.removed_lines.map(line => (
                                    <li key={line}>{line}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </details>
                      )}
                    </td>
                    <td className="px-4 py-2 text-gray-500">{new Date(doc.uploaded_at).toLocaleString()}</td>
                  </tr>
                ))}
                {documents.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                      No documents uploaded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </EMIPLayout>
  );
}
