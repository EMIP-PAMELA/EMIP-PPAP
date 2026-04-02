/**
 * Server-side proxy for Claude API calls.
 * Reads ANTHROPIC_API_KEY from process.env (never exposed to browser).
 * Receives the already-built ClaudeRequest from claudeOrchestrator.ts,
 * adds auth headers, forwards to Anthropic, and returns the response.
 */

import { NextRequest, NextResponse } from 'next/server';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

export async function POST(request: NextRequest) {
  // API key lives here on the server — never sent to the client
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[/api/copilot] ANTHROPIC_API_KEY is not set in server environment');
    return NextResponse.json(
      { error: 'Claude API is not configured on the server. Set ANTHROPIC_API_KEY in .env.local.' },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }

  let anthropicResponse: Response;
  try {
    anthropicResponse = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error('[/api/copilot] Network error reaching Claude API:', err);
    return NextResponse.json(
      { error: 'Failed to reach Claude API', details: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }

  const responseData = await anthropicResponse.json();

  if (!anthropicResponse.ok) {
    console.error('[/api/copilot] Claude API returned error:', anthropicResponse.status, responseData);
    return NextResponse.json(
      { error: 'Claude API returned an error', details: responseData },
      { status: anthropicResponse.status }
    );
  }

  return NextResponse.json(responseData);
}
