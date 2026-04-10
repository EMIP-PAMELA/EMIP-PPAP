/**
 * Harness Work Instruction Generator — Template Data Mapper
 * Phase HWI.4 — PDF Generation
 *
 * Converts the canonical HarnessInstructionJob into flat, display-ready
 * structures that the HTML template can render directly.
 * No rendering logic lives here — only data shaping.
 */

import type { HarnessInstructionJob, WireInstance } from '../types/harnessInstruction.schema';
import type { ProcessInstructionBundle } from '../types/processInstructions';

// ---------------------------------------------------------------------------
// Display types (flat, formatted, renderer-friendly)
// ---------------------------------------------------------------------------

export interface TemplateHeader {
  partNumber: string;
  revision: string;
  description: string;
  status: string;
  generatedAt: string;
}

export interface TemplateKomaxRow {
  komaxId: string;
  wireId: string;
  aciPartNumber: string;
  gauge: string;
  color: string;
  cutLength: string;
  stripA: string;
  stripB: string;
  programNumber: string;
  terminalA: string;           // from process instructions / end_a
  terminalB: string;           // from process instructions / end_b
  applicator: string;          // from process instructions tooling extraction
  terminationLocation: string; // KOMAX | PRESS | UNKNOWN
}

export interface TemplatePressRow {
  pressId: string;
  wireId: string;
  aciPartNumber: string;
  gauge: string;
  color: string;
  terminalPartNumber: string;
  applicatorId: string;
  crimpHeight: string;
}

export interface TemplatePinMapRow {
  pinMapId: string;
  connectorId: string;
  cavity: string;
  wireId: string;
  aciPartNumber: string;
  terminalPartNumber: string;
}

export interface TemplateAssemblyStep {
  stepNumber: number;
  instruction: string;
  wireIds: string;
  toolRef: string;
  notes: string;
}

export interface TemplateFlagItem {
  flagId: string;
  flagType: string;
  fieldRef: string;
  message: string;
}

export interface TemplateEngineeringNote {
  noteId: string;
  category: string;
  severity: string;
  message: string;
}

export interface TemplateData {
  header: TemplateHeader;
  komaxRows: TemplateKomaxRow[];
  pressRows: TemplatePressRow[];
  pinMapRows: TemplatePinMapRow[];
  assemblySteps: TemplateAssemblyStep[];
  engineeringFlags: TemplateFlagItem[];
  engineeringNotes: TemplateEngineeringNote[];
  allKomaxTerminated: boolean;
  hasManualPress: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function wireById(wires: WireInstance[], wireId: string): WireInstance | undefined {
  return wires.find(w => w.wire_id === wireId);
}

function formatLength(val: number | string | null | undefined): string {
  if (val == null || val === '') return '—';
  const n = typeof val === 'string' ? parseFloat(val) : val;
  return isNaN(n) ? String(val) : `${n.toFixed(3)}"`;
}

function formatNull(val: string | number | null | undefined): string {
  if (val == null || val === '') return '—';
  return String(val);
}

// ---------------------------------------------------------------------------
// Main mapper
// ---------------------------------------------------------------------------

export function buildTemplateData(
  job:                 HarnessInstructionJob,
  processInstructions?: ProcessInstructionBundle | null,
): TemplateData {
  const wireMap = new Map<string, WireInstance>(
    job.wire_instances.map(w => [w.wire_id, w])
  );

  const header: TemplateHeader = {
    partNumber: job.metadata.part_number,
    revision: job.metadata.revision,
    description: job.metadata.description ?? '',
    status: job.status,
    generatedAt: new Date().toLocaleString('en-US', {
      month: 'short', day: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }),
  };

  const komaxRows: TemplateKomaxRow[] = job.komax_rows.map(r => {
    const wire  = wireMap.get(r.wire_id);
    const setup = processInstructions?.komax_setup.find(e => e.komax_id === r.komax_id);
    return {
      komaxId:             r.komax_id,
      wireId:              r.wire_id,
      aciPartNumber:       wire?.aci_wire_part_number ?? '—',
      gauge:               wire ? String(wire.gauge) : '—',
      color:               wire?.color ?? '—',
      cutLength:           formatLength(setup?.cut_length ?? r.cut_length),
      stripA:              formatNull(setup?.strip_end_a ?? r.strip_a),
      stripB:              formatNull(setup?.strip_end_b ?? r.strip_b),
      programNumber:       formatNull(r.program_number),
      terminalA:           formatNull(setup?.terminal_a ?? wire?.end_a.terminal_part_number),
      terminalB:           formatNull(setup?.terminal_b ?? wire?.end_b.terminal_part_number),
      applicator:          formatNull(setup?.applicator),
      terminationLocation: setup?.termination_location ?? '—',
    };
  });

  const pressRows: TemplatePressRow[] = job.press_rows.map(r => {
    const wire = wireMap.get(r.wire_id);
    return {
      pressId: r.press_id,
      wireId: r.wire_id,
      aciPartNumber: wire?.aci_wire_part_number ?? '—',
      gauge: wire ? String(wire.gauge) : '—',
      color: wire?.color ?? '—',
      terminalPartNumber: r.terminal_part_number,
      applicatorId: formatNull(r.applicator_id),
      crimpHeight: r.crimp_height != null ? String(r.crimp_height) : '—',
    };
  });

  const pinMapRows: TemplatePinMapRow[] = job.pin_map_rows.map(r => {
    const wire = r.wire_id ? wireMap.get(r.wire_id) : undefined;
    return {
      pinMapId: r.pin_map_id,
      connectorId: r.connector_id,
      cavity: r.cavity,
      wireId: formatNull(r.wire_id),
      aciPartNumber: wire?.aci_wire_part_number ?? '—',
      terminalPartNumber: formatNull(r.terminal_part_number),
    };
  });

  const assemblySteps: TemplateAssemblyStep[] = job.assembly_steps.map(s => ({
    stepNumber: s.step_number,
    instruction: s.instruction,
    wireIds: s.wire_ids.length > 0 ? s.wire_ids.join(', ') : '—',
    toolRef: formatNull(s.tool_ref),
    notes: formatNull(s.notes),
  }));

  const engineeringFlags: TemplateFlagItem[] = job.engineering_flags.map(f => ({
    flagId: f.flag_id,
    flagType: f.flag_type,
    fieldRef: f.field_ref ?? '—',
    message: f.message,
  }));

  const engineeringNotes: TemplateEngineeringNote[] = (processInstructions?.engineering_notes ?? []).map(n => ({
    noteId:   n.note_id,
    category: n.category,
    severity: n.severity,
    message:  n.message,
  }));

  return {
    header,
    komaxRows,
    pressRows,
    pinMapRows,
    assemblySteps,
    engineeringFlags,
    engineeringNotes,
    allKomaxTerminated: processInstructions?.all_komax_terminated ?? false,
    hasManualPress:     processInstructions?.has_manual_press     ?? false,
  };
}
