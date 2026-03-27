/**
 * PFMEA Template - Document Engine
 *
 * Generates a Process FMEA document by chaining:
 *   NormalizedBOM → ProcessFlowModel → PFMEAModel → DocumentDraft
 *
 * Structural fields (stepNumber, operation, output) are pre-populated from BOM.
 * Risk fields (failureMode, effect, cause, severity, occurrence, detection) are
 * initialized to null and completed by the user in the document editor.
 * RPN is computed at the UI layer only — not stored here.
 *
 * Architecture layer: Template Implementation
 */

import { TemplateDefinition, TemplateInput, DocumentDraft } from './types';
import { mapBOMToProcessFlow } from '../mapping/bomToProcessFlow';
import { mapProcessFlowToPFMEA } from '../mapping/processFlowToPFMEA';

/**
 * Generate a PFMEA DocumentDraft from NormalizedBOM
 */
function generatePFMEA(input: TemplateInput): DocumentDraft {
  const { bom } = input;

  const processFlow = mapBOMToProcessFlow(bom);
  const pfmea = mapProcessFlowToPFMEA(processFlow);

  const fields = {
    partNumber: pfmea.partNumber,
    rows: pfmea.rows
  };

  const metadata = {
    generatedAt: new Date().toISOString(),
    bomMasterPartNumber: bom.masterPartNumber,
    templateVersion: '1.0'
  };

  return {
    templateId: 'PFMEA',
    metadata,
    fields
  };
}

/**
 * PFMEA Template Definition
 */
export const PFMEA_TEMPLATE: TemplateDefinition = {
  id: 'PFMEA',
  name: 'Process FMEA',
  description: 'Process Failure Mode and Effects Analysis derived from Process Flow',
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
      key: 'rows',
      label: 'PFMEA Rows',
      type: 'table',
      required: true,
      editable: true,
      rowFields: [
        {
          key: 'stepNumber',
          label: 'Process Step',
          type: 'text',
          required: true,
          editable: false
        },
        {
          key: 'operation',
          label: 'Operation Description',
          type: 'text',
          required: true,
          editable: false
        },
        {
          key: 'output',
          label: 'Product / Process Characteristic',
          type: 'text',
          required: true,
          editable: false
        },
        {
          key: 'failureMode',
          label: 'Potential Failure Mode',
          type: 'text',
          required: true,
          editable: true
        },
        {
          key: 'effect',
          label: 'Potential Effect(s) of Failure',
          type: 'text',
          required: false,
          editable: true
        },
        {
          key: 'cause',
          label: 'Potential Cause(s)',
          type: 'text',
          required: false,
          editable: true
        },
        {
          key: 'severity',
          label: 'Severity',
          type: 'number',
          required: false,
          editable: true,
          validation: { min: 1, max: 10 }
        },
        {
          key: 'occurrence',
          label: 'Occurrence',
          type: 'number',
          required: false,
          editable: true,
          validation: { min: 1, max: 10 }
        },
        {
          key: 'detection',
          label: 'Detection',
          type: 'number',
          required: false,
          editable: true,
          validation: { min: 1, max: 10 }
        },
        {
          key: 'rpn',
          label: 'Risk Priority Number',
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
        id: 'part_info',
        title: 'Part Information',
        fields: ['partNumber']
      },
      {
        id: 'pfmea',
        title: 'Process FMEA',
        fields: ['rows']
      }
    ]
  },
  generate: generatePFMEA
};
