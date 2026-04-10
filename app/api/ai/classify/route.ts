/**
 * Phase 3H.25 — AI Classification Review Dashboard
 * 
 * Server-side proxy for AI classification suggestions.
 * Returns a suggestion ONLY — does NOT write to the database.
 * Persistence is handled exclusively by /api/ai/classify-save after user approval.
 */

import { NextRequest, NextResponse } from 'next/server';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

const ALLOWED_CATEGORIES = [
  'WIRE', 'TERMINAL', 'CONNECTOR', 'SEAL',
  'HARDWARE', 'LABEL', 'SLEEVING', 'HOUSING', 'UNKNOWN'
];

function buildPrompt(partNumber: string, description: string | null): string {
  return `You are a harness manufacturing domain expert. Classify the component below into exactly one of these categories:
WIRE, TERMINAL, CONNECTOR, SEAL, HARDWARE, LABEL, SLEEVING, HOUSING, UNKNOWN

Classification guidelines:
- WIRE: Wire, cable, lead — usually prefixed W in part numbers, described with AWG or footage
- TERMINAL: Crimped electrical terminals
- CONNECTOR: Multi-pin housings, plugs, receptacles
- SEAL: Environmental seals, wire seals, cavity plugs
- HARDWARE: Clips, brackets, fasteners, grommets
- LABEL: Identification labels, markers
- SLEEVING: Corrugated conduit, heat shrink, braided sleeving
- HOUSING: Connector housing body (without terminals)
- UNKNOWN: Insufficient data to determine category

Respond with pure JSON only:
{ "category": "CATEGORY", "confidence": 0.0-1.0, "reason": "brief one-sentence explanation" }

Component to classify:
Part Number: ${partNumber}
Description: ${description ?? 'N/A'}`;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY is not configured on the server. Set it in .env.local.' },
      { status: 500 }
    );
  }

  let body: { partNumber?: string; description?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }

  const { partNumber, description = null } = body;
  if (!partNumber?.trim()) {
    return NextResponse.json({ error: 'partNumber is required' }, { status: 400 });
  }

  const claudeBody = {
    model: CLAUDE_MODEL,
    max_tokens: 256,
    temperature: 0,
    system: 'You are a deterministic classification microservice. Output only valid JSON with no markdown or extra text.',
    messages: [
      {
        role: 'user',
        content: [{ type: 'text', text: buildPrompt(partNumber.trim(), description ?? null) }]
      }
    ]
  };

  let anthropicResponse: Response;
  try {
    anthropicResponse = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(claudeBody)
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to reach Claude API', details: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }

  const responseData = await anthropicResponse.json();

  if (!anthropicResponse.ok) {
    const errMsg = responseData?.error?.message ?? `Claude API returned ${anthropicResponse.status}`;
    console.error('[/api/ai/classify] Claude API error:', errMsg);
    return NextResponse.json({ error: errMsg }, { status: anthropicResponse.status });
  }

  const rawContent = Array.isArray(responseData.content)
    ? responseData.content.map((item: { text?: string }) => item?.text ?? '').join('\n')
    : '';

  const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('[/api/ai/classify] No JSON found in response:', rawContent);
    return NextResponse.json(
      { error: 'AI returned an unparseable response', raw: rawContent },
      { status: 500 }
    );
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const rawCategory = typeof parsed.category === 'string' ? parsed.category.toUpperCase().trim() : 'UNKNOWN';
    const category = ALLOWED_CATEGORIES.includes(rawCategory) ? rawCategory : 'UNKNOWN';
    const confidence = typeof parsed.confidence === 'number'
      ? Math.max(0, Math.min(1, parsed.confidence))
      : 0;
    const reason = typeof parsed.reason === 'string' ? parsed.reason.trim() : '';

    return NextResponse.json({ category, confidence, reason });
  } catch {
    return NextResponse.json(
      { error: 'Failed to parse AI JSON response', raw: rawContent },
      { status: 500 }
    );
  }
}
