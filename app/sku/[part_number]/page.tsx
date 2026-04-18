'use client';

/**
 * DOCUMENT TRUTH CONTRACT
 *
 * All document presence logic MUST flow through documentPresence.
 * No component may independently derive document state from raw documents.
 *
 * This prevents UI drift and inconsistent system behavior.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import SKUControlPanel from '@/src/features/sku/components/SKUControlPanel';
import HarnessStructurePanel from '@/src/features/sku/components/HarnessStructurePanel';
import TruthVerificationPanel from '@/src/features/sku/components/TruthVerificationPanel';
import HarnessVisualizationPanel from '@/src/features/sku/components/HarnessVisualizationPanel';
import BOMDrawer from '@/src/features/sku/components/BOMDrawer';
import InterpretationDebugPanel from '@/src/features/sku/components/InterpretationDebugPanel';
import AdaptivePipelineDebugPanel from '@/src/features/sku/components/AdaptivePipelineDebugPanel';
import type { ExtractionCoverage } from '@/src/features/harness-work-instructions/services/extractionCoverageService';
import type { DrawingInterpretationResult } from '@/src/features/harness-work-instructions/services/drawingInterpretationService';
import type { AdaptiveDrawingAnalysis } from '@/src/features/harness-work-instructions/services/adaptiveDrawingPipelineService';
import { useDashboardReadiness } from '@/src/features/dashboard/hooks/useDashboardReadiness';
import { useRevisionValidationMap } from '@/src/features/revision/hooks/useRevisionValidationMap';
import { useSkuReadiness } from '@/src/features/ppap/hooks/useSkuReadiness';
import {
  applyWireOverrides,
  loadOverrides,
  type WireOverride,
} from '@/src/features/sku/utils/wireOverrides';
import type { ActionIntent } from '@/src/features/revision/hooks/useRecommendedFixActions';
import CorrectiveContextBanner from '@/src/components/CorrectiveContextBanner';
import { deriveIssueKind, parseActionIntentParam } from '@/src/features/revision/utils/correctiveIntent';
import { recordSkuVisit } from '@/src/features/dashboard/userContext';
import { canonicalizePartNumber } from '@/src/utils/canonicalizePartNumber';
import {
  deriveDocumentPresence,
  type DocByTypeMap,
  type DocumentPresence,
  type SupportedDocumentType,
} from '@/src/features/sku/utils/documentPresence';
import {
  resolveCanonicalDocument,
  CANONICAL_STATUS_SORT_ORDER,
  type CanonicalDocumentContext,
  type CanonicalDocumentStatus,
} from '@/src/features/revision/utils/resolveCanonicalDocuments';

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

const CANONICAL_BADGE: Record<CanonicalDocumentStatus, { label: string; tone: string }> = {
  CANONICAL: { label: '⭐ Canonical',        tone: 'bg-yellow-50 text-yellow-800 border border-yellow-200' },
  MATCHING:  { label: '✓ Matches expected', tone: 'bg-emerald-50 text-emerald-700 border border-emerald-100' },
  OUTDATED:  { label: '⚠ Outdated',          tone: 'bg-amber-50 text-amber-700 border border-amber-100' },
  CONFLICT:  { label: '🔥 Conflict',         tone: 'bg-red-50 text-red-700 border border-red-100' },
  PENDING:   { label: '⏳ Pending SKU',       tone: 'bg-gray-100 text-gray-600 border border-gray-200' },
  UNLINKED:  { label: '⚠ Unlinked',          tone: 'bg-orange-50 text-orange-700 border border-orange-100' },
  UNKNOWN:   { label: '—',                   tone: 'bg-gray-100 text-gray-500 border border-gray-200' },
};



const ALIGNED_READINESS_MESSAGES: Record<ReadinessStatus, string> = {
  READY:                'Ready for work instruction generation',
  READY_LOW_CONFIDENCE: 'Ready (some fields inferred or user-corrected)',
  NEEDS_REVIEW:         'Requires review — incomplete or uncertain data',
  PARTIAL:              'Partially ready — some data is missing or unresolved',
  BLOCKED:              'Cannot proceed — missing critical data',
};

interface PipelineSummary {
  wires: number;
  pinMapRows: number;
  komaxSetup: number;
  pressSetup: number;
  generatedAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getRecord(value: Record<string, unknown> | null | undefined, key: string): Record<string, unknown> | null {
  if (!value) return null;
  const candidate = (value as Record<string, unknown>)[key];
  return isRecord(candidate) ? candidate : null;
}

function getArray<T = unknown>(value: Record<string, unknown> | null | undefined, key: string): T[] | null {
  if (!value) return null;
  const candidate = value[key];
  return Array.isArray(candidate) ? (candidate as T[]) : null;
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
  const [bomOpen, setBomOpen] = useState(false);
  const [summary, setSummary] = useState<PipelineSummary | null>(null);
  const [pipelineJob, setPipelineJob] = useState<HarnessInstructionJob | null>(null);
  const [pipelineCoverage, setPipelineCoverage]           = useState<ExtractionCoverage | undefined>(undefined);
  const [pipelineInterpretation, setPipelineInterpretation] = useState<DrawingInterpretationResult | undefined>(undefined);
  const [pipelineAdaptiveAnalysis, setPipelineAdaptiveAnalysis] = useState<AdaptiveDrawingAnalysis | undefined>(undefined);
  const [pipelineHasStructuredData, setPipelineHasStructuredData] = useState(false);
  const [wireOverrides, setWireOverrides] = useState<Record<string, WireOverride>>({});
  const [pipelineStatus, setPipelineStatus] = useState<'idle' | 'READY' | 'PARTIAL'>('idle');
  const autoRunSignature = useRef<string | null>(null);
  const revisionSectionRef    = useRef<HTMLDivElement | null>(null);
  const truthRef               = useRef<HTMLDivElement | null>(null);
  const visualizationRef       = useRef<HTMLDivElement | null>(null);
  const [revisionHighlightActive,  setRevisionHighlightActive]  = useState(false);
  const [readinessHighlightActive, setReadinessHighlightActive] = useState(false);
  const [highlightSection,         setHighlightSection]         = useState<'truth' | 'visualization' | null>(null);

  const partNumber = sku?.part_number ?? partNumberParam?.toUpperCase() ?? '';
  const displayPartNumber = (partNumberParam || partNumber || '').toUpperCase();
  const hookPartNumber = useMemo(() => {
    const p = partNumberParam?.trim();
    if (!p || p.toLowerCase() === 'undefined') return null;
    return p.toUpperCase();
  }, [partNumberParam]);
  const hookPartArray = useMemo(() => (hookPartNumber ? [hookPartNumber] : []), [hookPartNumber]);
  const {
    summaries: dashboardHookSummaries,
    isLoadingAny: dashboardHookLoading,
  } = useDashboardReadiness(hookPartArray);
  const dashboardHookSummary = hookPartNumber ? dashboardHookSummaries[hookPartNumber] : null;
  const { validationMap: hookRevisionValidationMap, pending: hookRevisionPending } = useRevisionValidationMap(hookPartArray);
  const hookRevisionValidation = hookPartNumber ? hookRevisionValidationMap[hookPartNumber] : null;
  const {
    readiness: hookSkuReadiness,
    revisionValidation: hookSkuRevisionValidation,
    loading: hookSkuReadinessLoading,
    error: hookSkuReadinessError,
  } = useSkuReadiness(hookPartNumber);
  useEffect(() => {
    console.log('[T23.6.39 PARAM TRACE]', {
      stage: 'ROUTE_PARAM',
      file: 'app/sku/[part_number]/page.tsx',
      function: 'SKUDashboardPage',
      routeParam: params?.part_number ?? null,
      partNumber: partNumberParam || null,
      canonicalPartNumber: canonicalizePartNumber(partNumberParam),
      note: 'Decoded route param inside SKUDashboardPage',
    });
    console.log('[T23.6.39 PARAM TRACE]', {
      stage: 'PAGE_PROP',
      file: 'app/sku/[part_number]/page.tsx',
      function: 'SKUDashboardPage',
      routeParam: params?.part_number ?? null,
      partNumber: partNumber || null,
      canonicalPartNumber: canonicalizePartNumber(partNumber),
      note: 'Resolved page-level partNumber used for downstream hooks',
    });
    console.log('[T23.6.47 INPUT STABILIZED]', {
      source: 'partNumberParam (stable route param only, not sku state)',
      partNumberParam,
      hookPartNumber,
      partNumber,
      note: 'hookPartNumber decoupled from sku?.part_number to stop re-fetch on sku load',
    });
  }, [partNumberParam, partNumber, hookPartNumber]);

  useEffect(() => {
    console.log('[T23.6.45 BINDING CHECK]', {
      routeParam: params?.part_number ?? null,
      pagePartNumber: partNumber || null,
      hookInputPartNumber: hookPartNumber,
      canonicalRouteParam: partNumberParam ? canonicalizePartNumber(partNumberParam) : null,
    });
  }, [params?.part_number, partNumber, hookPartNumber, partNumberParam]);
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

  const readinessReasons = useMemo(() => {
    if (readinessBlockers.length > 0) {
      return readinessBlockers.slice(0, 2);
    }
    if (readinessWarnings.length > 0) {
      return readinessWarnings.slice(0, 2);
    }
    return readiness?.issues?.slice(0, 2).map(issue => issue.message) ?? [];
  }, [readinessBlockers, readinessWarnings, readiness?.issues]);

  async function loadSKU() {
    const canonicalParam = canonicalizePartNumber(partNumberParam);
    const fetchUrl = partNumberParam ? `/api/sku/get?partNumber=${encodeURIComponent(partNumberParam)}` : null;
    console.log('[T23.6.39 FETCH TRACE]', {
      stage: 'FETCH_CALL',
      file: 'app/sku/[part_number]/page.tsx',
      function: 'loadSKU',
      routeParam: params?.part_number ?? null,
      partNumber: partNumberParam || null,
      canonicalPartNumber: canonicalParam,
      url: fetchUrl,
      blocked: !partNumberParam,
      note: 'SKU page initial fetch trigger',
    });
    if (!partNumberParam || partNumberParam.toLowerCase() === 'undefined') {
      console.warn('[T23.6.45 BLOCKED FETCH]', {
        partNumber: partNumberParam ?? null,
        reason: !partNumberParam ? 'missing route param' : 'string literal "undefined" detected',
      });
      console.warn('[T23.6.47 BLOCKED INVALID FETCH]', { context: 'loadSKU', partNumberParam, reason: 'missing or undefined route param — hard block' });
      return;
    }
    console.log('[T23.6.47 STABLE FETCH]', { partNumberParam, hookPartNumber, note: 'proceeding with valid stable route param' });
    try {
      setLoading(true);
      console.log('[T23.6.37 TRACE]', {
        stage: 'API',
        function: 'sku/[part_number]:loadSKU',
        rawPart: partNumberParam,
        canonicalPart: canonicalizePartNumber(partNumberParam),
        outgoingValue: `/api/sku/get?partNumber=${partNumberParam}`,
        note: 'SKU page initial fetch',
      });
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
    if ((tabParam === 'revision' || tabParam === 'readiness') && revisionSectionRef.current) {
      revisionSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [tabParam, loading]);

  useEffect(() => {
    if (!partNumber) return;
    const saved = loadOverrides(partNumber);
    if (Object.keys(saved).length > 0) {
      setWireOverrides(saved);
    }
  }, [partNumber]);

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

  const docByType = useMemo<DocByTypeMap>(() => {
    const map: DocByTypeMap = {
      BOM: null,
      CUSTOMER_DRAWING: null,
      INTERNAL_DRAWING: null,
    };
    for (const doc of documents) {
      if (doc.revision_state === 'CURRENT' && (doc.document_type === 'BOM' || doc.document_type === 'CUSTOMER_DRAWING' || doc.document_type === 'INTERNAL_DRAWING')) {
        map[doc.document_type as SupportedDocumentType] = doc;
      }
    }
    return map;
  }, [documents]);

  const isDevelopment = process.env.NODE_ENV === 'development';

  const documentPresence = useMemo<DocumentPresence>(() => deriveDocumentPresence(docByType), [docByType]);
  const bomDocument = docByType.BOM;
  const bomEvidence = (bomDocument?.extraction_evidence as Record<string, unknown> | null) ?? null;
  const bomStructuredData = getRecord(bomEvidence, 'structured_data');
  const bomDocumentStructure = getRecord(bomEvidence, 'document_structure');
  const bomWireTableResult = isRecord(bomStructuredData) ? getRecord(bomStructuredData, 'wireTableResult') : null;
  const bomParsedRows = isRecord(bomStructuredData) ? getArray<Record<string, unknown>>(bomStructuredData, 'parsedRows') : null;
  useEffect(() => {
    console.log('[T23.6.45 BOM VIEW]', {
      parsedRows: bomParsedRows?.slice(0, 5) ?? null,
      wireTableResultCount: bomWireTableResult ? (Array.isArray(bomWireTableResult.rows) ? bomWireTableResult.rows.length : bomWireTableResult.rowCount ?? null) : null,
      structuredDataKeys: bomStructuredData ? Object.keys(bomStructuredData) : null,
    });
  }, [bomParsedRows, bomWireTableResult, bomStructuredData]);

  if (isDevelopment) {
    if (documentPresence.hasBOM && !docByType.BOM) {
      console.warn('DOCUMENT CONTRACT VIOLATION: BOM presence mismatch');
    }
    if (
      documentPresence.hasAnyDrawing &&
      !(docByType.CUSTOMER_DRAWING || docByType.INTERNAL_DRAWING)
    ) {
      console.warn('DOCUMENT CONTRACT VIOLATION: Drawing presence mismatch');
    }
  }

  const documentDebug = isDevelopment
    ? {
        totalDocuments: documents.length,
        docTypesPresent: Object.keys(docByType),
        presence: documentPresence,
      }
    : null;

  const documentConfidence = useMemo(() => {
    if (documentPresence.hasBOM && documentPresence.hasAnyDrawing) {
      return { icon: '🟢', label: 'Documents Verified', tone: 'text-emerald-700' };
    }
    if (documentPresence.hasBOM || documentPresence.hasAnyDrawing) {
      return { icon: '🟡', label: 'Partial Document Set', tone: 'text-amber-700' };
    }
    return { icon: '🔴', label: 'Missing Required Documents', tone: 'text-red-700' };
  }, [documentPresence]);

  const pipelineRequirementsMet = documentPresence.hasBOM && documentPresence.hasAnyDrawing;

  const buildUploadLink = useCallback(
    (docType: SupportedDocumentType) => {
      const params = new URLSearchParams();
      params.set('docType', docType);
      params.set('actionIntent', 'UPLOAD_MISSING_DOC');
      if (partNumber) {
        params.set('part', partNumber);
      }
      return `/vault?${params.toString()}`;
    },
    [partNumber],
  );

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
        setPipelineJob(job);
        setPipelineCoverage((json.coverage as ExtractionCoverage | undefined) ?? undefined);
        setPipelineInterpretation((json.interpretation as DrawingInterpretationResult | undefined) ?? undefined);
        setPipelineAdaptiveAnalysis((json.adaptive_analysis as AdaptiveDrawingAnalysis | undefined) ?? undefined);
        setPipelineHasStructuredData(Boolean(json.adaptive_has_structured_data));
      } else {
        setSummary(null);
        setPipelineJob(null);
        setPipelineCoverage(undefined);
        setPipelineInterpretation(undefined);
        setPipelineAdaptiveAnalysis(undefined);
        setPipelineHasStructuredData(false);
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
    console.log('[T23.6.47 LOOP TRACE]', { effect: 'auto-pipeline', loading, skuId: sku?.id ?? null, hasBOM: documentPresence.hasBOM, hasDrawing: documentPresence.hasAnyDrawing, signature: autoRunSignature.current });
    if (loading) return;
    if (!sku || !documentPresence.hasBOM || !documentPresence.hasAnyDrawing) {
      setPipelineStatus('PARTIAL');
      setSummary(null);
      autoRunSignature.current = null;
      return;
    }
    const currentBOM = docByType.BOM;
    const currentDrawing = docByType.INTERNAL_DRAWING ?? docByType.CUSTOMER_DRAWING;
    if (!currentBOM || !currentDrawing) {
      setPipelineStatus('PARTIAL');
      setSummary(null);
      autoRunSignature.current = null;
      return;
    }
    const sig = `${currentBOM.id}:${currentDrawing.id}`;
    if (autoRunSignature.current === sig) return;
    autoRunSignature.current = sig;
    runPipeline('auto');
  }, [docByType, documentPresence.hasBOM, documentPresence.hasAnyDrawing, sku?.id, loading]);

  const effectiveWires = useMemo(
    () => applyWireOverrides(pipelineJob?.wire_instances ?? [], wireOverrides),
    [pipelineJob, wireOverrides],
  );

  const wireCount      = effectiveWires.length;
  const terminalCount  = effectiveWires.filter(
    w => w.end_a.terminal_part_number || w.end_b.terminal_part_number,
  ).length;
  const connectorCount = effectiveWires.filter(
    w => w.end_a.connector_id || w.end_b.connector_id,
  ).length;
  const pinMapCount    = pipelineJob?.pin_map_rows?.length ?? 0;
  const hasStructureData = wireCount > 0;

  const hasWires         = effectiveWires.length > 0;
  const hasValidRevision = revisionValidation?.status === 'SYNCHRONIZED';
  const coverageScore    = pipelineCoverage?.coverageScore ?? 0;

  let alignedReadiness: ReadinessStatus;
  if (!hasWires) {
    alignedReadiness = 'BLOCKED';
  } else if (!hasValidRevision) {
    alignedReadiness = 'NEEDS_REVIEW';
  } else if (coverageScore >= 90) {
    alignedReadiness = 'READY';
  } else if (coverageScore >= 70) {
    alignedReadiness = 'READY_LOW_CONFIDENCE';
  } else {
    alignedReadiness = 'NEEDS_REVIEW';
  }

  const alignedMessage = ALIGNED_READINESS_MESSAGES[alignedReadiness];

  useEffect(() => {
    console.log('[READINESS ALIGNMENT]', {
      coverageScore,
      hasWires,
      hasValidRevision,
      status: alignedReadiness,
    });
  }, [coverageScore, hasWires, hasValidRevision, alignedReadiness]);

  const routeToIssue = useCallback(() => {
    const hasCoverageIssues = coverageScore < 90;
    const missingWireCount  = effectiveWires.filter(w =>
      !w.cut_length || !w.end_a?.terminal_part_number || !w.end_a?.connector_id
    ).length;
    const hasMissingWires = missingWireCount > 0;

    let target: 'truth' | 'visualization' | null = null;

    if (hasCoverageIssues) {
      truthRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setHighlightSection('truth');
      target = 'truth';
    } else if (hasMissingWires) {
      visualizationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setHighlightSection('visualization');
      target = 'visualization';
    }

    console.log('[GUIDED ROUTING]', { target, coverageScore, missingWireCount });
  }, [pipelineCoverage, effectiveWires, coverageScore]);

  useEffect(() => {
    if (!highlightSection) return;
    const t = setTimeout(() => setHighlightSection(null), 3000);
    return () => clearTimeout(t);
  }, [highlightSection]);

  useEffect(() => {
    console.log('[HARNESS STRUCTURE]', {
      wireCount,
      terminalCount,
      connectorCount,
      pinMapCount,
    });
  }, [wireCount, terminalCount, connectorCount, pinMapCount]);

  useEffect(() => {
    console.log('[T23.6.47 ROOT CAUSE SUMMARY]', {
      phase: 'T23.6.47',
      partNumberParam,
      hookPartNumber,
      fixes: [
        'hookPartNumber derived from partNumberParam only (stable route param, not sku state)',
        'useRevisionValidationMap: removed validationMap/pending from deps, using refs for in-flight guards',
        'VaultDocumentTable details debug tabs: stopPropagation to prevent navigation on toggle',
        'undefined check: case-insensitive (toLowerCase) in all hooks and loadSKU',
        'render-level param trace logs moved into useEffect hooks',
      ],
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canonicalContext = useMemo<CanonicalDocumentContext | null>(() => {
    if (!revisionValidation?.canonical_revision) return null;
    return {
      skuCanonicalRevision: revisionValidation.canonical_revision,
      skuCanonicalSource: revisionValidation.canonical_source,
      comparisons: revisionValidation.comparisons ?? [],
      expectedApogeeDrawingNumber: expectedDrawings?.apogee?.drawing_number ?? null,
    };
  }, [revisionValidation, expectedDrawings]);

  const sortedDocuments = useMemo(() => {
    if (!canonicalContext) return documents;
    return [...documents].sort((a, b) => {
      const aOrder = CANONICAL_STATUS_SORT_ORDER[
        resolveCanonicalDocument(a, canonicalContext).status
      ];
      const bOrder = CANONICAL_STATUS_SORT_ORDER[
        resolveCanonicalDocument(b, canonicalContext).status
      ];
      if (aOrder !== bOrder) return aOrder - bOrder;
      return new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime();
    });
  }, [documents, canonicalContext]);

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
          <h1 className="text-3xl font-bold text-[color:var(--text-primary)]">{displayPartNumber || 'SKU Not Found'}</h1>
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
            partNumber={displayPartNumber}
            expectedRevision={expectedRevisionHint}
            canonicalSource={canonicalSourceHint}
            issueType={correctiveIssueKind}
            location="sku"
          />
        )}

        {!loading && sku && (
          <SKUControlPanel
            partNumber={partNumber}
            vaultLink={vaultLink}
            sectionRef={revisionSectionRef}
            highlightActive={revisionHighlightActive || readinessHighlightActive}
            docByType={docByType}
            documentPresence={documentPresence}
            documentConfidence={documentConfidence}
            buildUploadLink={buildUploadLink}
            canonicalContext={canonicalContext}
            revisionValidation={revisionValidation}
            revisionRisk={revisionRisk}
            readiness={readiness}
            overallReadinessStatus={overallReadinessStatus}
            readinessNextAction={readinessNextAction}
            readinessReasons={readinessReasons}
            alignedReadiness={alignedReadiness}
            alignedMessage={alignedMessage}
            coverageScore={pipelineCoverage?.coverageScore}
            pipelineStatus={pipelineStatus}
            running={running}
            loading={loading}
            pipelineRequirementsMet={pipelineRequirementsMet}
            onRunPipeline={() => runPipeline('manual')}
            onViewBOM={() => setBomOpen(true)}
            onResolveIssues={routeToIssue}
          />
        )}

        {sku && !sku.description && !loading && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            This SKU stub was auto-created from a document upload. Add more documents to fill in the description and
            complete the record.
          </div>
        )}



        <section className="rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--surface-elevated)] p-5 space-y-4">
          <div className="flex flex-col gap-1">
            <p className="text-xs uppercase tracking-[0.4em] text-blue-500">BOM Extraction Visibility</p>
            <h2 className="text-2xl font-semibold text-[color:var(--text-primary)]">T23.6.45 Inspection Panel</h2>
            <p className="text-sm text-gray-500">
              Surface raw parsed rows, structured model output, and wire table traces captured during ingestion.
            </p>
            <div className="text-xs text-gray-500">
              <span className="font-semibold">Hook Readiness Sync:</span>{' '}
              {hookSkuReadinessLoading || dashboardHookLoading || hookRevisionPending.size > 0 ? 'Loading…' : 'Ready'} ·{' '}
              <span className="font-semibold">Readiness Snapshot:</span>{' '}
              {dashboardHookSummary?.readiness_tier ?? hookSkuReadiness?.overall_status ?? '—'} ·{' '}
              <span className="font-semibold">Revision Validation:</span>{' '}
              {hookSkuRevisionValidation?.status ?? hookRevisionValidation?.status ?? '—'}
              {hookSkuReadinessError && (
                <span className="ml-2 text-red-600">{hookSkuReadinessError}</span>
              )}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-dashed border-blue-200 bg-white/70 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Parsed Rows Sample</p>
              {bomParsedRows && bomParsedRows.length > 0 ? (
                <pre className="mt-2 max-h-60 overflow-auto rounded-lg bg-slate-900/90 p-3 text-[11px] text-emerald-200">
                  {JSON.stringify(bomParsedRows.slice(0, 10), null, 2)}
                </pre>
              ) : (
                <p className="mt-2 text-xs text-gray-500">No parsedRows captured on BOM document.</p>
              )}
            </div>

            <div className="rounded-xl border border-dashed border-amber-200 bg-white/70 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">Wire Table Result</p>
              {bomWireTableResult ? (
                <pre className="mt-2 max-h-60 overflow-auto rounded-lg bg-slate-900/90 p-3 text-[11px] text-amber-100">
                  {JSON.stringify(bomWireTableResult, null, 2)}
                </pre>
              ) : (
                <p className="mt-2 text-xs text-gray-500">wireTableResult missing — confirm ingestion logs.</p>
              )}
            </div>

            <div className="rounded-xl border border-dashed border-emerald-200 bg-white/70 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Structured Data Model</p>
              {bomStructuredData ? (
                <pre className="mt-2 max-h-60 overflow-auto rounded-lg bg-slate-900/90 p-3 text-[11px] text-emerald-100">
                  {JSON.stringify(bomStructuredData, null, 2)}
                </pre>
              ) : (
                <p className="mt-2 text-xs text-gray-500">Structured model output unavailable for this BOM.</p>
              )}
            </div>
          </div>

          {bomDocumentStructure && (
            <details className="rounded-xl border border-[color:var(--panel-border)] bg-white/70 p-4 text-sm text-gray-700">
              <summary className="cursor-pointer font-semibold text-gray-900">Document Structure Detection</summary>
              <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-slate-900/90 p-3 text-[11px] text-sky-100">
                {JSON.stringify(bomDocumentStructure, null, 2)}
              </pre>
            </details>
          )}

          <div className="rounded-xl border border-dashed border-gray-300 bg-white/40 p-4 text-xs text-gray-600">
            <p className="font-semibold text-gray-800">Console Tap</p>
            <p className="mt-1">
              Inspect <code className="font-mono">[T23.6.45 BOM VIEW]</code> and <code className="font-mono">[T23.6.45 BINDING CHECK]</code> logs to verify
              data propagation and parser fidelity before acting on readiness.
            </p>
          </div>
        </section>



        <section className="rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--surface-elevated)] p-5 space-y-4">
          <div className="flex flex-col gap-1">
            <p className="text-xs uppercase tracking-[0.4em] text-purple-500">Document Linkage Audit</p>
            <h2 className="text-2xl font-semibold text-[color:var(--text-primary)]">Canonical vs Raw Inventory</h2>
            <p className="text-sm text-gray-500">
              Compare canonical SKU binding to inferred document part numbers and highlight missing assets before pipeline execution.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-dashed border-purple-200 bg-white/60 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-purple-600">Linked Documents</p>
              <ul className="mt-2 space-y-1 text-sm text-gray-700">
                {documents.length > 0 ? (
                  documents.map(doc => (
                    <li key={doc.id} className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-gray-500">{doc.document_type}</span>
                      <span className="font-semibold text-gray-900">{doc.file_name}</span>
                      <span className="text-xs text-gray-500">rev {doc.canonical_revision ?? doc.revision ?? '—'}</span>
                      {doc.inferred_part_number && (
                        <span className="text-xs text-blue-600">
                          inferred PN: <span className="font-mono">{doc.inferred_part_number}</span>
                        </span>
                      )}
                    </li>
                  ))
                ) : (
                  <li className="text-xs text-gray-500">No documents attached yet.</li>
                )}
              </ul>
            </div>

            <div className="rounded-xl border border-dashed border-rose-200 bg-white/60 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-600">Missing Coverage</p>
              <ul className="mt-2 space-y-1 text-sm text-gray-700">
                {!documentPresence.hasBOM && <li>Missing BOM upload</li>}
                {!documentPresence.hasCustomerDrawing && <li>Missing customer drawing</li>}
                {!documentPresence.hasInternalDrawing && <li>Missing internal drawing</li>}
                {documentPresence.hasBOM && documentPresence.hasCustomerDrawing && documentPresence.hasInternalDrawing && (
                  <li className="text-xs text-gray-500">All key document types present.</li>
                )}
              </ul>
              <div className="mt-3 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">
                <p className="font-semibold">Canonical vs Raw</p>
                <p>
                  Canonical: <span className="font-mono">{canonicalizePartNumber(partNumber)}</span>
                </p>
                <p>
                  Route Param: <span className="font-mono">{partNumberParam || '—'}</span>
                </p>
                <p>
                  Hook Input: <span className="font-mono">{hookPartNumber ?? 'null'}</span>
                </p>
              </div>
            </div>
          </div>
        </section>



        <HarnessStructurePanel
          wireCount={wireCount}
          terminalCount={terminalCount}
          connectorCount={connectorCount}
          pinMapCount={pinMapCount}
          hasData={hasStructureData}
        />

        <div
          ref={visualizationRef}
          className={`rounded-2xl transition-all duration-300 ${
            highlightSection === 'visualization' ? 'ring-2 ring-amber-400 shadow-lg shadow-amber-100' : ''
          }`}
        >
          <HarnessVisualizationPanel
            wires={effectiveWires}
            pinMapCount={pinMapCount > 0 ? pinMapCount : undefined}
          />
        </div>

        <div className="mt-2">
          <AdaptivePipelineDebugPanel
            analysis={pipelineAdaptiveAnalysis}
            hasStructuredData={pipelineHasStructuredData}
            hasInterpretation={Boolean(pipelineInterpretation)}
            hasCoverage={Boolean(pipelineCoverage)}
          />
        </div>

        <div className="mt-2">
          <InterpretationDebugPanel
            interpretation={pipelineInterpretation}
            isHighlighted={highlightSection === 'truth'}
          />
        </div>

        <div
          ref={truthRef}
          className={`rounded-2xl transition-all duration-300 ${
            highlightSection === 'truth' ? 'ring-2 ring-amber-400 shadow-lg shadow-amber-100' : ''
          }`}
        >
          <TruthVerificationPanel
            partNumber={partNumber}
            coverage={pipelineCoverage}
            wires={effectiveWires}
            onOverridesUpdated={setWireOverrides}
          />
        </div>

        <section className="rounded-2xl border border-dashed border-[color:var(--panel-border)] bg-[color:var(--surface-elevated)] p-5 space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-[color:var(--text-primary)]">Pipeline</h2>
                <div className="mt-2 inline-flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Status</span>
                  <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${
                    pipelineStatus === 'READY'
                      ? 'bg-emerald-100 text-emerald-700'
                      : pipelineStatus === 'idle'
                        ? 'bg-[color:var(--panel-bg)] text-[color:var(--text-secondary)]'
                        : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {pipelineStatus === 'READY' ? 'READY' : pipelineStatus === 'idle' ? 'IDLE' : 'WAITING FOR DOCUMENTS'}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {pipelineStatus === 'READY'
                    ? 'Latest documents have generated a full harness instruction job.'
                    : !documentPresence.hasBOM && !documentPresence.hasAnyDrawing
                      ? 'Upload a BOM and at least one drawing to build instructions automatically.'
                      : !documentPresence.hasBOM
                        ? 'Upload a BOM to unlock the pipeline for this SKU.'
                        : !documentPresence.hasAnyDrawing
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
                    className="rounded-xl border border-dashed border-[color:var(--panel-border)] py-2.5 text-center text-sm font-semibold text-gray-400 cursor-not-allowed"
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
              <div className="rounded-xl border border-dashed border-[color:var(--panel-border)] px-4 py-3 text-sm text-gray-500">
                {pipelineStatus === 'READY'
                  ? 'Pipeline ready — run to refresh the latest instructions.'
                  : 'Pipeline results will appear here once both BOM and drawing are stored.'}
              </div>
            )}
        </section>

        {message && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {message}
          </div>
        )}

        <section className="rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--surface-elevated)] p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[color:var(--text-primary)]">Document Revisions</h2>
              <p className="text-sm text-gray-500">Full revision log per document type.</p>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-[color:var(--panel-border)]">
              <thead>
                <tr className="text-left text-sm text-gray-500">
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">Revision</th>
                  <th className="px-4 py-2">Authority</th>
                  <th className="px-4 py-2">File</th>
                  <th className="px-4 py-2">Status / Integrity</th>
                  <th className="px-4 py-2">Uploaded</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--panel-border)] text-sm">
                {sortedDocuments.map(doc => {
                  const resolution = resolveCanonicalDocument(doc, canonicalContext);
                  const authBadge = CANONICAL_BADGE[resolution.status];
                  return (
                  <tr key={doc.id}>
                    <td className="px-4 py-2 font-medium text-[color:var(--text-primary)]">{sectionDescription(doc.document_type)}</td>
                    <td className="px-4 py-2">{doc.canonical_revision ?? doc.normalized_revision ?? '—'}</td>
                    <td className="px-4 py-2">
                      <div className="flex flex-col gap-0.5">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${authBadge.tone}`}>
                          {authBadge.label}
                        </span>
                        {resolution.status !== 'UNKNOWN' && (
                          <span className="text-[11px] text-gray-500 max-w-[160px] leading-tight">{resolution.reason}</span>
                        )}
                      </div>
                    </td>
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
                                  {doc.phantom_diff_summary.added_lines.map((line: string) => (
                                    <li key={line}>{line}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {doc.phantom_diff_summary.removed_lines.length > 0 && (
                              <div>
                                <p className="text-[11px] uppercase text-amber-600">Removed</p>
                                <ul className="mt-1 space-y-1 font-mono text-[11px]">
                                  {doc.phantom_diff_summary.removed_lines.map((line: string) => (
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
                  );
                })}
                {documents.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                      No documents uploaded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <BOMDrawer
        isOpen={bomOpen}
        onClose={() => setBomOpen(false)}
        partNumber={partNumber}
      />
    </EMIPLayout>
  );
}
