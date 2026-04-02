/**
 * Phase 22: Backend Persistence for Document Engine
 * Phase 24: Document Version Control and Audit Trail
 * 
 * Abstraction layer for session and document persistence.
 * Replaces localStorage with Supabase database storage.
 */

import { supabase } from '@/src/lib/supabaseClient';
import { NormalizedBOM } from '../types/bomTypes';
import { DocumentDraft, TemplateId } from '../templates/types';
import { ValidationResult } from '../validation/types';

export type DocumentStatus = 'draft' | 'in_review' | 'approved';

export type DocumentMetadata = {
  ownerId: string;          // User ID of document owner
  ownerName?: string;       // Display name (cached for backward compat)
  status: DocumentStatus;
  approvedBy?: string;      // User ID of approver
  approvedByName?: string;  // Display name of approver (cached)
  approvedAt?: number;      // Timestamp of approval
};

// Phase 24: Document Version
export type DocumentVersion = {
  id: string;
  documentId: string;       // Logical document ID (consistent across versions)
  sessionId: string;
  templateId: TemplateId;
  versionNumber: number;
  documentData: DocumentDraft;
  editableData: DocumentDraft;
  metadata: DocumentMetadata;
  createdBy: string | null;
  createdAt: string;
  isApproved: boolean;
};

export type PPAPSession = {
  bomData: NormalizedBOM | null;
  documents: Record<string, DocumentDraft>;
  editableDocuments: Record<string, DocumentDraft>;
  validationResults: Record<string, ValidationResult>;
  documentTimestamps: Record<string, number>;
  documentMeta: Record<string, DocumentMetadata>;
  activeStep: TemplateId | null;
  selectedTemplateSet?: string[];  // Phase 30: Custom template IDs assigned to this session
  customerId?: string;  // Phase 31: Customer ID for template assignment
};

export type StoredSession = {
  id: string;
  name: string;
  ppapId?: string | null;
  createdBy?: string | null;  // User ID of session creator (Phase 23)
  data: PPAPSession;
  createdAt?: string;
  updatedAt?: string;
};

/**
 * Create a new session in the database
 * Phase 23: Added createdBy parameter for user ownership
 */
export async function createSession(
  name: string,
  ppapId?: string | null,
  createdBy?: string | null,
  customerId?: string
): Promise<StoredSession | null> {
  try {
    console.log('[SessionService] Creating new session:', { name, ppapId, createdBy, customerId });
    
    // Create session record
    const { data: sessionRecord, error: sessionError } = await supabase
      .from('ppap_document_sessions')
      .insert({
        name,
        ppap_id: ppapId || null,
        created_by: createdBy && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(createdBy) ? createdBy : null,
      })
      .select()
      .single();

    if (sessionError) {
      console.error('[SessionService] Failed to create session:', sessionError);
      return null;
    }

    // Create session state record
    const emptyData = {
      bomData: null,
      documents: {},
      editableDocuments: {},
      validationResults: {},
      documentTimestamps: {},
      documentMeta: {},
      activeStep: null,
      customerId: customerId
    };

    const { error: stateError } = await supabase
      .from('ppap_session_state')
      .insert({
        session_id: sessionRecord.id,
        bom_data: emptyData.bomData,
        active_step: emptyData.activeStep,
      });

    if (stateError) {
      console.error('[SessionService] Failed to create session state:', stateError);
      // Rollback: delete session
      await supabase.from('ppap_document_sessions').delete().eq('id', sessionRecord.id);
      return null;
    }

    console.log('[SessionService] Session created successfully:', sessionRecord.id);

    return {
      id: sessionRecord.id,
      name: sessionRecord.name,
      ppapId: sessionRecord.ppap_id,
      data: emptyData,
      createdAt: sessionRecord.created_at,
      updatedAt: sessionRecord.updated_at,
    };
  } catch (err) {
    console.error('[SessionService] Unexpected error creating session:', err);
    return null;
  }
}

/**
 * Load all sessions (optionally filtered by ppapId)
 */
