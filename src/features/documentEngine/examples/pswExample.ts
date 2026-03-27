/**
 * PSW Template Usage Example
 * 
 * Demonstrates how to generate a PSW document draft from normalized BOM data.
 * This is a reference implementation showing the complete flow:
 * 1. Create normalized BOM data (normally from parser + normalizer)
 * 2. Provide required external inputs
 * 3. Generate document draft
 * 
 * NOTE: This is an example file for documentation purposes.
 * It is NOT imported by production code.
 */

import { NormalizedBOM } from '../types/bomTypes';
import { generateDocumentDraft } from '../core/documentGenerator';
import { TemplateInput } from '../templates/types';

/**
 * Example normalized BOM data
 * (In production, this comes from parseBOMText() → normalizeBOMData())
 */
const exampleBOM: NormalizedBOM = {
  masterPartNumber: 'WH-12345-A',
  operations: [
    {
      step: '10',
      resourceId: 'WR-CUTGROUP',
      description: 'Wire cut/strip/crimp machine',
      components: [
        {
          partId: '770006-3',
          aciCode: 'ACI03442',
          description: 'SOCKET 14-20AWG TIN REEL',
          quantity: 2,
          uom: 'EA',
          componentType: 'terminal',
          source: {
            rawLine: '----770006-3     ACI03442 SOCKET 14-20AWG TIN REEL    2.00 EA',
            trailingLines: []
          }
        },
        {
          partId: 'W4BR1283',
          aciCode: null,
          description: 'WIRE 18AWG BLACK',
          quantity: 48,
          uom: 'FT',
          componentType: 'wire',
          source: {
            rawLine: '----W4BR1283     WIRE 18AWG BLACK                      48.00 FT',
            trailingLines: []
          }
        }
      ],
      processLines: ['CUT/STRIP PER INSTRUCTION'],
      metadataLines: ['Resource ID: WR-CUTGROUP', 'Setup: 15 minutes']
    },
    {
      step: '50',
      resourceId: 'ASSY-BENCH',
      description: 'Assembly workbench',
      components: [
        {
          partId: 'LABEL-001',
          aciCode: null,
          description: 'IDENTIFICATION LABEL',
          quantity: 1,
          uom: 'EA',
          componentType: 'hardware',
          source: {
            rawLine: '----LABEL-001    IDENTIFICATION LABEL                  1.00 EA',
            trailingLines: []
          }
        }
      ],
      processLines: ['APPLY LABEL PER SPEC'],
      metadataLines: []
    }
  ],
  summary: {
    totalComponents: 3,
    totalOperations: 2,
    wires: 1,
    terminals: 1,
    hardware: 1
  }
};

/**
 * Example external data required for PSW template
 */
const externalData = {
  customerName: 'Trane Technologies',
  partNumber: 'WH-12345-A',
  revisionLevel: 'B',
  submissionLevel: '3',
  supplierName: 'Apogee Controls'
};

/**
 * Generate PSW draft
 */
function generateExamplePSW() {
  console.log('=== PSW Template Example ===\n');

  const input: TemplateInput = {
    bom: exampleBOM,
    externalData
  };

  try {
    const draft = generateDocumentDraft('PSW', input);

    console.log('PSW Draft Generated Successfully!\n');
    console.log('Template ID:', draft.templateId);
    console.log('\nMetadata:');
    console.log(JSON.stringify(draft.metadata, null, 2));
    console.log('\nFields:');
    console.log(JSON.stringify(draft.fields, null, 2));
    
    return draft;
  } catch (error) {
    console.error('Error generating PSW:', error);
    throw error;
  }
}

/**
 * Expected output structure:
 * 
 * {
 *   templateId: 'PSW',
 *   metadata: {
 *     generatedAt: '2026-03-26T21:30:00.000Z',
 *     bomMasterPartNumber: 'WH-12345-A',
 *     templateVersion: '1.0'
 *   },
 *   fields: {
 *     partNumber: 'WH-12345-A',
 *     customerName: 'Trane Technologies',
 *     revisionLevel: 'B',
 *     submissionLevel: '3',
 *     supplierName: 'Apogee Controls',
 *     totalOperations: 2,
 *     totalComponents: 3,
 *     wireCount: 1,
 *     terminalCount: 1,
 *     hardwareCount: 1
 *   }
 * }
 */

// Export for testing/demonstration
export { generateExamplePSW, exampleBOM, externalData };
