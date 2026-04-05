/**
 * Template Ingestion Service - STUB
 * 
 * NOTE: This service was removed in V3.2F (AI-based generation replaced deterministic ingestion)
 * This stub exists only to prevent build failures from legacy imports.
 * 
 * DO NOT USE - Dynamic template loading is disabled.
 * Use AI prompt templates in promptRegistry.ts instead.
 */

import { TemplateDefinition } from './types';

export type IngestedTemplate = {
  id: string;
  name: string;
  description: string;
  sections: any[];
};

/**
 * @deprecated Dynamic template ingestion removed in V3.2F
 * @throws Error - This function is no longer supported
 */
export function parseWorkbookTemplate(fileContent: string): IngestedTemplate {
  throw new Error(
    'parseWorkbookTemplate is no longer supported. ' +
    'Dynamic template ingestion was removed in V3.2F. ' +
    'Use AI prompt templates in promptRegistry.ts instead.'
  );
}

/**
 * @deprecated Dynamic template ingestion removed in V3.2F
 * @throws Error - This function is no longer supported
 */
export function convertToTemplateDefinition(ingestedTemplate: IngestedTemplate): TemplateDefinition {
  throw new Error(
    'convertToTemplateDefinition is no longer supported. ' +
    'Dynamic template ingestion was removed in V3.2F. ' +
    'Use AI prompt templates in promptRegistry.ts instead.'
  );
}
