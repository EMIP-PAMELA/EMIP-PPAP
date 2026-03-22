import { WorkflowPhase } from '../constants/workflowPhases';
import { PPAPStatus } from '@/src/types/database.types';

export type ActionPriority = 'normal' | 'warning' | 'urgent';

export interface NextActionResult {
  nextAction: string;
  priority: ActionPriority;
}

/**
 * Determines the next action and priority for a PPAP record
 * based on current workflow phase and status.
 * 
 * No database changes required - all logic is derived from existing fields.
 * 
 * @param workflow_phase - Current workflow phase (accepts string from DB)
 * @param status - Current PPAP status
 * @returns Next action text and priority level
 */
export function getNextAction(
  workflow_phase: string,
  status: PPAPStatus
): NextActionResult {
  // Handle rejected status first (highest priority override)
  if (status === 'CLOSED') {
    return {
      nextAction: 'Fix Issues and Resubmit',
      priority: 'urgent',
    };
  }

  // Map workflow phase to next action
  switch (workflow_phase as WorkflowPhase) {
    case 'INITIATION':
      return {
        nextAction: 'Complete Initiation',
        priority: 'warning',
      };

    case 'DOCUMENTATION':
      return {
        nextAction: 'Submit Documentation',
        priority: 'warning',
      };

    case 'SAMPLE':
      return {
        nextAction: 'Submit Sample Information',
        priority: 'warning',
      };

    case 'REVIEW':
      return {
        nextAction: 'Awaiting Review Decision',
        priority: 'normal',
      };

    case 'COMPLETE':
      return {
        nextAction: 'PPAP Complete',
        priority: 'normal',
      };

    default:
      return {
        nextAction: 'Unknown Phase',
        priority: 'normal',
      };
  }
}

/**
 * Get priority color classes for styling
 */
export function getPriorityColor(priority: ActionPriority): string {
  switch (priority) {
    case 'urgent':
      return 'text-red-700';
    case 'warning':
      return 'text-amber-700';
    case 'normal':
      return 'text-gray-600';
    default:
      return 'text-gray-600';
  }
}

/**
 * Get priority background color for row highlighting
 */
export function getPriorityBackground(priority: ActionPriority): string {
  switch (priority) {
    case 'urgent':
      return 'bg-red-50';
    case 'warning':
      return 'bg-yellow-50';
    case 'normal':
      return '';
    default:
      return '';
  }
}
