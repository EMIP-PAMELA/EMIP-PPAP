/**
 * Harness Work Instruction Generator — Runtime Validation Service
 * Phase HWI.1 — Schema Validation Layer
 * Phase HWI.2 — validateAndMapErrors() added for AI pipeline
 *
 * All AI extraction output MUST pass validation before entering review workflow.
 */

import { z } from 'zod';
import {
  HarnessInstructionJobSchema,
  type HarnessInstructionJob,
  type EngineeringFlag,
} from '../types/harnessInstruction.schema';
import { mapZodErrorsToFlags } from '../utils/validationMapper';

const LOG_PREFIX = '[HWI VALIDATION ERROR]';

export interface ValidationResult {
  success: true;
  data: HarnessInstructionJob;
}

export interface ValidationFailure {
  success: false;
  error: string;
  issues: z.ZodIssue[];
}

export type ValidationOutcome = ValidationResult | ValidationFailure;

/**
 * Validate raw data against the canonical HarnessInstructionJobSchema.
 *
 * - Throws a descriptive error if the data does not conform.
 * - Returns a typed HarnessInstructionJob if valid.
 * - Rejects unknown fields (strictObject enforcement).
 *
 * @param data - Unknown input (AI extraction output, API payload, etc.)
 * @returns Typed HarnessInstructionJob
 * @throws Error with [HWI VALIDATION ERROR] prefix on failure
 */
export function validateInstruction(data: unknown): HarnessInstructionJob {
  const result = HarnessInstructionJobSchema.safeParse(data);

  if (!result.success) {
    const issues = result.error.issues;
    const summary = issues
      .map((issue) => `  • [${issue.path.join('.')}] ${issue.message}`)
      .join('\n');

    const message = `${LOG_PREFIX} Schema validation failed:\n${summary}`;
    console.error(message);
    throw new Error(message);
  }

  return result.data;
}

/**
 * Safe variant — returns a discriminated union instead of throwing.
 * Useful for API routes that need to return structured error responses.
 *
 * @param data - Unknown input
 * @returns ValidationOutcome (success or failure with issues)
 */
export function safeValidateInstruction(data: unknown): ValidationOutcome {
  const result = HarnessInstructionJobSchema.safeParse(data);

  if (!result.success) {
    const issues = result.error.issues;
    const summary = issues
      .map((issue) => `[${issue.path.join('.')}] ${issue.message}`)
      .join(' | ');

    console.error(`${LOG_PREFIX} ${summary}`);
    return { success: false, error: summary, issues };
  }

  return { success: true, data: result.data };
}

// ---------------------------------------------------------------------------
// HWI.2 additions — validation-aware reconciliation
// ---------------------------------------------------------------------------

export interface FallbackMeta {
  id: string;
  partNumber: string;
  revision: string;
}

/**
 * Build a minimal valid HarnessInstructionJob as a safe fallback.
 * All arrays are empty; engineering_flags will be populated by the caller.
 */
function buildFallbackJob(meta: FallbackMeta): HarnessInstructionJob {
  return {
    id: meta.id,
    status: 'review',
    metadata: {
      part_number: meta.partNumber,
      revision: meta.revision,
      description: null,
      source_document_url: null,
      created_at: new Date().toISOString(),
      approved_at: null,
      generated_pdf_url: null,
    },
    wire_instances: [],
    press_rows: [],
    komax_rows: [],
    pin_map_rows: [],
    assembly_steps: [],
    engineering_flags: [],
    review_questions: [],
  };
}

/**
 * Validate AI output and reconcile errors into EngineeringFlags.
 *
 * - If data validates: return it directly with no extra flags.
 * - If data fails validation: convert ZodIssues → flags, return safe fallback job.
 *
 * The returned job is ALWAYS a valid HarnessInstructionJob.
 * Any schema violations appear as engineering_flags for reviewer action.
 *
 * @param rawData  - Unknown data from AI extraction
 * @param fallback - Metadata used to build fallback job if validation fails
 */
export function validateAndMapErrors(
  rawData: unknown,
  fallback: FallbackMeta
): { job: HarnessInstructionJob; flags: EngineeringFlag[] } {
  const validation = safeValidateInstruction(rawData);

  if (validation.success) {
    console.log('[HWI VALIDATION RESULT] Passed — data conforms to schema');
    return { job: validation.data, flags: [] };
  }

  const flags = mapZodErrorsToFlags(validation.issues);
  console.log(`[HWI VALIDATION RESULT] ${flags.length} issue(s) — using fallback job`);

  const job = buildFallbackJob(fallback);
  job.engineering_flags = flags;

  return { job, flags };
}
