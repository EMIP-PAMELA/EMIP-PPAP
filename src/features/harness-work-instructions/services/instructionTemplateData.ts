/**
 * Harness Work Instruction Generator — Template Data Mapper
 * Phase HWI.4 — PDF Generation
 *
 * Converts the canonical HarnessInstructionJob into flat, display-ready
 * structures that the HTML template can render directly.
 * No rendering logic lives here — only data shaping.
 */

import type { HarnessInstructionJob, WireInstance } from '../types/harnessInstruction.schema';

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

export interface TemplateData {
  header: TemplateHeader;
  komaxRows: TemplateKomaxRow[];
  pressRows: TemplatePressRow[];
  pinMapRows: TemplatePinMapRow[];
  assemblySteps: TemplateAssemblyStep[];
  engineeringFlags: TemplateFlagItem[];
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

export function buildTemplateData(job: HarnessInstructionJob): TemplateData {
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
    const wire = wireMap.get(r.wire_id);
    return {
      komaxId: r.komax_id,
      wireId: r.wire_id,
      aciPartNumber: wire?.aci_wire_part_number ?? '—',
      gauge: wire ? String(wire.gauge) : '—',
      color: wire?.color ?? '—',
      cutLength: formatLength(r.cut_length),
      stripA: formatNull(r.strip_a),
      stripB: formatNull(r.strip_b),
      programNumber: formatNull(r.program_number),
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

  return { header, komaxRows, pressRows, pinMapRows, assemblySteps, engineeringFlags };
}
