/**
 * Phase 24: Document Version Control and Audit Trail
 * Phase 35: Persistent Mapping Metadata
 * V3.2F-2 Batch 2: AI Provenance Tracking
 * 
 * Service for managing document versions, history, and immutable approved versions.
 * Phase 35: Stores mapping metadata for audit trail and historical debugging.
 * V3.2F-2: Stores AI provenance metadata for Claude-generated documents.
 */

import { supabase } from '@/src/lib/supabaseClient';
import { DocumentDraft, TemplateId } from '../templates/types';
import { DocumentMetadata } from './sessionService';
import { MappingMetadata } from '../templates/templateMappingService';
import { CopilotDraft } from '../types/copilotTypes';

/**
 * AI Provenance Metadata (V3.2F-2)
 * Tracks which AI model generated the document and token usage
 */
export type AIProvenance = {
  promptTemplateId: string;    // Which prompt template was used
  modelUsed: string;           // 'claude-sonnet-4-20250514'
  inputTokens: number;         // Token count from Claude API
  outputTokens: number;        // Token count from Claude API
  totalTokens: number;         // Input + Output
  copilotSessionId?: string;   // Links version to Copilot session
  confidence: 'high' | 'medium' | 'low';  // AI confidence in output
  uncertainFields: string[];   // Fields flagged as uncertain
  assumptions: string[];       // Assumptions made during generation
};

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
  mappingMetadata?: MappingMetadata;  // Phase 35: Mapping provenance for audit trail
  aiProvenance?: AIProvenance;         // V3.2F-2: AI provenance for Claude-generated documents
};

/**
 * Create a new version of a document
 * Phase 35: Stores mapping metadata for audit trail
 * Called when:
 * - Document is first generated
 * - Document is re-generated
 * - Document is approved
 */
export async function createVersion(
  documentId: string,
  sessionId: string,
  templateId: TemplateId,
  documentData: DocumentDraft,
  editableData: DocumentDraft,
  metadata: DocumentMetadata,
  createdBy: string | null,
  mappingMetadata?: MappingMetadata  // Phase 35: Optional mapping metadata
): Promise<DocumentVersion | null> {
  try {
    console.log('[VersionService] Creating version for document:', { documentId, templateId });
    
    // Get next version number
    const { data: versionNumberData, error: versionError } = await supabase
      .rpc('get_next_version_number', { doc_id: documentId });
    
    if (versionError) {
      console.error('[VersionService] Failed to get next version number:', versionError);
      return null;
    }
    
    const versionNumber = versionNumberData as number;
    
    // Create version record
    const { data: version, error: insertError } = await supabase
      .from('ppap_document_versions')
      .insert({
        document_id: documentId,
        session_id: sessionId,
        template_id: templateId,
        version_number: versionNumber,
        document_data: documentData,
        editable_data: editableData,
        metadata: metadata,
        created_by: createdBy,
        is_approved: metadata.status === 'approved',
        mapping_metadata: mappingMetadata || null,  // Phase 35: Store mapping metadata
        ai_provenance: null,  // V3.2F-2: Will be set by createAIVersion for AI-generated docs
      })
      .select()
      .single();
    
    if (insertError) {
      console.error('[VersionService] Failed to create version:', insertError);
      return null;
    }
    
    console.log('[VersionService] Created version:', versionNumber, 'for document:', documentId);
    
    return {
      id: version.id,
      documentId: version.document_id,
      sessionId: version.session_id,
      templateId: version.template_id as TemplateId,
      versionNumber: version.version_number,
      documentData: version.document_data as DocumentDraft,
      editableData: version.editable_data as DocumentDraft,
      metadata: version.metadata as DocumentMetadata,
      createdBy: version.created_by,
      createdAt: version.created_at,
      isApproved: version.is_approved,
      mappingMetadata: version.mapping_metadata as MappingMetadata | undefined,  // Phase 35
      aiProvenance: version.ai_provenance as AIProvenance | undefined,  // V3.2F-2
    };
  } catch (err) {
    console.error('[VersionService] Unexpected error creating version:', err);
    return null;
  }
}

/**
 * Get all versions for a document
 * Returns versions in descending order (newest first)
 */
