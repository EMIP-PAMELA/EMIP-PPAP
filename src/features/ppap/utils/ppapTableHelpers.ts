import { PPAPStatus, PPAPRecord } from '@/src/types/database.types';

/**
 * Phase 2B Table Dashboard Helpers
 * 
 * Utility functions for deriving table data from PPAPRecord fields.
 * Uses corrected state mapping with operational visibility preservation.
 */

export function mapStatusToState(status: PPAPStatus): string {
  const stateMap: Record<PPAPStatus, string> = {
    'NEW': 'INITIATED',
    'INTAKE_COMPLETE': 'INTAKE_COMPLETE',
    'PRE_ACK_ASSIGNED': 'INITIATED',
    'PRE_ACK_IN_PROGRESS': 'IN_PROGRESS',
    'READY_TO_ACKNOWLEDGE': 'READY_FOR_ACKNOWLEDGEMENT',
    'ACKNOWLEDGED': 'ACKNOWLEDGED',
    'POST_ACK_ASSIGNED': 'POST_ACK_ASSIGNED',
    'POST_ACK_IN_PROGRESS': 'IN_VALIDATION',
    'AWAITING_SUBMISSION': 'READY_FOR_SUBMISSION',
    'SUBMITTED': 'SUBMITTED',
    'APPROVED': 'ACCEPTED',
    'ON_HOLD': 'ON_HOLD',
    'BLOCKED': 'BLOCKED',
    'CLOSED': 'COMPLETE',
  };
  
  return stateMap[status] || 'INITIATED';
}

export function derivePhase(status: PPAPStatus): 'Pre-Ack' | 'Post-Ack' | 'Final' {
  const preAckStatuses: PPAPStatus[] = [
    'NEW',
    'INTAKE_COMPLETE',
    'PRE_ACK_ASSIGNED',
    'PRE_ACK_IN_PROGRESS',
    'READY_TO_ACKNOWLEDGE',
  ];
  
  const postAckStatuses: PPAPStatus[] = [
    'ACKNOWLEDGED',
    'POST_ACK_ASSIGNED',
    'POST_ACK_IN_PROGRESS',
    'AWAITING_SUBMISSION',
  ];
  
  const finalStatuses: PPAPStatus[] = [
    'SUBMITTED',
    'APPROVED',
    'CLOSED',
  ];
  
  if (preAckStatuses.includes(status)) return 'Pre-Ack';
  if (postAckStatuses.includes(status)) return 'Post-Ack';
  if (finalStatuses.includes(status)) return 'Final';
  
  return 'Pre-Ack';
}

export function getAcknowledgementStatus(status: PPAPStatus): 'Pending' | 'Acknowledged' {
  const acknowledgedStatuses: PPAPStatus[] = [
    'ACKNOWLEDGED',
    'POST_ACK_ASSIGNED',
    'POST_ACK_IN_PROGRESS',
    'AWAITING_SUBMISSION',
    'SUBMITTED',
    'APPROVED',
    'CLOSED',
  ];
  
  return acknowledgedStatuses.includes(status) ? 'Acknowledged' : 'Pending';
}

export function getSubmissionStatus(status: PPAPStatus): 'Not Submitted' | 'Submitted' | 'Approved' {
  if (status === 'APPROVED' || status === 'CLOSED') return 'Approved';
  if (status === 'SUBMITTED') return 'Submitted';
  return 'Not Submitted';
}

export interface EnhancedPPAPRecord extends PPAPRecord {
  derivedState: string;
  derivedPhase: 'Pre-Ack' | 'Post-Ack' | 'Final';
  acknowledgementStatus: 'Pending' | 'Acknowledged';
  submissionStatus: 'Not Submitted' | 'Submitted' | 'Approved';
  coordinator: string;
  validationSummary: string;
}

