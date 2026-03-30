/**
 * PFMEA Summary Wizard Template
 * Phase W2B - Wizard-specific PPAP template implementation
 *
 * Direct BOM operations → table rows mapping
 * No intermediate mapping layers or transformations
 *
 * This template is separate from the existing PFMEA template
 * which uses the mapping chain (bomToProcessFlow → pfmea).
 */

import { TemplateDefinition, TemplateInput, DocumentDraft } from '../types';

/**
 * Generate PFMEA Summary document directly from BOM operations
 */
function generatePfmeaSummaryWizard(input: TemplateInput): DocumentDraft {
  const { bom } = input;

  console.log('[W2B WIZARD] Generating: pfmea-summary-wizard');
  console.log('[W2B WIZARD] Operations:', bom.operations.length);

  const rows = bom.operations.map((op) => ({
    stepNumber: op.step,
    processFunction: op.description,
    failureMode: '',
    effect: '',
    severity: null,
    occurrence: null,
    detection: null,
    rpn: null
  }));

  console.log('[W2B WIZARD] Rows created:', rows.length);

  const fields = {
    partNumber: bom.masterPartNumber,
    pfmeaRows: rows
  };

  const metadata = {
    generatedAt: new Date().toISOString(),
    bomMasterPartNumber: bom.masterPartNumber,
    templateVersion: '1.0',
    templateType: 'wizard'
  };

  return {
    templateId: 'pfmea-summary-wizard',
    metadata,
    fields
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
