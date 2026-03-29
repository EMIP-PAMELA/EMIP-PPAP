/**
 * Phase 38: Intelligent Workflow Guidance Layer
 * Phase 39: Guidance Intelligence Refinement
 * Phase 40: Adaptive Guidance Weighting
 * Phase 41: Risk Prediction Layer
 * 
 * Service for providing proactive workflow recommendations based on:
 * - Current workflow state
 * - Validation results
 * - Impact analysis
 * - Document status
 * 
 * Phase 39 enhancements:
 * - Relevance scoring system
 * - Context-aware filtering
 * - Sticky priority for critical warnings
 * - Reduced noise (top 2 instead of top 3)
 * 
 * Phase 40 enhancements:
 * - Workflow phase detection (initial, in_progress, validation, approval, complete)
 * - Adaptive weighting of priority vs relevance based on workflow stage
 * - Early stages: exploratory (favor relevance)
 * - Late stages: strict (favor priority)
 * 
 * Phase 41 enhancements:
 * - Deterministic risk prediction (no AI/ML)
 * - Proactive issue detection
 * - Risk-based warnings (high/medium/low severity)
 * - Advisory only (non-blocking)
 */

import { TemplateId } from '../templates/types';
import { ValidationResult } from '../validation/types';
import { DocumentMetadata } from '../persistence/sessionService';
import { VersionComparison } from '../persistence/versionDiffService';
import { analyzeRisk, RiskSeverity } from './riskAnalysisService';
import { MappingMetadata } from '../templates/templateMappingService';

/**
 * Guidance types for categorization
 */
export type GuidanceType = 'action' | 'warning' | 'insight';

/**
 * Phase 40: Workflow phases for adaptive weighting
 */
export type WorkflowPhase = 'initial' | 'in_progress' | 'validation' | 'approval' | 'complete';

/**
 * Phase 40: Guidance weights configuration
 */
export interface GuidanceWeights {
  priorityWeight: number;    // Weight for priority score (0-1)
  relevanceWeight: number;   // Weight for relevance score (0-1)
}

/**
 * Individual guidance item
 * Phase 39: Added relevance scoring and critical flag
 * Phase 41: Added risk severity
 */
export interface GuidanceItem {
  type: GuidanceType;
  message: string;
  priority: number; // Higher = more important
  relevanceScore: number; // Phase 39: Contextual relevance (0-100)
  isCritical?: boolean; // Phase 39: Sticky priority - always show
  riskSeverity?: RiskSeverity; // Phase 41: Risk level for predictive warnings
  templateId?: TemplateId;
}

/**
 * Complete guidance result
 * Phase 40: Added workflow phase info
 */
export interface WorkflowGuidance {
  recommendedAction: string | null;
  warnings: GuidanceItem[];
  insights: GuidanceItem[];
  workflowPhase?: WorkflowPhase; // Phase 40: Current workflow phase
  phaseLabel?: string; // Phase 40: Human-readable phase description
}

/**
 * Workflow state for guidance analysis
 * Phase 41: Added mapping metadata for risk analysis
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
  mappingMetadata?: Record<TemplateId, MappingMetadata>; // Phase 41: For risk analysis
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
 * Phase 40: Detect current workflow phase based on state
 */
function detectWorkflowPhase(
  completedCount: number,
  totalCount: number,
  hasValidationErrors: boolean,
  hasUnapprovedDocs: boolean
): WorkflowPhase {
  // No documents generated yet
  if (completedCount === 0) {
    return 'initial';
  }
  
  // All documents complete and approved
  if (completedCount === totalCount && !hasValidationErrors && !hasUnapprovedDocs) {
    return 'complete';
  }
  
  // Documents exist but have validation errors
  if (hasValidationErrors) {
    return 'validation';
  }
  
  // Documents valid but awaiting approval
  if (completedCount === totalCount && hasUnapprovedDocs) {
    return 'approval';
  }
  
  // Some documents generated, work in progress
  return 'in_progress';
}

/**
 * Phase 40: Get adaptive guidance weights based on workflow phase
 */
