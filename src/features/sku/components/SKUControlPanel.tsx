'use client';

/**
 * SKUControlPanel — Phase 3H.46 C1
 *
 * Unified above-the-fold control panel for the SKU dashboard.
 * Replaces the standalone Documents, Revision Validation, Signals,
 * and Readiness sections with a single consolidated layout:
 *
 *   ROW 1 — Status strip: readiness badge · canonical rev · sync status · actions
 *   ROW 2 — Document cards (BOM / Customer Drawing / Internal Drawing)
 *   FOOTER — Inline revision status · historical signals strip · readiness messaging
 *
 * All business logic remains upstream — this component is purely presentational.
 */

import React from 'react';
import Link from 'next/link';
import type { CrossSourceValidationResult } from '@/src/utils/revisionCrossValidator';
import type { RevisionRiskSummary } from '@/src/utils/revisionRiskAnalyzer';
import type { SKUReadinessResult, ReadinessStatus } from '@/src/utils/skuReadinessEvaluator';
import type { RevisionState } from '@/src/utils/revisionEvaluator';
import type {
  DocByTypeMap,
  DocumentPresence,
  SupportedDocumentType,
} from '@/src/features/sku/utils/documentPresence';
import {
  resolveCanonicalDocument,
  type CanonicalDocumentContext,
  type CanonicalDocumentStatus,
} from '@/src/features/revision/utils/resolveCanonicalDocuments';

// ── Display constants ─────────────────────────────────────────────────────────

const revisionStateTone: Record<RevisionState, string> = {
  CURRENT:    'bg-emerald-50 text-emerald-700',
  SUPERSEDED: 'bg-gray-100 text-gray-600',
  CONFLICT:   'bg-red-50 text-red-700',
  UNKNOWN:    'bg-amber-50 text-amber-700',
};

const revisionStateLabel: Record<RevisionState, string> = {
  CURRENT:    'Current',
  SUPERSEDED: 'Superseded',
  CONFLICT:   'Conflict',
  UNKNOWN:    'Unknown',
};

const CANONICAL_BADGE: Record<CanonicalDocumentStatus, { label: string; tone: string }> = {
  CANONICAL: { label: '⭐ Canonical',         tone: 'bg-yellow-50 text-yellow-800 border border-yellow-200' },
  MATCHING:  { label: '✓ Matches expected',  tone: 'bg-emerald-50 text-emerald-700 border border-emerald-100' },
  OUTDATED:  { label: '⚠ Outdated',           tone: 'bg-amber-50 text-amber-700 border border-amber-100' },
  CONFLICT:  { label: '🔥 Conflict',          tone: 'bg-red-50 text-red-700 border border-red-100' },
  PENDING:   { label: '⏳ Pending',            tone: 'bg-gray-100 text-gray-600 border border-gray-200' },
  UNLINKED:  { label: '⚠ Unlinked',           tone: 'bg-orange-50 text-orange-700 border border-orange-100' },
  UNKNOWN:   { label: '—',                    tone: 'bg-gray-100 text-gray-500 border border-gray-200' },
};

const readinessTone: Record<ReadinessStatus, { badge: string; icon: string; label: string }> = {
  READY:                { badge: 'bg-emerald-600 text-white', icon: '✅', label: 'Ready' },
  READY_LOW_CONFIDENCE: { badge: 'bg-emerald-500 text-white', icon: '✅', label: 'Ready · Low Confidence' },
  NEEDS_REVIEW:         { badge: 'bg-amber-500 text-white',   icon: '⚠️', label: 'Needs Review' },
  PARTIAL:              { badge: 'bg-amber-600 text-white',   icon: '⚠️', label: 'Partial' },
  BLOCKED:              { badge: 'bg-red-600 text-white',     icon: '🛑', label: 'Blocked' },
};

const revisionStatusMeta: Record<string, { icon: string; summary: string; tone: string }> = {
  SYNCHRONIZED: { icon: '✅', summary: 'All sources aligned — no action required',     tone: 'text-emerald-700' },
  OUT_OF_SYNC:  { icon: '⚠️', summary: 'Out of sync — sources do not match',           tone: 'text-amber-700' },
  CONFLICT:     { icon: '🔥', summary: 'Conflict detected — manual review required',   tone: 'text-red-700' },
  INCOMPLETE:   { icon: '⏳', summary: 'Incomplete — missing revision sources',         tone: 'text-yellow-700' },
  INCOMPARABLE: { icon: '❓', summary: 'Cannot compare — normalize revision formats',  tone: 'text-gray-700' },
};

type DocPresenceKey = keyof Pick<DocumentPresence, 'hasBOM' | 'hasCustomerDrawing' | 'hasInternalDrawing'>;

interface DocDef {
  type: SupportedDocumentType;
  label: string;
  description: string;
  presenceKey: DocPresenceKey;
}

