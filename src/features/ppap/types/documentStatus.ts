/**
 * V3.3A.3: Document Status Tracking
 * 
 * Defines status tracking for documents in the Documentation Phase.
 * Each document can be: not_started, in_progress, or complete.
 */

import { DocumentMode } from '../config/documentRegistry';

export type DocumentStatus = 'not_started' | 'in_progress' | 'complete';

export interface DocumentExecutionState {
  documentId: string;
  status: DocumentStatus;
  /** Timestamp when status last changed */
  lastUpdated?: string;
  /** File path if uploaded */
  filePath?: string;
  /** File name if uploaded */
  fileName?: string;
}

export interface DocumentCardData {
  documentId: string;
  name: string;
  mode: DocumentMode;
  owner: string;
  required: boolean;
  status: DocumentStatus;
  filePath?: string;
  fileName?: string;
}

/**
 * Determine if a document is actionable based on its mode
 */
export function isActionableDocument(mode: DocumentMode): boolean {
  return mode === 'generated' || mode === 'assisted';
}

/**
 * Get action label based on document mode
 */
export function getActionLabel(mode: DocumentMode): string {
  switch (mode) {
    case 'generated':
      return 'Generate with AI';
    case 'assisted':
      return 'Open Workspace';
    case 'static':
      return 'Upload File';
    case 'na':
      return 'N/A';
  }
}

/**
 * Check if all required actionable documents are complete
 */
export function areRequiredDocumentsComplete(documents: DocumentCardData[]): boolean {
  const requiredActionable = documents.filter(
    d => d.required && isActionableDocument(d.mode)
  );
  
  return requiredActionable.every(d => d.status === 'complete');
}
