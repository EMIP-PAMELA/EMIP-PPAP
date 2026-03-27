/**
 * Document Draft Generator - Document Engine Core
 * 
 * Orchestrates document generation from templates.
 * Validates inputs, retrieves templates, and generates drafts.
 * 
 * Architecture layer: Core Engine
 */

import { TemplateId, TemplateInput, DocumentDraft } from '../templates/types';
import { getTemplate } from '../templates/registry';

/**
 * Generate a document draft from a template
 * 
 * @param templateId - ID of the template to use
 * @param input - Template input (BOM + optional external data)
 * @returns Generated document draft
 * @throws Error if template not found or validation fails
 */
export function generateDocumentDraft(
  templateId: TemplateId,
  input: TemplateInput
): DocumentDraft {
  console.log(`[DocumentGenerator] Generating draft for template: ${templateId}`);

  // Retrieve template from registry
  const template = getTemplate(templateId);

  console.log(`[DocumentGenerator] Template: ${template.name}`);
  console.log(`[DocumentGenerator] Required inputs: ${template.requiredInputs.length}`);

  // Generate draft using template
  const draft = template.generate(input);

  console.log(`[DocumentGenerator] Draft generated successfully`);
  console.log(`[DocumentGenerator] Fields: ${Object.keys(draft.fields).length}`);

  return draft;
}
