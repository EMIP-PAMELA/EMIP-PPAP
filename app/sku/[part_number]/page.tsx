'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import EMIPLayout from '../../layout/EMIPLayout';
import type {
  SKURecord,
  SKUDocumentRecord,
} from '@/src/features/harness-work-instructions/services/skuService';
import type { RevisionState } from '@/src/utils/revisionEvaluator';
import type { HarnessInstructionJob } from '@/src/features/harness-work-instructions/types/harnessInstruction.schema';
import type { ProcessInstructionBundle } from '@/src/features/harness-work-instructions/types/processInstructions';
import type { ReadinessStatus } from '@/src/utils/skuReadinessEvaluator';
import RevisionSummaryCard from '@/src/features/revision/components/RevisionSummaryCard';
import RevisionRiskSignalsCard from '@/src/features/revision/components/RevisionRiskSignalsCard';
import type { ActionIntent } from '@/src/features/revision/hooks/useRecommendedFixActions';
import CorrectiveContextBanner from '@/src/components/CorrectiveContextBanner';
import { deriveIssueKind, parseActionIntentParam } from '@/src/features/revision/utils/correctiveIntent';
import { recordSkuVisit } from '@/src/features/dashboard/userContext';

const revisionStateTone: Record<RevisionState, string> = {
  CURRENT: 'bg-emerald-50 text-emerald-700',
  SUPERSEDED: 'bg-gray-100 text-gray-600',
  CONFLICT: 'bg-red-50 text-red-700',
  UNKNOWN: 'bg-amber-50 text-amber-700',
};

const revisionStateLabel: Record<RevisionState, string> = {
  CURRENT: 'Current',
  SUPERSEDED: 'Superseded',
  CONFLICT: 'Conflict',
  UNKNOWN: 'Unknown',
};

const readinessStatusTone: Record<ReadinessStatus, { container: string; badge: string; icon: string }> = {
  READY: {
    container: 'border-emerald-200 bg-emerald-50',
    badge: 'bg-emerald-600 text-white',
    icon: '✅',
  },
  PARTIAL: {
    container: 'border-amber-200 bg-amber-50',
    badge: 'bg-amber-600 text-white',
    icon: '⚠️',
  },
  BLOCKED: {
    container: 'border-red-200 bg-red-50',
    badge: 'bg-red-600 text-white',
    icon: '🛑',
  },
};

const readinessStatusLabel: Record<ReadinessStatus, string> = {
  READY: 'Ready',
  PARTIAL: 'Partial',
  BLOCKED: 'Blocked',
};

const outputStatusTone: Record<ReadinessStatus, string> = {
  READY: 'bg-emerald-100 text-emerald-800',
  PARTIAL: 'bg-amber-100 text-amber-800',
  BLOCKED: 'bg-red-100 text-red-700',
};

const readinessOutputs = [
  { key: 'work_instructions', label: 'Work Instructions' },
  { key: 'traveler_package', label: 'Traveler Package' },
  { key: 'komax_cut_sheet', label: 'Komax / Cut Sheet' },
] as const;

interface PipelineSummary {
  wires: number;
  pinMapRows: number;
  komaxSetup: number;
  pressSetup: number;
  generatedAt: string;
}

