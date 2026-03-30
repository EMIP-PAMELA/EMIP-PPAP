/**
 * Template Registry - Document Engine
 * 
 * Central registry for all document templates.
 * Provides template discovery and retrieval.
 * 
 * Architecture layer: Template System
 * 
 * Phase 29: Extended template registry with dynamic template support
 * Phase 30.1: Auto-load persisted dynamic templates from database
 * 
 * Manages both static (built-in) and dynamic (ingested) templates
 */

import { TemplateDefinition, TemplateId } from './types';
import { PSW_TEMPLATE } from './pswTemplate';
import { PROCESS_FLOW_TEMPLATE } from './processFlowTemplate';
import { PFMEA_TEMPLATE } from './pfmeaTemplate';
import { CONTROL_PLAN_TEMPLATE } from './controlPlanTemplate';

// Phase W2B: Wizard-specific templates
import { PROCESS_FLOW_WIZARD_TEMPLATE } from './wizard/ProcessFlowWizardTemplate';
import { CONTROL_PLAN_WIZARD_TEMPLATE } from './wizard/ControlPlanWizardTemplate';
import { PFMEA_SUMMARY_WIZARD_TEMPLATE } from './wizard/PfmeaSummaryWizardTemplate';

// Phase 30.1: Import persistence service
let persistenceServiceImported = false;

// Static templates (original system templates)
const staticTemplates: Record<string, TemplateDefinition> = {
  'PSW': PSW_TEMPLATE,
  'PROCESS_FLOW': PROCESS_FLOW_TEMPLATE,
  'PFMEA': PFMEA_TEMPLATE,
  'CONTROL_PLAN': CONTROL_PLAN_TEMPLATE,
  // Phase W2B: Wizard-specific templates (direct BOM mapping, no transformation chain)
  'process-flow-wizard': PROCESS_FLOW_WIZARD_TEMPLATE,
  'control-plan-wizard': CONTROL_PLAN_WIZARD_TEMPLATE,
  'pfmea-summary-wizard': PFMEA_SUMMARY_WIZARD_TEMPLATE
};

// Phase 29: Dynamic templates (ingested from external sources)
const dynamicTemplates: Record<string, TemplateDefinition> = {};

// Combined registry
function getAllTemplates(): Record<string, TemplateDefinition> {
  return { ...staticTemplates, ...dynamicTemplates };
}

/**
 * Get a specific template by ID
 * @throws Error if template not found
 */
export function getTemplate(id: TemplateId): TemplateDefinition {
  const allTemplates = getAllTemplates();
  const template = allTemplates[id];
  if (!template) {
    throw new Error(`Template not found: ${id}`);
  }
  return template;
}

/**
 * List all available templates (static + dynamic)
 */
export function listTemplates(): TemplateDefinition[] {
  return Object.values(getAllTemplates());
}

/**
 * Check if a template exists
 */
export function hasTemplate(id: TemplateId): boolean {
  return id in getAllTemplates();
}

/**
 * Phase 29: Register a dynamic template
 * Allows external templates to be added to the registry
 */
export function registerDynamicTemplate(template: TemplateDefinition): void {
  if (staticTemplates[template.id]) {
    console.warn(`[TemplateRegistry] Cannot override static template: ${template.id}`);
    return;
  }

  dynamicTemplates[template.id] = template;
  console.log(`[TemplateRegistry] Registered dynamic template: ${template.id} (${template.name})`);
}

/**
 * Phase 29: Load templates from external source (placeholder for future implementation)
 * Phase 29: Future implementation for loading from /public/templates/, database, or API
 * Phase 30.1: Load persisted dynamic templates from database
 */
export async function loadTemplatesFromSource(): Promise<void> {
  if (persistenceServiceImported) {
    return; // Already loaded
  }

  try {
    // Dynamic import to avoid circular dependencies
    const { loadAndRegisterDynamicTemplates } = await import('./templatePersistenceService');
    await loadAndRegisterDynamicTemplates();
    persistenceServiceImported = true;
    console.log('[TemplateRegistry] Dynamic templates loaded from database');
  } catch (err) {
    console.error('[TemplateRegistry] Error loading dynamic templates from database:', err);
    // Don't throw - allow app to continue with static templates
  }
}

/**
 * Phase 29: Get list of dynamic template IDs
 */
export function listDynamicTemplateIds(): string[] {
  return Object.keys(dynamicTemplates);
}

/**
 * Phase 29: Clear all dynamic templates (useful for testing)
 */
export function clearDynamicTemplates(): void {
  for (const key of Object.keys(dynamicTemplates)) {
    delete dynamicTemplates[key];
  }
  console.log('[TemplateRegistry] Cleared all dynamic templates');
}
