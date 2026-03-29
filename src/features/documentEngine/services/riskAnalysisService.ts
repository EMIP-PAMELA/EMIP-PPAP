/**
 * Phase 41: Risk Prediction Layer
 * 
 * Deterministic risk analysis service for proactive issue detection.
 * All predictions are rule-based and deterministic - no AI/ML inference.
 * 
 * Risk warnings are advisory only and do not block workflow.
 */

import { TemplateId } from '../templates/types';
import { ValidationResult } from '../validation/types';
import { DocumentMetadata } from '../persistence/sessionService';
import { MappingMetadata } from '../templates/templateMappingService';

/**
 * Risk severity levels
 */
export type RiskSeverity = 'low' | 'medium' | 'high';

/**
 * Risk type categories
 */
export type RiskType = 'validation_risk' | 'mapping_risk' | 'process_risk' | 'coverage_risk';

/**
 * Individual risk item
 */
export interface RiskItem {
  message: string;
  severity: RiskSeverity;
  type: RiskType;
  templateId?: TemplateId;
  details?: string; // Optional additional context
}

/**
 * Risk analysis result
 */
export interface RiskAnalysis {
  risks: RiskItem[];
  overallRiskLevel: RiskSeverity;
}

/**
 * State for risk analysis
 */
export interface RiskAnalysisState {
  documents: Record<TemplateId, any>;
  validationResults: Record<TemplateId, ValidationResult>;
  documentMeta: Record<TemplateId, DocumentMetadata>;
  mappingMetadata?: Record<TemplateId, MappingMetadata>;
}

/**
 * Risk thresholds (deterministic)
 */
const RISK_THRESHOLDS = {
  HIGH_RPN: 200,           // RPN above this is high risk
  MEDIUM_RPN: 100,         // RPN above this is medium risk
  MANY_ERRORS: 5,          // Validation errors above this is high risk
  SOME_ERRORS: 2,          // Validation errors above this is medium risk
  MAPPING_FAILURE_RATE: 0.3, // 30% mapping failures is high risk
};

/**
 * Analyze system state for predictive risks
 */
export function analyzeRisk(state: RiskAnalysisState): RiskAnalysis {
  const risks: RiskItem[] = [];

  // 1. Validation risk analysis
  const validationRisks = analyzeValidationRisks(state.validationResults);
  risks.push(...validationRisks);

  // 2. Mapping risk analysis
  if (state.mappingMetadata) {
    const mappingRisks = analyzeMappingRisks(state.mappingMetadata, state.documents);
    risks.push(...mappingRisks);
  }

  // 3. Process risk analysis (RPN-based)
  const processRisks = analyzeProcessRisks(state.documents);
  risks.push(...processRisks);

  // 4. Coverage risk analysis (PFMEA → Control Plan)
  const coverageRisks = analyzeCoverageRisks(state.documents);
  risks.push(...coverageRisks);

  // 5. Approval risk analysis
  const approvalRisks = analyzeApprovalRisks(state.validationResults, state.documentMeta);
  risks.push(...approvalRisks);

  // Determine overall risk level
  const overallRiskLevel = determineOverallRisk(risks);

  return {
    risks,
    overallRiskLevel
  };
}

/**
 * Analyze validation-related risks
 */
function analyzeValidationRisks(validationResults: Record<TemplateId, ValidationResult>): RiskItem[] {
  const risks: RiskItem[] = [];

  for (const [templateId, result] of Object.entries(validationResults)) {
    if (!result || result.isValid) continue;

    const errorCount = result.errors.length;

    if (errorCount >= RISK_THRESHOLDS.MANY_ERRORS) {
      risks.push({
        message: `High validation risk: ${templateId} has ${errorCount} errors and may fail approval`,
        severity: 'high',
        type: 'validation_risk',
        templateId: templateId as TemplateId,
        details: `Document likely to be rejected during approval process`
      });
    } else if (errorCount >= RISK_THRESHOLDS.SOME_ERRORS) {
      risks.push({
        message: `Moderate validation risk: ${templateId} has ${errorCount} errors`,
        severity: 'medium',
        type: 'validation_risk',
        templateId: templateId as TemplateId
      });
    }
  }

  return risks;
}

/**
 * Analyze mapping-related risks
 */
function analyzeMappingRisks(
  mappingMetadata: Record<TemplateId, MappingMetadata>,
  documents: Record<TemplateId, any>
): RiskItem[] {
  const risks: RiskItem[] = [];

  for (const [templateId, metadata] of Object.entries(mappingMetadata)) {
    if (!metadata || !documents[templateId as TemplateId]) continue;

    const failedFields = Object.entries(metadata.fields || {})
      .filter(([_, meta]) => meta.source === 'mapping' && meta.success === false);
    
    const totalMappedFields = Object.entries(metadata.fields || {})
      .filter(([_, meta]) => meta.source === 'mapping');

    if (totalMappedFields.length === 0) continue;

    const failureRate = failedFields.length / totalMappedFields.length;

    if (failureRate >= RISK_THRESHOLDS.MAPPING_FAILURE_RATE) {
      risks.push({
        message: `High mapping risk: ${Math.round(failureRate * 100)}% of automated mappings failed for ${templateId}`,
        severity: 'high',
        type: 'mapping_risk',
        templateId: templateId as TemplateId,
        details: `${failedFields.length} of ${totalMappedFields.length} fields require manual data entry`
      });
    }

    // Check for critical required field failures
    const requiredFieldFailures = failedFields.filter(([fieldPath]) => 
      fieldPath.includes('required') || 
      fieldPath.includes('critical') ||
      fieldPath.includes('partNumber') ||
      fieldPath.includes('processName')
    );

    if (requiredFieldFailures.length > 0) {
      risks.push({
        message: `Mapping risk: Critical required fields missing automated data in ${templateId}`,
        severity: 'medium',
        type: 'mapping_risk',
        templateId: templateId as TemplateId,
        details: `Critical fields require manual entry`
      });
    }
  }

  return risks;
}

