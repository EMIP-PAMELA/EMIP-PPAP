/**
 * Analyze Ingestion Service — Phase 3H.31
 *
 * Runs all extraction and analysis passes on a document WITHOUT writing to the database.
 * Returns a structured IngestionAnalysisResult with proposed values, confidence indicators,
 * extraction evidence, and a list of unresolved questions that must be answered before commit.
 *
 * Governance:
 *   - This function MUST NOT call any Supabase insert/update operations.
 *   - Read-only DB lookups (alias resolution, drawing lookup) are permitted.
 *   - Extraction/heuristic results are ADVISORY — they suggest values, never authoritatively set them.
 *   - The caller is responsible for ensuring all BLOCKING questions are answered before commit.
 *
 * TODO (future): Refactor ingestAndProcessDocument to share the extraction logic via this module,
 * eliminating duplication. For now, both paths run independently to avoid breaking the existing
 * ingestion pipeline.
 */

import { detectDocumentType } from '@/src/features/vault/utils/documentSignals';
import { extractEngineeringMasterIdentifiers } from '@/src/utils/extractEngineeringMasterIdentifiers';
import { extractEngineeringMasterRevision } from '@/src/utils/extractEngineeringMasterRevision';
import { extractRheemDrawingRevision } from '@/src/utils/extractRheemDrawingRevision';
import { extractApogeeDrawingRevision } from '@/src/utils/extractApogeeDrawingRevision';
import { extractRevisionSignal, type RevisionSource } from '@/src/utils/revisionParser';
import { extractPartNumberFromText, extractPartNumberFromFilename } from '@/src/utils/extractPartNumber';
import { extractDrawingNumberFromText, extractDrawingNumberFromFilename } from '@/src/utils/extractDrawingNumber';
import { ingestDrawingPdf } from './drawingIngestionService';
import { parseRheemDrawing, detectRheemDrawing, type RheemDrawingModel } from './rheemDrawingParser';
import type { SignalSource } from '../utils/resolveDocumentSignals';
import { analyzeDocumentStructure } from './documentStructureAnalyzer';
import { extractTitleBlockAndRevisionRegions, scanForApogeePN45, type TitleBlockExtractionResult } from './titleBlockRegionExtractor';
import { detectWireTableRegion } from './wireTableRegionExtractor';
import { parseWireTableRows } from './wireTableParser';
import { buildHarnessConnectivity, type HarnessConnectivityResult } from './harnessConnectivityService';
import { isolateDiagramLines, extractDiagramComponents, mergeWithVisionResult, type DiagramExtractionResult } from './diagramExtractor';
import { reconcileHarnessConnectivity, type HarnessReconciliationResult } from './harnessReconciliationService';
import { classifyHarnessEndpoints, type HarnessEndpointClassificationResult } from './endpointClassifier';
import { validateHarness, type HarnessValidationResult } from './harnessValidationService';
import { adjustHarnessConfidence, type HarnessConfidenceResult } from './harnessConfidenceService';
import { evaluateHarnessDecision, type HarnessDecisionResult } from './harnessDecisionService';
import {
  runAIDrawingVisionParse,
  runTitleBlockCropVisionParse,
  runFallbackTitleBlockVisionParse,
  runDiagramComponentParse,
  mergeVisionParsedData,
  type VisionParsedDrawingResult,
  type TitleBlockCropVisionResult,
} from './aiDrawingVisionService';
import { extractRegionsWithAI } from './aiRegionExtractor';
import { resolveAliasFromDB } from './aliasService';
import { resolvePartNumberFromDrawing } from './drawingLookupService';
import type {
  ExtractionFragment,
  EvidenceSignal,
  DocumentExtractionEvidence,
  FieldExtraction,
  FieldExtractionSource,
  ResolutionMode,
} from '../types/extractionEvidence';
import type { RegionOverlay } from '../types/documentRegionOverlay';
import type { DocumentType } from './skuService';
import type {
  IngestionAnalysisResult,
  UnresolvedQuestion,
} from '@/src/features/vault/types/ingestionReview';

// ---------------------------------------------------------------------------
// Internal helpers (duplicated from unifiedIngestionService — see TODO above)
// ---------------------------------------------------------------------------

function deriveRevisionFromBOM(text: string): string | null {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0 && l.length < 200);
  for (const line of lines.slice(0, 40)) {
    const m = line.match(/\b(?:REV(?:ISION)?|REVISION\s*LEVEL|REV\.?\s*NO\.?)[:\s.]*([A-Z0-9]{1,4})\b/i);
    if (!m) continue;
    const candidate = m[1].toUpperCase();
    if (/^\d+$/.test(candidate)) continue;
    return candidate;
  }
  return null;
}

const REJECT_REVISION_FRAGMENTS = new Set([
  'ISED', 'EVISED', 'EVISION', 'ISE', 'REVIS', 'EVISE',
]);

function isStrictRevisionToken(value: string | null | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toUpperCase();
  if (v.length === 0 || v.length > 4) return false;
  if (REJECT_REVISION_FRAGMENTS.has(v)) return false;
  return /^(?:[A-Z]{1,4}|\d{1,2})$/.test(v);
}

type FieldKey = 'REVISION' | 'DRAWING_NUMBER' | 'PART_NUMBER';
type PipelineMode = 'BOM' | 'DRAWING';
type DrawingSubtype = 'INTERNAL_DRAWING' | 'CUSTOMER_DRAWING' | 'DRAWING_UNKNOWN' | 'N/A';
type CandidateSignalSource = Exclude<SignalSource, 'NONE'>;

interface FieldSignalCandidate {
  field: FieldKey;
  value: string;
  source: CandidateSignalSource;
  confidence: number;
  regionLabel: RegionOverlay['label'] | 'FILENAME' | 'UNKNOWN';
  regionId?: string | null;
}

type DrawingSignalCandidate = {
  field: FieldKey;
  value: string;
  source: CandidateSignalSource;
  confidence: number;
  regionLabel: FieldSignalCandidate['regionLabel'];
};

interface DrawingExtractionResult {
  candidates: DrawingSignalCandidate[];
  description: string | null;
  rheemModel?: RheemDrawingModel | null;
}

function candidateToEvidenceSignal(
  candidate: FieldSignalCandidate,
  ignoredReason: string | null = null,
): EvidenceSignal {
  return {
    source: candidate.source,
    value: candidate.value,
    confidence: candidate.confidence,
    region_label: candidate.regionLabel,
    ignored_reason: ignoredReason,
    priority_tag: candidate.source,
  };
}

const FIELD_REGION_MAP: Record<FieldKey, Set<RegionOverlay['label']>> = {
  REVISION:       new Set(['REVISION', 'TITLE_BLOCK', 'TITLE_BLOCK_REGION', 'REVISION_REGION']),
  DRAWING_NUMBER: new Set(['DRAWING_NUMBER', 'TITLE_BLOCK', 'TITLE_BLOCK_REGION']),
  PART_NUMBER:    new Set(['TITLE_BLOCK', 'TITLE_BLOCK_REGION']),
};
// C12.2: Crop sources use TITLE_BLOCK_REGION label — already in FIELD_REGION_MAP above.

const BOM_FIELD_REGION_MAP: Record<FieldKey, Set<RegionOverlay['label']>> = {
  REVISION: new Set(['REVISION', 'TITLE_BLOCK', 'TABLE', 'UNKNOWN']),
  DRAWING_NUMBER: new Set(['DRAWING_NUMBER', 'TITLE_BLOCK', 'TABLE', 'UNKNOWN']),
  PART_NUMBER: new Set(['TITLE_BLOCK', 'TABLE', 'UNKNOWN']),
};

const NOISE_WORDS = new Set(['TORQUE', 'COLOR', 'COLOUR', 'WIRE', 'NOTES', 'TABLE']);
const TITLE_BLOCK_KEYWORDS = ['PART', 'P/N', 'PN', 'DRAWING', 'DWG', 'TITLE'];
const TITLE_BLOCK_VALUE_PATTERN = /\b[A-Z]{2,}-\d{3,}(?:-[A-Z0-9]{1,})?\b/;
const MIN_LENGTH_BY_FIELD: Record<FieldKey, number> = {
  REVISION: 1,
  DRAWING_NUMBER: 4,
  PART_NUMBER: 4,
};

function titleBlockTextIsTrusted(text?: string | null): boolean {
  if (!text) return false;
  const upper = text.toUpperCase();
  const hasKeyword = TITLE_BLOCK_KEYWORDS.some(keyword => upper.includes(keyword));
  const hasPattern = TITLE_BLOCK_VALUE_PATTERN.test(upper.replace(/[^A-Z0-9-]/g, ' '));
  return hasKeyword || hasPattern;
}

function enforceTitleBlockSanity(regions: RegionOverlay[]): boolean {
  let anyTrusted = false;
  regions.forEach(region => {
    if (region.label !== 'TITLE_BLOCK') return;
    if (titleBlockTextIsTrusted(region.extractedText)) {
      anyTrusted = true;
    } else {
      region.label = 'UNKNOWN';
    }
  });
  return anyTrusted;
}

