/**
 * Process Flow Template - Document Engine
 *
 * Maps NormalizedBOM through the Process Flow mapping layer
 * into a structured Process Flow document.
 *
 * Architecture layer: Template Implementation
 */

import { TemplateDefinition, TemplateInput, DocumentDraft } from './types';
import { mapBOMToProcessFlow } from '../mapping/bomToProcessFlow';

/**
 * Generate a Process Flow DocumentDraft from NormalizedBOM
 */
function generateProcessFlow(input: TemplateInput): DocumentDraft {
  const { bom } = input;

  const processFlow = mapBOMToProcessFlow(bom);

  const fields = {
    partNumber: processFlow.partNumber,
    steps: processFlow.steps
  };

  const metadata = {
    generatedAt: new Date().toISOString(),
    bomMasterPartNumber: bom.masterPartNumber,
    templateVersion: '1.0'
  };

  return {
    templateId: 'PROCESS_FLOW',
    metadata,
    fields
  };
}

/**
 * Process Flow Template Definition
 */
export const PROCESS_FLOW_TEMPLATE: TemplateDefinition = {
  id: 'PROCESS_FLOW',
  name: 'Process Flow Diagram',
  description: 'Step-by-step process flow derived from BOM operations',
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
      key: 'steps',
      label: 'Process Steps',
      type: 'table',
      required: true,
      editable: false,
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
          key: 'description',
          label: 'Process Description',
          type: 'text',
          required: true,
          editable: false
        },
        {
          key: 'inputs',
          label: 'Inputs',
          type: 'text',
          required: false,
          editable: false
        },
        {
          key: 'outputs',
          label: 'Outputs',
          type: 'text',
          required: false,
          editable: false
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
        id: 'process_flow',
        title: 'Process Flow Diagram',
        fields: ['steps']
      }
    ]
  },
  generate: generateProcessFlow
};
