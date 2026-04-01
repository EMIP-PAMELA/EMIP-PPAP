import { storeFile } from '@/src/features/vault/mutations';
import { retrieveFileUrl } from '@/src/features/vault/services/vaultService';
import type { FileReference } from '@/src/features/vault/types';

export async function uploadPPAPDocument(
  file: File,
  ppapId: string,
  uploadedBy: string = 'system'
): Promise<FileReference> {
  const fileRef = await storeFile(file, uploadedBy, {
    ownerId: ppapId,
    ownerType: 'PPAP',
  });

  return fileRef;
}

export async function downloadPPAPDocument(filePath: string): Promise<string> {
  return retrieveFileUrl(filePath);
}
