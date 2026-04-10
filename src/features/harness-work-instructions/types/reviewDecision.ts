/**
 * Harness Work Instruction Generator — Review Workflow Types
 * Phase HWI.1 — Updated to reference validated HarnessInstructionJob type
 */

import type { HarnessInstructionJob } from './harnessInstruction.schema';

export type ReviewAction = 'approve' | 'reject' | 'request_changes';

export interface ReviewDecision {
  jobId: string;
  action: ReviewAction;
  edits: Partial<HarnessInstructionJob> | null;
  reviewerNotes: string | null;
  timestamp: Date;
}

export interface ReviewValidation {
  isValid: boolean;
  errors: ReviewValidationError[];
  warnings: ReviewValidationWarning[];
}

export interface ReviewValidationError {
  field: string;
  message: string;
  severity: 'error';
}

export interface ReviewValidationWarning {
  field: string;
  message: string;
  severity: 'warning';
}

export interface ReviewAuditEntry {
  jobId: string;
  userId: string;
  action: ReviewAction;
  timestamp: Date;
  changes: ReviewChangeSummary | null;
}

export interface ReviewChangeSummary {
  fieldsModified: string[];
  beforeSnapshot: Partial<HarnessInstructionJob>;
  afterSnapshot: Partial<HarnessInstructionJob>;
}
