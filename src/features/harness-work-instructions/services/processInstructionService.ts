/**
 * Harness Work Instruction Generator — Process Instruction Service
 * Phase HWI.11 — Deterministic Work Instruction + Machine Setup Generator
 *
 * Responsibilities:
 *   1. Build structured Komax setup entries from wire_instances + komax_rows
 *   2. Build manual press setup entries from press_rows (POST_KOMAX only)
 *   3. Build numbered assembly instruction sequence with station context
 *   4. Build engineering notes from unresolved flags + wire-level gaps
 *   5. Detect tooling references from BOM instruction text
 *
 * Governance:
 *   - No machine settings or tooling values are invented
 *   - Missing required data creates review_required flags, not fabricated values
 *   - Returns a new ProcessInstructionBundle — input job is not mutated
 *   - All content is deterministic and template-driven
 *
 * Log prefixes:
 *   [HWI KOMAX SETUP BUILT]
 *   [HWI PRESS SETUP BUILT]
 *   [HWI ASSEMBLY INSTRUCTIONS BUILT]
 *   [HWI ENGINEERING NOTES BUILT]
 *   [HWI PROCESS INSTRUCTIONS BUILT]
 */

import type {
  HarnessInstructionJob,
  KomaxRow,
  EngineeringFlag,
} from '../types/harnessInstruction.schema';
import type {
  ProcessInstructionBundle,
  KomaxSetupEntry,
  PressSetupEntry,
  AssemblyInstructionStep,
  EngineeringInstructionNote,
  TerminationLocation,
  StationType,
  NoteCategory,
  NoteSeverity,
} from '../types/processInstructions';

// ---------------------------------------------------------------------------
// Tooling extraction helpers (exported for testing)
// ---------------------------------------------------------------------------

