import { WorkflowPhase } from '../constants/workflowPhases';

export interface PhaseTask {
  id: string;
  label: string;
  description?: string;
  completed: boolean;
}

export interface PhaseTasksResult {
  phase: WorkflowPhase;
  tasks: PhaseTask[];
  completedCount: number;
  totalCount: number;
}

/**
 * Get tasks for a specific workflow phase
 * Returns task checklist to guide user actions
 */
export function getPhaseTasks(
  phase: WorkflowPhase,
  phaseData?: Record<string, unknown>
): PhaseTasksResult {
  let tasks: PhaseTask[] = [];

  switch (phase) {
    case 'INITIATION':
      tasks = [
        {
          id: 'initiation_data',
          label: 'Complete PPAP initiation data',
          description: 'Fill in project info, contacts, part details, and drawing data',
          completed: false,
        },
        {
          id: 'drawing_review',
          label: 'Confirm drawing review',
          description: 'Verify drawing is understood and part is defined',
          completed: false,
        },
        {
          id: 'capability_check',
          label: 'Confirm capability requirements',
          description: 'Ensure parts are producible and capability can be met',
          completed: false,
        },
      ];
      break;

    case 'DOCUMENTATION':
      tasks = [
        {
          id: 'prepare_documents',
          label: 'Prepare required documents',
          description: 'Gather all necessary PPAP documentation',
          completed: false,
        },
        {
          id: 'markup_drawing',
          label: 'Create markup drawing',
          description: 'Mark up engineering drawing with inspection data',
          completed: false,
        },
        {
          id: 'dimensional_results',
          label: 'Complete dimensional results',
          description: 'Record dimensional inspection measurements',
          completed: false,
        },
        {
          id: 'upload_documents',
          label: 'Upload all required documents',
          description: 'Upload Design Record, Control Plan, DFMEA, PFMEA, etc.',
          completed: false,
        },
      ];
      break;

    case 'SAMPLE':
      tasks = [
        {
          id: 'prepare_samples',
          label: 'Prepare samples',
          description: 'Manufacture samples per PPAP requirements',
          completed: false,
        },
        {
          id: 'sample_inspection',
          label: 'Inspect samples',
          description: 'Perform dimensional and functional inspection',
          completed: false,
        },
        {
          id: 'ship_samples',
          label: 'Ship samples',
          description: 'Package and ship samples to customer',
          completed: false,
        },
      ];
      break;

    case 'REVIEW':
      tasks = [
        {
          id: 'await_review',
          label: 'Await review decision',
          description: 'Customer is reviewing PPAP submission',
          completed: false,
        },
        {
          id: 'track_status',
          label: 'Track review status',
          description: 'Monitor customer feedback and questions',
          completed: false,
        },
      ];
      break;

    case 'COMPLETE':
      tasks = [
        {
          id: 'archive_ppap',
          label: 'Archive PPAP records',
          description: 'Store all PPAP documentation for future reference',
          completed: true,
        },
      ];
      break;

    default:
      tasks = [];
  }

  const completedCount = tasks.filter(t => t.completed).length;

  return {
    phase,
    tasks,
    completedCount,
    totalCount: tasks.length,
  };
}
