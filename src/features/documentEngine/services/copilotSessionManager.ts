/**
 * Copilot Session Manager
 * V3.2F-2 Batch 2
 * 
 * Manages full session lifecycle for both PPAP-Bound and Standalone modes.
 * Tracks conversation history for multi-turn exchanges with Claude.
 * 
 * Uses existing sessionService.ts for Supabase persistence.
 * As defined in V3.2F-1 Section 6.
 */

import { 
  CopilotSession, 
  CopilotMode, 
  CopilotSessionStatus,
  ConversationMessage,
  CopilotDraft
} from '../types/copilotTypes';
import { createSession, loadSessions, saveSession } from '../persistence/sessionService';

// ============================================================================
// In-Memory Session Cache
// ============================================================================

const sessionCache: Map<string, CopilotSession> = new Map();

// ============================================================================
// Session Lifecycle Functions
// ============================================================================

/**
 * Create a new Copilot session
 * 
 * @param mode - 'ppap-bound' or 'standalone'
 * @param documentType - Document type to generate (e.g., 'pfmea', 'controlPlan')
 * @param ppapId - PPAP ID (required for PPAP-Bound mode)
 * @param createdBy - User ID who created the session
 * @returns CopilotSession
 */
export async function createCopilotSession(
  mode: CopilotMode,
  documentType: string,
  ppapId?: string,
  createdBy?: string
): Promise<CopilotSession> {
  console.log('[CopilotSessionManager] Creating session:', { mode, documentType, ppapId });
  
  // Validate PPAP-Bound mode requirements
  if (mode === 'ppap-bound' && !ppapId) {
    throw new Error('ppapId is required for PPAP-Bound mode');
  }
  
  // Generate session ID
  const sessionId = crypto.randomUUID();
  
  // Create session in database
  const sessionName = mode === 'ppap-bound' 
    ? `Copilot-${documentType}-PPAP-${ppapId}`
    : `Copilot-${documentType}-Standalone`;
  
  await createSession(sessionName, ppapId || null, createdBy || null);
  
  // Create Copilot session object
  const copilotSession: CopilotSession = {
    sessionId,
    mode,
    status: 'active',
    ppapId,
    documentType,
    conversationHistory: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  // Cache session
  sessionCache.set(sessionId, copilotSession);
  
  console.log('[CopilotSessionManager] Session created:', sessionId);
  
  return copilotSession;
}

/**
 * Load an existing Copilot session
 * 
 * @param sessionId - Session ID to load
 * @returns CopilotSession
 */
export async function loadCopilotSession(sessionId: string): Promise<CopilotSession> {
  console.log('[CopilotSessionManager] Loading session:', sessionId);
  
  // Check cache first
  const cachedSession = sessionCache.get(sessionId);
  if (cachedSession) {
    console.log('[CopilotSessionManager] Session loaded from cache');
    return cachedSession;
  }
  
  // Load from database
  const sessions = await loadSessions();
  const storedSession = sessions.find(s => s.id === sessionId);
  if (!storedSession) {
    throw new Error(`Session not found: ${sessionId}`);
  }
  
  // For now, we'll reconstruct a minimal CopilotSession from StoredSession
  // In a full implementation, we'd store CopilotSession data in the database
  const copilotSession: CopilotSession = {
    sessionId: storedSession.id,
    mode: storedSession.ppapId ? 'ppap-bound' : 'standalone',
    status: 'active',
    ppapId: storedSession.ppapId || undefined,
    documentType: 'unknown', // Would be stored in database in full implementation
    conversationHistory: [],
    createdAt: storedSession.createdAt || new Date().toISOString(),
    updatedAt: storedSession.updatedAt || new Date().toISOString()
  };
  
  // Cache session
  sessionCache.set(sessionId, copilotSession);
  
  console.log('[CopilotSessionManager] Session loaded from database');
  
  return copilotSession;
}

/**
 * Add a user message to conversation history
 * 
 * @param sessionId - Session ID
 * @param message - User message text
 */
export async function addUserMessage(
  sessionId: string,
  message: string
): Promise<void> {
  console.log('[CopilotSessionManager] Adding user message to session:', sessionId);
  
  const session = await loadCopilotSession(sessionId);
  
  const userMessage: ConversationMessage = {
    role: 'user',
    content: message,
    timestamp: new Date().toISOString()
  };
  
  session.conversationHistory.push(userMessage);
  session.updatedAt = new Date().toISOString();
  
  // Update cache
  sessionCache.set(sessionId, session);
  
  console.log('[CopilotSessionManager] User message added');
}

/**
 * Add a Claude response to conversation history
 * 
 * @param sessionId - Session ID
 * @param response - CopilotDraft from Claude
 */
export async function addClaudeResponse(
  sessionId: string,
  response: CopilotDraft
): Promise<void> {
  console.log('[CopilotSessionManager] Adding Claude response to session:', sessionId);
  
  const session = await loadCopilotSession(sessionId);
  
  // Determine response content based on type
  let content: string;
  if (response.type === 'draft' && response.documentData) {
    content = JSON.stringify(response.documentData.fields);
  } else if (response.type === 'question' && response.question) {
    content = response.question.text;
  } else if (response.type === 'error' && response.error) {
    content = `Error: ${response.error.message}`;
  } else {
    content = 'Unknown response';
  }
  
  const assistantMessage: ConversationMessage = {
    role: 'assistant',
    content,
    timestamp: new Date().toISOString()
  };
  
  session.conversationHistory.push(assistantMessage);
  session.updatedAt = new Date().toISOString();
  
  // Update current draft if this is a draft response
  if (response.type === 'draft') {
    session.currentDraft = response;
  }
  
  // Update status based on response type
  if (response.type === 'question') {
    session.status = 'awaiting-user';
  } else if (response.type === 'error') {
    session.status = 'error';
  } else if (response.type === 'draft') {
    session.status = 'completed';
  }
  
  // Update cache
  sessionCache.set(sessionId, session);
  
  console.log('[CopilotSessionManager] Claude response added, status:', session.status);
}

/**
 * Finalize a session (mark as completed)
 * 
 * @param sessionId - Session ID
 * @param draft - Final CopilotDraft
 */
export async function finalizeSession(
  sessionId: string,
  draft: CopilotDraft
): Promise<void> {
  console.log('[CopilotSessionManager] Finalizing session:', sessionId);
  
  const session = await loadCopilotSession(sessionId);
  
  session.status = 'completed';
  session.currentDraft = draft;
  session.completedAt = new Date().toISOString();
  session.updatedAt = new Date().toISOString();
  
  // Update cache
  sessionCache.set(sessionId, session);
  
  console.log('[CopilotSessionManager] Session finalized');
}

/**
 * Get conversation history for a session
 * 
 * @param sessionId - Session ID
 * @returns Array of conversation messages
 */
export async function getConversationHistory(
  sessionId: string
): Promise<ConversationMessage[]> {
  console.log('[CopilotSessionManager] Getting conversation history for session:', sessionId);
  
  const session = await loadCopilotSession(sessionId);
  
  return session.conversationHistory;
}

/**
 * Get current session status
 * 
 * @param sessionId - Session ID
 * @returns Session status
 */
export async function getSessionStatus(
  sessionId: string
): Promise<CopilotSessionStatus> {
  const session = await loadCopilotSession(sessionId);
  return session.status;
}

/**
 * Clear session cache (useful for testing)
 */
export function clearSessionCache(): void {
  sessionCache.clear();
  console.log('[CopilotSessionManager] Session cache cleared');
}
