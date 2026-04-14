/**
 * AI Drawing Vision Parse API Route — Phase 3H.51 C13
 *
 * Universal server-side Claude proxy for structured drawing extraction.
 * Accepts a structured prompt (and optionally base64 image data URLs for
 * future browser-render integration) and returns raw Claude JSON text.
 *
 * Contract:
 *   POST { prompt: string; imageDataUrls?: string[] }
 *   → 200 { content: string }   — raw Claude output (caller validates JSON)
 *   → 4xx/5xx { error: string } — on failure
 *
 * Governance:
 *   - Returns RAW text only. Caller owns all JSON parsing and validation.
 *   - Images are optional; text-only mode is fully supported in this phase.
 *   - Max 2 images accepted (first 2 pages of drawing if provided).
 *   - temperature 0 — deterministic structured output.
 *   - No DB writes. No side effects.
 *   - Fail-safe: non-200 responses are handled by the service caller.
 */

import { NextRequest, NextResponse } from 'next/server';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL   = 'claude-sonnet-4-20250514';
const MAX_TOKENS     = 4096;
const MAX_IMAGES     = 2;

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } };

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[AI VISION PARSE] Missing ANTHROPIC_API_KEY');
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  let body: { prompt?: string; imageDataUrls?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { prompt, imageDataUrls } = body;
  if (!prompt?.trim()) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
  }

  // Build user content — images (if present) followed by text prompt
  const userContent: ContentBlock[] = [];

  const images = (imageDataUrls ?? []).slice(0, MAX_IMAGES);
  for (const dataUrl of images) {
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx === -1) continue;
    const header    = dataUrl.slice(0, commaIdx);           // e.g. "data:image/png;base64"
    const data      = dataUrl.slice(commaIdx + 1);
    const mediaType = header.match(/data:([^;]+)/)?.[1] ?? 'image/png';
    if (!data) continue;
    userContent.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data } });
  }
  userContent.push({ type: 'text', text: prompt });

  console.log('[AI VISION PARSE] invoking Claude', {
    model:        CLAUDE_MODEL,
    promptLength: prompt.length,
    imageCount:   images.length,
  });

  let anthropicRes: Response;
  try {
    anthropicRes = await fetch(CLAUDE_API_URL, {
      method:  'POST',
      headers: {
        'content-type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:       CLAUDE_MODEL,
        max_tokens:  MAX_TOKENS,
        temperature: 0,
        system: [
          'You are a deterministic electrical harness drawing extraction microservice.',
          'You extract structured data from harness drawing text and/or images.',
          'Output ONLY valid JSON with no markdown fences, no preamble, no explanation outside the JSON.',
          'Never invent or hallucinate data. If a value cannot be determined, return null.',
          'Do not include schema comments or placeholder strings in the output.',
        ].join(' '),
        messages: [
          { role: 'user', content: userContent },
        ],
      }),
    });
  } catch (err) {
    console.error('[AI VISION PARSE] fetch to Anthropic failed', err);
    return NextResponse.json({ error: 'Failed to reach Claude API' }, { status: 502 });
  }

  const data = await anthropicRes.json();

  if (!anthropicRes.ok) {
    const msg = data?.error?.message ?? `Claude returned ${anthropicRes.status}`;
    console.error('[AI VISION PARSE] Claude error', msg);
    return NextResponse.json({ error: msg }, { status: anthropicRes.status });
  }

  const content: string = Array.isArray(data.content)
    ? data.content.map((item: { text?: string }) => item?.text ?? '').join('')
    : '';

  console.log('[AI VISION PARSE] Claude responded', {
    contentLength: content.length,
    preview:       content.slice(0, 120),
  });

  return NextResponse.json({ content });
}
