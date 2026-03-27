/**
 * Template Registry - Document Engine
 * 
 * Central registry for all document templates.
 * Provides template discovery and retrieval.
 * 
 * Architecture layer: Template System
 */

import { TemplateId, TemplateDefinition } from './types';
import { PSW_TEMPLATE } from './pswTemplate';
import { PROCESS_FLOW_TEMPLATE } from './processFlowTemplate';
import { PFMEA_TEMPLATE } from './pfmeaTemplate';
import { CONTROL_PLAN_TEMPLATE } from './controlPlanTemplate';

const templates: Record<TemplateId, TemplateDefinition> = {
  'PSW': PSW_TEMPLATE,
  'PROCESS_FLOW': PROCESS_FLOW_TEMPLATE,
  'PFMEA': PFMEA_TEMPLATE,
  'CONTROL_PLAN': CONTROL_PLAN_TEMPLATE
};

/**
 * Get a specific template by ID
 * @throws Error if template not found
 */
export function getTemplate(id: TemplateId): TemplateDefinition {
  const template = templates[id];
  if (!template) {
    throw new Error(`Template not found: ${id}`);
  }
  return template;
}

/**
 * List all available templates
 */
export function listTemplates(): TemplateDefinition[] {
  return Object.values(templates);
}

/**
 * Check if a template exists
 */
export function hasTemplate(id: TemplateId): boolean {
  return id in templates;
}