function getGuidanceWeights(phase: WorkflowPhase): GuidanceWeights {
  switch (phase) {
    case 'initial':
      // Early exploration - favor relevance (what's contextually important now)
      return { priorityWeight: 0.4, relevanceWeight: 0.6 };
    
    case 'in_progress':
      // Balanced approach during active development
      return { priorityWeight: 0.5, relevanceWeight: 0.5 };
    
    case 'validation':
      // Strict focus on critical issues - favor priority (fix errors first)
      return { priorityWeight: 0.7, relevanceWeight: 0.3 };
    
    case 'approval':
      // Emphasis on completion and approval - favor priority
      return { priorityWeight: 0.8, relevanceWeight: 0.2 };
    
    case 'complete':
      // Maintenance mode - balanced with slight priority bias
      return { priorityWeight: 0.6, relevanceWeight: 0.4 };
    
    default:
      return { priorityWeight: 0.6, relevanceWeight: 0.4 };
  }
}

/**
 * Phase 40: Get human-readable phase label
 */
function getPhaseLabel(phase: WorkflowPhase): string {
  switch (phase) {
    case 'initial':
      return 'Guidance Mode: Exploration';
    case 'in_progress':
      return 'Guidance Mode: Development';
    case 'validation':
      return 'Guidance Mode: Validation Focus';
    case 'approval':
      return 'Guidance Mode: Approval Focus';
    case 'complete':
      return 'Guidance Mode: Complete';
    default:
      return 'Guidance Mode: Active';
  }
}

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
  
  // Phase 39: Track active document context for relevance scoring
  const activeTemplateId = state.activeStep;
  const isActiveDocumentApproved = activeTemplateId && state.documentMeta[activeTemplateId]?.status === 'approved';

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
        const isActiveDoc = templateId === activeTemplateId;
        const relevance = isActiveDoc ? 100 : 60; // Phase 39: Active doc = highly relevant
        warnings.push({
          type: 'warning',
          message: `${getTemplateDisplayName(templateId)} has ${validation.errors.length} validation error(s)`,
          priority: 90,
          relevanceScore: relevance,
          isCritical: true, // Phase 39: Validation errors are always critical
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
  if (state.hasChanges && !state.isViewingOldVersion && !isActiveDocumentApproved) {
    // Phase 39: Suppress if active document is approved (edit-locked)
    warnings.push({
      type: 'warning',
      message: 'You have unsaved changes - create a new version to preserve them',
      priority: 80,
      relevanceScore: 90, // Phase 39: Highly relevant to active editing
      isCritical: false,
      templateId: state.activeStep || undefined
    });
  }

  // 5. Add insights about workflow progress
  if (completedSteps.length > 0) {
    const progressPercent = Math.round((completedSteps.length / WORKFLOW_ORDER.length) * 100);
    const relevance = progressPercent < 100 ? 70 : 50; // Phase 39: More relevant if incomplete
    insights.push({
      type: 'insight',
      message: `Workflow ${progressPercent}% complete (${completedSteps.length}/${WORKFLOW_ORDER.length} documents)`,
      priority: 50,
      relevanceScore: relevance
    });
  }

  // 6. Add insights from recent version comparison
  if (state.recentComparison) {
    const fieldChanges = Object.values(state.recentComparison.fieldDiffs).filter(d => d.changed).length;
    if (fieldChanges > 0) {
      insights.push({
        type: 'insight',
        message: `Recent comparison detected ${fieldChanges} field change(s) between versions`,
        priority: 60,
        relevanceScore: 80 // Phase 39: Recent user action = high relevance
      });
    }
  }

  // 7. Check for prerequisite issues
  if (completedSteps.includes('pfmea') && !completedSteps.includes('processFlow')) {
    const isRelevant = activeTemplateId === 'pfmea' || activeTemplateId === 'processFlow';
    warnings.push({
      type: 'warning',
      message: 'PFMEA typically requires Process Flow as prerequisite',
      priority: 70,
      relevanceScore: isRelevant ? 85 : 40, // Phase 39: Context-aware relevance
      isCritical: true // Phase 39: Missing prerequisites are critical
    });
  }

  if (completedSteps.includes('controlPlan') && !completedSteps.includes('pfmea')) {
    const isRelevant = activeTemplateId === 'controlPlan' || activeTemplateId === 'pfmea';
    warnings.push({
      type: 'warning',
      message: 'Control Plan typically requires PFMEA as prerequisite',
      priority: 70,
      relevanceScore: isRelevant ? 85 : 40, // Phase 39: Context-aware relevance
      isCritical: true // Phase 39: Missing prerequisites are critical
    });
  }

  // 8. Add insights about validation
  const totalErrors = Object.values(state.validationResults)
    .reduce((sum, result) => sum + (result?.errors?.length || 0), 0);
  
  if (totalErrors === 0 && completedSteps.length > 0) {
    insights.push({
      type: 'insight',
      message: 'All generated documents pass validation',
      priority: 40,
      relevanceScore: 55 // Phase 39: Moderate relevance
    });
  }

  // Phase 41: Analyze risks and add predictive warnings
  const riskAnalysis = analyzeRisk({
    documents: state.documents,
    validationResults: state.validationResults,
    documentMeta: state.documentMeta,
    mappingMetadata: state.mappingMetadata
  });

  for (const risk of riskAnalysis.risks) {
    // Convert risk severity to priority and relevance
    let priority = 70;
    let relevance = 75;
    let isCritical = false;

    if (risk.severity === 'high') {
      priority = 95; // Very high priority
      relevance = 95; // Always relevant
      isCritical = true; // High risks always show
    } else if (risk.severity === 'medium') {
      priority = 75;
      relevance = 70;
      isCritical = false;
    } else {
      priority = 50;
      relevance = 60;
      isCritical = false;
    }

    warnings.push({
      type: 'warning',
      message: risk.message,
      priority,
      relevanceScore: relevance,
      isCritical,
      riskSeverity: risk.severity, // Phase 41: Mark as risk-based warning
      templateId: risk.templateId
    });
  }

  // Phase 40: Detect workflow phase for adaptive weighting
  const workflowPhase = detectWorkflowPhase(
    completedSteps.length,
    WORKFLOW_ORDER.length,
    invalidSteps.length > 0,
    unapprovedSteps.length > 0
  );
  const weights = getGuidanceWeights(workflowPhase);
  const phaseLabel = getPhaseLabel(workflowPhase);
  
  // Phase 39: Enhanced filtering with relevance scoring and sticky priority
  
  // Separate critical warnings (always show)
  const criticalWarnings = warnings.filter(w => w.isCritical);
  const nonCriticalWarnings = warnings.filter(w => !w.isCritical);
  
  // Phase 40: Adaptive sorting with dynamic weights
  const sortByRelevance = (a: GuidanceItem, b: GuidanceItem) => {
    const scoreA = a.priority * weights.priorityWeight + a.relevanceScore * weights.relevanceWeight;
    const scoreB = b.priority * weights.priorityWeight + b.relevanceScore * weights.relevanceWeight;
    return scoreB - scoreA;
  };
  
  criticalWarnings.sort(sortByRelevance);
  nonCriticalWarnings.sort(sortByRelevance);
  insights.sort(sortByRelevance);
  
  // Phase 39: Filter low-relevance items (threshold: 50)
  const relevantNonCriticalWarnings = nonCriticalWarnings.filter(w => w.relevanceScore >= 50);
  const relevantInsights = insights.filter(i => i.relevanceScore >= 50);
  
  // Phase 39: Combine critical (always show) with top non-critical, limit to 2 total
  const finalWarnings = [
    ...criticalWarnings.slice(0, 2), // Max 2 critical
    ...relevantNonCriticalWarnings.slice(0, Math.max(0, 2 - criticalWarnings.length))
  ].slice(0, 2); // Hard limit of 2
  
  return {
    recommendedAction,
    warnings: finalWarnings, // Phase 39: Top 2 (down from 3)
    insights: relevantInsights.slice(0, 2), // Phase 39: Top 2 (down from 3)
    workflowPhase, // Phase 40: Current phase
    phaseLabel // Phase 40: Human-readable phase label
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
