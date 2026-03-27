/**
 * Control Plan Template - Document Engine
 *
 * Generates a Control Plan document by chaining:
 *   NormalizedBOM → ProcessFlowModel → PFMEAModel → ControlPlanModel → DocumentDraft
 *
 * Structural and risk context fields are pre-populated from the upstream chain.
 * Control fields (preventionControl, detectionControl, measurementMethod,
 * sampleSize, frequency, reactionPlan) are initialized to null and completed
 * by the user in the document editor.
 *
 * Architecture layer: Template Implementation
 */

import { TemplateDefinition, TemplateInput, DocumentDraft } from './types';
import { mapBOMToProcessFlow } from '../mapping/bomToProcessFlow';
import { mapProcessFlowToPFMEA } from '../mapping/processFlowToPFMEA';
import { mapPFMEAToControlPlan } from '../mapping/pfmeaToControlPlan';

/**
 * Generate a Control Plan DocumentDraft from NormalizedBOM
 */
function generateControlPlan(input: TemplateInput): DocumentDraft {
  const { bom } = input;

  const processFlow = mapBOMToProcessFlow(bom);
  const pfmea = mapProcessFlowToPFMEA(processFlow);
  const controlPlan = mapPFMEAToControlPlan(pfmea);

  const fields = {
    partNumber: controlPlan.partNumber,
    rows: controlPlan.rows
  };

  const metadata = {
    generatedAt: new Date().toISOString(),
    bomMasterPartNumber: bom.masterPartNumber,
    templateVersion: '1.0'
  };

  return {
    templateId: 'CONTROL_PLAN',
    metadata,
    fields
  };
}

/**
 * Control Plan Template Definition
 */
export const CONTROL_PLAN_TEMPLATE: TemplateDefinition = {
  id: 'CONTROL_PLAN',
  name: 'Control Plan',
  description: 'Control Plan derived from PFMEA — defines controls and measurement methods per characteristic',
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
      label: 'Control Plan Rows',
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
          key: 'characteristic',
          label: 'Product / Process Characteristic',
          type: 'text',
          required: true,
          editable: false
        },
        {
          key: 'failureMode',
          label: 'Potential Failure Mode',
          type: 'text',
          required: false,
          editable: false
        },
        {
          key: 'cause',
          label: 'Potential Cause(s)',
          type: 'text',
          required: false,
          editable: false
        },
        {
          key: 'preventionControl',
          label: 'Prevention Controls',
          type: 'text',
          required: false,
          editable: true
        },
        {
          key: 'detectionControl',
          label: 'Detection Controls',
          type: 'text',
          required: false,
          editable: true
        },
        {
          key: 'measurementMethod',
          label: 'Measurement Technique',
          type: 'text',
          required: false,
          editable: true
        },
        {
          key: 'sampleSize',
          label: 'Sample Size / Frequency',
          type: 'text',
          required: false,
          editable: true
        },
        {
          key: 'frequency',
          label: 'Control Method',
          type: 'text',
          required: false,
          editable: true
        },
        {
          key: 'reactionPlan',
          label: 'Reaction Plan / Corrective Action',
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
        id: 'part_info',
        title: 'Part Information',
        fields: ['partNumber']
      },
      {
        id: 'control_plan',
        title: 'Control Plan',
        fields: ['rows']
      }
    ]
  },
  generate: generateControlPlan
};
