import { getSupabaseServer } from '@/src/lib/supabaseServer';
import {
  createSKU,
  getSKU,
  type DocumentType,
} from '@/src/features/harness-work-instructions/services/skuService';
import { resolveAliasFromDB } from '@/src/features/harness-work-instructions/services/aliasService';
import { canonicalizePartNumber } from '@/src/utils/canonicalizePartNumber';

const MAX_CANDIDATES = 50;
const SAME_SKU_THRESHOLD = 5;
const RECENT_WINDOW_DAYS = 7;
const SKU_CREATION_CONFIDENCE_THRESHOLD = 6;

type LinkType = 'SAME_SKU' | 'RELATED' | 'CONFLICT';

interface DocumentRow {
  id: string;
  sku_id: string | null;
  document_type: DocumentType;
  file_name: string;
  storage_path: string | null;
  inferred_part_number: string | null;
  drawing_number: string | null;
  extracted_text_hash: string | null;
  phantom_rev_flag: boolean;
  uploaded_at: string;
  classification_status: string;
}

interface LinkEvaluation {
  score: number;
  signals: string[];
  linkType: LinkType;
  effectiveTargetPartNumber: string | null;
  effectiveCandidatePartNumber: string | null;
}

function documentTypeGroup(type: DocumentType): 'BOM' | 'DRAWING' {
  return type === 'BOM' ? 'BOM' : 'DRAWING';
}

function sortPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

async function resolveDrawingAlias(
  drawingNumber: string | null,
  cache: Map<string, string | null>,
): Promise<string | null> {
  if (!drawingNumber) return null;
  const normalized = drawingNumber.trim().toUpperCase();
  if (cache.has(normalized)) {
    return cache.get(normalized) ?? null;
  }
  try {
    const alias = await resolveAliasFromDB(normalized);
    cache.set(normalized, alias ?? null);
    return alias ?? null;
  } catch (err) {
    console.warn('[LINKING] alias lookup failed', { drawingNumber: normalized, error: err });
    cache.set(normalized, null);
    return null;
  }
}

async function fetchDocument(documentId: string, supabase = getSupabaseServer()): Promise<DocumentRow | null> {
  const { data, error } = await supabase
    .from('sku_documents')
    .select(
      `id, sku_id, document_type, file_name, storage_path,
       inferred_part_number, drawing_number, extracted_text_hash,
       phantom_rev_flag, uploaded_at, classification_status`
    )
    .eq('id', documentId)
    .maybeSingle();

  if (error) {
    console.error('[LINKING] failed to load document', { documentId, error: error.message });
    return null;
  }
  if (!data) return null;
  return {
    ...data,
    document_type: (data.document_type ?? 'BOM') as DocumentType,
  } as DocumentRow;
}

async function fetchCandidates(target: DocumentRow, supabase = getSupabaseServer()): Promise<DocumentRow[]> {
  const selector = supabase
    .from('sku_documents')
    .select(
      `id, sku_id, document_type, file_name, storage_path,
       inferred_part_number, drawing_number, extracted_text_hash,
       phantom_rev_flag, uploaded_at, classification_status`
    )
    .neq('id', target.id)
    .order('uploaded_at', { ascending: false })
    .limit(MAX_CANDIDATES);

  const orClauses: string[] = [];
  if (target.inferred_part_number) {
    orClauses.push(`inferred_part_number.eq.${target.inferred_part_number}`);
  }
  if (target.drawing_number) {
    orClauses.push(`drawing_number.eq.${target.drawing_number}`);
  }
  if (target.sku_id) {
    orClauses.push(`sku_id.eq.${target.sku_id}`);
  }

  if (orClauses.length === 0) {
    return [];
  }

  selector.or(orClauses.join(','));

  const { data, error } = await selector;

  if (error) {
    console.error('[LINKING] candidate query failed', error.message);
    return [];
  }

  return (data ?? []).map(row => ({
    ...row,
    document_type: (row.document_type ?? 'BOM') as DocumentType,
  })) as DocumentRow[];
}