export default function SKUDashboardPage() {
  const params = useParams<{ part_number: string }>();
  const searchParams = useSearchParams();
  const partNumberParam = params?.part_number ? decodeURIComponent(params.part_number) : '';
  const tabParam = searchParams?.get('tab') ?? null;
  const focusParam = searchParams?.get('focus');
  const highlightParam = searchParams?.get('highlight');
  const expectedRevisionParam = searchParams?.get('expectedRevision');
  const expectedRevisionHint = expectedRevisionParam?.trim() ? expectedRevisionParam.trim().toUpperCase() : null;
  const canonicalSourceParam = searchParams?.get('source');
  const canonicalSourceHint = canonicalSourceParam?.trim() ? canonicalSourceParam.trim().toUpperCase() : null;
  const actionIntent = parseActionIntentParam(searchParams?.get('actionIntent') ?? null);
  const correctiveIssueKind = deriveIssueKind(actionIntent);
  const fromParam = searchParams?.get('from') ?? null;
  const [sku, setSku] = useState<SKURecord | null>(null);
  const [documents, setDocuments] = useState<SKUDocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState<PipelineSummary | null>(null);
  const [pipelineStatus, setPipelineStatus] = useState<'idle' | 'READY' | 'PARTIAL'>('idle');
  const autoRunSignature = useRef<string | null>(null);
  const readinessSectionRef = useRef<HTMLElement | null>(null);
  const revisionSectionRef = useRef<HTMLDivElement | null>(null);
  const [revisionHighlightActive, setRevisionHighlightActive] = useState(false);
  const [readinessHighlightActive, setReadinessHighlightActive] = useState(false);

  const partNumber = sku?.part_number ?? partNumberParam?.toUpperCase() ?? '';
  const vaultLink = sku ? `/vault?sku=${encodeURIComponent(sku.part_number)}` : '/vault';
  const revisionValidation = sku?.revision_validation ?? null;
  const expectedDrawings = sku?.expected_drawings ?? null;
  const revisionRisk = sku?.revision_risk ?? null;
  const readiness = sku?.readiness ?? null;
  const overallReadinessStatus: ReadinessStatus | null = readiness?.overall_status ?? null;
  const readinessBlockers = readiness
    ? Array.from(
        new Set([
          ...readiness.work_instructions.blockers,
          ...readiness.traveler_package.blockers,
          ...readiness.komax_cut_sheet.blockers,
        ]),
      )
    : [];
  const readinessWarnings = readiness
    ? Array.from(
        new Set([
          ...readiness.work_instructions.warnings,
          ...readiness.traveler_package.warnings,
          ...readiness.komax_cut_sheet.warnings,
        ]),
      )
    : [];
  const readinessNextAction = (() => {
    if (!readiness) return 'Upload missing source documents.';
    if (readiness.work_instructions.status !== 'READY') {
      return readiness.work_instructions.recommended_action;
    }
    if (readiness.traveler_package.status !== 'READY') {
      return readiness.traveler_package.recommended_action;
    }
    if (readiness.komax_cut_sheet.status !== 'READY') {
      return readiness.komax_cut_sheet.recommended_action;
    }
    return 'All downstream outputs are clear to proceed.';
  })();

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

  useEffect(() => {
    if (!sku) return;
    recordSkuVisit(sku.part_number, actionIntent ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sku?.part_number]);

  useEffect(() => {
    if (loading) return;
    if (tabParam === 'revision' && revisionSectionRef.current) {
      revisionSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (tabParam === 'readiness' && readinessSectionRef.current) {
      readinessSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [tabParam, loading]);

  const revisionIntentActive = Boolean(actionIntent && actionIntent !== 'REVIEW_READINESS');
  const readinessIntentActive = actionIntent === 'REVIEW_READINESS';

  useEffect(() => {
    if (loading) return;
    const shouldHighlightRevision =
      tabParam === 'revision' || highlightParam === 'revision' || Boolean(focusParam) || revisionIntentActive;
    if (!shouldHighlightRevision) return;
    setRevisionHighlightActive(true);
    const timeout = window.setTimeout(() => setRevisionHighlightActive(false), 3500);
    return () => window.clearTimeout(timeout);
  }, [tabParam, focusParam, highlightParam, loading, revisionIntentActive]);

  useEffect(() => {
    if (loading) return;
    const shouldHighlightReadiness = tabParam === 'readiness' || highlightParam === 'readiness' || readinessIntentActive;
    if (!shouldHighlightReadiness) return;
    setReadinessHighlightActive(true);
    const timeout = window.setTimeout(() => setReadinessHighlightActive(false), 3500);
    return () => window.clearTimeout(timeout);
  }, [tabParam, highlightParam, loading, readinessIntentActive]);

  const docByType = useMemo(() => {
    const map: Record<string, SKUDocumentRecord | null> = {
      BOM: null,
      CUSTOMER_DRAWING: null,
      INTERNAL_DRAWING: null,
    };
    for (const doc of documents) {
      if (doc.revision_state === 'CURRENT') {
        map[doc.document_type] = doc;
      }
    }
    return map;
  }, [documents]);

  const documentPresence = useMemo(
    () => ({
      bom: Boolean(docByType.BOM),
      customerDrawing: Boolean(docByType.CUSTOMER_DRAWING),
      internalDrawing: Boolean(docByType.INTERNAL_DRAWING),
    }),
    [docByType],
  );

  const hasAnyDrawing = documentPresence.customerDrawing || documentPresence.internalDrawing;
  const pipelineRequirementsMet = documentPresence.bom && hasAnyDrawing;

  async function runPipeline(trigger: 'manual' | 'auto' = 'manual') {
    if (!sku) return;
    try {
      setRunning(true);
      if (trigger === 'manual') {
        setMessage(null);
      }
      setSummary(null);

      const res = await fetch(`/api/sku/pipeline?part_number=${encodeURIComponent(sku.part_number)}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? 'Failed to process documents');

      const status = (json.pipeline_status ?? 'PARTIAL') as 'READY' | 'PARTIAL';
      setPipelineStatus(status);

      if (json.sku) {
        setSku(json.sku as SKURecord);
      }
      if (Array.isArray(json.documents)) {
        setDocuments(json.documents as SKUDocumentRecord[]);
      }

      if (status === 'READY' && json.job && json.process_bundle) {
        const job: HarnessInstructionJob = json.job as HarnessInstructionJob;
        const bundle: ProcessInstructionBundle = json.process_bundle as ProcessInstructionBundle;

        setSummary({
          wires: job.wire_instances?.length ?? 0,
          pinMapRows: job.pin_map_rows?.length ?? 0,
          komaxSetup: bundle.komax_setup.length,
          pressSetup: bundle.press_setup.length,
          generatedAt: bundle.generated_at,
        });
      } else {
        setSummary(null);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (trigger === 'manual') {
        setMessage(msg);
      } else {
        console.warn('[HWI AUTO PIPELINE]', msg);
      }
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    if (loading) return;
    const currentBOM = docByType.BOM;
    const currentDrawing = docByType.INTERNAL_DRAWING ?? docByType.CUSTOMER_DRAWING;
    if (!sku || !currentBOM || !currentDrawing) {
      setPipelineStatus('PARTIAL');
      setSummary(null);
      autoRunSignature.current = null;
      return;
    }
    const sig = `${currentBOM.id}:${currentDrawing.id}`;
    if (autoRunSignature.current === sig) return;
    autoRunSignature.current = sig;
    runPipeline('auto');
  }, [docByType, sku?.id, loading]);

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
          {sku && sku.created_from && (
            <p className="text-xs text-gray-400">
              Auto-created from{' '}
              <span className="font-medium">
                {sku.created_from === 'CUSTOMER_DRAWING'
                  ? 'Customer Drawing'
                  : sku.created_from === 'INTERNAL_DRAWING'
                    ? 'Internal Drawing'
                    : 'BOM'}
              </span>
              {!sku.description && ' · incomplete — upload additional documents to enrich this SKU'}
            </p>
          )}
        </header>

        {fromParam === 'resume' && !actionIntent && (
          <p className="text-xs font-medium text-blue-600 -mt-1">
            ↩ Resumed from your recent work
          </p>
        )}

        {actionIntent && (
          <CorrectiveContextBanner
            intent={actionIntent}
            partNumber={partNumber}
            expectedRevision={expectedRevisionHint}
            canonicalSource={canonicalSourceHint}
            issueType={correctiveIssueKind}
            location="sku"
          />
        )}

        {!loading && sku && readiness && overallReadinessStatus && (
          <section
            id="sku-readiness"
            ref={readinessSectionRef}
            className={`rounded-2xl border px-5 py-5 space-y-5 ${readinessStatusTone[overallReadinessStatus].container} ${readinessHighlightActive ? 'ring-2 ring-blue-300 shadow-lg shadow-blue-100' : ''}`}
          >
            <div className="flex flex-wrap items-start gap-4">
              <span className="text-2xl" aria-hidden>
                {readinessStatusTone[overallReadinessStatus].icon}
              </span>
              <div className="flex-1 min-w-[240px] space-y-1">
                <p className="text-xs uppercase tracking-[0.4em] text-gray-500">SKU Readiness</p>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold text-gray-900">{readinessStatusLabel[overallReadinessStatus]}</h2>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${readinessStatusTone[overallReadinessStatus].badge}`}>
                    {readinessStatusLabel[overallReadinessStatus]}
                  </span>
                </div>
                <p className="text-sm text-gray-700">{readinessNextAction}</p>
                {readinessHighlightActive && (
                  <p className="text-xs font-semibold text-blue-700">Opened from corrective action.</p>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {readinessOutputs.map(def => {
                const output = readiness[def.key];
                const primaryIssue = output.blockers[0] ?? output.warnings[0] ?? 'No outstanding issues.';
                return (
                  <div key={def.key} className="rounded-xl bg-white/70 p-4 shadow-sm border border-white">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-gray-800">{def.label}</p>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${outputStatusTone[output.status]}`}>
                        {readinessStatusLabel[output.status]}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-gray-600 line-clamp-2">{primaryIssue}</p>
                    <p className="mt-2 text-xs font-semibold text-gray-500">Next: {output.recommended_action}</p>
                  </div>
                );
              })}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Critical blockers</p>
                {readinessBlockers.length > 0 ? (
                  <ul className="mt-2 list-disc pl-5 text-sm text-gray-700 space-y-1">
                    {readinessBlockers.slice(0, 5).map(item => (
                      <li key={`blocker-${item}`}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-gray-500">No blocking issues detected.</p>
                )}
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Warnings</p>
                {readinessWarnings.length > 0 ? (
                  <ul className="mt-2 list-disc pl-5 text-sm text-gray-700 space-y-1">
                    {readinessWarnings.slice(0, 5).map(item => (
                      <li key={`warning-${item}`}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-gray-500">No warnings at this time.</p>
                )}
              </div>
            </div>
          </section>
        )}

        {!loading && sku && (
          <div id="revision-summary" ref={revisionSectionRef}>
            <RevisionSummaryCard
              validation={revisionValidation}
              partNumber={sku.part_number}
              focusIntent={focusParam}
              highlight={revisionHighlightActive}
              expectedRevisionHint={expectedRevisionHint}
              canonicalSourceHint={canonicalSourceHint}
              actionIntent={actionIntent}
              defaultExpanded={Boolean(revisionIntentActive)}
              riskSummary={revisionRisk}
              expectedDrawings={expectedDrawings}
              readinessTier={sku.readiness?.readiness_tier ?? null}
              confidenceScore={sku.readiness?.confidence_score ?? null}
              confidenceFactors={sku.readiness?.confidence_factors ?? null}
            />

            <div className="mt-4">
              <RevisionRiskSignalsCard risk={revisionRisk} />
            </div>
          </div>
        )}

        {!loading && sku && (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 flex flex-wrap items-center gap-4">
            <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Source Checklist</span>
            <span className={`inline-flex items-center gap-1 text-xs font-semibold ${documentPresence.bom ? 'text-emerald-700' : 'text-red-600'}`}>
              {documentPresence.bom ? '✓' : '✗'} BOM
            </span>
            <span className={`inline-flex items-center gap-1 text-xs font-semibold ${documentPresence.customerDrawing ? 'text-emerald-700' : 'text-red-600'}`}>
              {documentPresence.customerDrawing ? '✓' : '✗'} Customer Drawing
            </span>
            <span className={`inline-flex items-center gap-1 text-xs font-semibold ${documentPresence.internalDrawing ? 'text-emerald-700' : 'text-red-600'}`}>
              {documentPresence.internalDrawing ? '✓' : '✗'} Internal Drawing
            </span>
            <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${
              pipelineStatus === 'READY'
                ? 'bg-emerald-100 text-emerald-700'
                : pipelineStatus === 'PARTIAL'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-gray-100 text-gray-500'
            }`}>
              {pipelineStatus === 'READY' ? 'PIPELINE READY' : pipelineStatus === 'PARTIAL' ? 'INCOMPLETE' : '…'}
            </span>
          </div>
        )}

        {sku && !sku.description && !loading && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            This SKU stub was auto-created from a document upload. Add more documents to fill in the description and
            complete the record.
          </div>
        )}

        {message && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {message}
          </div>
        )}

        {sku && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-3">
            <div className="text-sm text-gray-600 flex-1 min-w-[200px]">
              Drop new BOMs or drawings straight into the Document Vault — this SKU will be preselected.
            </div>
            <Link
              href={vaultLink}
              className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
            >
              Upload Document to this SKU
            </Link>
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
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${revisionStateTone[doc.revision_state ?? 'UNKNOWN']}`}
                      >
                        {revisionStateLabel[doc.revision_state ?? 'UNKNOWN']}
                      </span>
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

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Pipeline</h2>
                <div className="mt-2 inline-flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Status</span>
                  <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${
                    pipelineStatus === 'READY'
                      ? 'bg-emerald-100 text-emerald-700'
                      : pipelineStatus === 'idle'
                        ? 'bg-gray-100 text-gray-500'
                        : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {pipelineStatus === 'READY' ? 'READY' : pipelineStatus === 'idle' ? 'IDLE' : 'WAITING FOR DOCUMENTS'}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {pipelineStatus === 'READY'
                    ? 'Latest documents have generated a full harness instruction job.'
                    : !documentPresence.bom && !hasAnyDrawing
                      ? 'Upload a BOM and at least one drawing to build instructions automatically.'
                      : !documentPresence.bom
                        ? 'Upload a BOM to unlock the pipeline for this SKU.'
                        : !hasAnyDrawing
                          ? 'Upload a customer or internal drawing to unlock the pipeline for this SKU.'
                          : 'Documents are syncing — rerun the pipeline once status shows READY.'}
                </p>
              </div>

              <div className="flex flex-col gap-2 w-full lg:w-64">
                <button
                  onClick={() => runPipeline('manual')}
                  disabled={running || loading || !sku || !pipelineRequirementsMet}
                  className="rounded-xl bg-emerald-600 py-2.5 text-center text-sm font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-60"
                >
                  {running ? 'Refreshing…' : '🔄 Generate / Refresh'}
                </button>
                {pipelineStatus === 'READY' ? (
                  <Link
                    href={`/work-instructions?sku=${encodeURIComponent(partNumber)}`}
                    className="rounded-xl border border-blue-200 py-2.5 text-center text-sm font-semibold text-blue-700 hover:bg-blue-50 transition"
                  >
                    🧾 View Work Instructions
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="rounded-xl border border-dashed border-gray-200 py-2.5 text-center text-sm font-semibold text-gray-400 cursor-not-allowed"
                  >
                    🧾 View Work Instructions
                  </button>
                )}
              </div>
            </div>

            {summary ? (
              <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900 space-y-1">
                <p className="font-semibold">Latest run</p>
                <p>Wire instances: {summary.wires}</p>
                <p>Pin map rows: {summary.pinMapRows}</p>
                <p>Komax setup entries: {summary.komaxSetup}</p>
                <p>Press setup entries: {summary.pressSetup}</p>
                <p className="text-xs text-emerald-700">Generated at {new Date(summary.generatedAt).toLocaleString()}</p>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-200 px-4 py-3 text-sm text-gray-500">
                {pipelineStatus === 'READY'
                  ? 'Pipeline ready — run to refresh the latest instructions.'
                  : 'Pipeline results will appear here once both BOM and drawing are stored.'}
              </div>
            )}
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
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${revisionStateTone[doc.revision_state ?? 'UNKNOWN']}`}
                        >
                          {revisionStateLabel[doc.revision_state ?? 'UNKNOWN']}
                        </span>
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
