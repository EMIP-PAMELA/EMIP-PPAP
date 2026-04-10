/**
 * Harness Work Instruction Generator — Validation Error Mapper
 * Phase HWI.2 — ZodIssue → EngineeringFlag conversion
 *
 * Converts Zod schema validation failures into structured EngineeringFlags
 * so that invalid AI output becomes reviewable data rather than a hard crash.
 */

import { z } from 'zod';
import type { EngineeringFlag } from '../types/harnessInstruction.schema';

/**
 * Convert an array of ZodIssues into EngineeringFlags.
 *
 * Each flag gets:
 *   - flag_id:   VALIDATION-001, VALIDATION-002, ...
 *   - flag_type: 'review_required'
 *   - field_ref: dot-path from issue.path (e.g. "wire_instances.0.gauge")
 *   - message:   descriptive error text
 *   - resolved:  false (always — reviewer must clear)
 */
export function mapZodErrorsToFlags(issues: z.ZodIssue[]): EngineeringFlag[] {
  return issues.map((issue, index) => {
    const field_ref =
      issue.path.length > 0
        ? issue.path.map(String).join('.')
        : null;

    const message = field_ref
      ? `Validation error at ${field_ref}: ${issue.message}`
      : `Validation error: ${issue.message}`;

    console.warn('[HWI FLAG GENERATED]', {
      flag_id: `VALIDATION-${String(index + 1).padStart(3, '0')}`,
      field_ref,
      message,
    });

    return {
      flag_id: `VALIDATION-${String(index + 1).padStart(3, '0')}`,
      flag_type: 'review_required' as const,
      field_ref,
      message,
      resolved: false,
    };
  });
}

/**
 * Build a single ad-hoc EngineeringFlag (for AI-level errors, parse failures, etc.)
 */
export function buildFlag(
  code: string,
  message: string,
  options?: { field_ref?: string; flag_type?: EngineeringFlag['flag_type'] }
): EngineeringFlag {
  const flag: EngineeringFlag = {
    flag_id: code,
    flag_type: options?.flag_type ?? 'error',
    field_ref: options?.field_ref ?? null,
    message,
    resolved: false,
  };

  console.warn('[HWI FLAG GENERATED]', { flag_id: flag.flag_id, message });
  return flag;
}