export async function getVersions(documentId: string): Promise<DocumentVersion[]> {
  try {
    const { data, error } = await supabase
      .from('ppap_document_versions')
      .select('*')
      .eq('document_id', documentId)
      .order('version_number', { ascending: false });
    
    if (error) {
      console.error('[VersionService] Failed to get versions:', error);
      return [];
    }
    
    if (!data) return [];
    
    return data.map(v => ({
      id: v.id,
      documentId: v.document_id,
      sessionId: v.session_id,
      templateId: v.template_id as TemplateId,
      versionNumber: v.version_number,
      documentData: v.document_data as DocumentDraft,
      editableData: v.editable_data as DocumentDraft,
      metadata: v.metadata as DocumentMetadata,
      createdBy: v.created_by,
      createdAt: v.created_at,
      isApproved: v.is_approved,
      mappingMetadata: v.mapping_metadata as MappingMetadata | undefined,  // Phase 35
      aiProvenance: v.ai_provenance as AIProvenance | undefined,  // V3.2F-2
    }));
  } catch (err) {
    console.error('[VersionService] Unexpected error getting versions:', err);
    return [];
  }
}

/**
 * Get the latest version of a document
 */
export async function getLatestVersion(documentId: string): Promise<DocumentVersion | null> {
  try {
    const { data, error } = await supabase
      .from('ppap_document_versions')
      .select('*')
      .eq('document_id', documentId)
      .order('version_number', { ascending: false })
      .limit(1)
      .single();
    
    if (error) {
      console.error('[VersionService] Failed to get latest version:', error);
      return null;
    }
    
    if (!data) return null;
    
    return {
      id: data.id,
      documentId: data.document_id,
      sessionId: data.session_id,
      templateId: data.template_id as TemplateId,
      versionNumber: data.version_number,
      documentData: data.document_data as DocumentDraft,
      editableData: data.editable_data as DocumentDraft,
      metadata: data.metadata as DocumentMetadata,
      createdBy: data.created_by,
      createdAt: data.created_at,
      isApproved: data.is_approved,
      mappingMetadata: data.mapping_metadata as MappingMetadata | undefined,  // Phase 35
      aiProvenance: data.ai_provenance as AIProvenance | undefined,  // V3.2F-2
    };
  } catch (err) {
    console.error('[VersionService] Unexpected error getting latest version:', err);
    return null;
  }
}

/**
 * Get a specific version by version number
 */
export async function getVersionByNumber(
  documentId: string,
  versionNumber: number
): Promise<DocumentVersion | null> {
  try {
    const { data, error } = await supabase
      .from('ppap_document_versions')
      .select('*')
      .eq('document_id', documentId)
      .eq('version_number', versionNumber)
      .single();
    
    if (error) {
      console.error('[VersionService] Failed to get version:', error);
      return null;
    }
    
    if (!data) return null;
    
    return {
      id: data.id,
      documentId: data.document_id,
      sessionId: data.session_id,
      templateId: data.template_id as TemplateId,
      versionNumber: data.version_number,
      documentData: data.document_data as DocumentDraft,
      editableData: data.editable_data as DocumentDraft,
      metadata: data.metadata as DocumentMetadata,
      createdBy: data.created_by,
      createdAt: data.created_at,
      isApproved: data.is_approved,
      mappingMetadata: data.mapping_metadata as MappingMetadata | undefined,  // Phase 35
      aiProvenance: data.ai_provenance as AIProvenance | undefined,  // V3.2F-2
    };
  } catch (err) {
    console.error('[VersionService] Unexpected error getting version by number:', err);
    return null;
  }
}

/**
 * Check if a document has an approved version
 */
export async function hasApprovedVersion(documentId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('ppap_document_versions')
      .select('id')
      .eq('document_id', documentId)
      .eq('is_approved', true)
      .limit(1);
    
    if (error) {
      console.error('[VersionService] Failed to check approved version:', error);
      return false;
    }
    
    return data !== null && data.length > 0;
  } catch (err) {
    console.error('[VersionService] Unexpected error checking approved version:', err);
    return false;
  }
}

