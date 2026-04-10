import { supabase } from '@/src/lib/supabaseClient';
import { upsertClassificationMapping } from '@/src/core/services/classificationLookup';

const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
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

interface UnknownPart {
  partNumber: string;
  description: string | null;
}

interface AIClassificationResult {
  category: string;
  confidence: number;
}

function normalizePart(partNumber: string | null | undefined): string | null {
  if (!partNumber) return null;
  const normalized = partNumber.trim().toUpperCase();
  return normalized.length ? normalized : null;
}

async function fetchExistingMappings(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('component_classification_map')
    .select('part_number');

  if (error) {
    console.error('[AI CLASSIFICATION] Failed to load existing mappings', error);
    return new Set();
  }

  const set = new Set<string>();
  (data || []).forEach((row) => {
    const normalized = normalizePart(row.part_number as string | null);
    if (normalized) set.add(normalized);
  });
  return set;
}

async function fetchUnknownParts(limit?: number): Promise<UnknownPart[]> {
  const existingSet = await fetchExistingMappings();
  const normalizedLimit = typeof limit === 'number' && limit > 0 ? limit : Infinity;
  const pageSize = 1000;
  const unique = new Map<string, UnknownPart>();
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('bom_records')
      .select('component_part_number, description')
      .eq('category', 'UNKNOWN')
      .order('component_part_number', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(`Failed to fetch BOM records: ${error.message}`);
    }

    const batch = data || [];
    if (batch.length === 0) {
      break;
    }

    for (const record of batch) {
      const partNumber = normalizePart(record.component_part_number as string | null);
      if (!partNumber) continue;
      if (existingSet.has(partNumber)) continue;
      if (unique.has(partNumber)) continue;

      unique.set(partNumber, {
        partNumber,
        description: (record.description as string | null) ?? null
      });

      if (unique.size >= normalizedLimit) {
        return Array.from(unique.values());
      }
    }

    if (batch.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return Array.from(unique.values());
}

function buildPrompt(partNumber: string, description: string | null): string {
  return `You are a harness manufacturing domain expert. Classify the component described below into exactly one of these categories:
WIRE, TERMINAL, CONNECTOR, SEAL, HARDWARE, LABEL, SLEEVING, HOUSING, UNKNOWN.

Rules:
- Only return UNKNOWN if there is truly insufficient data.
- Base the classification on part number semantics and description keywords.
- Respond with pure JSON matching { "category": "CATEGORY", "confidence": number_between_0_and_1 }.
- confidence must be a decimal between 0 and 1, representing your probability estimate.
- Use uppercase category values.

Component:
Part Number: ${partNumber}
Description: ${description ?? 'N/A'}`;
}

async function classifyWithAI(partNumber: string, description: string | null, apiKey: string): Promise<AIClassificationResult | null> {
  const body = {
    model: CLAUDE_MODEL,
    max_tokens: 512,
    temperature: 0,
    system: 'You are a deterministic classification microservice. Output only valid JSON.',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: buildPrompt(partNumber, description)
          }
        ]
      }
    ]
  };

  const response = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => 'Unknown error');
    console.error('[AI CLASSIFICATION] Anthropic error', errText);
    return null;
  }

  const payload = await response.json();
  const content = Array.isArray(payload.content)
    ? payload.content.map((item: any) => item?.text ?? '').join('\n')
    : '';

  const jsonTextMatch = content.match(/\{[\s\S]*\}/);
  const jsonText = jsonTextMatch ? jsonTextMatch[0] : content;

  try {
    const parsed = JSON.parse(jsonText);
    const rawCategory = typeof parsed.category === 'string' ? parsed.category.toUpperCase().trim() : 'UNKNOWN';
    const category = ALLOWED_CATEGORIES.includes(rawCategory) ? rawCategory : 'UNKNOWN';
    const confidence = typeof parsed.confidence === 'number'
      ? Math.max(0, Math.min(1, parsed.confidence))
      : 0;

    return { category, confidence };
  } catch (err) {
    console.error('[AI CLASSIFICATION] Failed to parse AI response', {
      content,
      error: err
    });
    return null;
  }
}

export async function runAIClassificationPass(): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is required to run AI classification');
  }

  const limitEnv = Number(process.env.AI_CLASSIFICATION_BATCH || '0');
  const normalizedLimit = Number.isFinite(limitEnv) ? limitEnv : 0;
  const unknownParts = await fetchUnknownParts(normalizedLimit);

  if (normalizedLimit > 0) {
    console.log(`[AI CLASSIFICATION] Limiting batch to ${normalizedLimit} parts`);
  }

  if (unknownParts.length === 0) {
    console.log('✅ No UNKNOWN components require AI classification.');
    return;
  }

  console.log(`🔍 Processing ${unknownParts.length} UNKNOWN components with AI...`);

  let storedCount = 0;
  let skippedCount = 0;

  for (const part of unknownParts) {
    try {
      const result = await classifyWithAI(part.partNumber, part.description, apiKey);
      if (!result) {
        skippedCount++;
        continue;
      }

      if (result.confidence < 0.7 || result.category === 'UNKNOWN') {
        console.log('[AI CLASSIFICATION SKIPPED]', {
          part: part.partNumber,
          category: result.category,
          confidence: result.confidence.toFixed(2)
        });
        skippedCount++;
        continue;
      }

      await upsertClassificationMapping({
        partNumber: part.partNumber,
        category: result.category,
        confidence: result.confidence,
        description: part.description
      });
      storedCount++;
    } catch (error) {
      console.error('[AI CLASSIFICATION ERROR]', {
        part: part.partNumber,
        error
      });
      skippedCount++;
    }
  }

  console.log('📊 AI Classification Summary', {
    processed: unknownParts.length,
    stored: storedCount,
    skipped: skippedCount
  });
}

runAIClassificationPass()
  .then(() => {
    console.log('✅ AI classification pass complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 AI classification pass failed', error);
    process.exit(1);
  });
