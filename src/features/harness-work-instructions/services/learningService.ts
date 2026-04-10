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
} from './learningSignatures';

// Re-export everything from signatures so callers only need one import
export * from './learningSignatures';

// ---------------------------------------------------------------------------
// DB row shape
// ---------------------------------------------------------------------------

interface ResolutionRow {
  context_type:      string;
  context_signature: string;
  decision:          Record<string, unknown>;
  confidence:        number;
  source:            string;
  created_at:        string;
}

// ---------------------------------------------------------------------------
// storeResolution — upserts a single learned decision
// ---------------------------------------------------------------------------

export async function storeResolution(
  contextType: string,
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
  contextType: string,
  signature:   string,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from('hwi_resolution_memory')
    .select('decision')
    .eq('context_type', contextType)
    .eq('context_signature', signature)
    .order('confidence', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data.decision as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// loadFusionHints — batch prefetch all relevant hints for a fusion pass
//
// Called BEFORE fuseDrawingWithBOM + resolveEndpoints in page.tsx.
// Returns EMPTY_FUSION_HINTS on any failure — never throws.
// ---------------------------------------------------------------------------

import type { FusionHints, WireMatchDecision, EndpointDecision, ToolingDecision } from './learningSignatures';

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
    if (allSigs.length === 0) return EMPTY_FUSION_HINTS;

    const { data, error } = await supabase
      .from('hwi_resolution_memory')
      .select('context_type, context_signature, decision')
      .in('context_signature', allSigs);

    if (error || !data || data.length === 0) {
      if (error) console.warn('[HWI LEARNING] loadFusionHints failed (non-fatal):', error.message);
      return EMPTY_FUSION_HINTS;
    }

    const wireMatchOverrides = new Map<string, WireMatchDecision>();
    const endpointOverrides  = new Map<string, EndpointDecision>();
    const toolingOverrides   = new Map<string, ToolingDecision>();

    for (const row of data) {
      switch (row.context_type) {
        case 'WIRE_MATCH':
          wireMatchOverrides.set(row.context_signature, row.decision as WireMatchDecision);
          break;
        case 'ENDPOINT':
          endpointOverrides.set(row.context_signature, row.decision as EndpointDecision);
          break;
        case 'TOOLING':
          toolingOverrides.set(row.context_signature, row.decision as ToolingDecision);
          break;
      }
    }

    console.log('[HWI LEARNING APPLIED]', {
      hints_loaded:  data.length,
      wire_matches:  wireMatchOverrides.size,
      endpoints:     endpointOverrides.size,
      tooling:       toolingOverrides.size,
    });

    return { wireMatchOverrides, endpointOverrides, toolingOverrides };

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[HWI LEARNING] loadFusionHints exception (non-fatal):', msg);
    return EMPTY_FUSION_HINTS;
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