export async function loadSessions(ppapId?: string | null): Promise<StoredSession[]> {
  try {
    console.log('[SessionService] Loading sessions', ppapId ? `for PPAP ${ppapId}` : '(all)');

    // Build query
    let query = supabase
      .from('ppap_document_sessions')
      .select('*')
      .order('updated_at', { ascending: false });

    if (ppapId) {
      query = query.eq('ppap_id', ppapId);
    }

    const { data: sessions, error: sessionsError } = await query;

    if (sessionsError) {
      console.error('[SessionService] Failed to load sessions:', sessionsError);
      return [];
    }

    if (!sessions || sessions.length === 0) {
      console.log('[SessionService] No sessions found');
      return [];
    }

    // Load session data for each session
    const sessionsWithData = await Promise.all(
      sessions.map(async (session) => {
        const sessionData = await loadSessionById(session.id);
        return sessionData;
      })
    );

    // Filter out null results (failed loads)
    const validSessions = sessionsWithData.filter((s): s is StoredSession => s !== null);

    console.log(`[SessionService] Loaded ${validSessions.length} sessions`);
    return validSessions;
  } catch (err) {
    console.error('[SessionService] Unexpected error loading sessions:', err);
    return [];
  }
}

/**
 * Load a specific session by ID
 */
export async function loadSessionById(sessionId: string): Promise<StoredSession | null> {
  try {
    console.log('[SessionService] Loading session:', sessionId);

    // Load session record
    const { data: session, error: sessionError } = await supabase
      .from('ppap_document_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError) {
      console.error('[SessionService] Failed to load session:', sessionError);
      return null;
    }

    // Load session state
    const { data: state, error: stateError } = await supabase
      .from('ppap_session_state')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    if (stateError) {
      console.error('[SessionService] Failed to load session state:', stateError);
      return null;
    }

    // Load generated documents
    const { data: documents, error: docsError } = await supabase
      .from('ppap_generated_documents')
      .select('*')
      .eq('session_id', sessionId);

    if (docsError) {
      console.error('[SessionService] Failed to load documents:', docsError);
      return null;
    }

    // Reconstruct session data
    const sessionData: PPAPSession = {
      bomData: state.bom_data as NormalizedBOM | null,
      activeStep: state.active_step as TemplateId | null,
      documents: {},
      editableDocuments: {},
      validationResults: {},
      documentTimestamps: {},
      documentMeta: {},
    };

    // Populate documents
    if (documents) {
      for (const doc of documents) {
        sessionData.documents[doc.template_id] = doc.document_data as DocumentDraft;
        sessionData.editableDocuments[doc.template_id] = doc.editable_data as DocumentDraft;
        
        if (doc.validation_results) {
          sessionData.validationResults[doc.template_id] = doc.validation_results as ValidationResult;
        }
        
        if (doc.metadata) {
          sessionData.documentMeta[doc.template_id] = doc.metadata as DocumentMetadata;
        }
        
        if (doc.timestamps) {
          const timestamps = doc.timestamps as Record<string, number>;
          if (timestamps[doc.template_id]) {
            sessionData.documentTimestamps[doc.template_id] = timestamps[doc.template_id];
          }
        }
      }
    }

    console.log('[SessionService] Session loaded successfully');

    return {
      id: session.id,
      name: session.name,
      ppapId: session.ppap_id,
      data: sessionData,
      createdAt: session.created_at,
      updatedAt: session.updated_at,
    };
  } catch (err) {
    console.error('[SessionService] Unexpected error loading session:', err);
    return null;
  }
}

/**
 * Save session data (upsert pattern)
 */