async function computeSignals(
  target: DocumentRow,
  candidate: DocumentRow,
  aliasCache: Map<string, string | null>,
): Promise<LinkEvaluation> {
  let score = 0;
  const signals: string[] = [];
  let linkType: LinkType = 'RELATED';

  const targetAlias = await resolveDrawingAlias(target.drawing_number, aliasCache);
  const candidateAlias = await resolveDrawingAlias(candidate.drawing_number, aliasCache);

  const effectiveTargetPart = target.inferred_part_number ?? targetAlias;
  const effectiveCandidatePart = candidate.inferred_part_number ?? candidateAlias;

  // T23.6.35: Canonical comparison — resolves NH-prefix / dash-format mismatches
  const bomCanonical     = canonicalizePartNumber(effectiveTargetPart);
  const drawingCanonical = canonicalizePartNumber(effectiveCandidatePart);

  console.log('[T23.6.37 TRACE]', {
    stage: 'LINKING',
    function: 'computeSignals',
    rawPart: effectiveTargetPart,
    canonicalPart: bomCanonical,
    outgoingValue: effectiveCandidatePart,
    note: 'Evaluating BOM vs candidate inferred part numbers',
  });

  if (effectiveTargetPart && effectiveCandidatePart) {
    if (bomCanonical !== null && drawingCanonical !== null && bomCanonical === drawingCanonical) {
      score += 3;
      signals.push(`part_number_match:${bomCanonical}`);
      console.log('[T23.6.35 CANONICAL COMPARE]', {
        bomRaw: effectiveTargetPart,
        drawingRaw: effectiveCandidatePart,
        bomCanonical,
        drawingCanonical,
        match: true,
      });
    } else {
      linkType = 'CONFLICT';
      signals.push('part_number_conflict');
      console.log('[T23.6.35 CANONICAL COMPARE]', {
        bomRaw: effectiveTargetPart,
        drawingRaw: effectiveCandidatePart,
        bomCanonical,
        drawingCanonical,
        match: false,
      });
    }
  }

  if (!target.inferred_part_number && target.drawing_number && effectiveCandidatePart) {
    score += 2;
    signals.push(`alias_bridge:${target.drawing_number}->${effectiveCandidatePart}`);
  }

  if (!candidate.inferred_part_number && candidate.drawing_number && effectiveTargetPart) {
    score += 2;
    signals.push(`alias_bridge:${candidate.drawing_number}->${effectiveTargetPart}`);
  }

  // T23.6.35: Canonical comparison for drawing numbers
  const targetDwgCanonical    = canonicalizePartNumber(target.drawing_number);
  const candidateDwgCanonical = canonicalizePartNumber(candidate.drawing_number);

  if (target.drawing_number && candidate.drawing_number) {
    if (targetDwgCanonical !== null && candidateDwgCanonical !== null && targetDwgCanonical === candidateDwgCanonical) {
      score += 2;
      signals.push('drawing_number_match');
      console.log('[T23.6.35 CANONICAL COMPARE]', {
        bomRaw:          target.drawing_number,
        drawingRaw:      candidate.drawing_number,
        bomCanonical:    targetDwgCanonical,
        drawingCanonical: candidateDwgCanonical,
        match: true,
      });
      console.log('[T23.6.37 TRACE]', {
        stage: 'LINKING',
        function: 'computeSignals',
        rawPart: target.drawing_number,
        canonicalPart: targetDwgCanonical,
        outgoingValue: candidate.drawing_number,
        note: 'Drawing number canonical comparison match',
      });
      if (bomCanonical && drawingCanonical && bomCanonical !== drawingCanonical) {
        linkType = 'CONFLICT';
        signals.push('drawing_number_conflict');
      }
    }
  }

  if (documentTypeGroup(target.document_type) === documentTypeGroup(candidate.document_type)) {
    score += 1;
    signals.push('document_group_match');
  }

  if (
    target.extracted_text_hash &&
    candidate.extracted_text_hash &&
    target.extracted_text_hash === candidate.extracted_text_hash
  ) {
    score += 1;
    signals.push('text_hash_match');
  }

  const createdAtTarget = new Date(target.uploaded_at).getTime();
  const createdAtCandidate = new Date(candidate.uploaded_at).getTime();
  const diffDays = Math.abs(createdAtTarget - createdAtCandidate) / (1000 * 60 * 60 * 24);
  if (diffDays <= RECENT_WINDOW_DAYS) {
    score += 1;
    signals.push('time_proximity');
  }

  if (target.sku_id && candidate.sku_id && target.sku_id !== candidate.sku_id) {
    linkType = 'CONFLICT';
    signals.push('sku_mismatch');
  }

  if (target.phantom_rev_flag || candidate.phantom_rev_flag) {
    linkType = 'CONFLICT';
    signals.push('phantom_revision_detected');
  }

  if (score >= SAME_SKU_THRESHOLD && linkType !== 'CONFLICT') {
    linkType = 'SAME_SKU';
  }

  if (linkType !== 'CONFLICT' && score < 3) {
    linkType = 'RELATED';
  }

  return {
    score,
    signals,
    linkType,
    effectiveTargetPartNumber: effectiveTargetPart ?? null,
    effectiveCandidatePartNumber: effectiveCandidatePart ?? null,
  };
}

