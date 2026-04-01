import { supabase } from '@/src/lib/supabaseClient';
import type { FileReference, FileMetadata, DeleteFileResponse } from '../types';

export async function storeFile(
  file: File,
  uploadedBy: string,
  context?: { ownerId?: string; ownerType?: string }
): Promise<FileReference> {
  const timestamp = Date.now();
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const fileId = crypto.randomUUID();
  
  const filePath = `vault/${year}/${month}/${fileId}-${file.name}`;

  const { data, error } = await supabase.storage
    .from('ppap-documents')
    .upload(filePath, file);

  if (error) {
    throw new Error(`Failed to store file: ${error.message}`);
  }

  const { data: urlData } = supabase.storage
    .from('ppap-documents')
    .getPublicUrl(filePath);

  const fileReference: FileReference = {
    id: fileId,
    url: urlData.publicUrl,
    metadata: {
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || 'application/octet-stream',
      uploadedAt: new Date().toISOString(),
      uploadedBy,
    },
  };

  console.log('[Vault] File stored:', {
    fileId,
    fileName: file.name,
    context,
  });

  return fileReference;
}

export async function retrieveFileUrl(filePath: string): Promise<string> {
  const { data } = supabase.storage
    .from('ppap-documents')
    .getPublicUrl(filePath);

  return data.publicUrl;
}

export async function checkFileExists(fileId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('ppap_documents')
    .select('id')
    .eq('id', fileId)
    .maybeSingle();

  if (error) {
    console.error('[Vault] Error checking file existence:', error);
    return false;
  }

  return data !== null;
}

export async function deleteFile(
  fileId: string,
  deletedBy: string
): Promise<DeleteFileResponse> {
  const { data: fileData, error: fetchError } = await supabase
    .from('ppap_documents')
    .select('storage_path')
    .eq('id', fileId)
    .single();

  if (fetchError || !fileData) {
    throw new Error(`File not found: ${fileId}`);
  }

  const { error: storageError } = await supabase.storage
    .from('ppap-documents')
    .remove([fileData.storage_path]);

  if (storageError) {
    throw new Error(`Failed to delete file from storage: ${storageError.message}`);
  }

  const deletedAt = new Date().toISOString();

  const { error: dbError } = await supabase
    .from('ppap_documents')
    .update({ deleted_at: deletedAt })
    .eq('id', fileId);

  if (dbError) {
    throw new Error(`Failed to mark file as deleted: ${dbError.message}`);
  }

  console.log('[Vault] File deleted:', {
    fileId,
    deletedBy,
    deletedAt,
  });

  return {
    success: true,
    deletedAt,
  };
}
