import { useMemo } from 'react';
import type { CrossSourceValidationResult } from '@/src/utils/revisionCrossValidator';
import type { SKUReadinessResult } from '@/src/utils/skuReadinessEvaluator';

type Severity = 'info' | 'warning' | 'danger';

type ActionType =
  | 'VIEW_REVISION_DETAILS'
  | 'OPEN_SKU'
  | 'OPEN_VAULT'
  | 'MANUAL_REVIEW'
  | 'UPLOAD_DOCUMENT'
  | 'OPEN_CORRECTION_WIZARD';

export interface RecommendedFixAction {
  id: string;
  label: string;
  description: string;
  actionType: ActionType;
  href?: string;
  disabled?: boolean;
  severity: Severity;
}

interface CorrectionInput {
  partNumber?: string | null;
  readiness?: SKUReadinessResult | null;
  revisionValidation?: CrossSourceValidationResult | null;
}

function buildHref(actionType: ActionType, partNumber?: string | null): string | undefined {
  if (!partNumber) return undefined;
  const encoded = encodeURIComponent(partNumber.trim().toUpperCase());
  switch (actionType) {
    case 'OPEN_SKU':
      return `/sku/${encoded}`;
    case 'OPEN_VAULT':
      return `/vault?sku=${encoded}`;
    default:
      return undefined;
  }
}

function mapRevisionStatusToActions(input: CorrectionInput): RecommendedFixAction[] {
  const { revisionValidation, partNumber } = input;
  if (!revisionValidation) return [];

  const base: RecommendedFixAction = {
    id: 'view-revision-details',
    label: 'Review revision details',
    description: 'Inspect canonical vs. source revisions and underlying signals.',
    actionType: 'VIEW_REVISION_DETAILS',
    severity: 'info',
  };

  if (revisionValidation.status === 'SYNCHRONIZED') {
    return [base];
  }

  if (revisionValidation.status === 'OUT_OF_SYNC') {
    return [
      {
        id: 'review-out-of-sync',
        label: 'Review out-of-sync revisions',
        description: revisionValidation.recommended_action,
        actionType: 'OPEN_SKU',
        href: buildHref('OPEN_SKU', partNumber),
        severity: 'warning',
      },
      base,
    ];
  }

  if (revisionValidation.status === 'CONFLICT') {
    return [
      {
        id: 'resolve-revision-conflict',
        label: 'Resolve revision conflict',
        description: revisionValidation.recommended_action,
        actionType: 'MANUAL_REVIEW',
        href: buildHref('OPEN_SKU', partNumber),
        severity: 'danger',
      },
      base,
    ];
  }

  if (revisionValidation.status === 'INCOMPLETE') {
    return [
      {
        id: 'review-missing-documents',
        label: 'Review missing revision sources',
        description: revisionValidation.recommended_action,
        actionType: 'OPEN_VAULT',
        href: buildHref('OPEN_VAULT', partNumber),
        severity: 'danger',
      },
      base,
    ];
  }

  if (revisionValidation.status === 'INCOMPARABLE') {
    return [
      {
        id: 'normalize-revision-formats',
        label: 'Review incomparable revisions',
        description: revisionValidation.recommended_action,
        actionType: 'MANUAL_REVIEW',
        href: buildHref('OPEN_SKU', partNumber),
        severity: 'danger',
      },
      base,
    ];
  }

  return [base];
}

function mapReadinessToActions(input: CorrectionInput): RecommendedFixAction[] {
  const { readiness, partNumber } = input;
  if (!readiness) return [];

  const actions: RecommendedFixAction[] = [];
  const addAction = (id: string, label: string, description: string, actionType: ActionType, severity: Severity) => {
    actions.push({
      id,
      label,
      description,
      actionType,
      href: buildHref(actionType, partNumber),
      severity,
    });
  };

  if (readiness.work_instructions.status === 'BLOCKED') {
    addAction(
      'resolve-work-instructions-blocker',
      'Resolve work instructions blocker',
      readiness.work_instructions.recommended_action,
      'OPEN_SKU',
      'warning',
    );
  }

  if (readiness.traveler_package.status === 'BLOCKED') {
    addAction(
      'fix-traveler-blocker',
      'Resolve traveler package blocker',
      readiness.traveler_package.recommended_action,
      'OPEN_SKU',
      'danger',
    );
  }

  if (readiness.komax_cut_sheet.status === 'BLOCKED') {
    addAction(
      'fix-komax-blocker',
      'Resolve Komax/cut-sheet blocker',
      readiness.komax_cut_sheet.recommended_action,
      'OPEN_SKU',
      'danger',
    );
  }

  if (readiness.overall_status === 'BLOCKED' && actions.length === 0) {
    addAction(
      'review-overall-readiness',
      'Review readiness blockers',
      readiness.work_instructions.recommended_action || 'Review SKU readiness status for detailed blockers.',
      'OPEN_SKU',
      'danger',
    );
  }

  if (readiness.overall_status !== 'READY' && actions.length === 0) {
    addAction(
      'review-readiness-warnings',
      'Review readiness warnings',
      readiness.work_instructions.recommended_action,
      'OPEN_SKU',
      'warning',
    );
  }

  return actions;
}

export function useRecommendedFixActions(input: CorrectionInput): RecommendedFixAction[] {
  return useMemo(() => {
    const revisionActions = mapRevisionStatusToActions(input);
    const readinessActions = mapReadinessToActions(input);

    const deduped = new Map<string, RecommendedFixAction>();
    [...revisionActions, ...readinessActions].forEach(action => {
      if (!deduped.has(action.id)) {
        deduped.set(action.id, action);
      }
    });

    return Array.from(deduped.values());
  }, [input.partNumber, input.readiness, input.revisionValidation]);
}
