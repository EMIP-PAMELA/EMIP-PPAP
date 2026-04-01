import { storeFile as vaultStoreFile, deleteFile as vaultDeleteFile } from './services/vaultService';
import type { FileReference, DeleteFileResponse } from './types';

export async function storeFile(
  file: File,
  uploadedBy: string,
  context?: { ownerId?: string; ownerType?: string }
): Promise<FileReference> {
  return vaultStoreFile(file, uploadedBy, context);
}

export async function deleteFile(
  fileId: string,
  deletedBy: string
): Promise<DeleteFileResponse> {
  return vaultDeleteFile(fileId, deletedBy);
}
