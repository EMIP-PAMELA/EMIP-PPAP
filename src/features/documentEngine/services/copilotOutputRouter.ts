/**
 * Copilot Output Router
 * V3.2F-2 Batch 2
 * 
 * Handles routing Claude output to correct destination.
 * Routes through Vault contracts ONLY - no direct Supabase Storage calls.
 * 
 * Responsibilities:
 * - Store draft in Vault via storeFile() contract
 * - Create AI version with provenance via versionService
 * - Emit DocumentDraftCreatedEvent (PPAP-Bound mode only)
 * - Return vaultFileId
 * 
 * As defined in V3.2F-1 Section 3 (Output Handling).
 */

import { CopilotDraft, DocumentDraftCreatedEvent } from '../types/copilotTypes';
import { storeFile } from '@/src/features/vault/services/vaultService';
import { createAIVersion } from '../persistence/versionService';

// ============================================================================
// Output Routing
// ============================================================================

/**
 * Route Claude draft to appropriate destination
 * 
 * Flow:
 * 1. Convert draft to file blob
 * 2. Store in Vault via storeFile() contract
 * 3. Create AI version with provenance
 * 4. If PPAP-Bound: emit DocumentDraftCreatedEvent
 * 5. Return vaultFileId
 * 
 * @param sessionId - Copilot session ID
 * @param draft - CopilotDraft from Claude API
 * @param promptTemplateId - Which prompt template was used
 * @param createdBy - User ID who initiated generation
 * @param ppapId - PPAP ID (for PPAP-Bound mode)
 * @returns Vault file ID
 */
export async function routeDraft(
  sessionId: string,
  draft: CopilotDraft,
  promptTemplateId: string,
  createdBy: string,
  ppapId?: string
): Promise<string> {
  console.log('[CopilotOutputRouter] Routing draft:', {
    sessionId,
    promptTemplateId,
    draftType: draft.type,
    ppapId
  });
  
  if (draft.type !== 'draft' || !draft.documentData) {
    throw new Error('Cannot route non-draft response');
  }
  
  // Step 1: Convert draft to JSON file blob
  const draftJson = JSON.stringify(draft.documentData, null, 2);
  const draftBlob = new Blob([draftJson], { type: 'application/json' });
  const fileName = `${promptTemplateId}-draft-${Date.now()}.json`;
  const draftFile = new File([draftBlob], fileName, { type: 'application/json' });
  
  console.log('[CopilotOutputRouter] Draft converted to file:', fileName);
  
  // Step 2: Store in Vault via storeFile() contract
  // CRITICAL: MUST use Vault contract - NO direct Supabase Storage calls
  const fileReference = await storeFile(
    draftFile,
    createdBy,
    {
      ownerId: ppapId || sessionId,
      ownerType: ppapId ? 'ppap' : 'copilot-session'
    }
  );
  
  const vaultFileId = fileReference.id;
  
  console.log('[CopilotOutputRouter] Draft stored in Vault:', vaultFileId);
  
  // Step 3: Create AI version with provenance metadata
  const aiVersion = await createAIVersion(
    sessionId,
    draft,
    promptTemplateId,
    createdBy
  );
  
  if (!aiVersion) {
    console.error('[CopilotOutputRouter] Failed to create AI version');
    throw new Error('Failed to create AI version with provenance');
  }
  
  console.log('[CopilotOutputRouter] AI version created:', {
    versionId: aiVersion.id,
    versionNumber: aiVersion.versionNumber,
    model: aiVersion.aiProvenance?.modelUsed,
    tokens: aiVersion.aiProvenance?.totalTokens
  });
  
  // Step 4: If PPAP-Bound mode, emit DocumentDraftCreatedEvent
  if (ppapId) {
    const event = await emitDocumentDraftCreatedEvent(
      ppapId,
      promptTemplateId,
      vaultFileId,
      sessionId,
      draft.metadata.confidence,
      draft.metadata.uncertainFields,
      createdBy
    );
    
    console.log('[CopilotOutputRouter] DocumentDraftCreatedEvent emitted:', event.eventId);
  } else {
    console.log('[CopilotOutputRouter] Standalone mode - no event emission');
  }
  
  // Step 5: Return vaultFileId
  console.log('[CopilotOutputRouter] Routing complete, vaultFileId:', vaultFileId);
  
  return vaultFileId;
}

// ============================================================================
// Event Emission (PPAP-Bound Mode Only)
// ============================================================================

/**
 * Emit DocumentDraftCreatedEvent to PPAP Workflow
 * 
 * This is the ONLY way Document Copilot notifies PPAP Workflow.
 * Document Copilot MUST NOT directly mutate PPAP state.
 * 
 * @param ppapId - PPAP ID
 * @param documentType - Document type
 * @param vaultFileId - Vault file ID
 * @param sessionId - Copilot session ID
 * @param confidence - AI confidence level
 * @param uncertainFields - Fields flagged as uncertain
 * @param userId - User ID who initiated generation
 * @returns DocumentDraftCreatedEvent
 */
async function emitDocumentDraftCreatedEvent(
  ppapId: string,
  documentType: string,
  vaultFileId: string,
  sessionId: string,
  confidence: 'high' | 'medium' | 'low',
  uncertainFields: string[],
  userId: string
): Promise<DocumentDraftCreatedEvent> {
  console.log('[CopilotOutputRouter] Emitting DocumentDraftCreatedEvent');
  
  const event: DocumentDraftCreatedEvent = {
    eventType: 'DOCUMENT_DRAFT_CREATED',
    eventId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    payload: {
      ppapId,
      documentType,
      vaultFileId,
      sessionId,
      confidence,
      uncertainFields
    },
    actor: {
      userId,
      userName: 'Unknown User', // Would be fetched from user service in full implementation
      role: 'quality-engineer'
    }
  };
  
  // In a full implementation, this would publish to an event bus
  // For now, we'll just log it and store it in a hypothetical events table
  console.log('[CopilotOutputRouter] Event:', event);
  
  // TODO: Publish event to event bus or store in events table
  // For now, just return the event object
  
  return event;
}

/**
 * Check if a draft should be routed to PPAP Workflow
 * 
 * @param ppapId - PPAP ID (if PPAP-Bound mode)
 * @returns true if PPAP-Bound mode
 */
export function isPpapBound(ppapId?: string): boolean {
  return ppapId !== undefined && ppapId !== null && ppapId.length > 0;
}