/**
 * Generate a unique document ID for a template within a session
 * Used to link multiple versions of the same logical document
 */
export function generateDocumentId(sessionId: string, templateId: TemplateId): string {
  return `${sessionId}-${templateId}`;
}

/**
 * V3.2F-2 Batch 2: Create AI-generated version with provenance metadata
 * 
 * Creates a document version for AI-generated documents with full provenance tracking.
 * Records which Claude model was used, token usage, confidence, and uncertain fields.
 * 
 * @param copilotSessionId - Copilot session ID
 * @param draft - CopilotDraft from Claude API
 * @param promptTemplateId - Which prompt template was used
 * @param createdBy - User ID who initiated generation
 * @returns DocumentVersion with AI provenance metadata
 */
export async function createAIVersion(
  copilotSessionId: string,
  draft: CopilotDraft,
  promptTemplateId: string,
  createdBy: string | null
): Promise<DocumentVersion | null> {
  if (draft.type !== 'draft' || !draft.documentData) {
    console.error('[VersionService] Cannot create AI version: draft type is not "draft"');
    return null;
  }

  try {
    const documentId = generateDocumentId(copilotSessionId, promptTemplateId as TemplateId);
    
    console.log('[VersionService] Creating AI version for document:', {
      documentId,
      promptTemplateId,
      model: draft.metadata.model,
      tokens: draft.metadata.tokenCount.total
    });
    
    // Get next version number
    const { data: versionNumberData, error: versionError } = await supabase
      .rpc('get_next_version_number', { doc_id: documentId });
    
    if (versionError) {
      console.error('[VersionService] Failed to get next version number:', versionError);
      return null;
    }
    
    const versionNumber = versionNumberData as number;
    
    // Build AI provenance metadata
    const aiProvenance: AIProvenance = {
      promptTemplateId,
      modelUsed: draft.metadata.model,
      inputTokens: draft.metadata.tokenCount.input,
      outputTokens: draft.metadata.tokenCount.output,
      totalTokens: draft.metadata.tokenCount.total,
      copilotSessionId,
      confidence: draft.metadata.confidence,
      uncertainFields: draft.metadata.uncertainFields,
      assumptions: draft.metadata.assumptions
    };
    
    // Build document metadata
    const metadata: DocumentMetadata = {
      ownerId: createdBy || 'system',
      status: 'draft'
    };
    
    // Create version record with AI provenance
    const { data: version, error: insertError } = await supabase
      .from('ppap_document_versions')
      .insert({
        document_id: documentId,
        session_id: copilotSessionId,
        template_id: promptTemplateId,
        version_number: versionNumber,
        document_data: draft.documentData,
        editable_data: draft.documentData,  // Initially same as document_data
        metadata: metadata,
        created_by: createdBy,
        is_approved: false,  // AI-generated documents are never auto-approved
        ai_provenance: aiProvenance,  // V3.2F-2: Store AI provenance
        mapping_metadata: null  // No mapping metadata for AI-generated docs
      })
      .select()
      .single();
    
    if (insertError) {
      console.error('[VersionService] Failed to create AI version:', insertError);
      return null;
    }
    
    console.log('[VersionService] Created AI version:', versionNumber, 'for document:', documentId);
    console.log('[VersionService] AI provenance recorded:', {
      model: aiProvenance.modelUsed,
      tokens: aiProvenance.totalTokens,
      confidence: aiProvenance.confidence,
      uncertainFields: aiProvenance.uncertainFields.length
    });
    
    return {
      id: version.id,
      documentId: version.document_id,
      sessionId: version.session_id,
      templateId: version.template_id as TemplateId,
      versionNumber: version.version_number,
      documentData: version.document_data as DocumentDraft,
      editableData: version.editable_data as DocumentDraft,
      metadata: version.metadata as DocumentMetadata,
      createdBy: version.created_by,
      createdAt: version.created_at,
      isApproved: version.is_approved,
      mappingMetadata: version.mapping_metadata as MappingMetadata | undefined,
      aiProvenance: version.ai_provenance as AIProvenance
    };
  } catch (err) {
    console.error('[VersionService] Unexpected error creating AI version:', err);
    return null;
  }
}
