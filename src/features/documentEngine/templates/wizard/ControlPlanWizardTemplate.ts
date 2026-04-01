/**
 * Control Plan Wizard Template
 * Phase W2B - Wizard-specific PPAP template implementation
 * Phase W2C - Smart Autofill Layer
 *
 * Direct BOM operations → table rows mapping
 * Enhanced with deterministic rule-based field suggestions
 *
 * This template is separate from the existing CONTROL_PLAN template
 * which uses the mapping chain (bomToProcessFlow → pfmea → controlPlan).
 */

import { TemplateDefinition, TemplateInput, DocumentDraft, FieldMetadata } from '../types';
// REMOVED - deterministic autofill rules replaced by Claude
// import { getOperationInsights, getControlPlanDefaults } from '../../wizard/wizardAutofillRules';

// Stub implementations to maintain template functionality
const getOperationInsights = (description: string) => ({
  category: 'general',
  method: { value: 'Visual Inspection', reason: 'Default method' }
});

const getControlPlanDefaults = (category: string) => ({
  sampleSize: '5'
});

/**
 * Generate Control Plan document directly from BOM operations
 */
function generateControlPlanWizard(input: TemplateInput): DocumentDraft {
  const { bom } = input;

  console.log('[W2B WIZARD] Generating: control-plan-wizard');
  console.log('[W2B WIZARD] Operations:', bom.operations.length);

  const rows = bom.operations.map((op, index) => {
    const insights = getOperationInsights(op.description);
    const controlDefaults = getControlPlanDefaults(insights.category);

    console.log(`[W2C AUTOFILL] Operation: ${op.description}`);
    console.log(`[W2C AUTOFILL] Method: ${insights.method.value}`);
    console.log(`[W2C AUTOFILL] Sample Size: ${controlDefaults.sampleSize}`);
    console.log(`[W2D REASON] Field: method`);
    console.log(`[W2D REASON] Reason: ${insights.method.reason}`);

    return {
      stepNumber: op.step,
      process: op.description,
      machine: op.resourceId || '',
      characteristic: '',
      method: insights.method.value,
      sampleSize: controlDefaults.sampleSize,
      // V2.6X: Row-level metadata stored in _meta property
      _meta: {
        stepNumber: { certainty: 'system', source: 'bom', changeTrackingMode: 'log-on-change' },
        process: { certainty: 'system', source: 'bom', changeTrackingMode: 'log-on-change' },
        machine: { certainty: 'system', source: 'bom', changeTrackingMode: 'log-on-change' },
        characteristic: { 
          certainty: 'required', 
          source: 'user', 
          changeTrackingMode: 'required-input',
          // V2.7A: Reference centralized option registry
          optionsKey: 'characteristics'
        },
        method: { 
          certainty: 'suggested', 
          source: 'rule', 
          changeTrackingMode: 'normal-edit', 
          autofillReason: insights.method.reason,
          // V2.7A: Reference centralized option registry
          optionsKey: 'controlMethods'
        },
        sampleSize: { 
          certainty: 'suggested', 
          source: 'rule', 
          changeTrackingMode: 'normal-edit',
          // V2.7A: Reference centralized option registry
          optionsKey: 'sampleSizes'
        }
      }
    };
  });

  console.log('[W2B WIZARD] Rows created:', rows.length);

  const fields = {
    partNumber: bom.masterPartNumber,
    controlPlanRows: rows
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
    // - stepNumber, process, machine: system (from BOM, track changes)
    // - method, sampleSize: suggested (rule-based, editable without deviation logging)
    // - characteristic: required (operator must provide input)
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
      note: 'Each row includes autofill reasoning for method and sampleSize fields'
    }
  };

  return {
    templateId: 'control-plan-wizard',
    metadata,
    fields,
    fieldMetadata,
    fieldChanges: []
  };
}

/**
 * Control Plan Wizard Template Definition
 */
export const CONTROL_PLAN_WIZARD_TEMPLATE: TemplateDefinition = {
  id: 'control-plan-wizard',
  name: 'Control Plan (Wizard)',
  description: 'Simplified control plan for Document Wizard - direct BOM operations mapping',
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
      key: 'controlPlanRows',
      label: 'Control Plan',
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
          key: 'process',
          label: 'Process',
          type: 'text',
          required: true,
          editable: true
        },
        {
          key: 'machine',
          label: 'Machine',
          type: 'text',
          required: false,
          editable: true
        },
        {
          key: 'characteristic',
          label: 'Characteristic',
          type: 'text',
          required: false,
          editable: true
        },
        {
          key: 'method',
          label: 'Method',
          type: 'text',
          required: false,
          editable: true
        },
        {
          key: 'sampleSize',
          label: 'Sample Size',
          type: 'text',
          required: false,
          editable: true
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
        id: 'control_plan',
        title: 'Control Plan',
        fields: ['controlPlanRows']
      }
    ]
  },
  generate: generateControlPlanWizard
};
