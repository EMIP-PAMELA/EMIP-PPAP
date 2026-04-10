/**
 * Harness Work Instruction Generator — Review UI
 * Phase HWI.3 / HWI.5 / HWI.7 — Hybrid Grid + Approval + BOM Upload
 *
 * Layout: 3-column (Job Info | Tabs | Flags)
 * State: job + flags managed locally, no re-fetches after edits
 * Approval: locks all editing, stores to DB, uploads PDF artifact
 * BOM Upload: client-side PDF text extraction → parseBOMToHWI() → populates UI
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';
import EMIPLayout from '../layout/EMIPLayout';
import JobHeader from '@/src/features/harness-work-instructions/components/JobHeader';
import ReviewTabs from '@/src/features/harness-work-instructions/components/ReviewTabs';
import FlagsPanel from '@/src/features/harness-work-instructions/components/FlagsPanel';
import JobHistoryPanel from '@/src/features/harness-work-instructions/components/JobHistoryPanel';
import type {
  HarnessInstructionJob,
  EngineeringFlag,
} from '@/src/features/harness-work-instructions/types/harnessInstruction.schema';

interface ApprovalRecord {
  jobId: string;
  version: number;
  artifactUrl: string | null;
  approvedAt: string;
}

type EditableWireField =
  | 'aci_wire_part_number'
  | 'gauge'
  | 'color'
  | 'cut_length'
  | 'strip_end_a'
  | 'strip_end_b';

export default function HarnessInstructionsPage() {
  const [job, setJob]       = useState<HarnessInstructionJob | null>(null);
  const [flags, setFlags]   = useState<EngineeringFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('wires');
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [approving, setApproving]       = useState(false);
  const [approvalRecord, setApprovalRecord] = useState<ApprovalRecord | null>(null);
  const [showHistory, setShowHistory]   = useState(false);
  const [uploadingBOM, setUploadingBOM] = useState(false);
  const bomFileRef = useRef<HTMLInputElement>(null);

  const isLocked = approvalRecord !== null;

  useEffect(() => {
    console.log('[HWI UI LOAD]', { timestamp: new Date().toISOString() });

    fetch('/api/harness-instructions/extract-phase1', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
      .then(r => r.json())
      .then((json: { ok: boolean; data?: HarnessInstructionJob }) => {
        if (json.ok && json.data) {
          setJob(json.data);
          setFlags(json.data.engineering_flags ?? []);
          console.log('[HWI UI LOAD]', {
            wires: json.data.wire_instances.length,
            flags: json.data.engineering_flags.length,
          });
        } else {
          setError('Failed to load extraction data');
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function handleUpdateWire(
    index: number,
    field: EditableWireField,
    value: string | number | null
  ) {
    console.log('[HWI FIELD UPDATE]', { type: 'wire', index, field, value });
    const fieldRef = `wire_instances.${index}.${field}`;

    setJob(prev => {
      if (!prev) return prev;
      const wires = [...prev.wire_instances];
      const updated = { ...wires[index], [field]: value };
      if (field === 'cut_length') {
        updated.cut_length_source = typeof value === 'number'
          ? 'MANUAL_ENTRY'
          : 'REQUIRES_DRAWING';
      }
      wires[index] = updated;
      return { ...prev, wire_instances: wires };
    });

    setFlags(prev =>
      prev.map(f => {
        if (f.field_ref === fieldRef && !f.resolved) {
          console.log('[HWI FLAG RESOLVED]', { fieldRef });
          return { ...f, resolved: true };
        }
        return f;
      })
    );
  }

  function handleUpdateQuestion(id: string, answer: string | null, resolved: boolean) {
    console.log('[HWI FIELD UPDATE]', { type: 'question', id, resolved });
    setJob(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        review_questions: prev.review_questions.map(q =>
          q.id === id ? { ...q, answer, resolved } : q
        ),
      };
    });
  }

  async function handleBOMFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBOM(true);
    try {
      const { extractTextFromPDF } = await import('@/src/features/documentEngine/utils/pdfToText');
      const bomText = await extractTextFromPDF(file);
      const res = await fetch('/api/harness-instructions/upload-bom', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bomText, fileName: file.name }),
      });
      const json = await res.json() as { ok: boolean; job?: HarnessInstructionJob; error?: string };
      if (!json.ok || !json.job) throw new Error(json.error ?? 'BOM upload failed');
      setJob(json.job);
      setFlags(json.job.engineering_flags ?? []);
      setApprovalRecord(null);
      setActiveTab('wires');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`BOM upload failed: ${msg}`);
    } finally {
      setUploadingBOM(false);
      if (bomFileRef.current) bomFileRef.current.value = '';
    }
  }

  async function handleApprove() {
    if (!job || !canApprove || isLocked) return;
    setApproving(true);
    try {
      const res = await fetch('/api/harness-instructions/approve-job', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ job, approvedBy: 'engineer' }),
      });
      const json = await res.json() as {
        ok: boolean; jobId?: string; version?: number;
        artifactUrl?: string; approvedAt?: string; error?: string;
      };
      if (!json.ok) throw new Error(json.error ?? 'Approval failed');
      setApprovalRecord({
        jobId:       json.jobId!,
        version:     json.version!,
        artifactUrl: json.artifactUrl ?? null,
        approvedAt:  json.approvedAt!,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Approval failed: ${msg}`);
    } finally {
      setApproving(false);
    }
  }

  async function handleGeneratePDF() {
    if (!job) return;
    setGeneratingPDF(true);
    try {
      const res = await fetch('/api/harness-instructions/generate-pdf', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ job }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? 'PDF generation failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `WI-${job.metadata.part_number}-Rev${job.metadata.revision}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`PDF generation failed: ${msg}`);
    } finally {
      setGeneratingPDF(false);
    }
  }

  function handleFlagClick(flag: EngineeringFlag) {
    const ref = flag.field_ref ?? '';
    if (ref.startsWith('wire_instances'))  setActiveTab('wires');
    else if (ref.startsWith('press_rows')) setActiveTab('press');
    else if (ref.startsWith('komax_rows')) setActiveTab('komax');
    else if (ref.startsWith('pin_map_rows')) setActiveTab('pinmap');
    else if (ref.startsWith('review_questions')) setActiveTab('questions');

    setTimeout(() => {
      const parts = ref.split('.');
      if (parts.length >= 2) {
        document
          .getElementById(`${parts[0]}-${parts[1]}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 150);
  }

  const unresolvedFlags   = flags.filter(f => !f.resolved && f.flag_type !== 'info');
  const canApprove        = unresolvedFlags.length === 0;
  const resolvedCount     = flags.filter(f => f.resolved).length;
  const completionPct     = flags.length > 0
    ? Math.round((resolvedCount / flags.length) * 100)
    : 100;

  // ---------------------------------------------------------------------------
  // Loading / error states
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <EMIPLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-400 text-sm animate-pulse">Loading extraction data...</div>
        </div>
      </EMIPLayout>
    );
  }

  if (error || !job) {
    return (
      <EMIPLayout>
        <div className="p-5 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-red-700 font-medium text-sm">Failed to load instruction job</div>
          <div className="text-red-500 text-xs mt-1">{error ?? 'No data returned'}</div>
        </div>
      </EMIPLayout>
    );
  }

  // ---------------------------------------------------------------------------
  // Main 3-column review layout
  // ---------------------------------------------------------------------------

  return (
    <EMIPLayout>
      <div className="flex flex-col" style={{ height: 'calc(100vh - 128px)' }}>

        {/* Summary bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-white border border-gray-200 rounded-lg mb-3 flex-shrink-0 gap-4">
          <div className="flex items-center gap-5 min-w-0">
            <span className="font-semibold text-gray-700 text-sm truncate">
              🔌 {job.metadata.part_number} · Rev {job.metadata.revision}
            </span>

            <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
              unresolvedFlags.length > 0
                ? 'bg-orange-100 text-orange-700'
                : 'bg-green-100 text-green-700'
            }`}>
              {flags.length} flags · {unresolvedFlags.length} unresolved
            </span>

            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="w-20 bg-gray-200 rounded-full h-1.5">
                <div
                  className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${completionPct}%` }}
                />
              </div>
              <span className="text-xs text-gray-400">{completionPct}%</span>
            </div>
          </div>

          {/* Hidden BOM file input */}
          <input
            ref={bomFileRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleBOMFileChange}
          />

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Upload BOM PDF */}
            <button
              onClick={() => bomFileRef.current?.click()}
              disabled={uploadingBOM || isLocked}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                uploadingBOM || isLocked
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-purple-600 text-white hover:bg-purple-700'
              }`}
            >
              {uploadingBOM ? '⏳ Parsing...' : '📥 Upload BOM PDF'}
            </button>

            {/* History button */}
            <button
              onClick={() => setShowHistory(true)}
              className="px-3 py-1.5 rounded text-xs font-medium text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              🕓 History
            </button>

            {/* Generate PDF */}
            <button
              onClick={handleGeneratePDF}
              disabled={generatingPDF}
              className={`px-4 py-1.5 rounded text-xs font-semibold transition-colors ${
                generatingPDF
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {generatingPDF ? '⏳ Generating...' : '📄 Generate PDF'}
            </button>

            {/* Approve / Approved */}
            {isLocked ? (
              <div className="flex items-center gap-2">
                <span className="px-3 py-1.5 rounded text-xs font-semibold bg-green-100 text-green-800 border border-green-300">
                  ✅ Approved · v{approvalRecord!.version}
                </span>
                {approvalRecord!.artifactUrl && (
                  <a
                    href={approvalRecord!.artifactUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                  >
                    📄 Download PDF
                  </a>
                )}
              </div>
            ) : (
              <button
                disabled={!canApprove || approving}
                onClick={handleApprove}
                className={`px-4 py-1.5 rounded text-xs font-semibold transition-colors ${
                  canApprove && !approving
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                {approving
                  ? '⏳ Approving...'
                  : canApprove
                  ? '✅ Approve Instruction'
                  : `⚠️ ${unresolvedFlags.length} issue${unresolvedFlags.length !== 1 ? 's' : ''} pending`}
              </button>
            )}
          </div>
        </div>

        {/* 3-column layout */}
        <div className="flex-1 flex gap-3 overflow-hidden min-h-0">

          {/* LEFT — Job Info */}
          <div className="w-52 flex-shrink-0 overflow-y-auto">
            <JobHeader
              partNumber={job.metadata.part_number}
              revision={job.metadata.revision}
              status={job.status}
              wireCount={job.wire_instances.length}
              pressCount={job.press_rows.length}
              komaxCount={job.komax_rows.length}
              pinMapCount={job.pin_map_rows.length}
              stepCount={job.assembly_steps.length}
              flagCount={flags.length}
              unresolvedCount={unresolvedFlags.length}
            />
          </div>

          {/* CENTER — Tabs */}
          <div className="flex-1 overflow-hidden flex flex-col min-w-0">
            {isLocked && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-t-lg text-xs text-green-700 flex-shrink-0">
                <span className="font-semibold">🔒 APPROVED</span>
                <span className="text-green-600">v{approvalRecord!.version} · {new Date(approvalRecord!.approvedAt).toLocaleString()}</span>
                <span className="text-green-500 ml-1">— editing disabled</span>
              </div>
            )}
            <ReviewTabs
              job={job}
              flags={flags}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              onUpdateWire={handleUpdateWire}
              onUpdateQuestion={handleUpdateQuestion}
              isLocked={isLocked}
            />
          </div>

          {/* RIGHT — Flags */}
          <div className="w-60 flex-shrink-0 overflow-hidden">
            <FlagsPanel
              flags={flags}
              onFlagClick={handleFlagClick}
            />
          </div>

        </div>
      </div>
      {/* History panel modal */}
      {showHistory && job && (
        <JobHistoryPanel
          partNumber={job.metadata.part_number}
          onClose={() => setShowHistory(false)}
        />
      )}
    </EMIPLayout>
  );
}