const APPLICATOR_RE = /APPLICATOR\s+(?:TE#?\s*)?([A-Z0-9][A-Z0-9\-]{3,})/i;
const HAND_TOOL_RE  = /HAND[\s_-]TOOL\s+(?:TE#?\s*)?([A-Z0-9][A-Z0-9\-]{3,})/i;
const CQ_TOOL_RE    = /CQ#?\s*(\d{4,})/i;

export function extractApplicatorsFromText(text: string): string[] {
  const results: string[] = [];
  const m = text.match(APPLICATOR_RE) ?? text.match(CQ_TOOL_RE);
  if (m) results.push(normalizeToolingRef(m[1]));
  return results;
}

export function extractHandToolsFromText(text: string): string[] {
  const results: string[] = [];
  const m = text.match(HAND_TOOL_RE);
  if (m) results.push(normalizeToolingRef(m[1]));
  return results;
}

export function normalizeToolingRef(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '-');
}

// ---------------------------------------------------------------------------
// Station-type detection from operation code
// ---------------------------------------------------------------------------

function detectStationType(toolRef: string | null): StationType {
  if (!toolRef) return 'ASSEMBLY';
  const uc = toolRef.toUpperCase();
  if (uc.includes('CUTGROUP') || /\bCUT\b|\bKOM\b|\bSTRIP\b/.test(uc)) return 'KOMAX';
  if (uc.includes('CRIMP') || /\bPRESS\b|\bSEAL\b/.test(uc))           return 'PRESS';
  if (uc.includes('LABEL') || uc.includes('MARK'))                       return 'LABEL';
  if (uc.includes('INSPECT') || uc.includes('TEST'))                     return 'INSPECTION';
  return 'ASSEMBLY';
}

// ---------------------------------------------------------------------------
// Termination location from komax_row provenance note + press_row presence
// ---------------------------------------------------------------------------

function detectTerminationLocation(
  wireId:       string,
  kr:           KomaxRow | undefined,
  pressWireIds: Set<string>,
): TerminationLocation {
  const note = kr?.provenance.note ?? '';
  if (/KOMAX_TERMINATED/i.test(note)) return 'KOMAX';
  if (/CUT_ONLY/i.test(note))         return 'PRESS';
  if (pressWireIds.has(wireId))       return 'PRESS';
  return 'UNKNOWN';
}

// ---------------------------------------------------------------------------
// Collect flag messages relevant to a wire_id
// ---------------------------------------------------------------------------

function flagsForWire(wireId: string, flags: EngineeringFlag[]): string[] {
  return flags
    .filter(f => !f.resolved && f.message.includes(wireId))
    .map(f => `[${f.flag_type.toUpperCase()}] ${f.message}`);
}

// ---------------------------------------------------------------------------
// Build applicator lookup: wire_id → first applicator ref from assembly steps
// ---------------------------------------------------------------------------

function buildApplicatorIndex(job: HarnessInstructionJob): Map<string, string> {
  const index = new Map<string, string>();
  for (const step of job.assembly_steps) {
    const apps = extractApplicatorsFromText(step.instruction);
    if (apps.length === 0) continue;
    for (const wireId of step.wire_ids) {
      if (!index.has(wireId)) index.set(wireId, apps[0]);
    }
  }
  return index;
}

// ---------------------------------------------------------------------------
// 1. Komax Setup
// ---------------------------------------------------------------------------

function buildKomaxSetup(job: HarnessInstructionJob): KomaxSetupEntry[] {
  const pressWireIds   = new Set(job.press_rows.map(p => p.wire_id));
  const applicatorIdx  = buildApplicatorIndex(job);
  const entries: KomaxSetupEntry[] = [];

  for (let i = 0; i < job.wire_instances.length; i++) {
    const wire = job.wire_instances[i];

    // Find matching komax_row by wire_id first, then fall back to positional
    const kr =
      job.komax_rows.find(k => k.wire_id === wire.wire_id) ??
      job.komax_rows[i];

    const terminationLocation = detectTerminationLocation(wire.wire_id, kr, pressWireIds);
    const applicator          = applicatorIdx.get(wire.wire_id) ?? null;
    const flags               = flagsForWire(wire.wire_id, job.engineering_flags);

    if (wire.cut_length == null) {
      flags.push('[REVIEW_REQUIRED] Cut length not resolved — engineering drawing required');
    }
    if (wire.strip_end_a == null) {
      flags.push('[INFO] Strip length End A not specified — verify against engineering print');
    }
    if (wire.strip_end_b == null) {
      flags.push('[INFO] Strip length End B not specified — verify against engineering print');
    }

    entries.push({
      komax_id:             kr?.komax_id ?? `K-${wire.wire_id}`,
      wire_id:              wire.wire_id,
      aci_wire_part_number: wire.aci_wire_part_number,
      gauge:                String(wire.gauge),
      color:                wire.color,
      cut_length:           wire.cut_length ?? (kr != null ? kr.cut_length : null),
      cut_length_source:    wire.cut_length_source ?? 'UNKNOWN',
      strip_end_a:          wire.strip_end_a ?? (kr?.strip_a ?? null),
      strip_end_b:          wire.strip_end_b ?? (kr?.strip_b ?? null),
      terminal_a:           wire.end_a.terminal_part_number,
      terminal_b:           wire.end_b.terminal_part_number,
      termination_location: terminationLocation,
      applicator,
      hot_stamp_id:         null,
      notes:                kr?.provenance.note ?? null,
      flags,
      provenance:           wire.provenance,
    });
  }

  console.log('[HWI KOMAX SETUP BUILT]', {
    entries:          entries.length,
    komaxTerminated:  entries.filter(e => e.termination_location === 'KOMAX').length,
    pressTerminated:  entries.filter(e => e.termination_location === 'PRESS').length,
    unknownLocation:  entries.filter(e => e.termination_location === 'UNKNOWN').length,
    withApplicator:   entries.filter(e => e.applicator != null).length,
    unresolved:       entries.filter(e => e.flags.length > 0).length,
  });

  return entries;
}

// ---------------------------------------------------------------------------
// 2. Press Setup
// ---------------------------------------------------------------------------

function buildPressSetup(job: HarnessInstructionJob): PressSetupEntry[] {
  const wireMap = new Map(job.wire_instances.map(w => [w.wire_id, w]));
  const entries: PressSetupEntry[] = [];

  for (const pr of job.press_rows) {
    const wire  = wireMap.get(pr.wire_id);
    const flags: string[] = [];

    if (!pr.applicator_id) {
      flags.push('[REVIEW_REQUIRED] No applicator or hand tool specified — verify against crimp specification');
    }
    if (!wire) {
      flags.push('[WARNING] Wire ID not matched to any wire instance — verify wire-to-terminal assignment');
    }
    if (!wire?.strip_end_a && !wire?.strip_end_b) {
      flags.push('[INFO] Strip length not available — confirm with Komax program');
    }

    // Scan assembly steps for hand tool references linked to this wire
    const stepWithWire = job.assembly_steps.find(s => s.wire_ids.includes(pr.wire_id));
    const handTools    = stepWithWire ? extractHandToolsFromText(stepWithWire.instruction) : [];

    entries.push({
      press_id:             pr.press_id,
      wire_id:              pr.wire_id,
      gauge:                wire ? String(wire.gauge) : '—',
      color:                wire?.color ?? '—',
      terminal_part_number: pr.terminal_part_number,
      applicator_id:        pr.applicator_id,
      hand_tool_ref:        handTools[0] ?? null,
      strip_length:         wire?.strip_end_a ?? null,
      source:               pr.provenance.note ?? 'BOM_DERIVED',
      flags,
      provenance:           pr.provenance,
    });
  }

  console.log('[HWI PRESS SETUP BUILT]', {
    entries:      entries.length,
    withTooling:  entries.filter(e => e.applicator_id != null || e.hand_tool_ref != null).length,
    unresolved:   entries.filter(e => e.flags.length > 0).length,
  });

  return entries;
}

// ---------------------------------------------------------------------------
// 3. Assembly Instruction Sequence
// ---------------------------------------------------------------------------

function buildAssemblyInstructions(job: HarnessInstructionJob): AssemblyInstructionStep[] {
  const steps: AssemblyInstructionStep[] = job.assembly_steps.map(s => {
    const stationType = detectStationType(s.tool_ref);

    // Collect connector IDs referenced via pin_map for each wire in this step
    const connectorIdSet = new Set<string>();
    for (const wireId of s.wire_ids) {
      for (const pm of job.pin_map_rows) {
        if (pm.wire_id === wireId) connectorIdSet.add(pm.connector_id);
      }
    }

    const flags: string[] = [];
    if (!s.instruction || s.instruction.trim().length === 0) {
      flags.push('[WARNING] Assembly step has no instruction text — review BOM operation');
    }

    return {
      step_number:           s.step_number,
      station_type:          stationType,
      instruction_text:      s.instruction,
      related_wire_ids:      s.wire_ids,
      related_connector_ids: [...connectorIdSet],
      flags,
      provenance:            s.provenance,
    };
  });

  console.log('[HWI ASSEMBLY INSTRUCTIONS BUILT]', {
    steps: steps.length,
    byStation: steps.reduce<Record<string, number>>((acc, s) => {
      acc[s.station_type] = (acc[s.station_type] ?? 0) + 1;
      return acc;
    }, {}),
    withConnectors: steps.filter(s => s.related_connector_ids.length > 0).length,
  });

  return steps;
}

// ---------------------------------------------------------------------------
// 4. Engineering Notes
// ---------------------------------------------------------------------------

function buildEngineeringNotes(
  job:          HarnessInstructionJob,
  komaxSetup:   KomaxSetupEntry[],
  pressSetup:   PressSetupEntry[],
): EngineeringInstructionNote[] {
  const notes: EngineeringInstructionNote[] = [];
  let noteIdx = 0;

  function mkNote(
    category:  NoteCategory,
    severity:  NoteSeverity,
    message:   string,
    fieldRef?: string,
  ): EngineeringInstructionNote {
    return {
      note_id:   `EN${String(++noteIdx).padStart(3, '0')}`,
      category,
      severity,
      message,
      field_ref: fieldRef ?? null,
    };
  }

  // ── Global termination summary ─────────────────────────────────────────
  const allKomaxTerminated = komaxSetup.length > 0 &&
    komaxSetup.every(e => e.termination_location === 'KOMAX');
  const hasManualPress = pressSetup.length > 0;

  if (allKomaxTerminated && !hasManualPress) {
    notes.push(mkNote('GENERAL', 'info',
      'All terminations handled in Komax — no manual press operation required'));
  } else if (hasManualPress) {
    notes.push(mkNote('GENERAL', 'warning',
      `Manual press operation required for ${pressSetup.length} terminal(s) — verify applicator setup before production`,
      'press_rows'));
  }

  // ── Strip length notes ─────────────────────────────────────────────────
  const missingStrip = job.wire_instances.filter(
    w => w.strip_end_a == null || w.strip_end_b == null
  );
  if (missingStrip.length > 0) {
    notes.push(mkNote('STRIP', 'review_required',
      `Strip lengths not specified for ${missingStrip.length} wire(s) — extract from engineering print before Komax programming`,
      'wire_instances'));
  }

  // ── Cut length notes ──────────────────────────────────────────────────
  const missingLength = job.wire_instances.filter(w => w.cut_length == null);
  if (missingLength.length > 0) {
    notes.push(mkNote('TOLERANCE', 'review_required',
      `Cut length not resolved for ${missingLength.length} wire(s) — drawing upload required`,
      'wire_instances'));
  }

  // ── Terminal notes ────────────────────────────────────────────────────
  const missingTerminal = job.wire_instances.filter(
    w => w.end_a.terminal_part_number == null && w.end_b.terminal_part_number == null
  );
  if (missingTerminal.length > 0) {
    notes.push(mkNote('TERMINAL', 'review_required',
      `Terminal P/N not resolved for ${missingTerminal.length} wire(s) — verify against crimp specification`));
  }

  // ── Tooling notes ─────────────────────────────────────────────────────
  const missingTooling = pressSetup.filter(p => !p.applicator_id && !p.hand_tool_ref);
  if (missingTooling.length > 0) {
    notes.push(mkNote('TERMINAL', 'review_required',
      `Tooling not specified for ${missingTooling.length} press row(s) — applicator or hand tool reference required`,
      'press_rows'));
  }

  // ── From unresolved engineering flags (review_required only — avoid duplication) ──
  const seen = new Set(notes.map(n => n.message));
  for (const f of job.engineering_flags) {
    if (!f.resolved && f.flag_type === 'review_required' && !seen.has(f.message)) {
      notes.push(mkNote('GENERAL', 'review_required', f.message, f.field_ref ?? undefined));
      seen.add(f.message);
    }
  }

  console.log('[HWI ENGINEERING NOTES BUILT]', {
    notes:            notes.length,
    review_required:  notes.filter(n => n.severity === 'review_required').length,
    warnings:         notes.filter(n => n.severity === 'warning').length,
    info:             notes.filter(n => n.severity === 'info').length,
  });

  return notes;
}

// ---------------------------------------------------------------------------
// Main entry point: buildProcessInstructions(job)
// ---------------------------------------------------------------------------

export function buildProcessInstructions(
  job: HarnessInstructionJob,
): ProcessInstructionBundle {
  const komax_setup           = buildKomaxSetup(job);
  const press_setup           = buildPressSetup(job);
  const assembly_instructions = buildAssemblyInstructions(job);
  const engineering_notes     = buildEngineeringNotes(job, komax_setup, press_setup);

  const all_komax_terminated =
    komax_setup.length > 0 &&
    komax_setup.every(e => e.termination_location === 'KOMAX');
  const has_manual_press = press_setup.length > 0;

  console.log('[HWI PROCESS INSTRUCTIONS BUILT]', {
    komax_setup:           komax_setup.length,
    press_setup:           press_setup.length,
    assembly_instructions: assembly_instructions.length,
    engineering_notes:     engineering_notes.length,
    all_komax_terminated,
    has_manual_press,
    timestamp:             new Date().toISOString(),
  });

  return {
    generated_at:          new Date().toISOString(),
    komax_setup,
    press_setup,
    assembly_instructions,
    engineering_notes,
    all_komax_terminated,
    has_manual_press,
  };
}
