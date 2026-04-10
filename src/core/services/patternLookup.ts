import { supabase } from '@/src/lib/supabaseClient';
import { ClassificationPattern, matchPattern } from '@/src/core/utils/patternMatcher';

let PATTERN_CACHE: ClassificationPattern[] | null = null;
let CACHE_PROMISE: Promise<ClassificationPattern[] | null> | null = null;

async function loadPatterns(): Promise<ClassificationPattern[] | null> {
  if (PATTERN_CACHE) return PATTERN_CACHE;
  if (CACHE_PROMISE) return CACHE_PROMISE;

  CACHE_PROMISE = (async () => {
    const { data, error } = await supabase
      .from('component_classification_patterns')
      .select('pattern, match_type, category, confidence')
      .order('pattern', { ascending: true });

    CACHE_PROMISE = null;

    if (error) {
      console.error('[PATTERN LOOKUP] Failed to load patterns', error);
      PATTERN_CACHE = [];
      return PATTERN_CACHE;
    }

    PATTERN_CACHE = (data ?? []).map(row => ({
      pattern: row.pattern,
      match_type: (row.match_type as ClassificationPattern['match_type']) ?? 'prefix',
      category: row.category,
      confidence: typeof row.confidence === 'number'
        ? Math.max(0, Math.min(1, row.confidence))
        : 1,
    }));

    console.log('[PATTERN LOOKUP] Loaded patterns', { count: PATTERN_CACHE.length });
    return PATTERN_CACHE;
  })();

  return CACHE_PROMISE;
}

export function invalidatePatternCache(): void {
  PATTERN_CACHE = null;
}

export async function getPatternMatch(partNumber: string | null | undefined): Promise<ClassificationPattern | null> {
  if (!partNumber) return null;
  const normalized = partNumber.trim().toUpperCase();
  if (!normalized) return null;

  const patterns = (await loadPatterns()) ?? [];
  if (!patterns.length) {
    return null;
  }

  const match = matchPattern(normalized, patterns);
  if (match) {
    console.log('[PATTERN MATCH]', {
      partNumber: normalized,
      pattern: match.pattern,
      category: match.category,
      matchType: match.match_type,
      confidence: match.confidence ?? 1,
    });
  }

  return match;
}