export function enhancePPAPRecord(ppap: PPAPRecord): EnhancedPPAPRecord {
  return {
    ...ppap,
    derivedState: mapStatusToState(ppap.status),
    derivedPhase: derivePhase(ppap.status),
    acknowledgementStatus: getAcknowledgementStatus(ppap.status),
    submissionStatus: getSubmissionStatus(ppap.status),
    coordinator: '—',
    validationSummary: '—',
  };
}

export type SortField = 
  | 'ppap_number' 
  | 'part_number' 
  | 'customer_name' 
  | 'state' 
  | 'phase' 
  | 'assigned_to' 
  | 'plant' 
  | 'acknowledgement' 
  | 'submission' 
  | 'updated_at';

export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

const STATE_ORDER: string[] = [
  'INITIATED',
  'INTAKE_COMPLETE',
  'IN_PROGRESS',
  'IN_REVIEW',
  'READY_FOR_ACKNOWLEDGEMENT',
  'ACKNOWLEDGED',
  'POST_ACK_ASSIGNED',
  'IN_VALIDATION',
  'READY_FOR_SUBMISSION',
  'SUBMITTED',
  'ACCEPTED',
  'REJECTED',
  'COMPLETE',
  'BLOCKED',
  'ON_HOLD',
];

const PHASE_ORDER = ['Pre-Ack', 'Post-Ack', 'Final'];

const ACKNOWLEDGEMENT_ORDER = ['Pending', 'Acknowledged'];

const SUBMISSION_ORDER = ['Not Submitted', 'Submitted', 'Approved'];

export function sortPPAPs(
  ppaps: EnhancedPPAPRecord[], 
  config: SortConfig | null
): EnhancedPPAPRecord[] {
  if (!config) return ppaps;

  return [...ppaps].sort((a, b) => {
    const multiplier = config.direction === 'asc' ? 1 : -1;
    
    let compareResult = 0;
    
    switch (config.field) {
      case 'ppap_number':
        compareResult = a.ppap_number.localeCompare(b.ppap_number, undefined, { sensitivity: 'base' });
        break;
        
      case 'part_number':
        compareResult = a.part_number.localeCompare(b.part_number, undefined, { sensitivity: 'base' });
        break;
        
      case 'customer_name':
        compareResult = a.customer_name.localeCompare(b.customer_name, undefined, { sensitivity: 'base' });
        break;
        
      case 'state':
        const stateIndexA = STATE_ORDER.indexOf(a.derivedState);
        const stateIndexB = STATE_ORDER.indexOf(b.derivedState);
        compareResult = stateIndexA - stateIndexB;
        break;
        
      case 'phase':
        const phaseIndexA = PHASE_ORDER.indexOf(a.derivedPhase);
        const phaseIndexB = PHASE_ORDER.indexOf(b.derivedPhase);
        compareResult = phaseIndexA - phaseIndexB;
        break;
        
      case 'assigned_to':
        const assignedA = a.assigned_to || '';
        const assignedB = b.assigned_to || '';
        if (!assignedA && assignedB) return 1;
        if (assignedA && !assignedB) return -1;
        compareResult = assignedA.localeCompare(assignedB, undefined, { sensitivity: 'base' });
        break;
        
      case 'plant':
        compareResult = a.plant.localeCompare(b.plant, undefined, { sensitivity: 'base' });
        break;
        
      case 'acknowledgement':
        const ackIndexA = ACKNOWLEDGEMENT_ORDER.indexOf(a.acknowledgementStatus);
        const ackIndexB = ACKNOWLEDGEMENT_ORDER.indexOf(b.acknowledgementStatus);
        compareResult = ackIndexA - ackIndexB;
        break;
        
      case 'submission':
        const subIndexA = SUBMISSION_ORDER.indexOf(a.submissionStatus);
        const subIndexB = SUBMISSION_ORDER.indexOf(b.submissionStatus);
        compareResult = subIndexA - subIndexB;
        break;
        
      case 'updated_at':
        compareResult = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
        break;
        
      default:
        compareResult = 0;
    }
    
    return compareResult * multiplier;
  });
}