async function ensureSku(
  partNumber: string,
  sourceType: DocumentType,
  confidenceScore: number,
): Promise<string | null> {
  const canonical = canonicalizePartNumber(partNumber) ?? partNumber.trim().toUpperCase();

  console.log('[T23.6.37 TRACE]', {
    stage: 'SKU',
    function: 'ensureSku',
    rawPart: partNumber,
    canonicalPart: canonical,
    outgoingValue: confidenceScore,
    note: 'Linking workflow ensuring SKU exists before attachment',
  });
  try {
    const existing = await getSKU(canonical);
    if (existing?.sku?.id) {
      return existing.sku.id;
    }
  } catch (err) {
    console.warn('[LINKING] getSKU failed', err);
  }

  if (confidenceScore < SKU_CREATION_CONFIDENCE_THRESHOLD) {
    console.warn('[LINKING] SKU CREATION SKIPPED — LOW CONFIDENCE', {
      part_number: canonical,
      confidenceScore,
    });
    return null;
  }

  try {
    const sku = await createSKU(canonical, undefined, sourceType);
    return sku.id;
  } catch (err) {
    console.warn('[LINKING] createSKU failed', err);
    try {
      const fallback = await getSKU(canonical);
      return fallback?.sku?.id ?? null;
    } catch (inner) {
      console.warn('[LINKING] fallback getSKU failed', inner);
    }
  }
  return null;
}

async function attachDocumentsToSKU(
  document: DocumentRow,
  candidate: DocumentRow,
  evaluation: LinkEvaluation,
  supabase = getSupabaseServer(),
): Promise<void> {
  if (evaluation.linkType !== 'SAME_SKU' || evaluation.score < SAME_SKU_THRESHOLD) {
    return;
  }

  const partNumber =
    evaluation.effectiveTargetPartNumber ?? evaluation.effectiveCandidatePartNumber ?? null;
  if (!partNumber) return;

  let targetSkuId = document.sku_id ?? candidate.sku_id ?? null;
  if (!targetSkuId) {
    targetSkuId = await ensureSku(partNumber, document.document_type, evaluation.score);
  }

  if (!targetSkuId) return;

  if (!document.sku_id) {
    const { error } = await supabase
      .from('sku_documents')
      .update({ sku_id: targetSkuId })
      .eq('id', document.id);
    if (error) {
      console.warn('[LINKING] Failed to set SKU on document', { documentId: document.id, error: error.message });
    }
  }

  if (!candidate.sku_id) {
    const { error } = await supabase
      .from('sku_documents')
      .update({ sku_id: targetSkuId })
      .eq('id', candidate.id);
    if (error) {
      console.warn('[LINKING] Failed to set SKU on candidate', { documentId: candidate.id, error: error.message });
    }
  }
}

export async function linkDocument(documentId: string): Promise<void> {
  const supabase = getSupabaseServer();
  const document = await fetchDocument(documentId, supabase);
  if (!document) return;
  if (!document.inferred_part_number && !document.drawing_number) {
    return;
  }

  const aliasCache = new Map<string, string | null>();
  const candidates = await fetchCandidates(document, supabase);

  for (const candidate of candidates) {
    const evaluation = await computeSignals(document, candidate, aliasCache);
    if (evaluation.signals.length === 0) continue;

    const [docA, docB] = sortPair(document.id, candidate.id);
    const { error: linkError } = await supabase
      .from('document_links')
      .upsert(
        {
          document_id_a: docA,
          document_id_b: docB,
          link_type: evaluation.linkType,
          confidence_score: evaluation.score,
          signals_used: evaluation.signals,
        },
        { onConflict: 'document_id_a,document_id_b' },
      );

    if (linkError) {
      console.warn('[LINKING] Failed to upsert link', linkError.message);
      continue;
    }

    await attachDocumentsToSKU(document, candidate, evaluation, supabase);
  }
}

