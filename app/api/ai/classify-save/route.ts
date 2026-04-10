/**
 * Phase 3H.25 — AI Classification Review Dashboard
 *
 * Persists a user-approved classification to component_classification_map.
 * Called ONLY after explicit user action (Save or manual override).
 * AI suggestions are NEVER auto-written — this route requires intentional invocation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { upsertClassificationMapping } from '@/src/core/services/classificationLookup';

const ALLOWED_CATEGORIES = [
  'WIRE', 'TERMINAL', 'CONNECTOR', 'SEAL',
  'HARDWARE', 'LABEL', 'SLEEVING', 'HOUSING', 'UNKNOWN'
];

const ALLOWED_SOURCES = ['AI', 'AI_APPROVED', 'MANUAL'] as const;
type AllowedSource = typeof ALLOWED_SOURCES[number];

export async function POST(request: NextRequest) {
  let body: {
    partNumber?: string;
    category?: string;
    confidence?: number;
    description?: string | null;
    source?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }

  const { partNumber, category, confidence, description = null, source } = body;

  console.log('[CLASSIFY_SAVE_PAYLOAD]', {
    partNumber,
    category,
    confidence,
    source,
    description: description ?? 'null'
  });

  if (!partNumber?.trim()) {
    return NextResponse.json({ error: 'partNumber is required' }, { status: 400 });
  }
  if (!category?.trim()) {
    return NextResponse.json({ error: 'category is required' }, { status: 400 });
  }

  const normalizedCategory = category.trim().toUpperCase();
  if (!ALLOWED_CATEGORIES.includes(normalizedCategory)) {
    return NextResponse.json(
      { error: `Invalid category "${category}". Allowed: ${ALLOWED_CATEGORIES.join(', ')}` },
      { status: 400 }
    );
  }

  let resolvedSource: AllowedSource = 'AI';
  if (typeof source === 'string') {
    const normalizedSource = source.trim().toUpperCase();
    if (ALLOWED_SOURCES.includes(normalizedSource as AllowedSource)) {
      resolvedSource = normalizedSource as AllowedSource;
    } else {
      console.warn('[CLASSIFY_SAVE] Unknown source, defaulting to AI', { provided: source, normalized: normalizedSource });
    }
  }
  const resolvedConfidence = typeof confidence === 'number'
    ? Math.max(0, Math.min(1, confidence))
    : 1.0;

  try {
    await upsertClassificationMapping({
      partNumber: partNumber.trim(),
      category: normalizedCategory,
      confidence: resolvedConfidence,
      description: description ?? null,
      source: resolvedSource
    });

    console.log('[/api/ai/classify-save] Saved', {
      partNumber: partNumber.trim(),
      category: normalizedCategory,
      confidence: resolvedConfidence,
      source: resolvedSource
    });

    return NextResponse.json({
      success: true,
      partNumber: partNumber.trim(),
      category: normalizedCategory,
      source: resolvedSource
    });
  } catch (err) {
    console.error('[CLASSIFY_SAVE_ERROR]', {
      error: err,
      message: err instanceof Error ? err.message : String(err),
      partNumber: partNumber.trim(),
      category: normalizedCategory,
      source: resolvedSource
    });
    return NextResponse.json(
      { error: 'Failed to save classification', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
