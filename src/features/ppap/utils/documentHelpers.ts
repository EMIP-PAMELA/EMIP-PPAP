/**
 * Phase 3H.5: Document Progress Helpers
 * 
 * Utilities for calculating document completion and health status
 */

import { PPAPRecord } from '@/src/types/database.types';

// All REQUIRED documents (from DocumentationForm DOCUMENT_CONFIG)
const REQUIRED_DOCUMENTS = [
  'ballooned_drawing',
  'design_record',
  'dimensional_results',
  'dfmea',
  'pfmea',
  'control_plan',
  'msa',
  'material_test_results',
  'initial_process_studies'
];

export interface DocumentProgress {
  complete: number;
  total: number;
  percentage: number;
}

export type HealthStatus = 'GREEN' | 'YELLOW' | 'RED';

/**
 * Calculate document progress for a PPAP
 * Based on REQUIRED documents only
 */
export function calculateDocumentProgress(ppap: PPAPRecord): DocumentProgress {
  // In Phase 3H.5, we're working with existing data
  // Document tracking will be implemented when we add document table
  // For now, return mock data that will be replaced with real queries
  
  const total = REQUIRED_DOCUMENTS.length;
  
  // TODO Phase 3I: Query actual document records from ppap_documents table
  // For now, estimate based on status
  let complete = 0;
  
  if (ppap.status === 'POST_ACK_IN_PROGRESS') {
    complete = Math.floor(total * 0.3); // Assume 30% for in-progress
  } else if (ppap.status === 'AWAITING_SUBMISSION') {
    complete = total; // All docs ready
  } else if (ppap.status === 'SUBMITTED') {
    complete = total;
  }
  
  const percentage = Math.round((complete / total) * 100);
  
  return { complete, total, percentage };
}

/**
 * Determine health status badge
 * Logic:
 * - RED: Missing required docs AND in late stage
 * - YELLOW: In progress
 * - GREEN: All required complete
 */
export function getHealthStatus(ppap: PPAPRecord, progress: DocumentProgress): HealthStatus {
  // All docs complete
  if (progress.complete === progress.total) {
    return 'GREEN';
  }
  
  // Missing docs in late stages (post-ack or later)
  const lateStages = ['POST_ACK_IN_PROGRESS', 'AWAITING_SUBMISSION', 'SUBMITTED'];
  if (lateStages.includes(ppap.status) && progress.complete < progress.total) {
    return 'RED';
  }
  
  // In progress
  return 'YELLOW';
}

/**
 * Get health badge styling
 */
export function getHealthBadgeStyle(health: HealthStatus): string {
  switch (health) {
    case 'GREEN':
      return 'bg-green-100 text-green-800 border-green-300';
    case 'YELLOW':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'RED':
      return 'bg-red-100 text-red-800 border-red-300';
  }
}

/**
 * Get health badge icon
 */
export function getHealthBadgeIcon(health: HealthStatus): string {
  switch (health) {
    case 'GREEN':
      return '🟢';
    case 'YELLOW':
      return '🟡';
    case 'RED':
      return '🔴';
  }
}

/**
 * Get status clarity tag
 * User-friendly status labels
 */
export function getStatusClarityTag(status: string): string {
  const statusMap: Record<string, string> = {
    'NEW': 'New Request',
    'PRE_ACK_ASSIGNED': 'Under Review',
    'PRE_ACK_IN_PROGRESS': 'In Validation',
    'READY_TO_ACKNOWLEDGE': 'Awaiting Acknowledgement',
    'POST_ACK_IN_PROGRESS': 'Building Package',
    'AWAITING_SUBMISSION': 'Ready for Submission',
    'SUBMITTED': 'Submitted',
    'APPROVED': 'Approved',
    'CLOSED': 'Closed'
  };
  
  return statusMap[status] || status;
}

/**
 * Phase 3H.13.5: Unified balloon drawing system
 * ONE entry point for all balloon drawing actions
 * Ensures consistency across DocumentationForm and PPAPControlPanel
 */
export function openBalloonTool(ppapId: string): void {
  window.location.href = `/tools/balloon-drawing?ppapId=${ppapId}`;
}
