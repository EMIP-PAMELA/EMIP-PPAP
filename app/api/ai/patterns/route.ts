/**
 * Phase 3H.26 — Pattern Classification Engine
 * Persists deterministic part-number pattern rules that short-circuit AI.
 */

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { invalidatePatternCache } from '@/src/core/services/patternLookup';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ALLOWED_CATEGORIES = [
  'WIRE',
  'TERMINAL',
  'CONNECTOR',
  'SEAL',
  'HARDWARE',
  'LABEL',
  'SLEEVING',
  'HOUSING',
  'UNKNOWN'
];

const MATCH_TYPES = ['prefix', 'contains'] as const;
type MatchType = typeof MATCH_TYPES[number];

export async function POST(request: NextRequest) {
  console.log('[PATTERN API] Incoming request');
  console.log('[PATTERN API ENV]', {
    hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  });

  let body: any;
  try {
    body = await request.json();
    console.log('[PATTERN API BODY]', body);
  } catch (err) {
    console.error('[PATTERN API BODY PARSE ERROR]', err);
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
  }

  try {
    const { pattern, category, match_type = 'prefix' } = body;

    console.log('[PATTERN INSERT ATTEMPT]', {
      pattern,
      category,
      match_type
    });

    const { data, error } = await supabase
      .from('component_classification_patterns')
      .insert([
        {
          pattern,
          category,
          match_type,
          confidence: 1
        }
      ])
      .select();

    if (error) {
      console.error('[PATTERN INSERT ERROR]', error);
      return new Response(
        JSON.stringify({ error }),
        { status: 500 }
      );
    }

    invalidatePatternCache();
    console.log('[PATTERN INSERT SUCCESS]', data);

    return new Response(
      JSON.stringify({ success: true, data }),
      { status: 200 }
    );

  } catch (err) {
    console.error('[PATTERN API CRASH]', err);

    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500 }
    );
  }
}
