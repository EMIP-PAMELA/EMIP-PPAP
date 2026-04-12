import { useMemo } from 'react';
import type { CrossSourceRevisionStatus, CrossSourceValidationResult } from '@/src/utils/revisionCrossValidator';
import type { SKUReadinessResult } from '@/src/utils/skuReadinessEvaluator';

/**
 * Corrective routing contract (consumed by SKU + Vault pages):
 *
 * SKU page query params
 * - tab: section to scroll (revision|readiness)
 * - focus: revision focus (diff|conflict|review)
 * - highlight: section highlight key (revision|readiness)
 * - expectedRevision: canonical revision users should target
 * - source: canonical source that produced the expectedRevision
 * - actionIntent: ActionIntent enum informing helper banners + panel pre-expansion
 *
 * Vault page query params
 * - part / sku: SKU to preselect in filters & uploader
 * - issue: missing|conflict for contextual callouts
 * - docType: BOM|CUSTOMER_DRAWING|INTERNAL_DRAWING (or friendly alias) to preselect filters
 * - sources: comma-delimited revision sources powering issue callouts
 * - expectedRevision: canonical revision expected for uploads/corrections
 * - actionIntent: ActionIntent enum powering uploader auto-open + helper banner
 */

type VaultDocumentType = 'BOM' | 'CUSTOMER_DRAWING' | 'INTERNAL_DRAWING';

const SOURCE_TO_DOC_TYPE: Record<string, VaultDocumentType> = {
  BOM: 'BOM',
  APOGEE: 'INTERNAL_DRAWING',
  RHEEM: 'CUSTOMER_DRAWING',
};

type Severity = 'info' | 'warning' | 'danger';

export type ActionIntent =
  | 'VIEW_REVISION'
  | 'FIX_OUT_OF_SYNC'
  | 'RESOLVE_CONFLICT'
  | 'UPLOAD_MISSING_DOC'
  | 'REVIEW_INCOMPARABLE'
  | 'REVIEW_READINESS';

type ActionDestination =
  | 'VIEW_REVISION_DETAILS'
  | 'OPEN_SKU'
  | 'OPEN_VAULT'
  | 'MANUAL_REVIEW'
  | 'UPLOAD_DOCUMENT';

export interface RecommendedFixAction {
  id: string;
  label: string;
  description: string;
  actionType: ActionDestination;
  href?: string;
  disabled?: boolean;
  severity: Severity;
  intent: ActionIntent;
  context?: {
    partNumber?: string | null;
    revisionStatus?: CrossSourceRevisionStatus;
    canonicalRevision?: string | null;
    canonicalSource?: string | null;
    missingSources?: string[];
    conflictSources?: string[];
    documentType?: VaultDocumentType;
  };
}

interface CorrectionInput {
  partNumber?: string | null;
  readiness?: SKUReadinessResult | null;
  revisionValidation?: CrossSourceValidationResult | null;
}

interface SkuRouteOptions {
  tab?: string;
  focus?: string;
  highlight?: string;
  anchor?: string;
  expectedRevision?: string | null;
  actionIntent?: ActionIntent;
  source?: string | null;
}

interface VaultRouteOptions {
  issue?: 'missing' | 'conflict';
  sources?: string[];
  docType?: VaultDocumentType;
  expectedRevision?: string | null;
  actionIntent?: ActionIntent;
  canonicalSource?: string | null;
}

function buildSkuRoute(partNumber?: string | null, options?: SkuRouteOptions): string | undefined {
  if (!partNumber) return undefined;
  const encoded = encodeURIComponent(partNumber.trim().toUpperCase());
  const params = new URLSearchParams();
  if (options?.tab) params.set('tab', options.tab);
  if (options?.focus) params.set('focus', options.focus);
  if (options?.highlight) params.set('highlight', options.highlight);
  if (options?.expectedRevision) params.set('expectedRevision', options.expectedRevision);
  if (options?.actionIntent) params.set('actionIntent', options.actionIntent);
  if (options?.source) params.set('source', options.source);
  const query = params.toString();
  const anchor = options?.anchor ? `#${options.anchor}` : '';
  return `/sku/${encoded}${query ? `?${query}` : ''}${anchor}`;
}

function buildVaultRoute(partNumber?: string | null, options?: VaultRouteOptions): string | undefined {
  if (!partNumber) return undefined;
  const params = new URLSearchParams();
  const normalized = partNumber.trim().toUpperCase();
  params.set('sku', normalized);
  params.set('part', normalized);
  if (options?.issue) params.set('issue', options.issue);
  if (options?.sources?.length) params.set('sources', options.sources.join(','));
  if (options?.docType) params.set('docType', options.docType);
  if (options?.expectedRevision) params.set('expectedRevision', options.expectedRevision);
  if (options?.actionIntent) params.set('actionIntent', options.actionIntent);
  if (options?.canonicalSource) params.set('source', options.canonicalSource);
  return `/vault?${params.toString()}`;
}

function deriveDocumentType(source?: string | null): VaultDocumentType | undefined {
  if (!source) return undefined;
  return SOURCE_TO_DOC_TYPE[source] ?? undefined;
}