const DOCUMENT_DEFS: DocDef[] = [
  { type: 'BOM',              label: 'BOM',              description: 'Bill of Materials',         presenceKey: 'hasBOM' },
  { type: 'CUSTOMER_DRAWING', label: 'Customer Drawing', description: 'Customer-supplied drawing', presenceKey: 'hasCustomerDrawing' },
  { type: 'INTERNAL_DRAWING', label: 'Internal Drawing', description: 'Internal / Apogee drawing', presenceKey: 'hasInternalDrawing' },
];

type StatKey = 'override_count' | 'outdated_upload_count' | 'conflict_upload_count' | 'weak_detection_count';

const SIGNAL_STATS: { key: StatKey; label: string }[] = [
  { key: 'override_count',        label: 'Overrides' },
  { key: 'outdated_upload_count', label: 'Outdated' },
  { key: 'conflict_upload_count', label: 'Conflicts' },
  { key: 'weak_detection_count',  label: 'Weak Detection' },
];

// ── Props ─────────────────────────────────────────────────────────────────────

export interface SKUControlPanelProps {
  partNumber: string;
  vaultLink: string;
  sectionRef?: React.RefObject<HTMLDivElement | null>;
  highlightActive?: boolean;
  docByType: DocByTypeMap;
  documentPresence: DocumentPresence;
  documentConfidence: { icon: string; label: string; tone: string };
  buildUploadLink: (docType: SupportedDocumentType) => string;
  canonicalContext: CanonicalDocumentContext | null;
  revisionValidation: CrossSourceValidationResult | null;
  revisionRisk: RevisionRiskSummary | null;
  readiness: SKUReadinessResult | null;
  overallReadinessStatus: ReadinessStatus | null;
  readinessNextAction: string;
  readinessReasons: string[];
  /** Phase 3H.46 C4: Confidence-aligned readiness status computed from effective wires + coverage. */
  alignedReadiness?: ReadinessStatus;
  alignedMessage?: string;
  coverageScore?: number;
  pipelineStatus: 'idle' | 'READY' | 'PARTIAL';
  running: boolean;
  loading: boolean;
  pipelineRequirementsMet: boolean;
  onRunPipeline: () => void;
  /** Phase 3H.46 C6: Opens the inline BOM inspection drawer. */
  onViewBOM?: () => void;
  /** Phase 3H.46 C8: Routes user to the panel requiring attention. */
  onResolveIssues?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SKUControlPanel({
  partNumber,
  vaultLink,
  sectionRef,
  highlightActive = false,
  docByType,
  documentPresence,
  documentConfidence,
  buildUploadLink,
  canonicalContext,
  revisionValidation,
  revisionRisk,
  readiness,
  overallReadinessStatus,
  readinessNextAction,
  readinessReasons,
  alignedReadiness,
  alignedMessage,
  coverageScore,
  pipelineStatus,
  running,
  loading,
  pipelineRequirementsMet,
  onRunPipeline,
  onViewBOM,
  onResolveIssues,
}: SKUControlPanelProps) {
  const canonicalRev   = revisionValidation?.canonical_revision ?? null;
  const revStatus      = revisionValidation?.status ?? null;
  const revMeta        = revStatus ? (revisionStatusMeta[revStatus] ?? null) : null;
  const effectiveStatus = alignedReadiness ?? overallReadinessStatus;
  const readinessT      = effectiveStatus ? readinessTone[effectiveStatus] : null;

  return (
    <div
      ref={sectionRef}
      id="revision-summary"
      className={`rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden${
        highlightActive ? ' ring-2 ring-blue-100 shadow-lg shadow-blue-50' : ''
      }`}
    >
      {/* ── ROW 1: Status / Action strip ───────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-gray-50 border-b border-gray-200">
        {/* Left: badges */}
        <div className="flex flex-wrap items-center gap-3">
          <span className={`text-sm font-semibold ${documentConfidence.tone}`}>
            {documentConfidence.icon} {documentConfidence.label}
          </span>

          {readinessT && (
            onResolveIssues && effectiveStatus !== 'READY' ? (
              <button
                type="button"
                onClick={onResolveIssues}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition hover:opacity-75 cursor-pointer ${readinessT.badge}`}
              >
                {readinessT.icon} {readinessT.label} →
              </button>
            ) : (
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${readinessT.badge}`}>
                {readinessT.icon} {readinessT.label}
              </span>
            )
          )}

          {canonicalRev && (
            <span className="text-sm font-semibold text-gray-800">
              Rev <span className="font-mono">{canonicalRev}</span>
            </span>
          )}

          {revMeta && revStatus && (
            <span className={`text-sm font-semibold ${revMeta.tone}`}>
              {revMeta.icon} {revStatus}
            </span>
          )}

          <Link href={vaultLink} className="text-xs font-semibold text-blue-600 hover:text-blue-700">
            Open Vault →
          </Link>
        </div>

        {/* Right: pipeline actions */}
        <div className="flex items-center gap-2">
          {onViewBOM && documentPresence.hasBOM && (
            <button
              type="button"
              onClick={onViewBOM}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
            >
              📋 View BOM
            </button>
          )}
          <button
            onClick={onRunPipeline}
            disabled={running || loading || !pipelineRequirementsMet}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 transition"
          >
            {running ? 'Refreshing…' : '🔄 Generate / Refresh'}
          </button>
          {pipelineStatus === 'READY' ? (
            <Link
              href={`/work-instructions?sku=${encodeURIComponent(partNumber)}`}
              className="rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 transition"
            >
              🧾 View Work Instructions
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className="rounded-lg border border-dashed border-gray-200 px-4 py-2 text-sm font-semibold text-gray-400 cursor-not-allowed"
            >
              🧾 View Work Instructions
            </button>
          )}
        </div>
      </div>

      {/* ── ROW 2: Document cards (3-column) ───────────────────────────────── */}
      <div className="grid lg:grid-cols-3 divide-x divide-gray-100">
        {DOCUMENT_DEFS.map(def => {
          const doc        = docByType[def.type];
          const present    = documentPresence[def.presenceKey];
          const currentDoc = present ? doc : null;
          const resolution = canonicalContext && currentDoc
            ? resolveCanonicalDocument(currentDoc, canonicalContext)
            : null;
          const badge = resolution ? CANONICAL_BADGE[resolution.status] : null;

          return (
            <div key={def.type} className="p-5 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-widest text-gray-500">{def.label}</p>
                  <p className="text-[11px] text-gray-400">{def.description}</p>
                </div>
                {badge && badge.label !== '—' && (
                  <span className={`shrink-0 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.tone}`}>
                    {badge.label}
                  </span>
                )}
              </div>

              {currentDoc ? (
                <div className="space-y-1.5">
                  <p className="text-lg font-semibold text-gray-900">Revision {currentDoc.revision}</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${revisionStateTone[currentDoc.revision_state ?? 'UNKNOWN']}`}>
                      {revisionStateLabel[currentDoc.revision_state ?? 'UNKNOWN']}
                    </span>
                    {currentDoc.phantom_rev_flag && (
                      <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
                        PHANTOM REV
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate">{currentDoc.file_name}</p>
                  <p className="text-[11px] text-gray-400">{new Date(currentDoc.uploaded_at).toLocaleDateString()}</p>
                  <a
                    href={currentDoc.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex text-sm font-semibold text-blue-600 hover:text-blue-700"
                  >
                    View document →
                  </a>
                </div>
              ) : (
                <div className="space-y-2 pt-1">
                  <p className="text-sm text-gray-500">Not uploaded yet</p>
                  <Link
                    href={buildUploadLink(def.type)}
                    className="inline-flex rounded-lg border border-dashed border-blue-200 px-3 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                  >
                    Upload {def.label}
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── FOOTER: Revision status · Signals · Readiness ──────────────────── */}
      <div className="border-t border-gray-100 px-6 py-4 bg-gray-50/60 space-y-3">
        {/* Inline revision status */}
        {revMeta && (
          <p className={`text-sm font-semibold ${revMeta.tone}`}>
            {revMeta.icon}{' '}
            {revStatus === 'SYNCHRONIZED'
              ? revMeta.summary
              : (revisionValidation?.recommended_action ?? revMeta.summary)}
          </p>
        )}

        {/* Historical signals strip */}
        {revisionRisk && (
          <div className="flex flex-wrap items-center gap-5 text-xs">
            <span className="font-semibold uppercase tracking-wide text-gray-400">Historical Signals</span>
            {SIGNAL_STATS.map(({ key, label }) => {
              const val = revisionRisk.stats[key] as number;
              return (
                <span key={key} className={`font-semibold ${val > 0 ? 'text-amber-700' : 'text-gray-500'}`}>
                  {label}: <span className="font-mono">{val}</span>
                </span>
              );
            })}
          </div>
        )}

        {/* Inline readiness messaging */}
        {overallReadinessStatus && readinessT && (
          <div className="flex items-start gap-2 text-sm">
            <span className="mt-0.5 shrink-0">{readinessT.icon}</span>
            {readinessReasons.length > 0 ? (
              <ul className="list-disc pl-4 space-y-0.5 text-gray-700">
                {readinessReasons.map(r => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-700">{readinessNextAction}</p>
            )}
          </div>
        )}

        {/* System Assessment — Phase 3H.46 C4 */}
        {alignedReadiness && alignedMessage && (
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">System Assessment</span>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${readinessTone[alignedReadiness].badge}`}>
                {readinessTone[alignedReadiness].icon} {readinessTone[alignedReadiness].label}
              </span>
              {coverageScore !== undefined && (
                <span className={`text-xs font-semibold ${
                  coverageScore > 90 ? 'text-emerald-700'
                    : coverageScore > 70 ? 'text-amber-700'
                    : 'text-red-700'
                }`}>
                  Coverage: {coverageScore}%
                </span>
              )}
            </div>
            <p className="text-sm text-gray-700">
              {alignedReadiness === 'NEEDS_REVIEW'
                ? (coverageScore !== undefined && coverageScore < 90
                    ? 'Incomplete extraction data — rerun pipeline after uploading corrected documents.'
                    : 'Missing wire definitions — review wire attributes in the harness panel.')
                : alignedMessage}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
