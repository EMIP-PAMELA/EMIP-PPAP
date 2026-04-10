/**
 * Harness Work Instruction Generator — Runtime Validation Service
 * Phase HWI.1 — Schema Validation Layer
 *
 * All AI extraction output MUST pass validateInstruction() before
 * being accepted into the review workflow or stored.
 */

import { z } from 'zod';
import {
  HarnessInstructionJobSchema,
  type HarnessInstructionJob,
} from '../types/harnessInstruction.schema';

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
