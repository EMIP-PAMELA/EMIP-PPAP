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
  phaseStatus: 'IN_PROGRESS' | 'READY_TO_ADVANCE' | 'COMPLETE';
}

/**
 * Get tasks for a specific workflow phase
 * Returns task checklist with data-driven completion status
 */
export function getPhaseTasks(
  phase: WorkflowPhase,
  phaseData?: Record<string, unknown>
): PhaseTasksResult {
  const data = phaseData || {};
  let tasks: PhaseTask[] = [];

  switch (phase) {
    case 'INITIATION':
      tasks = [
        {
          id: 'initiation_data',
          label: 'Complete PPAP initiation data',
          description: 'Fill in project info, contacts, part details, and drawing data',
          completed: !!(data.project_name && data.quality_rep && data.part_description),
        },
        {
          id: 'drawing_review',
          label: 'Confirm drawing review',
          description: 'Verify drawing is understood and part is defined',
          completed: !!(data.drawing_understood && data.part_defined),
        },
        {
          id: 'capability_check',
          label: 'Confirm capability requirements',
          description: 'Ensure parts are producible and capability can be met',
          completed: !!(data.parts_producible && data.capability_met),
        },
      ];
      break;

    case 'DOCUMENTATION':
      {
        const checkedDocsCount = [
          data.design_record,
          data.dimensional_results,
          data.dfmea,
          data.pfmea,
          data.control_plan,
          data.msa,
        ].filter(Boolean).length;
        
        tasks = [
          {
            id: 'prepare_documents',
            label: 'Prepare required documents',
            description: 'Gather all necessary PPAP documentation',
            completed: checkedDocsCount > 0,
          },
          {
            id: 'markup_drawing',
            label: 'Create markup drawing',
            description: 'Mark up engineering drawing with inspection data',
            completed: !!(data.dimensional_results),
          },
          {
            id: 'dimensional_results',
            label: 'Complete dimensional results',
            description: 'Record dimensional inspection measurements',
            completed: !!(data.dimensional_results),
          },
          {
            id: 'upload_documents',
            label: 'Upload all required documents',
            description: 'Upload Design Record, Control Plan, DFMEA, PFMEA, etc.',
            completed: checkedDocsCount >= 4,
          },
        ];
      }
      break;

    case 'SAMPLE':
      tasks = [
        {
          id: 'prepare_samples',
          label: 'Prepare samples',
          description: 'Manufacture samples per PPAP requirements',
          completed: !!(data.sample_quantity && Number(data.sample_quantity) > 0),
        },
        {
          id: 'sample_inspection',
          label: 'Inspect samples',
          description: 'Perform dimensional and functional inspection',
          completed: !!(data.inspection_complete),
        },
        {
          id: 'ship_samples',
          label: 'Ship samples',
          description: 'Package and ship samples to customer',
          completed: !!(data.shipping_date),
        },
      ];
      break;

    case 'REVIEW':
      tasks = [
        {
          id: 'await_review',
          label: 'Await review decision',
          description: 'Customer is reviewing PPAP submission',
          completed: !!(data.decision),
        },
        {
          id: 'track_status',
          label: 'Track review status',
          description: 'Monitor customer feedback and questions',
          completed: !!(data.decision),
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
  const totalCount = tasks.length;
  
  // Determine phase status
  let phaseStatus: 'IN_PROGRESS' | 'READY_TO_ADVANCE' | 'COMPLETE';
  if (phase === 'COMPLETE') {
    phaseStatus = 'COMPLETE';
  } else if (completedCount === totalCount && totalCount > 0) {
    phaseStatus = 'READY_TO_ADVANCE';
  } else {
    phaseStatus = 'IN_PROGRESS';
  }

  return {
    phase,
    tasks,
    completedCount,
    totalCount,
    phaseStatus,
  };
}
