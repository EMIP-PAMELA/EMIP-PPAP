'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import EMIPLayout from '../../layout/EMIPLayout';

interface IngestResult {
  sku_created: boolean;
  header_updated: boolean;
  status: string;
  phantom_rev: boolean;
  message: string;
  sku: { id: string; part_number: string };
  document: { id: string; revision: string; file_name: string };
  pipeline_status?: 'READY' | 'PARTIAL';
}

export default function UploadBOMPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [manualPN, setManualPN] = useState('');
  const [manualRev, setManualRev] = useState('');
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<IngestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsPN, setNeedsPN] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingText, setPendingText] = useState<string | undefined>(undefined);

  async function extractText(file: File): Promise<string | undefined> {
    try {
      const { extractTextFromPDF } = await import('@/src/features/documentEngine/utils/pdfToText');
      return await extractTextFromPDF(file);
    } catch {
      return undefined;
    }
  }

  async function submit(file: File, extractedText: string | undefined, partNumber?: string) {
    setUploading(true);
    setError(null);
    setResult(null);

    if (!extractedText) {
      setError('Failed to extract text from PDF. Please try a different file.');
      setUploading(false);
      return;
    }

    const fd = new FormData();
    fd.append('file', file);
    fd.append('extracted_text', extractedText);
    if (partNumber) fd.append('part_number', partNumber);
    if (manualRev.trim()) fd.append('revision', manualRev.trim());

    const res = await fetch('/api/upload/bom', { method: 'POST', body: fd });
    const json = await res.json();

    if (json.needs_manual_part_number) {
      setNeedsPN(true);
      setPendingFile(file);
      setPendingText(extractedText);
      setUploading(false);
      return;
    }

    if (!json.ok) {
      setError(json.error ?? 'Upload failed');
      setUploading(false);
      return;
    }

    setResult(json as IngestResult);
    setNeedsPN(false);
    setPendingFile(null);
    setPendingText(undefined);
    setUploading(false);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await extractText(file);
    await submit(file, text);
  }

  async function handleRetryWithPN(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!pendingFile || !manualPN.trim()) return;
    await submit(pendingFile, pendingText, manualPN.trim());
  }

  return (
    <EMIPLayout>
      <div className="space-y-8 max-w-2xl">
        <header className="flex flex-col gap-2">
          <p className="text-sm uppercase tracking-widest text-blue-500">Document-First Ingestion</p>
          <h1 className="text-3xl font-bold text-gray-900">Upload BOM</h1>
          <p className="text-gray-600">
            Upload a Bill of Materials PDF. The system will automatically derive the part number and create or match an
            SKU stub. No manual SKU creation required.
          </p>
        </header>

        <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-4">
          <div>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-gray-700">Revision (optional)</span>
              <input
                type="text"
                value={manualRev}
                onChange={e => setManualRev(e.target.value)}
                placeholder="e.g. A, B, REV-C"
                className="rounded-xl border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </label>
          </div>

          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 py-8 text-gray-500 hover:border-blue-400 hover:text-blue-600 transition disabled:opacity-60"
          >
            {uploading ? (
              <span className="text-sm">Processing BOM...</span>
            ) : (
              <span className="text-sm font-medium">Click to select BOM PDF</span>
            )}
          </button>
          <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
        </section>

        {needsPN && (
          <section className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6 space-y-4">
            <p className="text-sm text-yellow-800 font-medium">
              Could not auto-detect part number from the BOM. Enter it manually to continue.
            </p>
            <form onSubmit={handleRetryWithPN} className="flex gap-3 items-end">
              <label className="flex flex-col gap-1 flex-1">
                <span className="text-sm font-medium text-gray-700">Part Number *</span>
                <input
                  type="text"
                  value={manualPN}
                  onChange={e => setManualPN(e.target.value)}
                  placeholder="EG-12345"
                  className="rounded-xl border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </label>
              <button
                type="submit"
                disabled={uploading || !manualPN.trim()}
                className="rounded-xl bg-blue-600 text-white font-semibold px-5 py-2 hover:bg-blue-700 transition disabled:opacity-60"
              >
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
            </form>
          </section>
        )}

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {result && (
          <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              {result.phantom_rev ? (
                <span className="rounded-full bg-yellow-100 text-yellow-800 text-xs font-bold px-3 py-1">
                  ⚠️ Phantom Rev
                </span>
              ) : (
                <span className="rounded-full bg-green-100 text-green-800 text-xs font-bold px-3 py-1">
                  ✓ {result.sku_created ? 'SKU Auto-Created' : 'SKU Matched'}
                </span>
              )}
              <span className="text-sm text-gray-500">{result.message}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-gray-50 px-4 py-3">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Part Number</p>
                <p className="font-semibold text-gray-900">{result.sku.part_number}</p>
              </div>
              <div className="rounded-xl bg-gray-50 px-4 py-3">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Revision</p>
                <p className="font-semibold text-gray-900">{result.document.revision}</p>
              </div>
              <div className="rounded-xl bg-gray-50 px-4 py-3 col-span-2">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">File</p>
                <p className="font-mono text-gray-700 text-xs">{result.document.file_name}</p>
              </div>
            </div>

            <div className="rounded-xl border border-dashed border-gray-200 px-4 py-3 text-sm text-gray-600 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Pipeline</span>
                <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${
                  result.pipeline_status === 'READY'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {result.pipeline_status === 'READY' ? 'READY' : 'WAITING FOR DRAWING'}
                </span>
              </div>
              {result.pipeline_status === 'READY' ? (
                <p>
                  HWI job generated from current BOM + drawing. Review instructions from the SKU or operator view.
                </p>
              ) : (
                <p>
                  Upload a matching drawing to this SKU to automatically build the harness instructions.
                </p>
              )}
            </div>

            <Link
              href={`/sku/${encodeURIComponent(result.sku.part_number)}`}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 text-white font-semibold px-5 py-2 hover:bg-blue-700 transition text-sm"
            >
              Open SKU →
            </Link>
            {result.pipeline_status === 'READY' && (
              <Link
                href={`/work-instructions?sku=${encodeURIComponent(result.sku.part_number)}`}
                className="inline-flex items-center gap-2 rounded-xl border border-blue-200 text-blue-600 font-semibold px-5 py-2 hover:bg-blue-50 transition text-sm"
              >
                🧾 View Work Instructions
              </Link>
            )}
          </section>
        )}
      </div>
    </EMIPLayout>
  );
}
