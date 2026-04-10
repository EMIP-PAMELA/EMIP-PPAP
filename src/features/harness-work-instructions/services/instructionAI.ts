/**
 * Harness Work Instruction Generator — AI Extraction Service
 * Phase HWI.2 — Controlled AI + Validation Pipeline
 *
 * Responsibilities:
 *   1. Build structured extraction prompt
 *   2. Call Anthropic API (claude-sonnet with retry)
 *   3. Safely parse JSON response
 *   4. Return rawData + any pre-validation flags
 *
 * Does NOT validate schema — that is instructionValidation.ts.
 * Does NOT persist — that is a future DB service.
 */

import type { EngineeringFlag } from '../types/harnessInstruction.schema';
import { buildFlag } from '../utils/validationMapper';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 8192;
const MAX_RETRIES = 3;

// ---------------------------------------------------------------------------
// Input / Output types
// ---------------------------------------------------------------------------

export interface ExtractionInput {
  jobId: string;
  partNumber: string;
  revision: string;
  rawBomText?: string;
  drawingNotes?: string;
}

export interface ExtractionRawResult {
  rawData: unknown;
  preFlags: EngineeringFlag[];
}

// ---------------------------------------------------------------------------
// Retry wrapper (handles Anthropic 529 overload)
// ---------------------------------------------------------------------------

async function fetchWithRetry(url: string, options: RequestInit): Promise<Response> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, options);

    if (res.status !== 529) return res;

    console.warn('[HWI AI REQUEST] Anthropic overloaded — retrying', {
      attempt,
      maxRetries: MAX_RETRIES,
    });

    if (attempt < MAX_RETRIES) {
      await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 500));
    }
  }

  throw new Error('Anthropic overloaded after retries');
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildExtractionPrompt(input: ExtractionInput): string {
  const bomSection = input.rawBomText
    ? `\n\nBOM DATA:\n${input.rawBomText}`
    : '\n\nBOM DATA: Not provided.';

  const drawingSection = input.drawingNotes
    ? `\n\nDRAWING NOTES:\n${input.drawingNotes}`
    : '\n\nDRAWING NOTES: Not provided.';

  return `You are a wire harness manufacturing data extraction service.
Extract structured data from the provided BOM and drawing notes.
Your output MUST be a single valid JSON object — no markdown, no prose, no explanation.

OUTPUT SCHEMA (follow exactly):
{
  "id": "<use the provided job ID>",
  "status": "review",
  "metadata": {
    "part_number": "<string>",
    "revision": "<string>",
    "description": "<string or null>",
    "source_document_url": null,
    "created_at": "<ISO8601 datetime string>",
    "approved_at": null,
    "generated_pdf_url": null
  },
  "wire_instances": [
    {
      "wire_id": "<unique string, e.g. W001>",
      "aci_wire_part_number": "<string>",
      "gauge": "<string or number, e.g. '18' or 18>",
      "color": "<string>",
      "cut_length": <positive number, inches>,
      "strip_end_a": <number or null>,
      "strip_end_b": <number or null>,
      "end_a": {
        "connector_id": "<string or null>",
        "cavity": "<string or null>",
        "terminal_part_number": "<string or null>",
        "seal_part_number": "<string or null>"
      },
      "end_b": {
        "connector_id": "<string or null>",
        "cavity": "<string or null>",
        "terminal_part_number": "<string or null>",
        "seal_part_number": "<string or null>"
      },
      "provenance": {
        "source_type": "<'drawing'|'bom'|'derived'|'manual'>",
        "source_ref": "<string or omit>",
        "confidence": <0.0-1.0>,
        "note": "<string or omit>"
      }
    }
  ],
  "press_rows": [
    {
      "press_id": "<unique string, e.g. PR001>",
      "wire_id": "<matching wire_id>",
      "terminal_part_number": "<string>",
      "applicator_id": "<string or null>",
      "crimp_height": <number or null>,
      "provenance": { "source_type": "...", "confidence": 0.0 }
    }
  ],
  "komax_rows": [
    {
      "komax_id": "<unique string, e.g. KX001>",
      "wire_id": "<matching wire_id>",
      "cut_length": <positive number>,
      "strip_a": <number or null>,
      "strip_b": <number or null>,
      "program_number": "<string or null>",
      "provenance": { "source_type": "...", "confidence": 0.0 }
    }
  ],
  "pin_map_rows": [
    {
      "pin_map_id": "<unique string, e.g. PM001>",
      "connector_id": "<string>",
      "cavity": "<string>",
      "wire_id": "<string or null>",
      "terminal_part_number": "<string or null>",
      "provenance": { "source_type": "...", "confidence": 0.0 }
    }
  ],
  "assembly_steps": [
    {
      "step_number": <integer starting at 1>,
      "instruction": "<clear assembly instruction text>",
      "wire_ids": ["<wire_id>"],
      "tool_ref": "<string or null>",
      "notes": "<string or null>",
      "provenance": { "source_type": "...", "confidence": 0.0 }
    }
  ],
  "engineering_flags": [
    {
      "flag_id": "<unique string, e.g. FL001>",
      "flag_type": "<'warning'|'error'|'info'|'review_required'>",
      "field_ref": "<dot-path string or null>",
      "message": "<description of the issue>",
      "resolved": false
    }
  ],
  "review_questions": [
    {
      "id": "<unique string, e.g. RQ001>",
      "prompt": "<question for human reviewer>",
      "answer": null,
      "resolved": false
    }
  ]
}

RULES:
- Set "answer" to null and "resolved" to false for all review_questions.
- Set "resolved" to false for all engineering_flags.
- Use "review_required" flag_type when data is uncertain or incomplete.
- Output empty arrays [] for sections with no data — do NOT omit them.
- All provenance objects must include source_type and confidence (0.0-1.0).
- If you cannot determine a required value, set it to null where nullable, or add a review_required engineering_flag.
- Do NOT include any fields not in the schema above.

JOB ID: ${input.jobId}
PART NUMBER: ${input.partNumber}
REVISION: ${input.revision}${bomSection}${drawingSection}`;
}

