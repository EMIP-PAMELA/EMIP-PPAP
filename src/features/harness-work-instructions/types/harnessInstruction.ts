/**
 * Harness Work Instruction Generator — Core Types
 * Phase HWI.1 — Types are now derived from Zod schemas (runtime-validated)
 *
 * Source of truth: harnessInstruction.schema.ts
 * Do NOT define types manually here — use z.infer<> exports from schema file.
 */

export type {
  HarnessInstructionJob,
  JobStatus,
  JobMetadata,
  WireInstance,
  EndTerminal,
  Provenance,
  PressRow,
  KomaxRow,
  PinMapRow,
  AssemblyStep,
  EngineeringFlag,
  ReviewQuestion,
} from './harnessInstruction.schema';

export {
  HarnessInstructionJobSchema,
  JobStatusSchema,
  JobMetadataSchema,
  WireInstanceSchema,
  EndTerminalSchema,
  ProvenanceSchema,
  PressRowSchema,
  KomaxRowSchema,
  PinMapRowSchema,
  AssemblyStepSchema,
  EngineeringFlagSchema,
  ReviewQuestionSchema,
} from './harnessInstruction.schema';
