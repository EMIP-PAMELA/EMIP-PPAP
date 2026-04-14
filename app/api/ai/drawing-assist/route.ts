/**
 * AI Drawing Assist API Route — Phase 3H.48 C10.3
 *
 * Server-side Anthropic Claude proxy for structured drawing interpretation.
 * Accepts a pre-built prompt from aiDrawingAssistService and returns the raw
 * AI text content for the caller to parse and validate.
 *
 * Contract:
 *   POST { prompt: string }
 *   → 200 { content: string }   — raw Claude output (caller validates JSON)
 *   → 4xx/5xx { error: string } — on failure
 *
 * Governance:
 *   - Returns RAW text only. Caller owns all JSON parsing and validation.
 *   - No DB writes. No side effects.
 *   - Fail-safe: non-200 responses are handled gracefully by the service caller.
 */

import { NextRequest, NextResponse } from 'next/server';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL   = 'claude-sonnet-4-20250514';
const MAX_TOKENS     = 2048;

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[AI DRAWING ASSIST] Missing ANTHROPIC_API_KEY');
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  let body: { prompt?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { prompt } = body;
  if (!prompt?.trim()) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
  }

  console.log('[AI DRAWING ASSIST] invoking Claude', {
    model:        CLAUDE_MODEL,
    promptLength: prompt.length,
  });

  let anthropicRes: Response;
  try {
    anthropicRes = await fetch(CLAUDE_API_URL, {
      method: 'POST',
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
          'You are a deterministic electrical harness interpretation microservice.',
          'You output ONLY valid JSON with no markdown fences, no preamble, no explanation outside the JSON.',
          'Never invent data. If a value cannot be determined from the provided text, return null.',
        ].join(' '),
        messages: [
          { role: 'user', content: [{ type: 'text', text: prompt }] },
        ],
      }),
    });
  } catch (err) {
    console.error('[AI DRAWING ASSIST] fetch to Anthropic failed', err);
    return NextResponse.json({ error: 'Failed to reach Claude API' }, { status: 502 });
  }

  const data = await anthropicRes.json();

  if (!anthropicRes.ok) {
    const msg = data?.error?.message ?? `Claude returned ${anthropicRes.status}`;
    console.error('[AI DRAWING ASSIST] Claude error', msg);
    return NextResponse.json({ error: msg }, { status: anthropicRes.status });
  }

  const content: string = Array.isArray(data.content)
    ? data.content.map((item: { text?: string }) => item?.text ?? '').join('')
    : '';

  console.log('[AI DRAWING ASSIST] Claude responded', {
    contentLength: content.length,
    preview:       content.slice(0, 120),
  });

  return NextResponse.json({ content });
}