function mapSignalSourceToFieldExtractionSource(source: SignalSource | null | undefined): FieldExtractionSource {
  if (source === 'FILENAME')               return 'FILENAME';
  if (source === 'TITLE_BLOCK_OCR')         return 'OCR';
  if (source === 'TITLE_BLOCK_OCR_CROP')    return 'OCR';    // C12.2
  if (source === 'TITLE_BLOCK_VISION_CROP') return 'AI';     // C12.2
  if (source === 'AI_REGION')               return 'AI';
  if (source === 'USER_CONFIRMED')          return 'USER';
  return 'HEURISTIC';
}

function mapSignalSourceToRevisionSource(source: SignalSource | null | undefined): RevisionSource | null {
  if (!source || source === 'NONE')          return null;
  if (source === 'USER_CONFIRMED')           return 'MANUAL';
  if (source === 'FILENAME')                 return 'FILENAME';
  if (source === 'TITLE_BLOCK_OCR')          return 'TITLE_BLOCK_RHEEM';
  if (source === 'TITLE_BLOCK_OCR_CROP')     return 'TITLE_BLOCK_RHEEM'; // C12.2
  if (source === 'TITLE_BLOCK_VISION_CROP')  return 'FALLBACK';           // C12.2
  if (source === 'AI_REGION')                return 'FALLBACK';
  if (source === 'HEURISTIC' || source === 'TABLE_TEXT') return 'TEXT';
  return 'UNKNOWN';
}

function resolveRegionIdForCandidate(
  candidate: FieldSignalCandidate | null,
  regions: RegionOverlay[],
): string | null {
  if (!candidate) return null;
  if (candidate.regionLabel === 'FILENAME' || candidate.regionLabel === 'UNKNOWN') return null;
  return findRegionByLabel(regions, candidate.regionLabel as RegionOverlay['label'])?.id ?? null;
}

const FIELD_SELECTION_CHAIN: Record<FieldKey, CandidateSignalSource[]> = {
  PART_NUMBER:    ['USER_CONFIRMED', 'FILENAME', 'TITLE_BLOCK_OCR', 'TITLE_BLOCK_OCR_CROP', 'TITLE_BLOCK_VISION_CROP', 'AI_REGION', 'TABLE_TEXT'],
  REVISION:       ['USER_CONFIRMED', 'FILENAME', 'TITLE_BLOCK_OCR', 'TITLE_BLOCK_VISION_CROP', 'AI_REGION', 'HEURISTIC'],
  DRAWING_NUMBER: ['USER_CONFIRMED', 'FILENAME', 'TITLE_BLOCK_OCR', 'AI_REGION', 'HEURISTIC', 'TABLE_TEXT'],
};

function selectCandidateByOrder(
  candidates: FieldSignalCandidate[],
  order: CandidateSignalSource[],
): FieldSignalCandidate | null {
  for (const source of order) {
    const found = candidates.find(candidate => candidate.source === source);
    if (found) return found;
  }
  return null;
}

function filterFieldSignals(
  field: FieldKey,
  candidates: FieldSignalCandidate[],
  options?: { titleBlockTrusted?: boolean; pipelineMode?: PipelineMode },
): {
  kept: FieldSignalCandidate[];
  keptEvidence: EvidenceSignal[];
  discardedEvidence: EvidenceSignal[];
} {
  const pipelineMode = options?.pipelineMode ?? 'DRAWING';
  const regionMap = pipelineMode === 'BOM' ? BOM_FIELD_REGION_MAP : FIELD_REGION_MAP;
  const allowedRegions = regionMap[field] ?? new Set<RegionOverlay['label']>();
  const minLength = MIN_LENGTH_BY_FIELD[field] ?? 1;
  const titleBlockTrusted = options?.titleBlockTrusted ?? true;
  const kept: FieldSignalCandidate[] = [];
  const keptEvidence: EvidenceSignal[] = [];
  const discardedEvidence: EvidenceSignal[] = [];

  for (const candidate of candidates) {
    const value = candidate.value?.trim();
    if (!value) continue;
    let ignoredReason: string | null = null;
    if (value.length < minLength) {
      ignoredReason = 'Ignored (value too short)';
    } else if (
      field === 'PART_NUMBER' &&
      NOISE_WORDS.has(value.replace(/[^A-Z]/gi, '').toUpperCase())
    ) {
      ignoredReason = 'BLACKLISTED_TERM';
    } else if (
      candidate.regionLabel === 'TITLE_BLOCK' &&
      !titleBlockTrusted
    ) {
      ignoredReason = 'INVALID_TITLE_BLOCK_CONTENT';
    } else if (
      candidate.regionLabel !== 'FILENAME' &&
      !allowedRegions.has(candidate.regionLabel as RegionOverlay['label'])
    ) {
      ignoredReason = `Ignored (wrong region: ${candidate.regionLabel})`;
    }

    const evidence: EvidenceSignal = {
      source: candidate.source,
      value,
      confidence: candidate.confidence,
      region_label: candidate.regionLabel,
      priority_tag: candidate.source,
      ignored_reason: ignoredReason,
    };

    if (ignoredReason) {
      discardedEvidence.push(evidence);
      continue;
    }

    kept.push(candidate);
    keptEvidence.push(evidence);
  }

  if (discardedEvidence.length > 0) {
    console.debug('[FILTERED SIGNALS]', {
      field,
      kept: kept.map(signal => ({ value: signal.value, source: signal.source, region: signal.regionLabel })),
      discarded: discardedEvidence.map(signal => ({ value: signal.value, source: signal.source, reason: signal.ignored_reason })),
    });
  }

  return { kept, keptEvidence, discardedEvidence };
}


function trimStr(v?: string | null): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

// ---------------------------------------------------------------------------
// Confidence helpers
// ---------------------------------------------------------------------------

function getDocTypeConfidence(detected: DocumentType | 'UNKNOWN', signals: string[]): number {
  if (detected === 'UNKNOWN') return signals.length === 0 ? 0.05 : 0.15;
  if (signals.some(s => s.includes('APOGEE_FILENAME_PATTERN'))) return 0.95;
  if (detected === 'BOM') return signals.length >= 2 ? 0.95 : 0.8;
  return signals.length >= 2 ? 0.85 : 0.7;
}

function getRevisionConfidence(revisionSource: RevisionSource | null, hasFilenameRev: boolean): number {
  if (revisionSource === 'MANUAL') return 1.0;
  if (revisionSource === 'REVISION_BOX_APOGEE' || revisionSource === 'TITLE_BLOCK_RHEEM') return 1.0;
  if (revisionSource === 'HEADER_EXPLICIT') return 0.95;
  if (revisionSource === 'TEXT') return 0.7;
  if (revisionSource === 'FILENAME' || hasFilenameRev) return 0.6;
  return 0.0;
}

function getPartNumberConfidence(pn: string | null, isProvisional: boolean, resolvedViaAlias: boolean): number {
  if (!pn) return 0.0;
  if (isProvisional) return 0.05;
  if (resolvedViaAlias) return 0.85;
  return 0.8;
}

// ---------------------------------------------------------------------------
// Region helpers (Phase 3H.36)
// ---------------------------------------------------------------------------

function findRegionByLabel(
  regions: RegionOverlay[],
  ...labels: Array<RegionOverlay['label']>
): RegionOverlay | null {
  for (const label of labels) {
    const found = regions.find(r => r.label === label);
    if (found) return found;
  }
  return null;
}

function mergeRegions(heuristic: RegionOverlay[], ai: RegionOverlay[]): RegionOverlay[] {
  if (ai.length === 0) return heuristic;
  const seen = new Set<string>();
  const merged: RegionOverlay[] = [];
  for (const region of ai) {
    merged.push({ ...region, id: region.id || `ai-${region.label}-${merged.length}` });
    seen.add(region.label);
  }
  for (const region of heuristic) {
    if (!seen.has(region.label)) merged.push(region);
  }
  return merged;
}

// ---------------------------------------------------------------------------
// Questions builder
// ---------------------------------------------------------------------------

