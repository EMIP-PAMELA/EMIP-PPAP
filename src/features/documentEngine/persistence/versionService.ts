/**
 * Phase 24: Document Version Control and Audit Trail
 * 
 * Service for managing document versions, history, and immutable approved versions.
 */

import { supabase } from '@/src/lib/supabaseClient';
import { DocumentDraft, TemplateId } from '../templates/types';
import { DocumentMetadata } from './sessionService';

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

/**
 * Create a new version of a document
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
  createdBy: string | null
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