function mapRevisionStatusToActions(input: CorrectionInput): RecommendedFixAction[] {
  const { revisionValidation, partNumber } = input;
  if (!revisionValidation) return [];

  const comparisons = revisionValidation.comparisons ?? [];
  const missingSources = comparisons
    .filter(entry => entry.comparison === 'MISSING')
    .map(entry => entry.source)
    .filter(Boolean);
  const conflictSources = comparisons
    .filter(entry => entry.comparison === 'GREATER' || entry.comparison === 'LESS')
    .map(entry => entry.source)
    .filter(Boolean);

  const base: RecommendedFixAction = {
    id: 'view-revision-details',
    label: 'Review revision details',
    description: 'Inspect canonical vs. source revisions and underlying signals.',
    actionType: 'VIEW_REVISION_DETAILS',
    severity: 'info',
    intent: 'VIEW_REVISION',
    href: buildSkuRoute(partNumber, {
      tab: 'revision',
      highlight: 'revision',
      anchor: 'revision-summary',
      expectedRevision: revisionValidation.canonical_revision,
      actionIntent: 'VIEW_REVISION',
      source: revisionValidation.canonical_source,
    }),
    context: {
      partNumber,
      revisionStatus: revisionValidation.status,
      canonicalRevision: revisionValidation.canonical_revision,
      canonicalSource: revisionValidation.canonical_source,
    },
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
        severity: 'warning',
        intent: 'FIX_OUT_OF_SYNC',
        href: buildSkuRoute(partNumber, {
          tab: 'revision',
          focus: 'diff',
          highlight: 'revision',
          anchor: 'revision-summary',
          expectedRevision: revisionValidation.canonical_revision,
          actionIntent: 'FIX_OUT_OF_SYNC',
          source: revisionValidation.canonical_source,
        }),
        context: {
          partNumber,
          revisionStatus: revisionValidation.status,
          canonicalRevision: revisionValidation.canonical_revision,
          canonicalSource: revisionValidation.canonical_source,
          conflictSources,
        },
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
        severity: 'danger',
        intent: 'RESOLVE_CONFLICT',
        href: buildSkuRoute(partNumber, {
          tab: 'revision',
          focus: 'conflict',
          highlight: 'revision',
          anchor: 'revision-summary',
          expectedRevision: revisionValidation.canonical_revision,
          actionIntent: 'RESOLVE_CONFLICT',
          source: revisionValidation.canonical_source,
        }),
        context: {
          partNumber,
          revisionStatus: revisionValidation.status,
          canonicalRevision: revisionValidation.canonical_revision,
          canonicalSource: revisionValidation.canonical_source,
          conflictSources,
        },
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
        href: buildVaultRoute(partNumber, {
          issue: 'missing',
          sources: missingSources,
          docType: deriveDocumentType(missingSources[0]),
          expectedRevision: revisionValidation.canonical_revision,
          actionIntent: 'UPLOAD_MISSING_DOC',
          canonicalSource: revisionValidation.canonical_source,
        }),
        severity: 'danger',
        intent: 'UPLOAD_MISSING_DOC',
        context: {
          partNumber,
          revisionStatus: revisionValidation.status,
          canonicalRevision: revisionValidation.canonical_revision,
          canonicalSource: revisionValidation.canonical_source,
          missingSources,
          documentType: deriveDocumentType(missingSources[0]),
        },
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
        href: buildSkuRoute(partNumber, {
          tab: 'revision',
          focus: 'review',
          highlight: 'revision',
          anchor: 'revision-summary',
          expectedRevision: revisionValidation.canonical_revision,
          actionIntent: 'REVIEW_INCOMPARABLE',
          source: revisionValidation.canonical_source,
        }),
        severity: 'danger',
        intent: 'REVIEW_INCOMPARABLE',
        context: {
          partNumber,
          revisionStatus: revisionValidation.status,
          canonicalRevision: revisionValidation.canonical_revision,
          canonicalSource: revisionValidation.canonical_source,
        },
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
  const addAction = (
    id: string,
    label: string,
    description: string,
    severity: Severity,
    intent: ActionIntent,
  ) => {
    actions.push({
      id,
      label,
      description,
      actionType: 'OPEN_SKU',
      href: buildSkuRoute(partNumber, {
        tab: 'readiness',
        highlight: 'readiness',
        anchor: 'sku-readiness',
        actionIntent: intent,
      }),
      severity,
      intent,
      context: {
        partNumber,
      },
    });
  };

  if (readiness.work_instructions.status === 'BLOCKED') {
    addAction(
      'resolve-work-instructions-blocker',
      'Resolve work instructions blocker',
      readiness.work_instructions.recommended_action,
      'warning',
      'REVIEW_READINESS',
    );
  }

  if (readiness.traveler_package.status === 'BLOCKED') {
    addAction(
      'fix-traveler-blocker',
      'Resolve traveler package blocker',
      readiness.traveler_package.recommended_action,
      'danger',
      'REVIEW_READINESS',
    );
  }

  if (readiness.komax_cut_sheet.status === 'BLOCKED') {
    addAction(
      'fix-komax-blocker',
      'Resolve Komax/cut-sheet blocker',
      readiness.komax_cut_sheet.recommended_action,
      'danger',
      'REVIEW_READINESS',
    );
  }

  if (readiness.overall_status === 'BLOCKED' && actions.length === 0) {
    addAction(
      'review-overall-readiness',
      'Review readiness blockers',
      readiness.work_instructions.recommended_action || 'Review SKU readiness status for detailed blockers.',
      'danger',
      'REVIEW_READINESS',
    );
  }

  if (readiness.overall_status !== 'READY' && actions.length === 0) {
    addAction(
      'review-readiness-warnings',
      'Review readiness warnings',
      readiness.work_instructions.recommended_action,
      'warning',
      'REVIEW_READINESS',
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
