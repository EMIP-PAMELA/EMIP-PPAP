/**
 * Prompt Template Registry - Document Copilot
 * V3.2F-2 Batch 1
 * 
 * Repurposed from templates/registry.ts for AI-based generation.
 * Replaces TemplateDefinition with PromptTemplate.
 * 
 * Central registry for all prompt templates used with Claude API.
 * Provides template discovery and retrieval for AI document generation.
 * 
 * As defined in V3.2F-1 Section 4.
 */

import { PromptTemplate } from '../types/copilotTypes';

// ============================================================================
// System Prompt (Common Across All Templates)
// ============================================================================

const SYSTEM_PROMPT = `You are an expert automotive quality engineer specializing in PPAP (Production Part Approval Process) documentation. Your role is to generate accurate, complete, and industry-standard PPAP documents based on Bill of Materials (BOM) data, engineering drawings, and customer requirements.

Output Format:
- Return structured JSON matching the provided schema
- Include confidence metadata for each field
- Flag uncertain fields requiring user review
- List assumptions made during generation

Quality Standards:
- Follow AIAG (Automotive Industry Action Group) standards
- Use industry-standard terminology
- Ensure traceability between BOM and document fields
- Highlight potential risks or gaps

Critical Instructions:
- Use BOTH the raw BOM PDF and the parsed BOM data as primary sources
- If you detect discrepancies between the raw PDF and parsed data, flag them explicitly
- If information is missing or ambiguous, ask the user specific questions rather than guessing
- Return structured output in the exact format specified in the output schema

If you need clarification, ask specific questions rather than making assumptions.`;

// ============================================================================
// Static Prompt Templates (Built-in)
// ============================================================================

/**
 * PFMEA (Process Failure Mode and Effects Analysis) Prompt Template
 */
const PFMEA_PROMPT_TEMPLATE: PromptTemplate = {
  id: 'pfmea',
  name: 'Process FMEA',
  description: 'Process Failure Mode and Effects Analysis for manufacturing processes',
  
  systemPrompt: SYSTEM_PROMPT,
  
  documentInstructions: `Generate a Process FMEA (Failure Mode and Effects Analysis) document based on the provided BOM data.

Required Sections:
1. Process Steps: Extract from BOM operations (--10, --20, etc.)
2. Failure Modes: Identify potential failure modes for each operation
3. Effects: Describe customer impact of each failure mode
4. Severity: Rate severity (1-10) based on customer impact
5. Causes: Identify root causes of each failure mode
6. Occurrence: Rate likelihood (1-10) of each cause
7. Current Controls: Identify existing detection methods
8. Detection: Rate detection effectiveness (1-10)
9. RPN: Calculate Risk Priority Number (Severity × Occurrence × Detection)
10. Recommended Actions: Suggest mitigation for high RPN items

Industry Standards (AIAG FMEA-4):
- Severity 9-10: Safety or regulatory non-compliance
- Severity 7-8: Major performance degradation
- Severity 4-6: Moderate customer impact
- Severity 1-3: Minor or no customer impact
- RPN > 200: High risk, immediate action required
- RPN 100-200: Medium risk, action recommended
- RPN < 100: Low risk, monitor

For each process step from the BOM:
- Analyze the operation description to identify potential failure modes
- Consider the component types involved (wire, terminal, connector, hardware)
- Assess the criticality of the operation in the overall assembly process
- Recommend appropriate controls based on the failure mode severity

Output Structure:
Return JSON with array of failure modes, each containing:
- processStep, processDescription, failureMode, effect, severity, cause, occurrence, currentControl, detection, rpn, recommendedAction
- Include confidence level for each field (high/medium/low)
- Flag any uncertain fields that require user review`,
  
  requiredInputs: {
    bom: true,
    template: false,
    drawing: false,
    ppapContext: false
  },
  
  optionalInputs: {
    emipContext: true,
    additionalFiles: true
  },
  
  outputFormat: {
    schema: {
      type: 'object',
      properties: {
        failureModes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              processStep: { type: 'string' },
              processDescription: { type: 'string' },
              failureMode: { type: 'string' },
              effect: { type: 'string' },
              severity: { type: 'number', minimum: 1, maximum: 10 },
              cause: { type: 'string' },
              occurrence: { type: 'number', minimum: 1, maximum: 10 },
              currentControl: { type: 'string' },
              detection: { type: 'number', minimum: 1, maximum: 10 },
              rpn: { type: 'number' },
              recommendedAction: { type: 'string' },
              confidence: { type: 'string', enum: ['high', 'medium', 'low'] }
            },
            required: ['processStep', 'failureMode', 'effect', 'severity', 'cause', 'occurrence', 'detection', 'rpn']
          }
        }
      }
    },
    fileFormat: 'json'
  },
  
  validationRules: [
    { field: 'severity', type: 'range', min: 1, max: 10, errorMessage: 'Severity must be between 1 and 10' },
    { field: 'occurrence', type: 'range', min: 1, max: 10, errorMessage: 'Occurrence must be between 1 and 10' },
    { field: 'detection', type: 'range', min: 1, max: 10, errorMessage: 'Detection must be between 1 and 10' },
    { field: 'failureMode', type: 'required', required: true, errorMessage: 'Failure mode is required for each process step' }
  ]
};

