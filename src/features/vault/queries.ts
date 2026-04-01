import { supabase } from '@/src/lib/supabaseClient';
import { checkFileExists as vaultCheckFileExists } from './services/vaultService';
import type { FileMetadata } from './types';

export async function getFileMetadata(fileId: string): Promise<FileMetadata | null> {
  const { data, error } = await supabase
    .from('ppap_documents')
    .select('*')
    .eq('id', fileId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    fileName: data.document_name || data.file_name || 'unknown',
    fileSize: data.file_size_bytes || 0,
    mimeType: data.mime_type || 'application/octet-stream',
    uploadedAt: data.uploaded_at || new Date().toISOString(),
    uploadedBy: data.uploaded_by || 'unknown',
    url: data.file_url || data.storage_path || '',
    version: data.version || 1,
  };
}

export async function checkFileExists(fileId: string): Promise<boolean> {
  return vaultCheckFileExists(fileId);
}

export async function listFilesByContext(
  ownerId: string,
  ownerType: string
): Promise<FileMetadata[]> {
  const { data, error } = await supabase
    .from('ppap_documents')
    .select('*')
    .eq('ppap_id', ownerId)
    .is('deleted_at', null);

  if (error || !data) {
    return [];
  }

  return data.map((file) => ({
    id: file.id,
    fileName: file.document_name || file.file_name || 'unknown',
    fileSize: file.file_size_bytes || 0,
    mimeType: file.mime_type || 'application/octet-stream',
    uploadedAt: file.uploaded_at || new Date().toISOString(),
    uploadedBy: file.uploaded_by || 'unknown',
    url: file.file_url || file.storage_path || '',
    version: file.version || 1,
  }));
}
