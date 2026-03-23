import { PPAPStatus } from '@/src/types/database.types';

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// Safe text rendering helper - prevents React #418 errors from rendering objects
export function safeText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

export function isOverdue(dueDate: string, status: PPAPStatus): boolean {
  if (status === 'APPROVED' || status === 'CLOSED') {
    return false;
  }
  
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return due < today;
}

export function getDaysUntilDue(dueDate: string): number {
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

export function getAgingBucket(daysInStatus: number): string {
  if (daysInStatus <= 7) return 'Normal';
  if (daysInStatus <= 14) return 'Attention';
  if (daysInStatus <= 30) return 'At Risk';
  return 'Critical';
}
