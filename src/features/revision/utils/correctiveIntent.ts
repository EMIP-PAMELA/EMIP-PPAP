import type { ActionIntent } from '@/src/features/revision/hooks/useRecommendedFixActions';

export type CorrectiveIssueKind = 'missing' | 'conflict' | 'readiness' | 'incomparable' | 'diff';

export const ACTION_INTENTS: ActionIntent[] = [
  'VIEW_REVISION',
  'FIX_OUT_OF_SYNC',
  'RESOLVE_CONFLICT',
  'UPLOAD_MISSING_DOC',
  'REVIEW_INCOMPARABLE',
  'REVIEW_READINESS',
];

export function parseActionIntentParam(value?: string | null): ActionIntent | null {
  if (!value) return null;
  const upper = value.trim().toUpperCase();
  return ACTION_INTENTS.includes(upper as ActionIntent) ? (upper as ActionIntent) : null;
}

export function deriveIssueKind(intent: ActionIntent | null): CorrectiveIssueKind | undefined {
  switch (intent) {
    case 'UPLOAD_MISSING_DOC':
      return 'missing';
    case 'RESOLVE_CONFLICT':
      return 'conflict';
    case 'FIX_OUT_OF_SYNC':
      return 'diff';
    case 'REVIEW_INCOMPARABLE':
      return 'incomparable';
    case 'REVIEW_READINESS':
      return 'readiness';
    default:
      return undefined;
  }
}
