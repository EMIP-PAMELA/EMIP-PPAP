/**
 * Pattern Learning Service
 * Phase HWI.6 — Deterministic Pattern Learning Engine
 *
 * Learns prefix patterns from approved HWI job part numbers and stores them
 * in component_classification_patterns so future BOM ingestion resolves via
 * PATTERN before reaching AI.
 *
 * Resolution order (unchanged):  MAP → PATTERN → AI/CANONICAL → UNKNOWN
 *
 * Governance:
 *  - classifyComponent is NOT called here
 *  - AI pipeline is NOT modified
 *  - All learning is ADDITIVE: no existing pattern is overwritten
 *  - category = UNKNOWN is never stored as a learned pattern
 *
 * Pre-requisite: run migration 002_add_pattern_source_column.sql in Supabase
 *
 * Log prefixes used:
 *   [PATTERN LEARNED MATCH]   — new pattern inserted successfully
 *   [PATTERN LEARNING]        — batch/status diagnostics
 */

import { supabase } from '@/src/lib/supabaseClient';
import { invalidatePatternCache } from '@/src/core/services/patternLookup';
import type { HarnessInstructionJob } from '@/src/features/harness-work-instructions/types/harnessInstruction.schema';

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface PartCategory {
  partNumber: string;
  category: string;
}

type LearnAction = 'inserted' | 'skipped_exists' | 'skipped_invalid' | 'error';

interface LearnResult {
  pattern: string;
  category: string;
  action: LearnAction;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Prefix extraction
//
// Strategy: split on "-", take first 2 segments as the generalizing prefix.
// Example: "1-1123722-3" → "1-1123722"
//          "HA-12345-A"  → "HA-12345"
// ---------------------------------------------------------------------------

function extractPrefix(normalized: string): string | null {
  const segments = normalized.split('-');
  if (segments.length < 2) return null;
  return segments.slice(0, 2).join('-');
}

// ---------------------------------------------------------------------------
// Pattern validation
// ---------------------------------------------------------------------------

function isValidPattern(prefix: string): boolean {
  if (prefix.length < 5)         return false; // too short to be useful
  if (/^\d+$/.test(prefix))      return false; // purely numeric — not a stable identifier
  if (!prefix.includes('-'))     return false; // must contain a hyphen (sanity check)
  return true;
}

// ---------------------------------------------------------------------------
// learnPatternFromPart
//
// Core learning primitive: derives a prefix pattern from a single
// (partNumber, category) pair and inserts it if new and valid.
// ---------------------------------------------------------------------------

export async function learnPatternFromPart(
  partNumber: string,
  category: string
): Promise<LearnResult> {
  if (!partNumber || !category) {
    return { pattern: '', category: category ?? '', action: 'skipped_invalid', reason: 'Empty input' };
  }
  if (category === 'UNKNOWN') {
    return { pattern: '', category, action: 'skipped_invalid', reason: 'Will not learn UNKNOWN category' };
  }

  const normalized = partNumber.trim().toUpperCase();
  const prefix     = extractPrefix(normalized);

  if (!prefix || !isValidPattern(prefix)) {
    return {
      pattern:  prefix ?? '',
      category,
      action:   'skipped_invalid',
      reason:   `Prefix "${prefix}" failed validation`,
    };
  }

  // Do not overwrite an existing pattern for this prefix
  const { data: existing, error: checkError } = await supabase
    .from('component_classification_patterns')
    .select('pattern, category')
    .eq('pattern', prefix)
    .eq('match_type', 'prefix')
    .maybeSingle();

  if (checkError) {
    console.error('[PATTERN LEARNING] Existence check failed', { prefix, error: checkError.message });
    return { pattern: prefix, category, action: 'error', reason: checkError.message };
  }

  if (existing) {
    return { pattern: prefix, category: existing.category, action: 'skipped_exists' };
  }

  // Insert new learned pattern
  const { error: insertError } = await supabase
    .from('component_classification_patterns')
    .insert({
      pattern:    prefix,
      match_type: 'prefix',
      category,
      confidence: 0.95,
      source:     'LEARNED',
    });

  if (insertError) {
    console.error('[PATTERN LEARNING] Insert failed', {
      prefix,
      category,
      error:   insertError.message,
      code:    insertError.code,
      details: insertError.details,
    });
    return { pattern: prefix, category, action: 'error', reason: insertError.message };
  }

  // Invalidate in-process cache so next lookup picks up the new pattern
  invalidatePatternCache();

  console.log('[PATTERN LEARNED MATCH]', {
    partNumber: normalized,
    matchedPattern: prefix,
    category,
    source: 'LEARNED',
  });

  return { pattern: prefix, category, action: 'inserted' };
}

// ---------------------------------------------------------------------------
// extractPartCategories
//
// Harvests all (partNumber, category) pairs from an approved HWI job.
// Deduplicates by (UPPER(partNumber), category).
// ---------------------------------------------------------------------------

export function extractPartCategories(job: HarnessInstructionJob): PartCategory[] {
  const seen   = new Set<string>();
  const result: PartCategory[] = [];

  function add(partNumber: string | null | undefined, category: string): void {
    if (!partNumber) return;
    const key = `${partNumber.trim().toUpperCase()}::${category}`;
    if (seen.has(key)) return;
    seen.add(key);
    result.push({ partNumber: partNumber.trim().toUpperCase(), category });
  }

  for (const wire of job.wire_instances) {
    add(wire.aci_wire_part_number,        'WIRE');
    add(wire.end_a.terminal_part_number,  'TERMINAL');
    add(wire.end_b.terminal_part_number,  'TERMINAL');
    add(wire.end_a.seal_part_number,      'SEAL');
    add(wire.end_b.seal_part_number,      'SEAL');
    add(wire.end_a.connector_id,          'CONNECTOR');
    add(wire.end_b.connector_id,          'CONNECTOR');
  }

  for (const row of job.press_rows) {
    add(row.terminal_part_number, 'TERMINAL');
  }

  for (const row of job.pin_map_rows) {
    add(row.terminal_part_number, 'TERMINAL');
  }

  return result;
}

// ---------------------------------------------------------------------------
// learnPatternsFromApprovedJob
//
// Entry point called by the approve-job route.
// Runs all learning in sequence, logs summary, never throws.
// ---------------------------------------------------------------------------

export async function learnPatternsFromApprovedJob(
  job: HarnessInstructionJob
): Promise<void> {
  const parts = extractPartCategories(job);

  console.log('[PATTERN LEARNING] Batch started', {
    partNumber: job.metadata.part_number,
    revision:   job.metadata.revision,
    partCount:  parts.length,
  });

  if (parts.length === 0) return;

  let inserted = 0;
  let skippedExists  = 0;
  let skippedInvalid = 0;
  let errors   = 0;

  for (const { partNumber, category } of parts) {
    const result = await learnPatternFromPart(partNumber, category);
    if      (result.action === 'inserted')         inserted++;
    else if (result.action === 'skipped_exists')   skippedExists++;
    else if (result.action === 'skipped_invalid')  skippedInvalid++;
    else if (result.action === 'error')            errors++;
  }

  console.log('[PATTERN LEARNING] Batch complete', {
    partNumber:    job.metadata.part_number,
    total:         parts.length,
    inserted,
    skippedExists,
    skippedInvalid,
    errors,
  });
}
