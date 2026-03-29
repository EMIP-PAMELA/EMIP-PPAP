/**
 * Phase 38: Intelligent Workflow Guidance Layer
 * 
 * Service for providing proactive workflow recommendations based on:
 * - Current workflow state
 * - Validation results
 * - Impact analysis
 * - Document status
 */

import { TemplateId } from '../templates/types';
import { ValidationResult } from '../validation/validateDocument';
import { DocumentMetadata } from '../types/bomTypes';
import { VersionComparison } from '../persistence/versionDiffService';

/**
 * Guidance types for categorization
 */
export type GuidanceType = 'action' | 'warning' | 'insight';

/**
 * Individual guidance item
 */
export interface GuidanceItem {
  type: GuidanceType;
  message: string;
  priority: number; // Higher = more important
  templateId?: TemplateId;
}

/**
 * Complete guidance result
 */
export interface WorkflowGuidance {
  recommendedAction: string | null;
  warnings: GuidanceItem[];
  insights: GuidanceItem[];
}

/**
 * Workflow state for guidance analysis
 */
export interface WorkflowState {
  activeStep: TemplateId | null;
  documents: Record<TemplateId, any>;
  editableDocuments: Record<TemplateId, any>;
  documentMeta: Record<TemplateId, DocumentMetadata>;
  validationResults: Record<TemplateId, ValidationResult>;
  bomData: any;
  hasChanges: boolean;
  isViewingOldVersion: boolean;
  recentComparison?: VersionComparison | null;
}

/**
 * Template workflow order
 */
const WORKFLOW_ORDER: TemplateId[] = [
  'processFlow',
  'pfmea',
  'controlPlan',
  'workInstructions',
  'inspectionPlan'
];

/**
 * Get intelligent workflow guidance based on current state
 */
export function getWorkflowGuidance(state: WorkflowState): WorkflowGuidance {
  const warnings: GuidanceItem[] = [];
  const insights: GuidanceItem[] = [];
  let recommendedAction: string | null = null;

  // 1. Check for BOM data
  if (!state.bomData) {
    recommendedAction = 'Upload a BOM file to begin generating PPAP documents';
    return { recommendedAction, warnings, insights };
  }

  // 2. Analyze workflow progression
  const completedSteps: TemplateId[] = [];
  const incompleteSteps: TemplateId[] = [];
  const invalidSteps: TemplateId[] = [];
  const unapprovedSteps: TemplateId[] = [];

  for (const templateId of WORKFLOW_ORDER) {
    const doc = state.documents[templateId];
    const meta = state.documentMeta[templateId];
    const validation = state.validationResults[templateId];

    if (!doc) {
      incompleteSteps.push(templateId);
    } else {
      completedSteps.push(templateId);

      // Check validation
      if (validation && !validation.isValid) {
        invalidSteps.push(templateId);
        warnings.push({
          type: 'warning',
          message: `${getTemplateDisplayName(templateId)} has ${validation.errors.length} validation error(s)`,
          priority: 90,
          templateId
        });
      }

      // Check approval status
      if (meta && meta.status !== 'approved') {
        unapprovedSteps.push(templateId);
      }
    }
  }

  // 3. Determine recommended action
  if (incompleteSteps.length > 0) {
    const nextStep = incompleteSteps[0];
    recommendedAction = `Generate ${getTemplateDisplayName(nextStep)} to continue workflow`;
  } else if (invalidSteps.length > 0) {
    const firstInvalid = invalidSteps[0];
    recommendedAction = `Fix validation errors in ${getTemplateDisplayName(firstInvalid)}`;
  } else if (state.hasChanges && state.activeStep) {
    recommendedAction = `Create new version to save changes to ${getTemplateDisplayName(state.activeStep)}`;
  } else if (unapprovedSteps.length > 0) {
    const firstUnapproved = unapprovedSteps[0];
    recommendedAction = `Submit ${getTemplateDisplayName(firstUnapproved)} for approval`;
  } else if (completedSteps.length === WORKFLOW_ORDER.length) {
    recommendedAction = 'All documents complete and approved - ready for submission';
  }

  // 4. Add warnings for unsaved changes
  if (state.hasChanges && !state.isViewingOldVersion) {
    warnings.push({
      type: 'warning',
      message: 'You have unsaved changes - create a new version to preserve them',
      priority: 80,
      templateId: state.activeStep || undefined
    });
  }

  // 5. Add insights about workflow progress
  if (completedSteps.length > 0) {
    const progressPercent = Math.round((completedSteps.length / WORKFLOW_ORDER.length) * 100);
    insights.push({
      type: 'insight',
      message: `Workflow ${progressPercent}% complete (${completedSteps.length}/${WORKFLOW_ORDER.length} documents)`,
      priority: 50
    });
  }

  // 6. Add insights from recent version comparison
  if (state.recentComparison) {
    const fieldChanges = Object.values(state.recentComparison.fieldDiffs).filter(d => d.changed).length;
    if (fieldChanges > 0) {
      insights.push({
        type: 'insight',
        message: `Recent comparison detected ${fieldChanges} field change(s) between versions`,
        priority: 60
      });
    }
  }

  // 7. Check for prerequisite issues
  if (completedSteps.includes('pfmea') && !completedSteps.includes('processFlow')) {
    warnings.push({
      type: 'warning',
      message: 'PFMEA typically requires Process Flow as prerequisite',
      priority: 70
    });
  }

  if (completedSteps.includes('controlPlan') && !completedSteps.includes('pfmea')) {
    warnings.push({
      type: 'warning',
      message: 'Control Plan typically requires PFMEA as prerequisite',
      priority: 70
    });
  }

  // 8. Add insights about validation
  const totalErrors = Object.values(state.validationResults)
    .reduce((sum, result) => sum + (result?.errors?.length || 0), 0);
  
  if (totalErrors === 0 && completedSteps.length > 0) {
    insights.push({
      type: 'insight',
      message: 'All generated documents pass validation',
      priority: 40
    });
  }

  // Sort and limit
  warnings.sort((a, b) => b.priority - a.priority);
  insights.sort((a, b) => b.priority - a.priority);

  return {
    recommendedAction,
    warnings: warnings.slice(0, 3), // Top 3
    insights: insights.slice(0, 3)  // Top 3
  };
}

/**
 * Get display name for template
 */
function getTemplateDisplayName(templateId: TemplateId): string {
  const names: Record<TemplateId, string> = {
    processFlow: 'Process Flow',
    pfmea: 'PFMEA',
    controlPlan: 'Control Plan',
    workInstructions: 'Work Instructions',
    inspectionPlan: 'Inspection Plan'
  };
  return names[templateId] || templateId;
}

/**
 * Check if a template has prerequisites met
 */
export function hasPrerequisitesMet(
  templateId: TemplateId,
  completedTemplates: TemplateId[]
): boolean {
  const prerequisites: Record<TemplateId, TemplateId[]> = {
    processFlow: [],
    pfmea: ['processFlow'],
    controlPlan: ['pfmea'],
    workInstructions: ['processFlow'],
    inspectionPlan: ['controlPlan']
  };

  const required = prerequisites[templateId] || [];
  return required.every(prereq => completedTemplates.includes(prereq));
}
