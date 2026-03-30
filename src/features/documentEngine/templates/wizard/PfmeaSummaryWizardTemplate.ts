/**
 * PFMEA Summary Wizard Template
 * Phase W2B - Wizard-specific PPAP template implementation
 * Phase W2C - Smart Autofill Layer
 *
 * Direct BOM operations → table rows mapping
 * Enhanced with deterministic rule-based field suggestions
 *
 * This template is separate from the existing PFMEA template
 * which uses the mapping chain (bomToProcessFlow → pfmea).
 */

import { TemplateDefinition, TemplateInput, DocumentDraft, FieldMetadata } from '../types';
import { getOperationInsights, getPfmeaDefaults } from '../../wizard/wizardAutofillRules';

/**
 * Generate PFMEA Summary document directly from BOM operations
 */
function generatePfmeaSummaryWizard(input: TemplateInput): DocumentDraft {
  const { bom } = input;

  console.log('[W2B WIZARD] Generating: pfmea-summary-wizard');
  console.log('[W2B WIZARD] Operations:', bom.operations.length);

  const rows = bom.operations.map((op, index) => {
    const insights = getOperationInsights(op.description);
    const pfmeaDefaults = getPfmeaDefaults(insights.category);

    console.log(`[W2C AUTOFILL] Operation: ${op.description}`);
    console.log(`[W2C AUTOFILL] FailureMode: ${insights.failureMode.value}`);
    console.log(`[W2C AUTOFILL] Effect: ${insights.effect.value}`);
    console.log(`[W2C AUTOFILL] Severity: ${insights.severity.value}`);
    console.log(`[W2D REASON] Field: failureMode`);
    console.log(`[W2D REASON] Reason: ${insights.failureMode.reason}`);
    console.log(`[W2D REASON] Field: effect`);
    console.log(`[W2D REASON] Reason: ${insights.effect.reason}`);
    console.log(`[W2D REASON] Field: severity`);
    console.log(`[W2D REASON] Reason: ${insights.severity.reason}`);

    return {
      stepNumber: op.step,
      processFunction: op.description,
      failureMode: insights.failureMode.value,
      effect: insights.effect.value,
      severity: insights.severity.value,
      occurrence: pfmeaDefaults.occurrence,
      detection: pfmeaDefaults.detection,
      rpn: null, // Calculated by UI layer
      // V2.6X: Row-level metadata stored in _meta property
      _meta: {
        stepNumber: { certainty: 'system', source: 'bom', changeTrackingMode: 'log-on-change' },
        processFunction: { certainty: 'system', source: 'bom', changeTrackingMode: 'log-on-change' },
        failureMode: { certainty: 'suggested', source: 'rule', changeTrackingMode: 'normal-edit', autofillReason: insights.failureMode.reason },
        effect: { certainty: 'suggested', source: 'rule', changeTrackingMode: 'normal-edit', autofillReason: insights.effect.reason },
        severity: { certainty: 'suggested', source: 'rule', changeTrackingMode: 'normal-edit', autofillReason: insights.severity.reason },
        occurrence: { certainty: 'suggested', source: 'rule', changeTrackingMode: 'normal-edit' },
        detection: { certainty: 'suggested', source: 'rule', changeTrackingMode: 'normal-edit' },
        rpn: { certainty: 'system', source: 'bom', changeTrackingMode: 'log-on-change' }
      }
    };
  });

  console.log('[W2B WIZARD] Rows created:', rows.length);

  const fields = {
    partNumber: bom.masterPartNumber,
    pfmeaRows: rows
  };

  // V2.6X: Field certainty metadata
  const fieldMetadata: Record<string, FieldMetadata> = {
    partNumber: {
      certainty: 'system',
      source: 'bom',
      originalValue: bom.masterPartNumber,
      changeTrackingMode: 'log-on-change'
    }
    // V2.6X Row field classifications:
    // - stepNumber, processFunction: system (from BOM, track changes)
    // - failureMode, effect, severity, occurrence, detection: suggested (rule-based, editable)
    // - rpn: system (calculated from S×O×D)
    // Row-level metadata embedded in rows themselves via _meta property
  };

  const metadata = {
    generatedAt: new Date().toISOString(),
    bomMasterPartNumber: bom.masterPartNumber,
    templateVersion: '1.0',
    templateType: 'wizard',
    autofillTransparency: {
      enabled: true,
      version: 'W2D',
      note: 'Each row includes autofill reasoning for failureMode, effect, severity, occurrence, and detection fields'
    }
  };

  return {
    templateId: 'pfmea-summary-wizard',
    metadata,
    fields,
    fieldMetadata,
    fieldChanges: []
  };
}

/**
 * PFMEA Summary Wizard Template Definition
 */
export const PFMEA_SUMMARY_WIZARD_TEMPLATE: TemplateDefinition = {
  id: 'pfmea-summary-wizard',
  name: 'PFMEA Summary (Wizard)',
  description: 'Simplified PFMEA for Document Wizard - direct BOM operations mapping',
  requiredInputs: [],
  fieldDefinitions: [
    {
      key: 'partNumber',
      label: 'Part Number',
      type: 'text',
      required: true,
      editable: false
    },
    {
      key: 'pfmeaRows',
      label: 'PFMEA Analysis',
      type: 'table',
      required: true,
      editable: true,
      rowFields: [
        {
          key: 'stepNumber',
          label: 'Step Number',
          type: 'text',
          required: true,
          editable: false
        },
        {
          key: 'processFunction',
          label: 'Process Function',
          type: 'text',
          required: true,
          editable: true
        },
        {
          key: 'failureMode',
          label: 'Failure Mode',
          type: 'text',
          required: false,
          editable: true
        },
        {
          key: 'effect',
          label: 'Effect',
          type: 'text',
          required: false,
          editable: true
        },
        {
          key: 'severity',
          label: 'Severity (1-10)',
          type: 'number',
          required: false,
          editable: true,
          validation: { min: 1, max: 10 }
        },
        {
          key: 'occurrence',
          label: 'Occurrence (1-10)',
          type: 'number',
          required: false,
          editable: true,
          validation: { min: 1, max: 10 }
        },
        {
          key: 'detection',
          label: 'Detection (1-10)',
          type: 'number',
          required: false,
          editable: true,
          validation: { min: 1, max: 10 }
        },
        {
          key: 'rpn',
          label: 'RPN',
          type: 'number',
          required: false,
          editable: false,
          derivedProduct: ['severity', 'occurrence', 'detection']
        }
      ]
    }
  ],
  layout: {
    sections: [
      {
        id: 'header',
        title: 'Part Information',
        fields: ['partNumber']
      },
      {
        id: 'pfmea',
        title: 'PFMEA Summary',
        fields: ['pfmeaRows']
      }
    ]
  },
  generate: generatePfmeaSummaryWizard
};
