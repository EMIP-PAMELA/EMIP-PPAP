/**
 * Workflow Phase Constants
 * 
 * Defines the canonical workflow phases for PPAP records.
 * These values must match the database CHECK constraint on ppap_records.workflow_phase.
 */

export const WORKFLOW_PHASES = [
  'INITIATION',
  'DOCUMENTATION',
  'SAMPLE',
  'REVIEW',
  'COMPLETE',
] as const;

export type WorkflowPhase = typeof WORKFLOW_PHASES[number];

export const WORKFLOW_PHASE_LABELS: Record<WorkflowPhase, string> = {
  INITIATION: 'Initiation',
  DOCUMENTATION: 'Documentation',
  SAMPLE: 'Sample',
  REVIEW: 'Review',
  COMPLETE: 'Complete',
};

/**
 * Get human-readable label for a workflow phase
 */
export function getPhaseLabel(phase: WorkflowPhase): string {
  return WORKFLOW_PHASE_LABELS[phase] || 'Unknown Phase';
}

/**
 * Validate if a string is a valid workflow phase
 */
export function isValidWorkflowPhase(value: unknown): value is WorkflowPhase {
  return typeof value === 'string' && WORKFLOW_PHASES.includes(value as WorkflowPhase);
}
