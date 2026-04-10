/**
 * Harness Work Instruction Generator — Process Instruction Types
 * Phase HWI.11 — Deterministic Work Instruction + Machine Setup Generator
 *
 * Defines structured output types for the process instruction layer:
 *   KomaxSetupEntry      — per-wire Komax machine setup row
 *   PressSetupEntry      — per-terminal manual press setup row
 *   AssemblyInstructionStep — numbered assembly step with station context
 *   EngineeringInstructionNote — structured note (strip / tolerance / tooling / etc.)
 *   ProcessInstructionBundle  — root container for all instruction output
 */

import type { Provenance } from './harnessInstruction.schema';

// ---------------------------------------------------------------------------
// Enums / union types
// ---------------------------------------------------------------------------

export type TerminationLocation = 'KOMAX' | 'PRESS' | 'UNKNOWN';

export type StationType = 'KOMAX' | 'PRESS' | 'ASSEMBLY' | 'LABEL' | 'INSPECTION';

export type NoteCategory =
  | 'STRIP'
  | 'TOLERANCE'
  | 'HOT_STAMP'
  | 'LABELING'
  | 'PACKAGING'
  | 'TERMINAL'
  | 'GENERAL';

export type NoteSeverity = 'info' | 'warning' | 'review_required';

// ---------------------------------------------------------------------------
// KomaxSetupEntry — one row per wire in the Komax program
// ---------------------------------------------------------------------------

export interface KomaxSetupEntry {
  komax_id:             string;
  wire_id:              string;
  aci_wire_part_number: string;
  gauge:                string;
  color:                string;
  cut_length:           number | null;
  cut_length_source:    string;
  strip_end_a:          number | null;
  strip_end_b:          number | null;
  terminal_a:           string | null;  // from end_a.terminal_part_number
  terminal_b:           string | null;  // from end_b.terminal_part_number
  termination_location: TerminationLocation;
  applicator:           string | null;  // extracted from BOM instruction text
  hot_stamp_id:         string | null;
  notes:                string | null;
  flags:                string[];       // formatted flag messages for this wire
  provenance:           Provenance;
}

// ---------------------------------------------------------------------------
// PressSetupEntry — one row per press_row requiring manual press
// ---------------------------------------------------------------------------

export interface PressSetupEntry {
  press_id:             string;
  wire_id:              string;
  gauge:                string;
  color:                string;
  terminal_part_number: string;
  applicator_id:        string | null;
  hand_tool_ref:        string | null;
  strip_length:         number | null;
  source:               string;
  flags:                string[];
  provenance:           Provenance;
}

// ---------------------------------------------------------------------------
// AssemblyInstructionStep — one numbered step in the assembly sequence
// ---------------------------------------------------------------------------

export interface AssemblyInstructionStep {
  step_number:           number;
  station_type:          StationType;
  instruction_text:      string;
  related_wire_ids:      string[];
  related_connector_ids: string[];
  flags:                 string[];
  provenance:            Provenance;
}

// ---------------------------------------------------------------------------
// EngineeringInstructionNote — structured note for engineering review
// ---------------------------------------------------------------------------

export interface EngineeringInstructionNote {
  note_id:   string;
  category:  NoteCategory;
  message:   string;
  field_ref: string | null;
  severity:  NoteSeverity;
}

// ---------------------------------------------------------------------------
// ProcessInstructionBundle — root container
// ---------------------------------------------------------------------------

export interface ProcessInstructionBundle {
  generated_at:          string;
  komax_setup:           KomaxSetupEntry[];
  press_setup:           PressSetupEntry[];
  assembly_instructions: AssemblyInstructionStep[];
  engineering_notes:     EngineeringInstructionNote[];
  all_komax_terminated:  boolean;
  has_manual_press:      boolean;
}
