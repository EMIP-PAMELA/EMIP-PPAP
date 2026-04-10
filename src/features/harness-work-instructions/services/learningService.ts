/**
 * HWI Learning Service — Persistent Human Resolution Memory
 * Phase HWI.12 — Human Resolution Learning Engine
 *
 * Captures human-approved wire match, endpoint, and tooling decisions after
 * each job approval and persists them in hwi_resolution_memory for reuse
 * in future jobs. All learning is additive and traceable.
 *
 * Governance:
 *   - Learned values NEVER override manual edits (only heuristic guesses)
 *   - Learning is silent — no UI prompts in this phase
 *   - DB failures are non-fatal — system continues normally
 *   - category = 'UNKNOWN' / null values are never stored
 *
 * Log prefixes:
 *   [HWI LEARNING STORED]   — batch upsert completed after approval
 *   [HWI LEARNING APPLIED]  — hint used during fusion / endpoint resolution
 *   [HWI LEARNING SKIPPED]  — hint found but not applicable
 */

import { supabase } from '@/src/lib/supabaseClient';
import type { HarnessInstructionJob } from '../types/harnessInstruction.schema';
import type { CanonicalDrawingDraft } from '../types/drawingDraft';
import {
  buildWireMatchSignature,
  buildEndpointSignature,
  buildToolingSignature,
  EMPTY_FUSION_HINTS,
  createEmptyFusionHints,
  trackLearningEvent,
} from './learningSignatures';
import type {
  FusionHints,
  WireMatchDecision,
  EndpointDecision,
  ToolingDecision,
  LearnedDecision,
  LearningUsageEvent,
  ContextType,
} from './learningSignatures';

// Re-export everything from signatures so callers only need one import
export * from './learningSignatures';

// ---------------------------------------------------------------------------
// DB row shape
// ---------------------------------------------------------------------------

interface ResolutionRow {
  context_type:      ContextType;
  context_signature: string;
  decision:          Record<string, unknown>;
  confidence:        number;
  source:            string;
  created_at:        string;
  usage_count?:      number;
  conflict_count?:   number;
}

// ---------------------------------------------------------------------------
// storeResolution — upserts a single learned decision
// ---------------------------------------------------------------------------

export async function storeResolution(
  contextType: ContextType,
  signature:   string,
  decision:    Record<string, unknown>,
  confidence   = 1.0,
): Promise<void> {
  const { error } = await supabase
    .from('hwi_resolution_memory')
    .upsert(
      {
        context_type:      contextType,
        context_signature: signature,
        decision,
        confidence,
        source:            'MANUAL_APPROVED',
        created_at:        new Date().toISOString(),
        usage_count:       0,
        conflict_count:    0,
      },
      { onConflict: 'context_type,context_signature' },
    );

  if (error) {
    console.error('[HWI LEARNING] storeResolution failed', { contextType, signature, error: error.message });
    return;
  }

  console.log('[HWI LEARNING STORED]', { context_type: contextType, signature });
}

// ---------------------------------------------------------------------------
// lookupResolution — retrieves a single decision (used for targeted lookup)
// ---------------------------------------------------------------------------