// ---------------------------------------------------------------------------
// Main extraction function
// ---------------------------------------------------------------------------

export async function runPhase1Extraction(
  input: ExtractionInput
): Promise<ExtractionRawResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  console.log('[HWI AI REQUEST]', {
    jobId: input.jobId,
    partNumber: input.partNumber,
    revision: input.revision,
    hasBom: !!input.rawBomText,
    hasDrawing: !!input.drawingNotes,
    timestamp: new Date().toISOString(),
  });

  if (!apiKey) {
    console.error('[HWI AI REQUEST] ANTHROPIC_API_KEY is not set');
    return {
      rawData: null,
      preFlags: [
        buildFlag('AI_NO_KEY', 'ANTHROPIC_API_KEY is not configured — AI extraction skipped', {
          flag_type: 'error',
        }),
      ],
    };
  }

  const prompt = buildExtractionPrompt(input);

  const requestBody = {
    model: CLAUDE_MODEL,
    max_tokens: MAX_TOKENS,
    temperature: 0,
    system:
      'You are a deterministic wire harness data extraction microservice. ' +
      'Output ONLY valid JSON with no markdown, no code fences, no commentary. ' +
      'The JSON must conform exactly to the schema provided in the user message.',
    messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
  };

  let anthropicResponse: Response;
  try {
    anthropicResponse = await fetchWithRetry(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(requestBody),
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[HWI AI REQUEST] Fetch failed:', errMsg);
    return {
      rawData: null,
      preFlags: [
        buildFlag('AI_FAILURE', `AI extraction failed: ${errMsg}`, { flag_type: 'error' }),
      ],
    };
  }

  let responseJson: Record<string, unknown>;
  try {
    responseJson = await anthropicResponse.json();
  } catch {
    console.error('[HWI AI RESPONSE RAW] Could not parse Anthropic response body');
    return {
      rawData: null,
      preFlags: [
        buildFlag('AI_FAILURE', 'Could not parse Anthropic API response body', {
          flag_type: 'error',
        }),
      ],
    };
  }

  if (!anthropicResponse.ok) {
    const errMsg =
      (responseJson?.error as Record<string, unknown>)?.message ??
      `Anthropic API returned status ${anthropicResponse.status}`;
    console.error('[HWI AI RESPONSE RAW] API error:', errMsg);
    return {
      rawData: null,
      preFlags: [
        buildFlag('AI_API_ERROR', `Anthropic API error: ${String(errMsg)}`, { flag_type: 'error' }),
      ],
    };
  }

  const contentItems = Array.isArray(responseJson.content)
    ? (responseJson.content as Array<{ text?: string }>)
    : [];
  const rawText = contentItems.map((item) => item?.text ?? '').join('\n').trim();

  console.log('[HWI AI RESPONSE RAW]', {
    jobId: input.jobId,
    responseLength: rawText.length,
    preview: rawText.slice(0, 200),
  });

  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('[HWI AI RESPONSE RAW] No JSON object found in response');
    return {
      rawData: null,
      preFlags: [
        buildFlag('AI_PARSE_ERROR', 'AI response was not valid JSON — no JSON object found', {
          flag_type: 'error',
        }),
      ],
    };
  }

  try {
    const parsed: unknown = JSON.parse(jsonMatch[0]);
    console.log('[HWI AI RESPONSE RAW] JSON parsed successfully', { jobId: input.jobId });
    return { rawData: parsed, preFlags: [] };
  } catch (parseErr) {
    const errMsg = parseErr instanceof Error ? parseErr.message : String(parseErr);
    console.error('[HWI AI RESPONSE RAW] JSON.parse failed:', errMsg);
    return {
      rawData: null,
      preFlags: [
        buildFlag('AI_PARSE_ERROR', `AI response was not valid JSON: ${errMsg}`, {
          flag_type: 'error',
        }),
      ],
    };
  }
}
