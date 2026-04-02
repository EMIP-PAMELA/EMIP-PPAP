/**
 * PPAP-Bound Copilot Entry Point
 * V3.2F-2 Batch 2
 * 
 * Entry point for PPAP-Bound mode (launched from PPAP workspace).
 * This is the contract entry point for PPAP Workflow → Document Copilot.
 * 
 * As defined in V3.2F-1 Section 2 (Two-Mode Architecture).
 */

import { getEmipContext } from '../stubs/emipContextStub';
import { getPromptTemplate } from '../templates/promptRegistry';
import { createCopilotSession } from '../services/copilotSessionManager';
import { CopilotInputPackage, PPAPContext } from '../types/copilotTypes';

/**
 * Launch PPAP-Bound Copilot session
 * 
 * Flow:
 * 1. Call getEmipContext(ppapId) from EMIP stub
 * 2. Load template from promptRegistry by documentType
 * 3. Create session via copilotSessionManager
 * 4. Package inputs: EMIP context + template + PPAP context
 * 5. Return sessionId for UI to use
 * 
 * @param ppapId - PPAP ID
 * @param documentType - Document type to generate (e.g., 'pfmea', 'controlPlan')
 * @param ppapContext - PPAP context (part number, customer, etc.)
 * @param createdBy - User ID who launched the session
 * @returns Session ID
 */
export async function launchPpapBoundSession(
  ppapId: string,
  documentType: string,
  ppapContext: PPAPContext,
  createdBy?: string | null
): Promise<string> {
  console.log('[PpapBoundCopilot] Launching PPAP-Bound session:', {
    ppapId,
    documentType,
    createdBy
  });
  
  // Step 1: Call getEmipContext(ppapId) from EMIP stub
  const emipContext = await getEmipContext(ppapId);
  
  console.log('[PpapBoundCopilot] EMIP context loaded:', {
    source: emipContext.metadata.source,
    components: emipContext.components.length,
    operations: emipContext.operations.length
  });
  
  // Display warning if using stub data
  if (emipContext.metadata.source === 'stub') {
    console.warn('[PpapBoundCopilot] WARNING: Using EMIP stub data - EMIP storage not yet built');
    console.warn('[PpapBoundCopilot] Real EMIP integration will replace stub in future phase');
  }
  
  // Step 2: Load template from promptRegistry by documentType
  const promptTemplate = getPromptTemplate(documentType);
  
  console.log('[PpapBoundCopilot] Prompt template loaded:', {
    id: promptTemplate.id,
    name: promptTemplate.name
  });
  
  // Step 3: Create session via copilotSessionManager
  const session = await createCopilotSession(
    'ppap-bound',
    documentType,
    ppapId,
    createdBy ?? undefined
  );

  console.log('[PpapBoundCopilot] Copilot session created:', session.sessionId);
  
  // Step 4: Package inputs (for future use by orchestrator)
  // Note: The actual orchestration happens when user initiates generation
  // This just prepares the session with all required context
  const inputPackage: Partial<CopilotInputPackage> = {
    systemPrompt: promptTemplate.systemPrompt,
    documentInstructions: promptTemplate.documentInstructions,
    template: {
      documentType,
      requiredFields: [], // Would be populated from promptTemplate.outputFormat
      outputFormat: promptTemplate.outputFormat,
      validationRules: promptTemplate.validationRules
    },
    ppapContext,
    emipContext
  };
  
  console.log('[PpapBoundCopilot] Input package prepared:', {
    hasEmipContext: !!inputPackage.emipContext,
    hasPpapContext: !!inputPackage.ppapContext,
    documentType: inputPackage.template?.documentType
  });
  
  // Step 5: Return sessionId for UI to use
  console.log('[PpapBoundCopilot] Session launched successfully:', session.sessionId);
  
  return session.sessionId;
}

/**
 * Check if PPAP has EMIP context available
 * 
 * @param ppapId - PPAP ID
 * @returns true if EMIP context is available
 */
export async function hasPpapEmipContext(ppapId: string): Promise<boolean> {
  try {
    const context = await getEmipContext(ppapId);
    return context.metadata.source === 'emip' || context.metadata.source === 'stub';
  } catch (error) {
    console.error('[PpapBoundCopilot] Error checking EMIP context:', error);
    return false;
  }
}
