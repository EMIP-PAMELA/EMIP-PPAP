import { supabase } from '@/src/lib/supabaseClient';
import { classifyComponent } from '@/src/core/projections/normalizers';
import { getPatternMatch } from '@/src/core/services/patternLookup';

const CLASSIFICATION_CACHE = new Map<string, string | null>();

function normalizePart(partNumber: string | null | undefined): string | null {
  if (!partNumber) return null;
  const normalized = partNumber.trim().toUpperCase();
  return normalized.length ? normalized : null;
}

export async function getMappedCategory(partNumber: string | null | undefined): Promise<string | null> {
  const normalized = normalizePart(partNumber);
  if (!normalized) {
    return null;
  }

  if (CLASSIFICATION_CACHE.has(normalized)) {
    return CLASSIFICATION_CACHE.get(normalized) ?? null;
  }

  const { data, error } = await supabase
    .from('component_classification_map')
    .select('category')
    .eq('part_number', normalized)
    .maybeSingle();

  if (error) {
    console.error('[AI CLASSIFICATION LOOKUP] Failed to read mapping', {
      partNumber: normalized,
      error
    });
    CLASSIFICATION_CACHE.set(normalized, null);
    return null;
  }

  const category = data?.category ?? null;

  if (category) {
    console.log('[AI CLASSIFICATION LOOKUP]', {
      part: normalized,
      category
    });
  }

  CLASSIFICATION_CACHE.set(normalized, category);
  return category;
}

export async function upsertClassificationMapping(params: {
  partNumber: string;
  category: string;
  confidence: number;
  description?: string | null;
  source?: string;
}): Promise<void> {
  const normalized = normalizePart(params.partNumber);
  if (!normalized) {
    throw new Error('partNumber is required to upsert classification mapping');
  }

  const payload = {
    part_number: normalized,
    category: params.category,
    confidence: params.confidence,
    source: params.source ?? 'AI',
    description: params.description ?? null
  };

  console.log('[AI CLASSIFICATION UPSERT] Attempting insert', payload);

  const { data, error } = await supabase
    .from('component_classification_map')
    .upsert(payload, { onConflict: 'part_number' })
    .select();

  if (error) {
    console.error('[AI CLASSIFICATION STORE] Failed to upsert mapping', {
      part: normalized,
      payload,
      error,
      errorMessage: error.message,
      errorCode: error.code,
      errorDetails: error.details,
      errorHint: error.hint
    });
    throw error;
  }

  console.log('[AI CLASSIFICATION UPSERT] Success', { data, part: normalized });

  CLASSIFICATION_CACHE.set(normalized, payload.category);

  console.log('[AI CLASSIFICATION STORED]', {
    part: normalized,
    category: payload.category,
    confidence: payload.confidence,
    source: payload.source
  });
}

type ClassificationSource = 'MAP' | 'PATTERN' | 'CANONICAL';

export interface ClassificationResolution {
  category: string;
  source: ClassificationSource;
  confidence: number;
}

export async function resolveClassification(partNumber: string | null | undefined, description: string | null | undefined): Promise<ClassificationResolution> {
  const normalized = normalizePart(partNumber);

  if (normalized) {
    const mapped = await getMappedCategory(normalized);
    if (mapped && mapped !== 'UNKNOWN') {
      return { category: mapped, source: 'MAP', confidence: 1 };
    }

    const pattern = await getPatternMatch(normalized);
    if (pattern) {
      return {
        category: pattern.category,
        source: 'PATTERN',
        confidence: pattern.confidence ?? 1
      };
    }
  }

  const fallbackCategory = classifyComponent(partNumber ?? null, description ?? null);
  return {
    category: fallbackCategory,
    source: 'CANONICAL',
    confidence: 1
  };
}
