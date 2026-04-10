/**
 * Harness Work Instruction Generator — Canonical Zod Schemas
 * Phase HWI.1 — Runtime Validation Layer
 *
 * All schemas use z.strictObject() (Zod v4 equivalent of .strict())
 * which rejects unknown fields at parse time.
 *
 * Source of truth for all HWI types — TypeScript types are inferred
 * from these schemas via z.infer<>.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Provenance — source tracking for all domain entities
// ---------------------------------------------------------------------------

export const ProvenanceSchema = z.strictObject({
  source_type: z.enum(['drawing', 'bom', 'derived', 'manual']),
  source_ref: z.string().optional(),
  confidence: z.number().min(0).max(1),
  note: z.string().optional(),
});

// ---------------------------------------------------------------------------
// End Terminal — wire endpoint connection (one per wire side)
// ---------------------------------------------------------------------------

export const EndTerminalSchema = z.strictObject({
  connector_id: z.string().nullable(),
  cavity: z.string().nullable(),
  terminal_part_number: z.string().nullable(),
  seal_part_number: z.string().nullable(),
});

const CutLengthSourceSchema = z.enum([
  'REQUIRES_DRAWING',
  'DRAWING_SPEC',
  'DRAWING',
  'MANUAL_ENTRY',
  'UNKNOWN',
]);

// ---------------------------------------------------------------------------
// Wire Instance — individual wire run (core data unit)
// ---------------------------------------------------------------------------

export const WireInstanceSchema = z.strictObject({
  wire_id: z.string().min(1),
  aci_wire_part_number: z.string().min(1),
  gauge: z.union([z.string(), z.number()]),
  color: z.string().min(1),
  cut_length: z.number().positive().nullable().optional().default(null),
  cut_length_source: CutLengthSourceSchema.optional().default('UNKNOWN'),
  strip_end_a: z.number().nullable(),
  strip_end_b: z.number().nullable(),
  end_a: EndTerminalSchema,
  end_b: EndTerminalSchema,
  match_confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
  provenance: ProvenanceSchema,
});

// ---------------------------------------------------------------------------
// Press Row — terminal pressing / crimping operation
// ---------------------------------------------------------------------------

export const PressRowSchema = z.strictObject({
  press_id: z.string().min(1),
  wire_id: z.string().min(1),
  terminal_part_number: z.string().min(1),
  applicator_id: z.string().nullable(),
  crimp_height: z.number().nullable(),
  provenance: ProvenanceSchema,
});

// ---------------------------------------------------------------------------
// Komax Row — automated cut-and-strip machine row
// ---------------------------------------------------------------------------

export const KomaxRowSchema = z.strictObject({
  komax_id: z.string().min(1),
  wire_id: z.string().min(1),
  cut_length: z.number().positive(),
  strip_a: z.number().nullable(),
  strip_b: z.number().nullable(),
  program_number: z.string().nullable(),
  provenance: ProvenanceSchema,
});

// ---------------------------------------------------------------------------
// Pin Map Row — connector cavity to wire/terminal assignment
// ---------------------------------------------------------------------------

export const PinMapRowSchema = z.strictObject({
  pin_map_id: z.string().min(1),
  connector_id: z.string().min(1),
  cavity: z.string().min(1),
  wire_id: z.string().nullable(),
  terminal_part_number: z.string().nullable(),
  provenance: ProvenanceSchema,
});

// ---------------------------------------------------------------------------
// Assembly Step — sequential build instruction
// ---------------------------------------------------------------------------

export const AssemblyStepSchema = z.strictObject({
  step_number: z.number().int().positive(),
  instruction: z.string().min(1),
  wire_ids: z.array(z.string()),
  tool_ref: z.string().nullable(),
  notes: z.string().nullable(),
  provenance: ProvenanceSchema,
});

// ---------------------------------------------------------------------------
// Engineering Flag — validation warning / error / review flag
// ---------------------------------------------------------------------------

export const EngineeringFlagSchema = z.strictObject({
  flag_id: z.string().min(1),
  flag_type: z.enum(['warning', 'error', 'info', 'review_required']),
  field_ref: z.string().nullable(),
  message: z.string().min(1),
  resolved: z.boolean(),
});

// ---------------------------------------------------------------------------
// Review Question — open question for human reviewer
// ---------------------------------------------------------------------------

export const ReviewQuestionSchema = z.strictObject({
  id: z.string().min(1),
  prompt: z.string().min(1),
  answer: z.string().nullable(),
  resolved: z.boolean(),
});

// ---------------------------------------------------------------------------
// Job Metadata — job-level identification and lifecycle timestamps
// ---------------------------------------------------------------------------

export const JobMetadataSchema = z.strictObject({
  part_number: z.string().min(1),
  revision: z.string().min(1),
  description: z.string().nullable(),
  source_document_url: z.string().nullable(),
  created_at: z.string().datetime(),
  approved_at: z.string().datetime().nullable(),
  generated_pdf_url: z.string().nullable(),
});

// ---------------------------------------------------------------------------
// Job Status — valid lifecycle states
// ---------------------------------------------------------------------------

export const JobStatusSchema = z.enum([
  'draft',
  'extracting',
  'review',
  'approved',
  'generated',
]);

// ---------------------------------------------------------------------------
// HarnessInstructionJob — root schema (all sub-schemas composed here)
// ---------------------------------------------------------------------------

export const HarnessInstructionJobSchema = z.strictObject({
  id: z.string().min(1),
  status: JobStatusSchema,
  metadata: JobMetadataSchema,
  wire_instances: z.array(WireInstanceSchema),
  press_rows: z.array(PressRowSchema),
  komax_rows: z.array(KomaxRowSchema),
  pin_map_rows: z.array(PinMapRowSchema),
  assembly_steps: z.array(AssemblyStepSchema),
  engineering_flags: z.array(EngineeringFlagSchema),
  review_questions: z.array(ReviewQuestionSchema),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript types — derived from schemas (single source of truth)
// ---------------------------------------------------------------------------

export type Provenance = z.infer<typeof ProvenanceSchema>;
export type EndTerminal = z.infer<typeof EndTerminalSchema>;
export type WireInstance = z.infer<typeof WireInstanceSchema>;
export type PressRow = z.infer<typeof PressRowSchema>;
export type KomaxRow = z.infer<typeof KomaxRowSchema>;
export type PinMapRow = z.infer<typeof PinMapRowSchema>;
export type AssemblyStep = z.infer<typeof AssemblyStepSchema>;
export type EngineeringFlag = z.infer<typeof EngineeringFlagSchema>;
export type ReviewQuestion = z.infer<typeof ReviewQuestionSchema>;
export type JobMetadata = z.infer<typeof JobMetadataSchema>;
export type JobStatus = z.infer<typeof JobStatusSchema>;
export type HarnessInstructionJob = z.infer<typeof HarnessInstructionJobSchema>;
