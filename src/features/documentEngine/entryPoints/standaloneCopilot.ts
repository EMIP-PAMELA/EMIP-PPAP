/**
 * Standalone Copilot Entry Point
 * V3.2F-2 Batch 2
 * 
 * Entry point for Standalone mode (independent of PPAP).
 * This is the entry point for ad-hoc document generation.
 * 
 * As defined in V3.2F-1 Section 2 (Two-Mode Architecture).
 */

import { getPromptTemplate } from '../templates/promptRegistry';
import { createCopilotSession } from '../services/copilotSessionManager';

/**
 * Launch Standalone Copilot session
 * 
 * Flow:
 * 1. Load template from promptRegistry by documentType
 * 2. Create session via copilotSessionManager
 * 3. Return sessionId
 * 4. UI handles document uploads separately
 * 
 * No PPAP context, no EMIP context. User provides all inputs.
 * 
 * @param documentType - Document type to generate (e.g., 'pfmea', 'controlPlan')
 * @param createdBy - User ID who launched the session
 * @returns Session ID
 */
export async function launchStandaloneSession(
  documentType: string,
  createdBy?: string | null
): Promise<string> {
  console.log('[StandaloneCopilot] Launching Standalone session:', {
    documentType,
    createdBy
  });
  
  // Step 1: Load template from promptRegistry by documentType
  const promptTemplate = getPromptTemplate(documentType);
  
  console.log('[StandaloneCopilot] Prompt template loaded:', {
    id: promptTemplate.id,
    name: promptTemplate.name
  });
  
  // Step 2: Create session via copilotSessionManager
  const session = await createCopilotSession(
    'standalone',
    documentType,
    undefined, // No ppapId for Standalone mode
    createdBy ?? undefined
  );
  
  console.log('[StandaloneCopilot] Copilot session created:', session.sessionId);
  
  // Step 3: Return sessionId for UI to use
  // UI will handle:
  // - BOM PDF upload
  // - Optional Excel template upload
  // - Optional engineering drawing upload
  // - Initiate generation when ready
  
  console.log('[StandaloneCopilot] Session launched successfully:', session.sessionId);
  console.log('[StandaloneCopilot] User must upload BOM and other required inputs');
  
  return session.sessionId;
}

/**
 * List available document types for Standalone mode
 * 
 * @returns Array of document type IDs
 */
export function listAvailableDocumentTypes(): string[] {
  // In a full implementation, this would query the prompt registry
  // For now, return the static template IDs
  return ['pfmea', 'controlPlan', 'processFlow', 'psw'];
}

/**
 * Get document type requirements
 * 
 * @param documentType - Document type ID
 * @returns Required and optional inputs for the document type
 */
export function getDocumentTypeRequirements(documentType: string): {
  required: string[];
  optional: string[];
} {
  try {
    const template = getPromptTemplate(documentType);
    
    const required: string[] = [];
    const optional: string[] = [];
    
    if (template.requiredInputs.bom) required.push('BOM');
    if (template.requiredInputs.template) required.push('Excel Template');
    if (template.requiredInputs.drawing) required.push('Engineering Drawing');
    if (template.requiredInputs.ppapContext) required.push('PPAP Context');
    
    if (template.optionalInputs.emipContext) optional.push('EMIP Context');
    if (template.optionalInputs.additionalFiles) optional.push('Additional Files');
    
    return { required, optional };
  } catch (error) {
    console.error('[StandaloneCopilot] Error getting requirements:', error);
    return { required: ['BOM'], optional: [] };
  }
}
