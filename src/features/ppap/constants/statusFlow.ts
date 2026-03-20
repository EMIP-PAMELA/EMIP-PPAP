export const PPAP_STATUSES = [
  'NEW',
  'PRE_ACK_IN_PROGRESS',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
] as const;

export type PPAPStatusType = typeof PPAP_STATUSES[number];

export const STATUS_TRANSITIONS: Record<string, string[]> = {
  NEW: ['PRE_ACK_IN_PROGRESS'],
  PRE_ACK_IN_PROGRESS: ['SUBMITTED'],
  SUBMITTED: ['APPROVED', 'REJECTED'],
  REJECTED: ['PRE_ACK_IN_PROGRESS'],
  APPROVED: [],
};

export const STATUS_LABELS: Record<string, string> = {
  NEW: 'New',
  PRE_ACK_IN_PROGRESS: 'Pre-Ack In Progress',
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};