/**
 * Control Plan Prompt Template
 */
const CONTROL_PLAN_PROMPT_TEMPLATE: PromptTemplate = {
  id: 'controlPlan',
  name: 'Control Plan',
  description: 'Manufacturing Control Plan for process control and quality assurance',
  
  systemPrompt: SYSTEM_PROMPT,
  
  documentInstructions: `Generate a Control Plan document based on the provided BOM data.

Required Sections:
1. Process Steps: Extract from BOM operations (--10, --20, etc.)
2. Characteristics: Key product/process characteristics to control
3. Method: Measurement or inspection method
4. Sample Size: Number of units to inspect
5. Frequency: How often to perform the control
6. Control Method: Statistical or attribute control method
7. Reaction Plan: Action to take if out of specification

Industry Standards:
- Critical characteristics require 100% inspection or statistical process control
- Use appropriate measurement techniques (visual, caliper, gauge, etc.)
- Specify clear reaction plans for out-of-spec conditions
- Align with AIAG Production Part Approval Process requirements

For each process step from the BOM:
- Identify key characteristics that affect product quality, safety, or fit
- Specify appropriate measurement methods based on the characteristic type
- Recommend sample sizes based on process capability and risk
- Define reaction plans for potential non-conformances

Output Structure:
Return JSON with array of control items, each containing:
- processStep, processDescription, characteristic, specification, method, sampleSize, frequency, controlMethod, reactionPlan
- Include confidence level for each field (high/medium/low)
- Flag any uncertain fields that require user review`,
  
  requiredInputs: {
    bom: true,
    template: false,
    drawing: false,
    ppapContext: false
  },
  
  optionalInputs: {
    emipContext: true,
    additionalFiles: true
  },
  
  outputFormat: {
    schema: {
      type: 'object',
      properties: {
        controlItems: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              processStep: { type: 'string' },
              processDescription: { type: 'string' },
              characteristic: { type: 'string' },
              specification: { type: 'string' },
              method: { type: 'string' },
              sampleSize: { type: 'string' },
              frequency: { type: 'string' },
              controlMethod: { type: 'string' },
              reactionPlan: { type: 'string' },
              confidence: { type: 'string', enum: ['high', 'medium', 'low'] }
            },
            required: ['processStep', 'characteristic', 'method', 'sampleSize', 'frequency']
          }
        }
      }
    },
    fileFormat: 'json'
  },
  
  validationRules: [
    { field: 'characteristic', type: 'required', required: true, errorMessage: 'Characteristic is required for each control item' },
    { field: 'method', type: 'required', required: true, errorMessage: 'Method is required for each control item' }
  ]
};

/**
 * Process Flow Prompt Template
 */
const PROCESS_FLOW_PROMPT_TEMPLATE: PromptTemplate = {
  id: 'processFlow',
  name: 'Process Flow',
  description: 'Manufacturing process flow diagram showing operation sequence',
  
  systemPrompt: SYSTEM_PROMPT,
  
  documentInstructions: `Generate a Process Flow document based on the provided BOM data.

Required Sections:
1. Process Steps: Extract from BOM operations (--10, --20, etc.) in sequence
2. Operation Description: Detailed description of each operation
3. Equipment: Equipment or work center used
4. Inputs: Components or materials consumed at this step
5. Outputs: Result of this operation
6. Controls: Critical parameters or specifications

Industry Standards:
- Process flow should show logical sequence from raw materials to finished product
- Identify inspection points and quality gates
- Document rework loops or alternate paths
- Align with AIAG Production Part Approval Process requirements

For each process step from the BOM:
- Describe the operation in sufficient detail for process understanding
- Identify equipment or work centers from BOM resource IDs
- List components consumed at this step
- Specify what is produced or achieved at this step

Output Structure:
Return JSON with array of process steps, each containing:
- stepNumber, operation, description, equipment, inputs, outputs, controls
- Include confidence level for each field (high/medium/low)
- Flag any uncertain fields that require user review`,
  
  requiredInputs: {
    bom: true,
    template: false,
    drawing: false,
    ppapContext: false
  },
  
  optionalInputs: {
    emipContext: true,
    additionalFiles: true
  },
  
  outputFormat: {
    schema: {
      type: 'object',
      properties: {
        processSteps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              stepNumber: { type: 'string' },
              operation: { type: 'string' },
              description: { type: 'string' },
              equipment: { type: 'string' },
              inputs: { type: 'array', items: { type: 'string' } },
              outputs: { type: 'array', items: { type: 'string' } },
              controls: { type: 'string' },
              confidence: { type: 'string', enum: ['high', 'medium', 'low'] }
            },
            required: ['stepNumber', 'operation', 'description']
          }
        }
      }
    },
    fileFormat: 'json'
  },
  
  validationRules: [
    { field: 'operation', type: 'required', required: true, errorMessage: 'Operation is required for each process step' }
  ]
};