export async function lookupResolution(
  contextType: ContextType,
  signature:   string,
): Promise<LearnedDecision<Record<string, unknown>> | null> {
  const { data, error } = await supabase
    .from('hwi_resolution_memory')
    .select('decision, confidence, usage_count, conflict_count')
    .eq('context_type', contextType)
    .eq('context_signature', signature)
    .order('confidence', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return {
    decision:       data.decision as Record<string, unknown>,
    confidence:     data.confidence ?? 1,
    usage_count:    data.usage_count ?? 0,
    conflict_count: data.conflict_count ?? 0,
  };
}

// ---------------------------------------------------------------------------
// loadFusionHints — batch prefetch all relevant hints for a fusion pass
//
// Called BEFORE fuseDrawingWithBOM + resolveEndpoints in page.tsx.
// Returns EMPTY_FUSION_HINTS on any failure — never throws.
// ---------------------------------------------------------------------------

export async function loadFusionHints(
  drawing: CanonicalDrawingDraft,
  job:     HarnessInstructionJob,
): Promise<FusionHints> {
  try {
    const sigSet = new Set<string>();

    for (const row of drawing.wire_rows) {
      sigSet.add(buildWireMatchSignature(row.gauge, row.color, row.length));
      sigSet.add(buildEndpointSignature(row.wire_label ?? row.wire_id, row.connector_a));
    }
    for (const pr of job.press_rows) {
      sigSet.add(buildToolingSignature(pr.terminal_part_number, 'PRESS'));
    }

    const allSigs = [...sigSet];
    if (allSigs.length === 0) return createEmptyFusionHints();

    const { data, error } = await supabase
      .from('hwi_resolution_memory')
      .select('context_type, context_signature, decision, confidence, usage_count, conflict_count')
      .in('context_signature', allSigs);

    if (error || !data || data.length === 0) {
      if (error) console.warn('[HWI LEARNING] loadFusionHints failed (non-fatal):', error.message);
      return createEmptyFusionHints();
    }

    const wireMatchOverrides = new Map<string, LearnedDecision<WireMatchDecision>>();
    const endpointOverrides  = new Map<string, LearnedDecision<EndpointDecision>>();
    const toolingOverrides   = new Map<string, LearnedDecision<ToolingDecision>>();

    for (const row of data) {
      const learnedRow: LearnedDecision<any> = {
        decision:       row.decision as Record<string, unknown>,
        confidence:     row.confidence ?? 1,
        usage_count:    row.usage_count ?? 0,
        conflict_count: row.conflict_count ?? 0,
      };
      if (learnedRow.conflict_count > learnedRow.usage_count) {
        console.warn('[HWI LEARNING SKIPPED]', {
          reason:       'unstable_pattern',
          context_type: row.context_type,
          signature:    row.context_signature,
          usage:        learnedRow.usage_count,
          conflicts:    learnedRow.conflict_count,
        });
        continue;
      }
      switch (row.context_type) {
        case 'WIRE_MATCH':
          wireMatchOverrides.set(
            row.context_signature,
            learnedRow as LearnedDecision<WireMatchDecision>,
          );
          break;
        case 'ENDPOINT':
          endpointOverrides.set(
            row.context_signature,
            learnedRow as LearnedDecision<EndpointDecision>,
          );
          break;
        case 'TOOLING':
          toolingOverrides.set(
            row.context_signature,
            learnedRow as LearnedDecision<ToolingDecision>,
          );
          break;
      }
    }

    console.log('[HWI LEARNING APPLIED]', {
      hints_loaded:  data.length,
      wire_matches:  wireMatchOverrides.size,
      endpoints:     endpointOverrides.size,
      tooling:       toolingOverrides.size,
    });

    return { wireMatchOverrides, endpointOverrides, toolingOverrides, usageEvents: [] };

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[HWI LEARNING] loadFusionHints exception (non-fatal):', msg);
    return createEmptyFusionHints();
  }
}

// ---------------------------------------------------------------------------
// learnFromApprovedJob — harvests decisions and upserts to DB
//
// Called fire-and-forget from the approve-job API route.
// Never throws — any error is logged and swallowed.
// ---------------------------------------------------------------------------

export async function learnFromApprovedJob(job: HarnessInstructionJob): Promise<void> {
  const now  = new Date().toISOString();
  const rows: ResolutionRow[] = [];

  // ── Wire matches ──────────────────────────────────────────────────────────
  for (const wire of job.wire_instances) {
    const gauge  = wire.gauge  != null ? String(wire.gauge)  : null;
    const color  = wire.color != null && wire.color !== 'UNKNOWN' ? wire.color  : null;
    const aci    = wire.aci_wire_part_number;

    if (!gauge || !color || !aci || aci === 'UNKNOWN') continue;

    const sig = buildWireMatchSignature(gauge, color, wire.cut_length);
    if (sig.includes('UNK')) continue;  // Skip if any component is unknown

    rows.push({
      context_type:      'WIRE_MATCH',
      context_signature: sig,
      decision:          { gauge, color, aci_wire_part_number: aci },
      confidence:        1.0,
      source:            'MANUAL_APPROVED',
      created_at:        now,
      usage_count:       0,
      conflict_count:    0,
    });
  }

  // ── Endpoints (end_a and end_b separately) ────────────────────────────────
  for (const wire of job.wire_instances) {
    const { end_a, end_b } = wire;

    if (end_a.connector_id && end_a.cavity) {
      const sig = buildEndpointSignature(wire.wire_id, end_a.connector_id);
      rows.push({
        context_type:      'ENDPOINT',
        context_signature: sig,
        decision: {
          connector_id:         end_a.connector_id,
          cavity:               end_a.cavity,
          terminal_part_number: end_a.terminal_part_number,
        },
        confidence:  1.0,
        source:      'MANUAL_APPROVED',
        created_at:  now,
        usage_count: 0,
        conflict_count: 0,
      });
    }

    if (end_b.connector_id && end_b.cavity) {
      const sig = buildEndpointSignature(`${wire.wire_id}_B`, end_b.connector_id);
      rows.push({
        context_type:      'ENDPOINT',
        context_signature: sig,
        decision: {
          connector_id:         end_b.connector_id,
          cavity:               end_b.cavity,
          terminal_part_number: end_b.terminal_part_number,
        },
        confidence:  1.0,
        source:      'MANUAL_APPROVED',
        created_at:  now,
        usage_count: 0,
        conflict_count: 0,
      });
    }
  }

  // ── Tooling (from press_rows with known applicators) ──────────────────────
  for (const pr of job.press_rows) {
    if (!pr.applicator_id || !pr.terminal_part_number) continue;

    const sig = buildToolingSignature(pr.terminal_part_number, 'PRESS');
    rows.push({
      context_type:      'TOOLING',
      context_signature: sig,
      decision: { applicator_id: pr.applicator_id, hand_tool_ref: null },
      confidence:  1.0,
      source:      'MANUAL_APPROVED',
      created_at:  now,
      usage_count: 0,
      conflict_count: 0,
    });
  }

  if (rows.length === 0) {
    console.log('[HWI LEARNING SKIPPED]', {
      reason:     'no_learnable_data',
      job_id:     job.id,
      part_number: job.metadata.part_number,
    });
    return;
  }

  // Deduplicate by (context_type, context_signature) — keep last occurrence
  const deduped = [
    ...new Map(
      rows.map(r => [`${r.context_type}::${r.context_signature}`, r])
    ).values(),
  ];

  const { error } = await supabase
    .from('hwi_resolution_memory')
    .upsert(deduped, { onConflict: 'context_type,context_signature' });

  if (error) {
    console.error('[HWI LEARNING] Batch upsert failed (non-fatal)', {
      error:    error.message,
      rows:     deduped.length,
      job_id:   job.id,
    });
    return;
  }

  console.log('[HWI LEARNING STORED]', {
    job_id:       job.id,
    part_number:  job.metadata.part_number,
    total:        deduped.length,
    wire_matches: deduped.filter(r => r.context_type === 'WIRE_MATCH').length,
    endpoints:    deduped.filter(r => r.context_type === 'ENDPOINT').length,
    tooling:      deduped.filter(r => r.context_type === 'TOOLING').length,
  });
}

// ---------------------------------------------------------------------------
// persistLearningUsageEvents — flushes tracked usage/conflict deltas to Supabase
// ---------------------------------------------------------------------------

interface UsageMutation {
  context_type:   ContextType;
  signature:      string;
  usage_delta:    number;
  conflict_delta: number;
  last_used_at?:  string;
}

function getMapForContext(
  hints: FusionHints,
  context: ContextType,
): Map<string, LearnedDecision<any>> {
  switch (context) {
    case 'WIRE_MATCH':
      return hints.wireMatchOverrides as Map<string, LearnedDecision<any>>;
    case 'ENDPOINT':
      return hints.endpointOverrides as Map<string, LearnedDecision<any>>;
    case 'TOOLING':
      return hints.toolingOverrides as Map<string, LearnedDecision<any>>;
    case 'TERMINAL':
    default:
      return new Map();
  }
}

export async function persistLearningUsageEvents(hints?: FusionHints): Promise<void> {
  if (!hints || hints.usageEvents.length === 0) return;

  const grouped = new Map<string, UsageMutation>();
  const now     = new Date().toISOString();

  for (const event of hints.usageEvents) {
    const key = `${event.context_type}::${event.signature}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        context_type:   event.context_type,
        signature:      event.signature,
        usage_delta:    0,
        conflict_delta: 0,
      });
    }
    const mutation = grouped.get(key)!;
    if (event.outcome === 'USED') {
      mutation.usage_delta += 1;
      mutation.last_used_at = now;
    } else if (event.outcome === 'CONFLICT' || event.outcome === 'OVERRIDDEN') {
      mutation.conflict_delta += 1;
    }
  }

  for (const mutation of grouped.values()) {
    const sourceMap = getMapForContext(hints, mutation.context_type);
    const learned   = sourceMap.get(mutation.signature);
    const currentUsage    = learned?.usage_count ?? 0;
    const currentConflict = learned?.conflict_count ?? 0;

    const nextUsage    = currentUsage + mutation.usage_delta;
    const nextConflict = currentConflict + mutation.conflict_delta;

    const payload: Record<string, unknown> = {};
    if (mutation.usage_delta > 0) {
      payload.usage_count = nextUsage;
      payload.last_used_at = mutation.last_used_at ?? now;
    }
    if (mutation.conflict_delta > 0) {
      payload.conflict_count = nextConflict;
    }

    if (Object.keys(payload).length === 0) {
      continue;
    }

    const { error } = await supabase
      .from('hwi_resolution_memory')
      .update(payload)
      .eq('context_type', mutation.context_type)
      .eq('context_signature', mutation.signature);

    if (error) {
      console.warn('[HWI LEARNING] persistLearningUsageEvents failed', {
        context_type: mutation.context_type,
        signature:    mutation.signature,
        error:        error.message,
      });
      continue;
    }

    if (mutation.usage_delta > 0) {
      console.log('[HWI LEARNING USED]', {
        context_type: mutation.context_type,
        signature:    mutation.signature,
        usage_count:  nextUsage,
      });
      if (learned) learned.usage_count = nextUsage;
    }
    if (mutation.conflict_delta > 0) {
      console.warn('[HWI LEARNING CONFLICT]', {
        context_type: mutation.context_type,
        signature:    mutation.signature,
        conflict_count: nextConflict,
      });
      if (learned) learned.conflict_count = nextConflict;
    }
  }

  hints.usageEvents = [];
}
