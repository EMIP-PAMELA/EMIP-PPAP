/**
 * Process Flow Wizard Template
 * Phase W2B - Wizard-specific PPAP template implementation
 *
 * Direct BOM operations → table rows mapping
 * No intermediate mapping layers or transformations
 *
 * This template is separate from the existing PROCESS_FLOW template
 * which uses the mapping chain (bomToProcessFlow).
 */

import { TemplateDefinition, TemplateInput, DocumentDraft } from '../types';

/**
 * Generate Process Flow document directly from BOM operations
 */
function generateProcessFlowWizard(input: TemplateInput): DocumentDraft {
  const { bom } = input;

  console.log('[W2B WIZARD] Generating: process-flow-wizard');
  console.log('[W2B WIZARD] Operations:', bom.operations.length);

  const rows = bom.operations.map((op) => ({
    stepNumber: op.step,
    operation: op.description,
    machine: op.resourceId || '',
    notes: ''
  }));

  console.log('[W2B WIZARD] Rows created:', rows.length);

  const fields = {
    partNumber: bom.masterPartNumber,
    processSteps: rows
  };

  const metadata = {
    generatedAt: new Date().toISOString(),
    bomMasterPartNumber: bom.masterPartNumber,
    templateVersion: '1.0',
    templateType: 'wizard'
  };

  return {
    templateId: 'process-flow-wizard',
    metadata,
    fields
  };
}

/**
 * Process Flow Wizard Template Definition
 */
export const PROCESS_FLOW_WIZARD_TEMPLATE: TemplateDefinition = {
  id: 'process-flow-wizard',
  name: 'Process Flow (Wizard)',
  description: 'Simplified process flow for Document Wizard - direct BOM operations mapping',
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
      key: 'processSteps',
      label: 'Process Steps',
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
          key: 'operation',
          label: 'Operation',
          type: 'text',
          required: true,
          editable: true
        },
        {
          key: 'machine',
          label: 'Machine/Resource',
          type: 'text',
          required: false,
          editable: true
        },
        {
          key: 'notes',
          label: 'Notes',
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
        id: 'process_steps',
        title: 'Process Flow',
        fields: ['processSteps']
      }
    ]
  },
  generate: generateProcessFlowWizard
};
