/**
 * PSW Template - Production Part Submission Warrant
 * 
 * Maps normalized BOM data and external inputs into PSW document structure.
 * 
 * Required external inputs:
 * - customerName
 * - partNumber (fallback if not in BOM)
 * - revisionLevel
 * - submissionLevel
 * - supplierName
 * 
 * BOM-derived fields:
 * - totalOperations
 * - totalComponents
 * - wireCount
 * - terminalCount
 * - hardwareCount
 * 
 * Architecture layer: Template Implementation
 */

import { TemplateDefinition, TemplateInput, DocumentDraft, TemplateInputField } from './types';

const REQUIRED_INPUTS: TemplateInputField[] = [
  { key: 'customerName', label: 'Customer Name', required: true },
  { key: 'partNumber', label: 'Part Number', required: true },
  { key: 'revisionLevel', label: 'Revision Level', required: true },
  { key: 'submissionLevel', label: 'Submission Level (1-5)', required: true },
  { key: 'supplierName', label: 'Supplier Name', required: true }
];

/**
 * Validate that all required external inputs are present
 * @throws Error if any required input is missing
 */
function validateRequiredInputs(externalData: Record<string, any> | undefined): void {
  if (!externalData) {
    const missingKeys = REQUIRED_INPUTS.map(f => f.key).join(', ');
    throw new Error(`PSW Template requires external data: ${missingKeys}`);
  }

  const missing: string[] = [];
  
  for (const field of REQUIRED_INPUTS) {
    if (field.required && !externalData[field.key]) {
      missing.push(field.label);
    }
  }

  if (missing.length > 0) {
    throw new Error(`PSW Template missing required fields: ${missing.join(', ')}`);
  }
}

/**
 * Generate PSW document draft from normalized BOM and external data
 */
function generatePSW(input: TemplateInput): DocumentDraft {
  validateRequiredInputs(input.externalData);

  const { bom, externalData } = input;

  // Use part number from external data (with BOM fallback)
  const partNumber = externalData!.partNumber || bom.masterPartNumber;

  // Map BOM summary to PSW fields
  const fields = {
    // External inputs (required)
    partNumber,
    customerName: externalData!.customerName,
    revisionLevel: externalData!.revisionLevel,
    submissionLevel: externalData!.submissionLevel,
    supplierName: externalData!.supplierName,

    // BOM-derived fields
    totalOperations: bom.summary.totalOperations,
    totalComponents: bom.summary.totalComponents,
    wireCount: bom.summary.wires,
    terminalCount: bom.summary.terminals,
    hardwareCount: bom.summary.hardware
  };

  const metadata = {
    generatedAt: new Date().toISOString(),
    bomMasterPartNumber: bom.masterPartNumber,
    templateVersion: '1.0'
  };

  return {
    templateId: 'PSW',
    metadata,
    fields
  };
}

/**
 * PSW Template Definition
 */
export const PSW_TEMPLATE: TemplateDefinition = {
  id: 'PSW',
  name: 'Production Part Submission Warrant',
  description: 'Part submission documentation for PPAP process',
  requiredInputs: REQUIRED_INPUTS,
  generate: generatePSW
};