function buildUnresolvedQuestions(params: {
  docType: DocumentType | 'UNKNOWN';
  docTypeConfidence: number;
  revision: string | null;
  revisionSignals: EvidenceSignal[];
  partNumber: string | null;
  partNumberIsProvisional: boolean;
  drawingNumber: string | null;
  drawingPatternDetected: boolean;
  drawingSuggestion?: string | null;
  docTypeForced?: boolean;
}): UnresolvedQuestion[] {
  const questions: UnresolvedQuestion[] = [];

  if (!params.docTypeForced && (params.docType === 'UNKNOWN' || params.docTypeConfidence < 0.5)) {
    questions.push({
      id: 'q-doc-type',
      issueCode: 'DOC_TYPE_UNCERTAIN',
      severity: 'BLOCKING',
      blocksCommit: true,
      promptText: 'Document type could not be determined from text or filename. Select the correct type.',
      suggestedValue: null,
      fieldToResolve: 'documentType',
    });
  }

  if (!params.revision) {
    const blocksForType = params.docType === 'CUSTOMER_DRAWING' || params.docType === 'INTERNAL_DRAWING';
    questions.push({
      id: 'q-revision',
      issueCode: 'REVISION_MISSING',
      severity: blocksForType ? 'BLOCKING' : 'WARNING',
      blocksCommit: blocksForType,
      promptText: 'Revision could not be extracted from this document. Enter it manually or confirm it is not applicable.',
      suggestedValue: null,
      fieldToResolve: 'revision',
    });
  }

  if (!params.partNumber || params.partNumberIsProvisional) {
    questions.push({
      id: 'q-part-number',
      issueCode: 'PART_NUMBER_UNCERTAIN',
      severity: 'BLOCKING',
      blocksCommit: true,
      promptText: 'Part number could not be determined. Enter the part number to link this document to a SKU.',
      suggestedValue: null,
      fieldToResolve: 'partNumber',
    });
  }

  if (params.docType === 'INTERNAL_DRAWING' && params.drawingPatternDetected && !params.drawingNumber) {
    questions.push({
      id: 'q-drawing-number',
      issueCode: 'DRAWING_NUMBER_MISSING',
      severity: 'BLOCKING',
      blocksCommit: true,
      promptText: 'Drawing number pattern detected but no value captured. Enter the drawing number to continue.',
      suggestedValue: params.drawingSuggestion ?? null,
      fieldToResolve: 'drawingNumber',
    });
  }

  const revValues = [...new Set(params.revisionSignals.filter(s => s.value !== null).map(s => s.value))];
  if (revValues.length > 1) {
    const titleBlockVal = params.revisionSignals.find(s => s.source === 'TITLE_BLOCK_OCR')?.value;
    const otherVals = params.revisionSignals
      .filter(s => s.source !== 'TITLE_BLOCK_OCR' && s.value && s.value !== titleBlockVal)
      .map(s => s.value);
    const isStructuredConflict = Boolean(titleBlockVal && otherVals.length > 0);
    questions.push({
      id: 'q-signal-conflict',
      issueCode: isStructuredConflict ? 'REVISION_CONFLICT' : 'SIGNAL_CONFLICT',
      severity: isStructuredConflict ? 'BLOCKING' : 'WARNING',
      blocksCommit: isStructuredConflict,
      promptText: isStructuredConflict
        ? `Revision conflict: title block says "${titleBlockVal}" but another source says "${otherVals[0]}". Confirm the correct value.`
        : `Multiple revision values detected: ${revValues.join(', ')}. Verify which is correct.`,
      suggestedValue: params.revision,
      fieldToResolve: 'revision',
    });
  }

  return questions;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function extractInternalDrawingSignals(text: string, fileName: string): DrawingExtractionResult {
  const candidates: DrawingSignalCandidate[] = [];

  // 527-xxxx-010 is the Apogee DRAWING NUMBER — emit ONLY as DRAWING_NUMBER, never PART_NUMBER.
  const textMatch = text.match(/\b(527-\d{4}-010)\b/);
  const fnMatch   = !textMatch ? fileName.match(/\b(527-\d{4}-010)\b/) : null;
  const apogeeDRN = (textMatch ?? fnMatch)?.[1] ?? null;
  const drnSource: CandidateSignalSource = textMatch ? 'TITLE_BLOCK_OCR' : 'FILENAME';
  const drnConf   = textMatch ? 0.97 : 0.9;
  const drnRegion: FieldSignalCandidate['regionLabel'] = textMatch ? 'TITLE_BLOCK' : 'FILENAME';
  if (apogeeDRN) {
    candidates.push({ field: 'DRAWING_NUMBER', value: apogeeDRN, source: drnSource, confidence: drnConf, regionLabel: drnRegion });
  }

  // C12.1: Zone-priority, proximity-anchored 45-PN cluster search.
  // Splits text to lines, locates DRN index in allLines, then delegates to
  // scanForApogeePN45 (same logic as titleBlockRegionExtractor) for consistency.
  const allLinesInternal = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    .split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const drnLineIdxInternal = apogeeDRN
    ? allLinesInternal.findIndex(l => /\b527-\d{4}-010\b/.test(l))
    : -1;
  const pnScan45           = scanForApogeePN45(allLinesInternal, drnLineIdxInternal);
  const detected45PartNumber = pnScan45.value;
  const pnSource45           = pnScan45.source;
  const pnConf45 = pnSource45 === 'drn-proximity' ? 0.90
                 : pnSource45 === 'last40-zone'   ? 0.85
                 : pnSource45 === 'first40-zone'  ? 0.75
                 :                                  0.65;
  if (detected45PartNumber) {
    candidates.push({ field: 'PART_NUMBER', value: detected45PartNumber, source: 'TITLE_BLOCK_OCR', confidence: pnConf45, regionLabel: 'TITLE_BLOCK' });
  }

  console.log('[C12.1 APOGEE PN]', {
    detected527DrawingNumber: apogeeDRN,
    drnLineIdxInternal,
    detected45PartNumber,
    pnSource45,
    aliasResolvedPartNumber: null,
  });

  const apogeeRev = extractApogeeDrawingRevision(text);
  if (apogeeRev.revision && isStrictRevisionToken(apogeeRev.revision)) {
    candidates.push({ field: 'REVISION', value: apogeeRev.revision, source: 'TITLE_BLOCK_OCR', confidence: 0.98, regionLabel: 'REVISION' });
  }

  const titleMatch = text.match(/(?:WIRE\s+HARNESS|ASSEMBLY|CABLE\s+ASSY|WIRING\s+DIAGRAM)[^\n]{0,80}/i);
  const description = titleMatch ? titleMatch[0].replace(/\s+/g, ' ').trim().slice(0, 120) : null;

  return { candidates, description };
}

function extractCustomerDrawingSignals(text: string, fileName: string): DrawingExtractionResult {
  const candidates: DrawingSignalCandidate[] = [];
  let rheemModel: RheemDrawingModel | null = null;

  // --- Rheem structured parser (Phase 3H.43.X) ---
  if (detectRheemDrawing(text, fileName)) {
    rheemModel = parseRheemDrawing(text, fileName);

    // Bridge title block into signal system with high confidence
    if (rheemModel.titleBlock.partNumber) {
      const conf = rheemModel.titleBlock.anchorFound ? 0.98 : 0.90;
      candidates.push({ field: 'PART_NUMBER', value: rheemModel.titleBlock.partNumber, source: 'TITLE_BLOCK_OCR', confidence: conf, regionLabel: 'TITLE_BLOCK' });
    }
    if (rheemModel.titleBlock.revision && isStrictRevisionToken(rheemModel.titleBlock.revision)) {
      const conf = rheemModel.titleBlock.anchorFound ? 0.98 : 0.85;
      candidates.push({ field: 'REVISION', value: rheemModel.titleBlock.revision, source: 'TITLE_BLOCK_OCR', confidence: conf, regionLabel: 'REVISION' });
    }
  } else {
    // Fallback to legacy extraction for non-Rheem customer drawings
    const rheemPnMatch = text.match(/\b(45-\d{5,6}-\d{2,4}[A-Z]?)\b/);
    if (rheemPnMatch) {
      candidates.push({ field: 'PART_NUMBER', value: rheemPnMatch[1], source: 'TITLE_BLOCK_OCR', confidence: 0.95, regionLabel: 'TITLE_BLOCK' });
    }

    const rheemRev = extractRheemDrawingRevision(text);
    if (rheemRev.isRheemTitleBlock && rheemRev.revision && isStrictRevisionToken(rheemRev.revision)) {
      candidates.push({ field: 'REVISION', value: rheemRev.revision, source: 'TITLE_BLOCK_OCR', confidence: 0.97, regionLabel: 'REVISION' });
    }
  }

  // Drawing number extraction (always run)
  const drnFromText = extractDrawingNumberFromText(text);
  const drnFromFile = extractDrawingNumberFromFilename(fileName);
  const drn = drnFromText ?? drnFromFile;
  if (drn) {
    const drnSource: CandidateSignalSource = drnFromText ? 'TITLE_BLOCK_OCR' : 'FILENAME';
    const drnConf   = drnFromText ? 0.82 : 0.7;
    const drnRegion: FieldSignalCandidate['regionLabel'] = drnFromText ? 'TITLE_BLOCK' : 'FILENAME';
    candidates.push({ field: 'DRAWING_NUMBER', value: drn, source: drnSource, confidence: drnConf, regionLabel: drnRegion });
  }

  const description = rheemModel?.description ?? (() => {
    const titleMatch = text.match(/(?:WIRE\s+HARNESS|ASSEMBLY|CABLE\s+ASSY|WIRING\s+DIAGRAM)[^\n]{0,80}/i);
    return titleMatch ? titleMatch[0].replace(/\s+/g, ' ').trim().slice(0, 120) : null;
  })();

  return { candidates, description, rheemModel };
}

function extractUnknownDrawingSignals(text: string, fileName: string): DrawingExtractionResult {
  const candidates: DrawingSignalCandidate[] = [];
  const draft = ingestDrawingPdf({ drawingText: text, fileName });

  if (draft.drawing_number) {
    candidates.push({ field: 'PART_NUMBER',    value: draft.drawing_number, source: 'TITLE_BLOCK_OCR', confidence: 0.8, regionLabel: 'TITLE_BLOCK' });
    candidates.push({ field: 'DRAWING_NUMBER', value: draft.drawing_number, source: 'TITLE_BLOCK_OCR', confidence: 0.8, regionLabel: 'TITLE_BLOCK' });
  }
  if (draft.revision && isStrictRevisionToken(draft.revision)) {
    candidates.push({ field: 'REVISION', value: draft.revision, source: 'HEURISTIC', confidence: 0.6, regionLabel: 'TITLE_BLOCK' });
  }

  return { candidates, description: draft.title ?? null };
}

export interface AnalyzeIngestionParams {
  fileName: string;
  fileSize: number;
  /** Normalized OCR text, or null if not extractable. */
  normalizedText: string | null;
  /** Optional caller-provided overrides (e.g. from corrective workflow context). */
  partNumberHint?: string | null;
  revisionHint?: string | null;
  drawingNumberHint?: string | null;
  forcedDocumentType?: DocumentType | null;
  /** C12.2: coordinate-filtered PDF region text lines (browser-side pdfjs extraction). */
  titleBlockRegionLines?: string[] | null;
  /** C12.2: base64 PNG data URL of the cropped title block image (browser-rendered). */
  titleBlockCropDataUrl?: string | null;
  /** C12.4: coordinate-filtered region lines from the fallback region (bottom 25%, right 50%).
   *  Sent when primary OCR did not detect a 527 DRN — browser tries the wider fallback crop. */
  titleBlockFallbackLines?: string[] | null;
  /** C12.4: base64 PNG data URL of the fallback region crop (browser-rendered). */
  titleBlockFallbackCrop?: string | null;
}

export async function analyzeFileIngestion(params: AnalyzeIngestionParams): Promise<IngestionAnalysisResult> {
  const {
    fileName, fileSize, normalizedText,
    partNumberHint, revisionHint, drawingNumberHint, forcedDocumentType,
    titleBlockRegionLines, titleBlockCropDataUrl,
    titleBlockFallbackLines, titleBlockFallbackCrop,
  } = params;

  // --- Document type detection ---
  const classification = normalizedText
    ? detectDocumentType(normalizedText, fileName)
    : { detected: 'UNKNOWN' as const, signals: ['NO_TEXT_AVAILABLE'] };
  const docTypeForced = Boolean(forcedDocumentType && forcedDocumentType !== 'UNKNOWN');
  const docType = docTypeForced ? (forcedDocumentType as DocumentType) : classification.detected;
  const docTypeSignals = docTypeForced ? [`USER_PRESET:${docType}`] : classification.signals;
  const docTypeConfidence = docTypeForced ? 1 : getDocTypeConfidence(docType, docTypeSignals);

  // --- Pipeline mode ---
  const pipelineMode: PipelineMode = docType === 'BOM' ? 'BOM' : 'DRAWING';
  console.log('[PIPELINE MODE]', { file: fileName, documentType: docType, pipelineMode });

  // --- Drawing subtype ---
  const drawingSubtype: DrawingSubtype = (() => {
    if (pipelineMode !== 'DRAWING') return 'N/A';
    if (!normalizedText) return 'DRAWING_UNKNOWN';
    if (/\b527-\d{4}-010\b/.test(normalizedText) || /\b527-\d{4}-010\b/.test(fileName)) return 'INTERNAL_DRAWING';
    if (/\b45-\d{5,6}-\d{2,4}\b/.test(normalizedText)) return 'CUSTOMER_DRAWING';
    return 'DRAWING_UNKNOWN';
  })();
  console.log('[DRAWING SUBTYPE]', { file: fileName, drawingSubtype });

  // --- Extraction state ---
  const drawingNumberOverride = trimStr(drawingNumberHint);
  let partNumber = trimStr(partNumberHint);
  let revision = trimStr(revisionHint);
  let revisionSource: RevisionSource | null = null;
  let description: string | null = null;
  const fieldCandidates: Record<FieldKey, FieldSignalCandidate[]> = {
    REVISION: [],
    DRAWING_NUMBER: [],
    PART_NUMBER: [],
  };
  const fieldLocks: Record<FieldKey, boolean> = {
    REVISION: false,
    DRAWING_NUMBER: false,
    PART_NUMBER: false,
  };
  const lockedSignalBypass: Record<FieldKey, FieldSignalCandidate[]> = {
    REVISION: [],
    DRAWING_NUMBER: [],
    PART_NUMBER: [],
  };
  const lockedFieldCandidate: Partial<Record<FieldKey, FieldSignalCandidate>> = {};
  const fieldResolutionMode: Record<FieldKey, ResolutionMode | null> = {
    REVISION: null,
    DRAWING_NUMBER: null,
    PART_NUMBER: null,
  };
  const fieldResolutionSource: Record<FieldKey, SignalSource | null> = {
    REVISION: null,
    DRAWING_NUMBER: null,
    PART_NUMBER: null,
  };
  const enforcementRules: Record<FieldKey, Set<string>> = {
    REVISION: new Set<string>(),
    DRAWING_NUMBER: new Set<string>(),
    PART_NUMBER: new Set<string>(),
  };
  const addCandidate = (field: FieldKey, candidate: Omit<FieldSignalCandidate, 'field'>) => {
    if (!candidate.value) return null;
    const fullCandidate: FieldSignalCandidate = { field, ...candidate };
    if (fieldLocks[field]) {
      lockedSignalBypass[field].push(fullCandidate);
      return fullCandidate;
    }
    fieldCandidates[field].push(fullCandidate);
    return fullCandidate;
  };

  if (partNumber) {
    const candidate = addCandidate('PART_NUMBER', {
      value: partNumber,
      source: 'USER_CONFIRMED',
      confidence: 1,
      regionLabel: 'TITLE_BLOCK',
    });
    if (candidate) {
      fieldLocks.PART_NUMBER = true;
      lockedFieldCandidate.PART_NUMBER = candidate;
      fieldResolutionMode.PART_NUMBER = 'USER_OVERRIDE';
      fieldResolutionSource.PART_NUMBER = 'USER_CONFIRMED';
    }
  }
  if (revision) {
    const candidate = addCandidate('REVISION', {
      value: revision,
      source: 'USER_CONFIRMED',
      confidence: 1,
      regionLabel: 'REVISION',
    });
    if (candidate) {
      fieldLocks.REVISION = true;
      lockedFieldCandidate.REVISION = candidate;
      fieldResolutionMode.REVISION = 'USER_OVERRIDE';
      fieldResolutionSource.REVISION = 'USER_CONFIRMED';
    }
  }
  if (drawingNumberOverride) {
    const candidate = addCandidate('DRAWING_NUMBER', {
      value: drawingNumberOverride,
      source: 'USER_CONFIRMED',
      confidence: 1,
      regionLabel: 'TITLE_BLOCK',
    });
    if (candidate) {
      fieldLocks.DRAWING_NUMBER = true;
      lockedFieldCandidate.DRAWING_NUMBER = candidate;
      fieldResolutionMode.DRAWING_NUMBER = 'USER_OVERRIDE';
      fieldResolutionSource.DRAWING_NUMBER = 'USER_CONFIRMED';
    }
  }

  const filenamePartNumber = extractPartNumberFromFilename(fileName);
  if (filenamePartNumber && !fieldLocks.PART_NUMBER) {
    const fnCandidate = addCandidate('PART_NUMBER', {
      value: filenamePartNumber,
      source: 'FILENAME',
      confidence: pipelineMode === 'BOM' ? 0.98 : 0.95,
      regionLabel: 'FILENAME',
    });
    if (fnCandidate) {
      fieldLocks.PART_NUMBER = true;
      lockedFieldCandidate.PART_NUMBER = fnCandidate;
      fieldResolutionMode.PART_NUMBER = 'SHORT_CIRCUIT';
      fieldResolutionSource.PART_NUMBER = 'FILENAME';
      enforcementRules.PART_NUMBER.add('FILENAME_SHORT_CIRCUIT');
      console.debug('[GUARDRAIL ENFORCEMENT]', {
        field: 'PART_NUMBER',
        short_circuit_applied: true,
        locked: true,
        source: 'FILENAME',
        value: filenamePartNumber,
        signals_skipped: 'all subsequent PART_NUMBER candidates',
      });
    }
  } else if (filenamePartNumber && fieldLocks.PART_NUMBER) {
    console.debug('[GUARDRAIL ENFORCEMENT]', {
      field: 'PART_NUMBER',
      short_circuit_applied: false,
      locked: true,
      source: fieldResolutionSource.PART_NUMBER,
      filename_value_bypassed: filenamePartNumber,
    });
  }

  // --- BOM (Engineering Master) extraction ---
  if (docType === 'BOM' && normalizedText) {
    const emIds = extractEngineeringMasterIdentifiers(normalizedText);
    if (emIds.canonicalPartNumber) {
      addCandidate('PART_NUMBER', {
        value: emIds.canonicalPartNumber,
        source: 'TITLE_BLOCK_OCR',
        confidence: 0.92,
        regionLabel: 'TITLE_BLOCK',
      });
    }

    if (!revision) {
      const emRev = extractEngineeringMasterRevision(normalizedText);
      if (emRev.isHeaderExplicit && emRev.revision) {
        revision = emRev.revision;
        revisionSource = 'HEADER_EXPLICIT';
        addCandidate('REVISION', {
          value: emRev.revision,
          source: 'TITLE_BLOCK_OCR',
          confidence: 0.95,
          regionLabel: 'REVISION',
        });
      } else {
        const bomRev = deriveRevisionFromBOM(normalizedText);
        if (bomRev) {
          addCandidate('REVISION', {
            value: bomRev,
            source: 'HEURISTIC',
            confidence: 0.6,
            regionLabel: 'TITLE_BLOCK',
          });
        }
        revision = bomRev;
        revisionSource = revision ? 'TEXT' : null;
      }
    }
  }

  // --- BOM table scan (Phase 3H.41) ---
  if (pipelineMode === 'BOM' && normalizedText) {
    const nhMatches = normalizedText.match(/\bNH\d{2}-\d{5}-\d{3}\b/g) ?? [];
    for (const match of nhMatches) {
      addCandidate('PART_NUMBER', {
        value: match,
        source: 'TABLE_TEXT',
        confidence: 0.75,
        regionLabel: 'TABLE',
      });
    }
  }

  // --- Drawing extraction (subtype-aware, Phase 3H.43) ---
  let rheemStructuredData: RheemDrawingModel | null = null;
  if (pipelineMode === 'DRAWING' && normalizedText) {
    const drawingResult = drawingSubtype === 'INTERNAL_DRAWING'
      ? extractInternalDrawingSignals(normalizedText, fileName)
      : drawingSubtype === 'CUSTOMER_DRAWING'
      ? extractCustomerDrawingSignals(normalizedText, fileName)
      : extractUnknownDrawingSignals(normalizedText, fileName);

    for (const c of drawingResult.candidates) {
      addCandidate(c.field, { value: c.value, source: c.source, confidence: c.confidence, regionLabel: c.regionLabel });
    }
    if (!description && drawingResult.description) {
      description = drawingResult.description;
    }
    if (drawingResult.rheemModel) {
      rheemStructuredData = drawingResult.rheemModel;
    }
  }

  // --- Generic part number fallback ---
  if (!partNumber && normalizedText && docType !== 'BOM') {
    const derived = extractPartNumberFromText(normalizedText);
    if (derived) {
      addCandidate('PART_NUMBER', {
        value: derived,
        source: 'TABLE_TEXT',
        confidence: 0.4,
        regionLabel: 'TABLE',
      });
    }
  }

  // --- Fragment capture ---
  const rawLines = normalizedText?.split('\n') ?? [];
  const titleBlockRaw = rawLines.slice(0, 60).join('\n').slice(0, 1500);
  const extractionFragments: ExtractionFragment[] = [
    ...(titleBlockRaw.trim().length > 0 ? [{
      source: 'OCR_TITLE_BLOCK' as const,
      raw_text: titleBlockRaw,
      confidence: 1.0,
      metadata: { total_lines: rawLines.length, captured_lines: Math.min(60, rawLines.length) },
    }] : []),
    { source: 'FILENAME' as const, raw_text: fileName, confidence: 1.0 },
  ];
  const documentStructure = analyzeDocumentStructure(extractionFragments);

  const heuristicRegions = documentStructure.regions ?? [];
  let aiRegions: RegionOverlay[] = [];
  try {
    aiRegions = await extractRegionsWithAI({
      textualHint: normalizedText ? normalizedText.slice(0, 4000) : null,
    });
  } catch (err) {
    console.warn('[ANALYZE INGESTION] AI region extractor failed, continuing with heuristics.', err);
  }

  const mergedRegions: RegionOverlay[] = mergeRegions(heuristicRegions, aiRegions);
  documentStructure.regions = mergedRegions;

  // --- C12: Region-aware title block / revision extraction ---
  let titleBlockRegionResult: TitleBlockExtractionResult | null = null;
  if (pipelineMode === 'DRAWING' && normalizedText) {
    try {
      titleBlockRegionResult = extractTitleBlockAndRevisionRegions({
        fullText: normalizedText,
        fileName,
        documentType: drawingSubtype !== 'N/A' ? drawingSubtype : docType,
        existingRegions: mergedRegions,
        rheemModel: rheemStructuredData,
      });

      // Fix TITLE_BLOCK overlay extractedText so enforceTitleBlockSanity passes for Rheem.
      // The first-60-lines OCR fragment captures wire-table content for Rheem drawings;
      // injecting the known PN ensures titleBlockTextIsTrusted returns true.
      if (titleBlockRegionResult.titleBlockDetected && titleBlockRegionResult.partNumber.value) {
        const existingTB = mergedRegions.find(r => r.label === 'TITLE_BLOCK');
        if (existingTB) {
          const existing = existingTB.extractedText ?? '';
          const upper = existing.toUpperCase();
          if (!upper.includes('PN') && !upper.includes('PART')) {
            existingTB.extractedText = `PN ${titleBlockRegionResult.partNumber.value} ${existing}`.slice(0, 400).trim();
          }
        }
      }

      // Emit TITLE_BLOCK_REGION overlay for display
      if (titleBlockRegionResult.titleBlockDetected && titleBlockRegionResult.titleBlockBox) {
        const { x, y, w: width, h: height } = titleBlockRegionResult.titleBlockBox;
        mergedRegions.push({
          id: 'c12-title-block-region',
          label: 'TITLE_BLOCK_REGION',
          boundingBox: { x, y, width, height },
          confidence: titleBlockRegionResult.drawingNumber.confidence || titleBlockRegionResult.partNumber.confidence,
          extractedText: titleBlockRegionResult.drawingNumber.value
            ? `DWG: ${titleBlockRegionResult.drawingNumber.value}${titleBlockRegionResult.partNumber.value ? ` PN: ${titleBlockRegionResult.partNumber.value}` : ''}`
            : (titleBlockRegionResult.partNumber.value ? `PN: ${titleBlockRegionResult.partNumber.value}` : 'Title block detected'),
          source: 'HEURISTIC',
          orientation: drawingSubtype === 'CUSTOMER_DRAWING' ? 'VERTICAL' : 'HORIZONTAL',
          authority: titleBlockRegionResult.drawingNumber.confidence || titleBlockRegionResult.partNumber.confidence,
        });
      }

      // Emit REVISION_REGION overlay for display
      if (titleBlockRegionResult.revisionRegionDetected && titleBlockRegionResult.revision.value && titleBlockRegionResult.revisionRegionBox) {
        const { x, y, w: width, h: height } = titleBlockRegionResult.revisionRegionBox;
        mergedRegions.push({
          id: 'c12-revision-region',
          label: 'REVISION_REGION',
          boundingBox: { x, y, width, height },
          confidence: titleBlockRegionResult.revision.confidence,
          extractedText: `REV: ${titleBlockRegionResult.revision.value}`,
          source: 'HEURISTIC',
          orientation: drawingSubtype === 'INTERNAL_DRAWING' ? 'HORIZONTAL' : 'VERTICAL',
          authority: titleBlockRegionResult.revision.confidence,
        });
      }

      // Add region-derived candidates to the signal pool.
      // These use regionLabel 'TITLE_BLOCK_REGION' / 'REVISION_REGION', which bypasses
      // the enforceTitleBlockSanity gate (only 'TITLE_BLOCK' regionLabel is gated).
      if (titleBlockRegionResult.partNumber.value) {
        addCandidate('PART_NUMBER', {
          value:       titleBlockRegionResult.partNumber.value,
          source:      'TITLE_BLOCK_OCR',
          confidence:  titleBlockRegionResult.partNumber.confidence,
          regionLabel: 'TITLE_BLOCK_REGION',
        });
      }
      if (titleBlockRegionResult.drawingNumber.value) {
        addCandidate('DRAWING_NUMBER', {
          value:       titleBlockRegionResult.drawingNumber.value,
          source:      'TITLE_BLOCK_OCR',
          confidence:  titleBlockRegionResult.drawingNumber.confidence,
          regionLabel: 'TITLE_BLOCK_REGION',
        });
      }
      if (titleBlockRegionResult.revision.value) {
        addCandidate('REVISION', {
          value:       titleBlockRegionResult.revision.value,
          source:      'TITLE_BLOCK_OCR',
          confidence:  titleBlockRegionResult.revision.confidence,
          regionLabel: titleBlockRegionResult.revisionRegionDetected ? 'REVISION_REGION' : 'REVISION',
        });
      }
    } catch (err) {
      console.warn('[ANALYZE INGESTION] C12 title block extraction failed, continuing without it.', err);
    }
  }

  // --- C12.2: Title block OCR crop (coordinate-filtered PDF region text) ---
  let titleBlockCropResult: {
    ocrCropPartNumber:       string | null;
    visionCropPartNumber:    string | null;
    visionCropDrawingNumber: string | null;
    visionCropRevision:      string | null;
    confidence:              number;
  } | null = null;

  if (drawingSubtype === 'INTERNAL_DRAWING' && (titleBlockRegionLines?.length || titleBlockCropDataUrl)) {
    const ocrCropPN = (() => {
      if (!titleBlockRegionLines?.length) return null;
      const { value } = scanForApogeePN45(titleBlockRegionLines, -1);
      return value;
    })();

    let visionCropRaw: TitleBlockCropVisionResult | null = null;
    if (titleBlockCropDataUrl) {
      try {
        visionCropRaw = await runTitleBlockCropVisionParse(titleBlockCropDataUrl);
      } catch (err) {
        console.warn('[C12.2 VISION CROP] Failed — non-fatal', err);
      }
    }

    const hasCropResult = ocrCropPN || visionCropRaw?.partNumber;
    if (hasCropResult) {
      titleBlockCropResult = {
        ocrCropPartNumber:       ocrCropPN,
        visionCropPartNumber:    visionCropRaw?.partNumber    ?? null,
        visionCropDrawingNumber: visionCropRaw?.drawingNumber ?? null,
        visionCropRevision:      visionCropRaw?.revision      ?? null,
        confidence:              visionCropRaw?.confidence    ?? 0,
      };

      if (ocrCropPN) {
        addCandidate('PART_NUMBER', {
          value:       ocrCropPN,
          source:      'TITLE_BLOCK_OCR_CROP',
          confidence:  0.88,
          regionLabel: 'TITLE_BLOCK_REGION',
        });
      }
      if (visionCropRaw?.partNumber && !(/^527-\d{4}-010$/i.test(visionCropRaw.partNumber))) {
        addCandidate('PART_NUMBER', {
          value:       visionCropRaw.partNumber,
          source:      'TITLE_BLOCK_VISION_CROP',
          confidence:  Math.min(visionCropRaw.confidence, 0.82),
          regionLabel: 'TITLE_BLOCK_REGION',
        });
      }
      if (visionCropRaw?.revision) {
        addCandidate('REVISION', {
          value:       visionCropRaw.revision,
          source:      'TITLE_BLOCK_VISION_CROP',
          confidence:  Math.min(visionCropRaw.confidence * 0.95, 0.78),
          regionLabel: 'REVISION_REGION',
        });
      }
    }

    console.log('[C12.2 CROP]', {
      drawingSubtype,
      ocrCropPN,
      visionCropPN:  visionCropRaw?.partNumber ?? null,
      visionCropDRN: visionCropRaw?.drawingNumber ?? null,
      visionCropRev: visionCropRaw?.revision ?? null,
      hasCropResult,
    });
  }

  // --- C12.4: Title block fallback recovery (multi-pass, strict pattern) ---
  // Runs when the browser could not determine isLikelyInternal (no 527 DRN in
  // primary OCR text) and sent fallback region data from the bottom-25%/right-50%
  // title block area.
  // PASS 1: scanForApogeePN45 on fallback lines + strict /^45-\d{6}-\d{2}$/ gate.
  // PASS 2: Claude vision with strict PN-only prompt + same strict gate.
  // Accepts ONLY /^45-\d{6}-\d{2}$/ — rejects 527-pattern, 5-digit middle, etc.
  if (!fieldLocks.PART_NUMBER && (titleBlockFallbackLines?.length || titleBlockFallbackCrop)) {
    const STRICT_PN_45_RE = /^45-\d{6}-\d{2}$/;

    // PASS 1: coordinate-filtered region text
    let fallbackOcrPN: string | null = null;
    let fallbackVisionPN: string | null = null;
    let finalFallbackPn: string | null = null;
    let ocrHasValidPn = false;
    if (titleBlockFallbackLines?.length) {
      console.log('[C12.4 DEBUG] OCR Lines Passed to Scanner:', titleBlockFallbackLines);
      const pnScanResult = scanForApogeePN45(titleBlockFallbackLines, -1);
      const pnValue = pnScanResult.value;
      ocrHasValidPn = Boolean(pnValue && STRICT_PN_45_RE.test(pnValue));
      if (ocrHasValidPn) {
        fallbackOcrPN = pnValue!;
        finalFallbackPn = fallbackOcrPN;
      }
      console.log('[C12.4 DEBUG] OCR PN Result:', pnScanResult);
      console.log('[C12.4 DEBUG] OCR Valid PN:', ocrHasValidPn);
    }

    // PASS 2: AI vision — runs when OCR did not produce a valid PN
    if (titleBlockFallbackCrop && !ocrHasValidPn) {
      console.log('[C12.4 DEBUG] OCR did not find valid PN — triggering Vision');
      try {
        const visionResult = await runFallbackTitleBlockVisionParse(titleBlockFallbackCrop);
        console.log('[C12.4 DEBUG] Vision Result:', visionResult);
        if (visionResult?.partNumber && STRICT_PN_45_RE.test(visionResult.partNumber)) {
          fallbackVisionPN = visionResult.partNumber;
          finalFallbackPn = fallbackVisionPN;
        }
      } catch (err) {
        console.warn('[C12.4 FALLBACK] Vision pass failed — non-fatal', err);
      }
    }

    if (fallbackOcrPN) {
      addCandidate('PART_NUMBER', {
        value:       fallbackOcrPN,
        source:      'TITLE_BLOCK_OCR_CROP',
        confidence:  0.82,
        regionLabel: 'TITLE_BLOCK_REGION',
      });
    }
    if (fallbackVisionPN) {
      addCandidate('PART_NUMBER', {
        value:       fallbackVisionPN,
        source:      'TITLE_BLOCK_VISION_CROP',
        confidence:  0.75,
        regionLabel: 'TITLE_BLOCK_REGION',
      });
    }

    console.log('[C12.4 FALLBACK]', {
      linesProvided: titleBlockFallbackLines?.length ?? 0,
      cropProvided:  Boolean(titleBlockFallbackCrop),
      fallbackOcrPN,
      fallbackVisionPN,
      finalFallbackPn,
    });
  }

  // Shared OCR lines for T1 + T4 (computed once, avoids duplicate split)
  const ocrLines: string[] = (drawingSubtype === 'INTERNAL_DRAWING' && normalizedText)
    ? normalizedText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0)
    : [];

  // --- T1: Wire table region detection and structured row extraction ---
  let wireTableResult: IngestionAnalysisResult['wireTableResult'] = null;
  let wireTableHeaderIdx: number | null = null; // captured for T4 diagram region isolation
  if (drawingSubtype === 'INTERNAL_DRAWING' && normalizedText) {
    try {
      const detected  = detectWireTableRegion(ocrLines);
      if (detected) {
        wireTableHeaderIdx = detected.headerLineIdx;
        const parsed = parseWireTableRows(detected.bodyLines);
        wireTableResult = {
          region:       detected.region,
          confidence:   detected.confidence,
          rows:         parsed.rows,
          rowCount:     parsed.rowCount,
          parseQuality: parsed.parseQuality,
          headerText:   detected.headerText,
        };
        console.log('[T1 WIRE TABLE]', {
          drawingSubtype,
          headerText:   detected.headerText.slice(0, 80),
          confidence:   detected.confidence,
          rowCount:     parsed.rowCount,
          parseQuality: parsed.parseQuality,
        });
      }
    } catch (err) {
      console.warn('[T1 WIRE TABLE] Non-fatal — continuing without wire table result.', err);
    }
  }

  // --- T4: Diagram component and callout extraction ---
  let diagramExtraction: DiagramExtractionResult | null = null;
  if (drawingSubtype === 'INTERNAL_DRAWING' && normalizedText) {
    try {
      const diagramLines = isolateDiagramLines(ocrLines, wireTableHeaderIdx);
      if (diagramLines.length >= 3) {
        const deterministic = extractDiagramComponents(diagramLines);

        // AI augmentation — text-based, scoped to diagram region, non-fatal
        let visionResult = null;
        if (diagramLines.length >= 5) {
          try {
            visionResult = await runDiagramComponentParse({
              diagramText: diagramLines.join('\n'),
              fileName,
            });
          } catch {
            console.warn('[T4 DIAGRAM] AI pass failed — using deterministic only');
          }
        }

        diagramExtraction = mergeWithVisionResult(deterministic, visionResult);
        console.log('[T4 DIAGRAM EXTRACTION]', {
          diagramLines:      diagramLines.length,
          components:        diagramExtraction.components.length,
          callouts:          diagramExtraction.callouts.length,
          unresolvedCallouts: diagramExtraction.unresolvedCallouts.length,
        });
      }
    } catch (err) {
      console.warn('[T4 DIAGRAM EXTRACTION] Non-fatal — continuing without diagram result.', err);
    }
  }

  // --- T2: Harness Connectivity normalization (HC-BOM) ---
  let harnessConnectivity: HarnessConnectivityResult | null = null;
  if (wireTableResult && wireTableResult.rows.length > 0) {
    try {
      harnessConnectivity = buildHarnessConnectivity(wireTableResult.rows);
    } catch (err) {
      console.warn('[T2 CONNECTIVITY] Non-fatal — continuing without HC-BOM.', err);
    }
  }

  // --- T5: HC-BOM ↔ diagram reconciliation ---
  let harnessReconciliation: HarnessReconciliationResult | null = null;
  if (harnessConnectivity && diagramExtraction) {
    try {
      harnessReconciliation = reconcileHarnessConnectivity({
        harnessConnectivity,
        diagramExtraction,
      });
    } catch (err) {
      console.warn('[T5 RECONCILIATION] Non-fatal — continuing without reconciliation.', err);
    }
  }

  // --- T6: Endpoint classification ---
  let endpointClassification: HarnessEndpointClassificationResult | null = null;
  if (harnessConnectivity) {
    try {
      endpointClassification = classifyHarnessEndpoints(harnessConnectivity);
    } catch (err) {
      console.warn('[T6 CLASSIFICATION] Non-fatal — continuing without endpoint classification.', err);
    }
  }

  // --- T7: Harness constraint validation ---
  let harnessValidation: HarnessValidationResult | null = null;
  if (harnessConnectivity) {
    try {
      harnessValidation = validateHarness({
        connectivity:           harnessConnectivity,
        reconciliation:         harnessReconciliation,
        endpointClassification,
      });
    } catch (err) {
      console.warn('[T7 VALIDATION] Non-fatal — continuing without validation.', err);
    }
  }

  // --- T8: Constraint-aware confidence adjustment ---
  let harnessConfidence: HarnessConfidenceResult | null = null;
  if (harnessConnectivity) {
    try {
      harnessConfidence = adjustHarnessConfidence({
        connectivity:           harnessConnectivity,
        reconciliation:         harnessReconciliation,
        endpointClassification,
        validation:             harnessValidation,
      });
    } catch (err) {
      console.warn('[T8 CONFIDENCE] Non-fatal — continuing without confidence adjustment.', err);
    }
  }

  // --- T9: Operator decision layer + PPAP readiness ---
  let harnessDecision: HarnessDecisionResult | null = null;
  if (harnessConnectivity) {
    try {
      harnessDecision = evaluateHarnessDecision({
        connectivity:           harnessConnectivity,
        reconciliation:         harnessReconciliation,
        endpointClassification,
        validation:             harnessValidation,
        confidence:             harnessConfidence,
      });
    } catch (err) {
      console.warn('[T9 DECISION] Non-fatal — continuing without decision layer.', err);
    }
  }

  // --- C13: Universal AI vision parse ---
  let visionParsedResult: VisionParsedDrawingResult | null = null;
  if (pipelineMode === 'DRAWING' && normalizedText) {
    try {
      const titleBlockHint = drawingSubtype === 'INTERNAL_DRAWING'
        ? 'Apogee internal drawing. The bottom-right title block contains: drawing number (pattern 527-XXXX-010) and customer part number (pattern 45-XXXXXX-XX). The upper-right contains the revision record box with DATE and REV entries.'
        : null;
      visionParsedResult = await runAIDrawingVisionParse({
        fileName,
        documentType: drawingSubtype !== 'N/A' ? drawingSubtype : docType,
        extractedText: normalizedText,
        titleBlockHint,
      });

      // Add AI_REGION candidates to signal pool for part number and revision.
      // The field authority resolver will treat these as AI_VISION source.
      if (visionParsedResult?.metadata.partNumber) {
        addCandidate('PART_NUMBER', {
          value:       visionParsedResult.metadata.partNumber,
          source:      'AI_REGION',
          confidence:  Math.min(visionParsedResult.confidence, 0.80),
          regionLabel: 'UNKNOWN',
        });
      }
      if (visionParsedResult?.metadata.drawingNumber) {
        addCandidate('DRAWING_NUMBER', {
          value:       visionParsedResult.metadata.drawingNumber,
          source:      'AI_REGION',
          confidence:  Math.min(visionParsedResult.confidence * 0.9, 0.72),
          regionLabel: 'UNKNOWN',
        });
      }
      if (visionParsedResult?.metadata.revision) {
        addCandidate('REVISION', {
          value:       visionParsedResult.metadata.revision,
          source:      'AI_REGION',
          confidence:  Math.min(visionParsedResult.confidence * 0.95, 0.76),
          regionLabel: 'UNKNOWN',
        });
      }
    } catch (err) {
      console.warn('[ANALYZE INGESTION] C13 vision parse failed, continuing without it.', err);
    }
  }

  // --- Signal resolution ---
  const drawingNumberFromText     = normalizedText ? extractDrawingNumberFromText(normalizedText) : null;
  const drawingNumberFromFilename = extractDrawingNumberFromFilename(fileName);
  const filenameRevSignal = extractRevisionSignal({ fileName });
  const filenameRevision  = (filenameRevSignal.normalized && filenameRevSignal.parseSource !== 'UNKNOWN')
    ? filenameRevSignal.normalized : null;
  if (filenameRevision) {
    addCandidate('REVISION', {
      value: filenameRevision,
      source: 'FILENAME',
      confidence: 0.9,
      regionLabel: 'FILENAME',
    });
  }

  const emDrawingNumber = docType === 'BOM' && normalizedText
    ? extractEngineeringMasterIdentifiers(normalizedText).drawingNumber
    : null;
  if (emDrawingNumber) {
    addCandidate('DRAWING_NUMBER', {
      value: emDrawingNumber,
      source: 'TITLE_BLOCK_OCR',
      confidence: 0.93,
      regionLabel: 'TITLE_BLOCK',
    });
  }
  if (drawingNumberFromText) {
    addCandidate('DRAWING_NUMBER', {
      value: drawingNumberFromText,
      source: 'TABLE_TEXT',
      confidence: 0.45,
      regionLabel: 'TABLE',
    });
  }
  if (drawingNumberFromFilename) {
    addCandidate('DRAWING_NUMBER', {
      value: drawingNumberFromFilename,
      source: 'FILENAME',
      confidence: 0.85,
      regionLabel: 'FILENAME',
    });
  }

  const titleBlockTrusted = pipelineMode === 'BOM' ? true : enforceTitleBlockSanity(mergedRegions);
  const revisionFiltering = filterFieldSignals('REVISION', fieldCandidates.REVISION, { titleBlockTrusted, pipelineMode });
  const drawingFiltering = filterFieldSignals('DRAWING_NUMBER', fieldCandidates.DRAWING_NUMBER, { titleBlockTrusted, pipelineMode });
  const partFiltering = filterFieldSignals('PART_NUMBER', fieldCandidates.PART_NUMBER, { titleBlockTrusted, pipelineMode });

  const selectedRevisionCandidate = fieldLocks.REVISION
    ? (lockedFieldCandidate.REVISION ?? null)
    : selectCandidateByOrder(revisionFiltering.kept, FIELD_SELECTION_CHAIN.REVISION);
  const selectedDrawingCandidate = fieldLocks.DRAWING_NUMBER
    ? (lockedFieldCandidate.DRAWING_NUMBER ?? null)
    : selectCandidateByOrder(drawingFiltering.kept, FIELD_SELECTION_CHAIN.DRAWING_NUMBER);
  const partWinner = fieldLocks.PART_NUMBER
    ? (lockedFieldCandidate.PART_NUMBER ?? null)
    : selectCandidateByOrder(partFiltering.kept, FIELD_SELECTION_CHAIN.PART_NUMBER);

  if (selectedRevisionCandidate) {
    revision = selectedRevisionCandidate.value;
    revisionSource = mapSignalSourceToRevisionSource(selectedRevisionCandidate.source);
    if (drawingSubtype === 'INTERNAL_DRAWING' && selectedRevisionCandidate.source === 'TITLE_BLOCK_OCR') {
      revisionSource = 'REVISION_BOX_APOGEE';
    }
    if (!fieldResolutionMode.REVISION) {
      fieldResolutionMode.REVISION = 'RESOLVED';
      fieldResolutionSource.REVISION = selectedRevisionCandidate.source;
    }
  }
  if (selectedDrawingCandidate && !fieldResolutionMode.DRAWING_NUMBER) {
    fieldResolutionMode.DRAWING_NUMBER = 'RESOLVED';
    fieldResolutionSource.DRAWING_NUMBER = selectedDrawingCandidate.source;
  }
  if (partWinner && !fieldResolutionMode.PART_NUMBER) {
    fieldResolutionMode.PART_NUMBER = 'RESOLVED';
    fieldResolutionSource.PART_NUMBER = partWinner.source;
  }
  const hasFilenameRev = Boolean(filenameRevision);

  let proposedDrawingNumber = selectedDrawingCandidate?.value ?? null;
  if (drawingNumberOverride) {
    proposedDrawingNumber = drawingNumberOverride;
  }

  if (partWinner) {
    partNumber = partWinner.value;
  } else {
    partNumber = null;
  }

  const revEvidenceSignals = revisionFiltering.keptEvidence;
  const drnEvidenceSignals = drawingFiltering.keptEvidence;
  const partEvidenceSignals = partFiltering.keptEvidence;
  const discardedSignals: DocumentExtractionEvidence['discarded_signals'] = [];
  if (revisionFiltering.discardedEvidence.length) {
    discardedSignals.push({ field: 'REVISION', reason: 'Field-scope filter', signals: revisionFiltering.discardedEvidence });
  }
  if (drawingFiltering.discardedEvidence.length) {
    discardedSignals.push({ field: 'DRAWING_NUMBER', reason: 'Field-scope filter', signals: drawingFiltering.discardedEvidence });
  }
  if (partFiltering.discardedEvidence.length) {
    discardedSignals.push({ field: 'PART_NUMBER', reason: 'Field-scope filter', signals: partFiltering.discardedEvidence });
  }

  // --- Alias / drawing lookup (read-only DB) ---
  // C11.3: also run alias lookup when partNumber is itself a 527 drawing number
  const partIsDrawingNumber = Boolean(partNumber && /^527-\d{4}-010$/i.test(partNumber.trim()));
  let partNumberIsProvisional = !partWinner || partWinner.source === 'TABLE_TEXT' || partWinner.source === 'HEURISTIC' || partIsDrawingNumber;
  let resolvedViaAlias = false;
  if ((!partNumber || partIsDrawingNumber) && proposedDrawingNumber) {
    let resolvedPN: string | null = null;
    try {
      resolvedPN = await resolveAliasFromDB(proposedDrawingNumber);
    } catch { /* ignore */ }
    if (!resolvedPN) {
      try {
        resolvedPN = await resolvePartNumberFromDrawing(proposedDrawingNumber);
      } catch { /* ignore */ }
    }
    if (resolvedPN) {
      console.log('[APOGEE PN FIX]', { detected527DrawingNumber: proposedDrawingNumber, aliasResolvedPartNumber: resolvedPN, detected45PartNumber: null });
      partNumber = resolvedPN;
      resolvedViaAlias = true;
      partNumberIsProvisional = false;
    }
  }
  if (!partNumber) partNumberIsProvisional = true;

  // --- Evidence bundle ---
  const extractionEvidence: DocumentExtractionEvidence = {
    fragments: extractionFragments,
    revision_signals: revEvidenceSignals,
    drawing_number_signals: drnEvidenceSignals,
    part_number_signals: partEvidenceSignals,
    document_structure: documentStructure,
    resolved_revision: selectedRevisionCandidate?.value ?? null,
    resolved_revision_source: selectedRevisionCandidate?.source ?? null,
    resolved_drawing_number: selectedDrawingCandidate?.value ?? null,
    resolved_drawing_number_source: selectedDrawingCandidate?.source ?? null,
    captured_at: new Date().toISOString(),
    confirmation_mode: null,
    pipeline_mode: pipelineMode,
    drawing_subtype: drawingSubtype !== 'N/A' ? drawingSubtype : null,
    discarded_signals: discardedSignals.length > 0 ? discardedSignals : undefined,
    structured_data: rheemStructuredData ? (rheemStructuredData as unknown as Record<string, unknown>) : null,
  };

  const revisionConfidence = getRevisionConfidence(revisionSource, hasFilenameRev);
  const partNumberConfidence = getPartNumberConfidence(partNumber, partNumberIsProvisional, resolvedViaAlias);

  // --- Field-to-region binding (Phase 3H.36) ---
  const revRegion = findRegionByLabel(mergedRegions, 'REVISION', 'TITLE_BLOCK');
  const partRegion = findRegionByLabel(mergedRegions, 'PART_NUMBER', 'TITLE_BLOCK');
  const drnRegion  = findRegionByLabel(mergedRegions, 'DRAWING_NUMBER', 'TITLE_BLOCK');

  const revisionRegionId = resolveRegionIdForCandidate(selectedRevisionCandidate, mergedRegions) ?? revRegion?.id ?? null;
  const partRegionId = resolveRegionIdForCandidate(partWinner, mergedRegions) ?? partRegion?.id ?? null;
  const drawingRegionId = resolveRegionIdForCandidate(selectedDrawingCandidate, mergedRegions) ?? drnRegion?.id ?? null;

  if (!fieldResolutionMode.PART_NUMBER) fieldResolutionMode.PART_NUMBER = 'RESOLVED';
  if (!fieldResolutionMode.REVISION) fieldResolutionMode.REVISION = 'RESOLVED';
  if (!fieldResolutionMode.DRAWING_NUMBER) fieldResolutionMode.DRAWING_NUMBER = 'RESOLVED';

  const fieldExtractions: FieldExtraction[] = [
    {
      field: 'REVISION',
      value: revision,
      confidence: selectedRevisionCandidate?.confidence ?? revisionConfidence,
      sourceRegionId: revisionRegionId,
      source: mapSignalSourceToFieldExtractionSource(selectedRevisionCandidate?.source ?? null),
      locked: fieldLocks.REVISION,
    },
    {
      field: 'PART_NUMBER',
      value: partNumber,
      confidence: partWinner?.confidence ?? partNumberConfidence,
      sourceRegionId: partRegionId,
      source: partWinner
        ? mapSignalSourceToFieldExtractionSource(partWinner.source)
        : (resolvedViaAlias ? 'HEURISTIC' : 'HEURISTIC'),
      locked: fieldLocks.PART_NUMBER,
    },
    {
      field: 'DRAWING_NUMBER',
      value: proposedDrawingNumber,
      confidence: selectedDrawingCandidate?.confidence ?? (drawingNumberFromFilename ? 0.7 : 0.0),
      sourceRegionId: drawingRegionId,
      source: mapSignalSourceToFieldExtractionSource(selectedDrawingCandidate?.source ?? null),
      locked: fieldLocks.DRAWING_NUMBER,
    },
  ];

  extractionEvidence.field_extractions = fieldExtractions;

  // Phase 3H.43.Y: Tag usedForField on each winning region for overlay debug visibility
  for (const fe of fieldExtractions) {
    if (!fe.sourceRegionId || !fe.value) continue;
    const targetRegion = mergedRegions.find(r => r.id === fe.sourceRegionId);
    if (targetRegion) {
      targetRegion.usedForField = [
        ...(targetRegion.usedForField ?? []),
        fe.field as 'REVISION' | 'PART_NUMBER' | 'DRAWING_NUMBER',
      ];
    }
  }

  extractionEvidence.resolution_audit = {
    part_number: {
      field: 'PART_NUMBER',
      resolution_mode: fieldResolutionMode.PART_NUMBER!,
      source: fieldResolutionSource.PART_NUMBER,
      locked: fieldLocks.PART_NUMBER,
      short_circuit_applied: fieldResolutionMode.PART_NUMBER === 'SHORT_CIRCUIT',
      signals_considered: fieldCandidates.PART_NUMBER.length,
      signals_discarded: partFiltering.discardedEvidence.length + lockedSignalBypass.PART_NUMBER.length,
      enforcement_rules_applied: [...enforcementRules.PART_NUMBER],
    },
    revision: {
      field: 'REVISION',
      resolution_mode: fieldResolutionMode.REVISION!,
      source: fieldResolutionSource.REVISION,
      locked: fieldLocks.REVISION,
      short_circuit_applied: fieldResolutionMode.REVISION === 'SHORT_CIRCUIT',
      signals_considered: fieldCandidates.REVISION.length,
      signals_discarded: revisionFiltering.discardedEvidence.length + lockedSignalBypass.REVISION.length,
      enforcement_rules_applied: [...enforcementRules.REVISION],
    },
    drawing_number: {
      field: 'DRAWING_NUMBER',
      resolution_mode: fieldResolutionMode.DRAWING_NUMBER!,
      source: fieldResolutionSource.DRAWING_NUMBER,
      locked: fieldLocks.DRAWING_NUMBER,
      short_circuit_applied: fieldResolutionMode.DRAWING_NUMBER === 'SHORT_CIRCUIT',
      signals_considered: fieldCandidates.DRAWING_NUMBER.length,
      signals_discarded: drawingFiltering.discardedEvidence.length + lockedSignalBypass.DRAWING_NUMBER.length,
      enforcement_rules_applied: [...enforcementRules.DRAWING_NUMBER],
    },
  };

  // --- Questions ---
  const unresolvedQuestions = buildUnresolvedQuestions({
    docType,
    docTypeConfidence,
    revision,
    revisionSignals: revEvidenceSignals,
    partNumber,
    partNumberIsProvisional,
    drawingNumber: proposedDrawingNumber,
    drawingPatternDetected: drnEvidenceSignals.some(s => Boolean(s.value)),
    drawingSuggestion: drawingNumberFromFilename ?? emDrawingNumber,
    docTypeForced,
  }).filter(q => {
    if (q.fieldToResolve === 'partNumber' && fieldLocks.PART_NUMBER) return false;
    if (q.fieldToResolve === 'revision' && fieldLocks.REVISION) return false;
    if (q.fieldToResolve === 'drawingNumber' && fieldLocks.DRAWING_NUMBER) return false;
    return true;
  });
  const readyToCommit = unresolvedQuestions.every(q => !q.blocksCommit);

  return {
    fileName,
    fileSize,
    proposedDocumentType: docType,
    docTypeConfidence,
    docTypeSignals,
    proposedPartNumber: partNumber,
    partNumberIsProvisional,
    partNumberConfidence,
    proposedRevision: revision,
    revisionConfidence,
    revisionSource,
    proposedDrawingNumber,
    extractionEvidence,
    unresolvedQuestions,
    readyToCommit,
    structuredData: (() => {
      // C13: Produce structuredData for ALL drawing types.
      // Rheem model remains authoritative when present.
      // Apogee / other drawings use merged vision display model when available.
      const merged = mergeVisionParsedData({
        deterministicStructuredData: rheemStructuredData ?? undefined,
        visionResult: visionParsedResult,
      });
      return merged ? (merged as Record<string, unknown>) : null;
    })(),
    titleBlockRegionResult,
    visionParsedResult,
    titleBlockCropResult,
    wireTableResult,
    harnessConnectivity,
    diagramExtraction,
    harnessReconciliation,
    harnessValidation,
    harnessConfidence,
    harnessDecision,
    analyzedAt: new Date().toISOString(),
  };
}