/**
 * Analyze process-related risks (RPN thresholds)
 */
function analyzeProcessRisks(documents: Record<TemplateId, any>): RiskItem[] {
  const risks: RiskItem[] = [];

  const pfmea = documents.pfmea;
  if (!pfmea || !pfmea.data?.failureModes) return risks;

  const failureModes = Array.isArray(pfmea.data.failureModes) 
    ? pfmea.data.failureModes 
    : [];

  const highRPNItems = failureModes.filter((fm: any) => {
    const rpn = fm.rpn || (fm.severity * fm.occurrence * fm.detection);
    return rpn > RISK_THRESHOLDS.HIGH_RPN;
  });

  const mediumRPNItems = failureModes.filter((fm: any) => {
    const rpn = fm.rpn || (fm.severity * fm.occurrence * fm.detection);
    return rpn > RISK_THRESHOLDS.MEDIUM_RPN && rpn <= RISK_THRESHOLDS.HIGH_RPN;
  });

  if (highRPNItems.length > 0) {
    const maxRPN = Math.max(...highRPNItems.map((fm: any) => 
      fm.rpn || (fm.severity * fm.occurrence * fm.detection)
    ));
    risks.push({
      message: `High process risk: ${highRPNItems.length} failure mode(s) exceed RPN threshold (max: ${maxRPN})`,
      severity: 'high',
      type: 'process_risk',
      templateId: 'pfmea',
      details: `Risk Priority Number exceeds acceptable limits - immediate action required`
    });
  } else if (mediumRPNItems.length > 0) {
    risks.push({
      message: `Moderate process risk: ${mediumRPNItems.length} failure mode(s) have elevated RPN`,
      severity: 'medium',
      type: 'process_risk',
      templateId: 'pfmea'
    });
  }

  return risks;
}

/**
 * Analyze coverage risks (PFMEA → Control Plan alignment)
 */
function analyzeCoverageRisks(documents: Record<TemplateId, any>): RiskItem[] {
  const risks: RiskItem[] = [];

  const pfmea = documents.pfmea;
  const controlPlan = documents.controlPlan;

  if (!pfmea || !controlPlan) return risks;

  const failureModes = Array.isArray(pfmea.data?.failureModes) 
    ? pfmea.data.failureModes 
    : [];
  
  const controlMethods = Array.isArray(controlPlan.data?.controls)
    ? controlPlan.data.controls
    : [];

  // Check if control plan has fewer controls than high-risk failure modes
  const highRiskFailureModes = failureModes.filter((fm: any) => {
    const rpn = fm.rpn || (fm.severity * fm.occurrence * fm.detection);
    return rpn > RISK_THRESHOLDS.MEDIUM_RPN;
  });

  if (highRiskFailureModes.length > 0 && controlMethods.length < highRiskFailureModes.length) {
    risks.push({
      message: `Coverage risk: Control Plan may not fully address all ${highRiskFailureModes.length} high-risk PFMEA items`,
      severity: 'medium',
      type: 'coverage_risk',
      templateId: 'controlPlan',
      details: `${highRiskFailureModes.length} high-risk failure modes, but only ${controlMethods.length} control methods defined`
    });
  }

  return risks;
}

/**
 * Analyze approval-related risks
 */
function analyzeApprovalRisks(
  validationResults: Record<TemplateId, ValidationResult>,
  documentMeta: Record<TemplateId, DocumentMetadata>
): RiskItem[] {
  const risks: RiskItem[] = [];

  // Check for documents with validation errors that are in review or approved
  for (const [templateId, result] of Object.entries(validationResults)) {
    const meta = documentMeta[templateId as TemplateId];
    
    if (!result || !meta) continue;

    // Risk if document is in review but has validation errors
    if (!result.isValid && meta.status === 'in_review') {
      risks.push({
        message: `Approval risk: ${templateId} is in review but has validation errors`,
        severity: 'high',
        type: 'validation_risk',
        templateId: templateId as TemplateId,
        details: `Document will likely be rejected - fix validation errors first`
      });
    }
  }

  return risks;
}

/**
 * Determine overall risk level from individual risks
 */
function determineOverallRisk(risks: RiskItem[]): RiskSeverity {
  if (risks.length === 0) return 'low';
  
  const hasHigh = risks.some(r => r.severity === 'high');
  const hasMedium = risks.some(r => r.severity === 'medium');

  if (hasHigh) return 'high';
  if (hasMedium) return 'medium';
  return 'low';
}