/**
 * PSW (Part Submission Warrant) Prompt Template
 */
const PSW_PROMPT_TEMPLATE: PromptTemplate = {
  id: 'psw',
  name: 'Part Submission Warrant (PSW)',
  description: 'PPAP Part Submission Warrant with key part information and submission details',
  
  systemPrompt: SYSTEM_PROMPT,
  
  documentInstructions: `Generate a Part Submission Warrant (PSW) document based on the provided BOM and PPAP context.

Required Sections:
1. Part Information: Part number, name, description
2. Supplier Information: Supplier name, code, address
3. Customer Information: Customer name, plant, contact
4. Submission Details: Submission level, reason for submission
5. Part Weight: Weight per unit
6. Material Specification: Material type and grade
7. Additional Information: Engineering change level, tooling information

Industry Standards:
- PSW is Form 1 of PPAP submission per AIAG requirements
- All fields must be accurate and complete
- Submission level should match customer requirements
- Must be signed by authorized personnel

Extract information from:
- BOM data for part details and material information
- PPAP context for supplier, customer, and submission information
- Use EMIP context if available for additional part details

Output Structure:
Return JSON with PSW fields:
- partNumber, partName, customerPartNumber, supplierName, supplierCode, customerName, submissionLevel, reasonForSubmission, partWeight, materialSpec
- Include confidence level for each field (high/medium/low)
- Flag any uncertain fields that require user review or customer confirmation`,
  
  requiredInputs: {
    bom: true,
    template: false,
    drawing: false,
    ppapContext: true
  },
  
  optionalInputs: {
    emipContext: true,
    additionalFiles: false
  },
  
  outputFormat: {
    schema: {
      type: 'object',
      properties: {
        partNumber: { type: 'string' },
        partName: { type: 'string' },
        customerPartNumber: { type: 'string' },
        supplierName: { type: 'string' },
        supplierCode: { type: 'string' },
        customerName: { type: 'string' },
        submissionLevel: { type: 'string' },
        reasonForSubmission: { type: 'string' },
        partWeight: { type: 'string' },
        materialSpec: { type: 'string' },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] }
      },
      required: ['partNumber', 'partName', 'supplierName', 'customerName', 'submissionLevel']
    },
    fileFormat: 'json'
  },
  
  validationRules: [
    { field: 'partNumber', type: 'required', required: true, errorMessage: 'Part number is required' },
    { field: 'supplierName', type: 'required', required: true, errorMessage: 'Supplier name is required' },
    { field: 'customerName', type: 'required', required: true, errorMessage: 'Customer name is required' }
  ]
};

// ============================================================================
// Registry Implementation
// ============================================================================

// Static prompt templates (built-in)
const staticPromptTemplates: Record<string, PromptTemplate> = {
  'pfmea': PFMEA_PROMPT_TEMPLATE,
  'controlPlan': CONTROL_PLAN_PROMPT_TEMPLATE,
  'processFlow': PROCESS_FLOW_PROMPT_TEMPLATE,
  'psw': PSW_PROMPT_TEMPLATE
};

// Dynamic prompt templates (user-defined or ingested)
const dynamicPromptTemplates: Record<string, PromptTemplate> = {};

// Combined registry
function getAllPromptTemplates(): Record<string, PromptTemplate> {
  return { ...staticPromptTemplates, ...dynamicPromptTemplates };
}

/**
 * Get a specific prompt template by ID
 * @throws Error if template not found
 */
export function getPromptTemplate(id: string): PromptTemplate {
  const allTemplates = getAllPromptTemplates();
  const template = allTemplates[id];
  if (!template) {
    throw new Error(`Prompt template not found: ${id}`);
  }
  return template;
}

/**
 * List all available prompt templates (static + dynamic)
 */
export function listPromptTemplates(): PromptTemplate[] {
  return Object.values(getAllPromptTemplates());
}

/**
 * Check if a prompt template exists
 */
export function hasPromptTemplate(id: string): boolean {
  return id in getAllPromptTemplates();
}

/**
 * Register a dynamic prompt template
 * Allows external templates to be added to the registry
 */
export function registerPromptTemplate(template: PromptTemplate): void {
  if (staticPromptTemplates[template.id]) {
    console.warn(`[PromptRegistry] Cannot override static template: ${template.id}`);
    return;
  }

  dynamicPromptTemplates[template.id] = template;
  console.log(`[PromptRegistry] Registered dynamic prompt template: ${template.id} (${template.name})`);
}

/**
 * Get list of dynamic prompt template IDs
 */
export function listDynamicPromptTemplateIds(): string[] {
  return Object.keys(dynamicPromptTemplates);
}

/**
 * Clear all dynamic prompt templates (useful for testing)
 */
export function clearDynamicPromptTemplates(): void {
  for (const key of Object.keys(dynamicPromptTemplates)) {
    delete dynamicPromptTemplates[key];
  }
  console.log('[PromptRegistry] Cleared all dynamic prompt templates');
}
