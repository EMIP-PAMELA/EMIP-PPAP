// Workspace/Vault Domain Types
// V3.2B Contract Definitions (as specified in BUILD_PLAN.md V3.2E-1 Section 5)

// Contract 1: Store File (Request Contract)
export interface StoreFileRequest {
  file: File;
  context?: {
    ownerId?: string;
    ownerType?: string;
  };
}

export interface FileReference {
  id: string;
  url: string;
  metadata: {
    fileName: string;
    fileSize: number;
    mimeType: string;
    uploadedAt: string;
    uploadedBy: string;
  };
}

// Contract 2: Retrieve File (Read Contract)
export interface GetFileRequest {
  fileId: string;
}

export interface FileMetadata {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
  uploadedBy: string;
  url: string;
  version: number;
}

// Contract 3: Delete File (Request Contract)
export interface DeleteFileRequest {
  fileId: string;
  deletedBy: string;
}

export interface DeleteFileResponse {
  success: boolean;
  deletedAt: string;
}

// Contract 4: File Storage Events (Event Contract)
export interface FileUploadedEvent {
  eventType: 'FILE_UPLOADED';
  fileId: string;
  fileName: string;
  uploadedBy: string;
  uploadedAt: string;
  context?: { ownerId?: string; ownerType?: string };
}

export interface FileDeletedEvent {
  eventType: 'FILE_DELETED';
  fileId: string;
  deletedBy: string;
  deletedAt: string;
}

export interface FileReplacedEvent {
  eventType: 'FILE_REPLACED';
  fileId: string;
  oldVersion: number;
  newVersion: number;
  replacedBy: string;
  replacedAt: string;
}

export type VaultEvent = FileUploadedEvent | FileDeletedEvent | FileReplacedEvent;
