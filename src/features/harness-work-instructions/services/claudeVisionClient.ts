/**
 * Claude Vision Client — C12.4-R10
 *
 * Direct caller to the Anthropic Claude API for drawing vision extraction.
 *
 * WHY THIS EXISTS:
 *   aiDrawingVisionService.ts previously called `/api/ai/drawing-vision-parse`
 *   via HTTP self-fetch, using AI_ROUTE_BASE resolved from:
 *     NEXT_PUBLIC_APP_URL ?? NEXTAUTH_URL ?? 'http://localhost:3000'
 *   On Vercel serverless, when neither env var is set, that resolves to
 *   localhost:3000 which is unreachable. The fetch throws, the catch swallows
 *   it, and all vision paths return null silently.
 *
 *   This module calls the Anthropic API directly — no HTTP round-trip,
 *   no localhost dependency, no env-var URL resolution required.
 *
 * Governance:
 *   - Server-side only. Requires ANTHROPIC_API_KEY.
 *   - Returns raw text content or null on any failure — never throws.
 *   - Behaviour is identical to app/api/ai/drawing-vision-parse/route.ts.
 *   - app/api/ai/drawing-vision-parse/route.ts is preserved for direct
 *     client-side callers (browser fetch) and is NOT modified by this fix.
 */

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL   = 'claude-sonnet-4-20250514';
const MAX_TOKENS     = 4096;
const MAX_IMAGES     = 2;

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } };

/**
 * Call Claude directly with a prompt and optional image data URLs.
 * Returns the raw text content of Claude's response, or null on any failure.
 */
export async function callClaudeVision(
  prompt: string,
  imageDataUrls?: string[],
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[CLAUDE VISION CLIENT] Missing ANTHROPIC_API_KEY — all vision calls will return null');
    return null;
  }

  const userContent: ContentBlock[] = [];
  const images = (imageDataUrls ?? []).slice(0, MAX_IMAGES);

  for (const dataUrl of images) {
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx === -1) continue;
    const header    = dataUrl.slice(0, commaIdx);
    const data      = dataUrl.slice(commaIdx + 1);
    const mediaType = header.match(/data:([^;]+)/)?.[1] ?? 'image/png';
    if (!data) continue;
    userContent.push({
      type:   'image',
      source: { type: 'base64', media_type: mediaType, data },
    });
  }
  userContent.push({ type: 'text', text: prompt });

  console.log('[CLAUDE VISION CLIENT] invoking Claude', {
    model:      CLAUDE_MODEL,
    promptLen:  prompt.length,
    imageCount: images.length,
  });

  try {
    const res = await fetch(CLAUDE_API_URL, {
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
        messages: [{ role: 'user', content: userContent }],
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const msg = (errData as { error?: { message?: string } })?.error?.message
        ?? `Claude returned ${res.status}`;
      console.error('[CLAUDE VISION CLIENT] Claude error:', msg);
      return null;
    }

    const responseData = await res.json() as { content?: Array<{ text?: string }> };
    const content = Array.isArray(responseData.content)
      ? responseData.content.map(item => item?.text ?? '').join('')
      : '';

    console.log('[CLAUDE VISION CLIENT] responded', {
      contentLen: content.length,
      preview:    content.slice(0, 120),
    });

    return content || null;
  } catch (err) {
    console.error('[CLAUDE VISION CLIENT] fetch to Anthropic failed', err);
    return null;
  }
}
