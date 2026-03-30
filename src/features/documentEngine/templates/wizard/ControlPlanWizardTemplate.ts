/**
 * Control Plan Wizard Template
 * Phase W2B - Wizard-specific PPAP template implementation
 *
 * Direct BOM operations → table rows mapping
 * No intermediate mapping layers or transformations
 *
 * This template is separate from the existing CONTROL_PLAN template
 * which uses the mapping chain (bomToProcessFlow → pfmea → controlPlan).
 */

import { TemplateDefinition, TemplateInput, DocumentDraft } from '../types';

/**
 * Generate Control Plan document directly from BOM operations
 */
function generateControlPlanWizard(input: TemplateInput): DocumentDraft {
  const { bom } = input;

  console.log('[W2B WIZARD] Generating: control-plan-wizard');
  console.log('[W2B WIZARD] Operations:', bom.operations.length);

  const rows = bom.operations.map((op) => ({
    stepNumber: op.step,
    process: op.description,
    machine: op.resourceId || '',
    characteristic: '',
    method: '',
    sampleSize: ''
  }));

  console.log('[W2B WIZARD] Rows created:', rows.length);

  const fields = {
    partNumber: bom.masterPartNumber,
    controlPlanRows: rows
  };

  const metadata = {
    generatedAt: new Date().toISOString(),
    bomMasterPartNumber: bom.masterPartNumber,
    templateVersion: '1.0',
    templateType: 'wizard'
  };

  return {
    templateId: 'control-plan-wizard',
    metadata,
    fields
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