export async function saveSession(session: StoredSession): Promise<boolean> {
  try {
    console.log('[SessionService] Saving session:', session.id);

    // Update session metadata
    const { error: sessionError } = await supabase
      .from('ppap_document_sessions')
      .update({
        name: session.name,
        ppap_id: session.ppapId || null,
      })
      .eq('id', session.id);

    if (sessionError) {
      console.error('[SessionService] Failed to update session:', sessionError);
      return false;
    }

    // Update session state
    const { error: stateError } = await supabase
      .from('ppap_session_state')
      .upsert({
        session_id: session.id,
        bom_data: session.data.bomData,
        active_step: session.data.activeStep,
      });

    if (stateError) {
      console.error('[SessionService] Failed to update session state:', stateError);
      return false;
    }

    // Save/update documents
    const documentUpdates = Object.keys(session.data.documents).map((templateId) => {
      const timestamps: Record<string, number> = {};
      if (session.data.documentTimestamps[templateId]) {
        timestamps[templateId] = session.data.documentTimestamps[templateId];
      }

      return {
        session_id: session.id,
        template_id: templateId,
        document_data: session.data.documents[templateId],
        editable_data: session.data.editableDocuments[templateId],
        validation_results: session.data.validationResults[templateId] || null,
        metadata: session.data.documentMeta[templateId] || null,
        timestamps,
      };
    });

    if (documentUpdates.length > 0) {
      const { error: docsError } = await supabase
        .from('ppap_generated_documents')
        .upsert(documentUpdates, {
          onConflict: 'session_id,template_id',
        });

      if (docsError) {
        console.error('[SessionService] Failed to save documents:', docsError);
        return false;
      }
    }

    console.log('[SessionService] Session saved successfully');
    return true;
  } catch (err) {
    console.error('[SessionService] Unexpected error saving session:', err);
    return false;
  }
}

/**
 * Delete a session
 */
export async function deleteSession(sessionId: string): Promise<boolean> {
  try {
    console.log('[SessionService] Deleting session:', sessionId);

    // Cascade delete handled by database constraints
    const { error } = await supabase
      .from('ppap_document_sessions')
      .delete()
      .eq('id', sessionId);

    if (error) {
      console.error('[SessionService] Failed to delete session:', error);
      return false;
    }

    console.log('[SessionService] Session deleted successfully');
    return true;
  } catch (err) {
    console.error('[SessionService] Unexpected error deleting session:', err);
    return false;
  }
}

/**
 * Migrate localStorage sessions to database (one-time migration)
 */
export async function migrateLocalStorageSessions(): Promise<number> {
  try {
    const STORAGE_KEY = 'emip_ppap_sessions_v1';
    const LEGACY_STORAGE_KEY = 'emip_ppap_session_v1';
    
    console.log('[SessionService] Checking for localStorage sessions to migrate');

    let sessionsToMigrate: StoredSession[] = [];

    // Check for multi-session storage
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const sessions = JSON.parse(raw) as StoredSession[];
      sessionsToMigrate = sessions;
      console.log(`[SessionService] Found ${sessions.length} sessions in localStorage`);
    }

    // Check for legacy single-session storage
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw && sessionsToMigrate.length === 0) {
      console.log('[SessionService] Found legacy single-session storage');
      const legacySession = JSON.parse(legacyRaw) as PPAPSession;
      sessionsToMigrate = [{
        id: crypto.randomUUID(),
        name: 'Migrated Session',
        data: legacySession,
      }];
    }

    if (sessionsToMigrate.length === 0) {
      console.log('[SessionService] No localStorage sessions to migrate');
      return 0;
    }

    // Migrate each session
    let migratedCount = 0;
    for (const session of sessionsToMigrate) {
      const newSession = await createSession(
        session.name,
        session.ppapId || null,
        session.createdBy || null
      );
      
      if (!newSession) {
        console.error(`[SessionService] Failed to create session for migration: ${session.name}`);
        continue;
      }
      
      // Save full session data
      const saved = await saveSession({ ...session, id: newSession.id });
      if (saved) {
        migratedCount++;
        console.log(`[SessionService] Migrated session: ${session.name}`);
      }
    }

    // Clear localStorage after successful migration
    if (migratedCount === sessionsToMigrate.length) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      console.log('[SessionService] localStorage cleared after successful migration');
    }

    console.log(`[SessionService] Migration complete: ${migratedCount}/${sessionsToMigrate.length} sessions migrated`);
    return migratedCount;
  } catch (err) {
    console.error('[SessionService] Unexpected error during migration:', err);
    return 0;
  }
}
