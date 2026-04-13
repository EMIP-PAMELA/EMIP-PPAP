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
import { extractPartNumberFromText } from '@/src/utils/extractPartNumber';
import { extractDrawingNumberFromText, extractDrawingNumberFromFilename } from '@/src/utils/extractDrawingNumber';
import { ingestDrawingPdf } from './drawingIngestionService';
import { resolveDocumentSignalsFromArrays, type Signal } from '../utils/resolveDocumentSignals';
import { analyzeDocumentStructure } from './documentStructureAnalyzer';
import { resolveAliasFromDB } from './aliasService';
import { resolvePartNumberFromDrawing } from './drawingLookupService';
import type { ExtractionFragment, EvidenceSignal, DocumentExtractionEvidence } from '../types/extractionEvidence';
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
// Questions builder
// ---------------------------------------------------------------------------

function buildUnresolvedQuestions(params: {
  docType: DocumentType | 'UNKNOWN';
  docTypeConfidence: number;
  revision: string | null;
  revisionSignals: EvidenceSignal[];
  partNumber: string | null;
  partNumberIsProvisional: boolean;
}): UnresolvedQuestion[] {
  const questions: UnresolvedQuestion[] = [];

  if (params.docType === 'UNKNOWN' || params.docTypeConfidence < 0.5) {
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

  const revValues = [...new Set(params.revisionSignals.filter(s => s.value !== null).map(s => s.value))];
  if (revValues.length > 1) {
    questions.push({
      id: 'q-signal-conflict',
      issueCode: 'SIGNAL_CONFLICT',
      severity: 'WARNING',
      blocksCommit: false,
      promptText: `Multiple revision values detected: ${revValues.join(', ')}. Verify which is correct.`,
      suggestedValue: params.revision,
      fieldToResolve: 'revision',
    });
  }

  return questions;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface AnalyzeIngestionParams {
  fileName: string;
  fileSize: number;
  /** Normalized OCR text, or null if not extractable. */
  normalizedText: string | null;
  /** Optional caller-provided overrides (e.g. from corrective workflow context). */
  partNumberHint?: string | null;
  revisionHint?: string | null;
}

export async function analyzeFileIngestion(params: AnalyzeIngestionParams): Promise<IngestionAnalysisResult> {
  const { fileName, fileSize, normalizedText, partNumberHint, revisionHint } = params;

  // --- Document type detection ---
  const classification = normalizedText
    ? detectDocumentType(normalizedText, fileName)
    : { detected: 'UNKNOWN' as const, signals: ['NO_TEXT_AVAILABLE'] };
  const docType = classification.detected;
  const docTypeConfidence = getDocTypeConfidence(docType, classification.signals);

  // --- Extraction state ---
  let partNumber = trimStr(partNumberHint);
  let revision = trimStr(revisionHint);
  let revisionSource: RevisionSource | null = null;
  let description: string | null = null;

  // --- BOM (Engineering Master) extraction ---
  if (docType === 'BOM' && normalizedText) {
    const emIds = extractEngineeringMasterIdentifiers(normalizedText);
    if (!partNumber && emIds.canonicalPartNumber) partNumber = emIds.canonicalPartNumber;

    if (!revision) {
      const emRev = extractEngineeringMasterRevision(normalizedText);
      if (emRev.isHeaderExplicit && emRev.revision) {
        revision = emRev.revision;
        revisionSource = 'HEADER_EXPLICIT';
      } else {
        revision = deriveRevisionFromBOM(normalizedText);
        revisionSource = revision ? 'TEXT' : null;
      }
    }
  }

  // --- Drawing extraction ---
  if (normalizedText && docType !== 'BOM' && docType !== 'UNKNOWN') {
    const draft = ingestDrawingPdf({ drawingText: normalizedText, fileName });
    if (!partNumber && draft.drawing_number) partNumber = draft.drawing_number;
    if (!description && draft.title) description = draft.title;

    if (!revision) {
      const hasApogeePN = /\b527-\d{4}-010\b/.test(normalizedText);
      const hasRheemPN  = /\b45-\d{5,6}-\d{2,4}\b/.test(normalizedText);

      if (hasApogeePN) {
        const apogeeRev = extractApogeeDrawingRevision(normalizedText);
        if (apogeeRev.isApogeeDrawing && apogeeRev.revision) {
          revision = apogeeRev.revision;
          revisionSource = 'REVISION_BOX_APOGEE';
        }
      } else if (hasRheemPN) {
        const rheemRev = extractRheemDrawingRevision(normalizedText);
        if (rheemRev.isRheemTitleBlock && rheemRev.revision) {
          revision = rheemRev.revision;
          revisionSource = 'TITLE_BLOCK_RHEEM';
        }
      }
      if (!revision && draft.revision) {
        revision = draft.revision;
        revisionSource = 'TEXT';
      }
    }
  }

  // --- Generic part number fallback ---
  if (!partNumber && normalizedText && docType !== 'BOM') {
    const derived = extractPartNumberFromText(normalizedText);
    if (derived) partNumber = derived;
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

  // --- Signal resolution ---
  const drawingNumberFromText     = normalizedText ? extractDrawingNumberFromText(normalizedText) : null;
  const drawingNumberFromFilename = extractDrawingNumberFromFilename(fileName);
  const filenameRevSignal = extractRevisionSignal({ fileName });
  const filenameRevision  = (filenameRevSignal.normalized && filenameRevSignal.parseSource !== 'UNKNOWN')
    ? filenameRevSignal.normalized : null;

  const isStructuredRevision =
    revisionSource === 'REVISION_BOX_APOGEE' ||
    revisionSource === 'TITLE_BLOCK_RHEEM'   ||
    revisionSource === 'HEADER_EXPLICIT';

  const emDrawingNumber = docType === 'BOM' && normalizedText
    ? extractEngineeringMasterIdentifiers(normalizedText).drawingNumber
    : null;

  const revSignalsArr: Signal<string>[] = [
    { value: isStructuredRevision ? (revision ?? null) : null, source: 'TITLE_BLOCK' },
    { value: !isStructuredRevision && revision ? revision : null, source: 'TEXT' },
    { value: filenameRevision ?? null, source: 'FILENAME' },
  ];
  const drnSignalsArr: Signal<string>[] = [
    { value: emDrawingNumber ?? null,      source: 'TITLE_BLOCK' },
    { value: drawingNumberFromText,        source: 'TEXT' },
    { value: drawingNumberFromFilename,    source: 'FILENAME' },
  ];
  const resolved = resolveDocumentSignalsFromArrays(revSignalsArr, drnSignalsArr);

  if (resolved.revision.value && !revision) {
    revision = resolved.revision.value;
    if (resolved.revision.source === 'FILENAME') revisionSource = 'FILENAME';
  }
  const proposedDrawingNumber = resolved.drawingNumber.value;

  // --- Evidence signals ---
  const revEvidenceSignals: EvidenceSignal[] = [
    ...(isStructuredRevision && revision ? [{
      source: 'TITLE_BLOCK', value: revision,
      confidence: revisionSource === 'REVISION_BOX_APOGEE' || revisionSource === 'TITLE_BLOCK_RHEEM' ? 1.0 : 0.95,
    }] : []),
    ...(!isStructuredRevision && revision ? [{ source: 'TEXT', value: revision, confidence: 0.7 }] : []),
    ...(filenameRevision ? [{ source: 'FILENAME', value: filenameRevision, confidence: 0.6 }] : []),
  ];
  const drnEvidenceSignals: EvidenceSignal[] = [
    ...(emDrawingNumber ? [{ source: 'TITLE_BLOCK', value: emDrawingNumber, confidence: 0.95 }] : []),
    ...(drawingNumberFromText ? [{ source: 'TEXT', value: drawingNumberFromText, confidence: 0.8 }] : []),
    ...(drawingNumberFromFilename ? [{ source: 'FILENAME', value: drawingNumberFromFilename, confidence: 0.7 }] : []),
  ];

  // --- Alias / drawing lookup (read-only DB) ---
  let partNumberIsProvisional = false;
  let resolvedViaAlias = false;
  if (!partNumber && proposedDrawingNumber) {
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
      partNumber = resolvedPN;
      resolvedViaAlias = true;
    }
  }
  if (!partNumber) partNumberIsProvisional = true;

  // --- Evidence bundle ---
  const extractionEvidence: DocumentExtractionEvidence = {
    fragments: extractionFragments,
    revision_signals: revEvidenceSignals,
    drawing_number_signals: drnEvidenceSignals,
    document_structure: documentStructure,
    resolved_revision: resolved.revision.value,
    resolved_revision_source: resolved.revision.source !== 'NONE' ? resolved.revision.source : null,
    resolved_drawing_number: resolved.drawingNumber.value,
    resolved_drawing_number_source: resolved.drawingNumber.source !== 'NONE' ? resolved.drawingNumber.source : null,
    captured_at: new Date().toISOString(),
    confirmation_mode: null,
  };

  const revisionConfidence = getRevisionConfidence(revisionSource, Boolean(filenameRevision));
  const partNumberConfidence = getPartNumberConfidence(partNumber, partNumberIsProvisional, resolvedViaAlias);

  // --- Questions ---
  const unresolvedQuestions = buildUnresolvedQuestions({
    docType,
    docTypeConfidence,
    revision,
    revisionSignals: revEvidenceSignals,
    partNumber,
    partNumberIsProvisional,
  });
  const readyToCommit = unresolvedQuestions.every(q => !q.blocksCommit);

  return {
    fileName,
    fileSize,
    proposedDocumentType: docType,
    docTypeConfidence,
    docTypeSignals: classification.signals,
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
    analyzedAt: new Date().toISOString(),
  };
}
