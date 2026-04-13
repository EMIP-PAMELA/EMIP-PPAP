/**
 * Canonical Document Resolution — Phase 3H.27
 *
 * Determines the authority status of each document relative to the SKU's
 * canonical revision and expected drawing set.
 *
 * Resolution rules (applied in strict order):
 * 1. UNLINKED  — no sku_id
 * 2. PENDING   — sku starts with 'PENDING-'
 * 3. CANONICAL — type matches canonical_source, revision matches canonical_revision, is_current
 * 4. MATCHING  — revision matches canonical_revision, different type, is_current
 * 5. OUTDATED  — revision_state = SUPERSEDED, OR comparison = LESS
 * 6. CONFLICT  — comparison = GREATER or INCOMPARABLE, OR is_current + canonical type + revision ≠ canonical
 * 7. UNKNOWN   — insufficient data
 *
 * Honesty guarantee: if canonical_revision is absent, only UNLINKED/PENDING/OUTDATED (via SUPERSEDED)
 * are assigned. No canonical/conflict/matching determination is made without evidence.
 */

import type { RevisionComparisonEntry } from '@/src/utils/revisionCrossValidator';

export type CanonicalDocumentStatus =
  | 'CANONICAL'
  | 'MATCHING'
  | 'OUTDATED'
  | 'CONFLICT'
  | 'UNLINKED'
  | 'PENDING'
  | 'UNKNOWN';

export const CANONICAL_STATUS_SORT_ORDER: Record<CanonicalDocumentStatus, number> = {
  CANONICAL: 0,
  MATCHING:  1,
  CONFLICT:  2,
  OUTDATED:  3,
  PENDING:   4,
  UNLINKED:  5,
  UNKNOWN:   6,
};

/** Maps the SKU-level canonical_source (AuthorityLabel) to document_type strings. */
const CANONICAL_SOURCE_TO_DOC_TYPE: Record<string, string> = {
  BOM:   'BOM',
  APOGEE: 'INTERNAL_DRAWING',
  RHEEM:  'CUSTOMER_DRAWING',
};

/** Maps document_type to the authority key used in comparisons. */
const DOC_TYPE_TO_AUTHORITY_KEY: Record<string, string> = {
  BOM:               'BOM',
  INTERNAL_DRAWING:  'APOGEE',
  CUSTOMER_DRAWING:  'RHEEM',
};

export interface CanonicalDocumentResolution {
  status: CanonicalDocumentStatus;
  reason: string;
  matchesExpectedRevision: boolean;
  matchesExpectedDrawing: boolean | null;
  isLinkedToSku: boolean;
  isCurrentBestCandidate: boolean;
}

export interface CanonicalDocumentContext {
  /** SKU-level canonical revision from revision_validation.canonical_revision. */
  skuCanonicalRevision: string | null;
  /** Authority source label (BOM / APOGEE / RHEEM) from revision_validation.canonical_source. */
  skuCanonicalSource: string | null;
  /** Per-source comparison results from revision_validation.comparisons. */
  comparisons: RevisionComparisonEntry[];
  /** Expected Apogee drawing number (from expected_drawings.apogee.drawing_number). */
  expectedApogeeDrawingNumber?: string | null;
}

export interface DocumentInput {
  id: string;
  sku_id: string | null;
  sku?: string | null;
  document_type: string;
  canonical_revision?: string | null;
  revision_state?: string | null;
  drawing_number?: string | null;
}

// ---------------------------------------------------------------------------
// Core resolution logic
// ---------------------------------------------------------------------------

export function resolveCanonicalDocument(
  doc: DocumentInput,
  context: CanonicalDocumentContext | null,
): CanonicalDocumentResolution {
  const isLinkedToSku = Boolean(doc.sku_id);
  const isProvisional = Boolean(doc.sku?.startsWith('PENDING-'));

  // Rule 1 — UNLINKED
  if (!isLinkedToSku) {
    return {
      status: 'UNLINKED',
      reason: 'Not linked to a resolved SKU yet',
      matchesExpectedRevision: false,
      matchesExpectedDrawing: null,
      isLinkedToSku: false,
      isCurrentBestCandidate: false,
    };
  }

  // Rule 2 — PENDING
  if (isProvisional) {
    return {
      status: 'PENDING',
      reason: 'Linked to a provisional SKU — awaiting part number resolution',
      matchesExpectedRevision: false,
      matchesExpectedDrawing: null,
      isLinkedToSku: true,
      isCurrentBestCandidate: false,
    };
  }

  // No canonical context available — use structural state only (never guess canonical)
  if (!context || !context.skuCanonicalRevision) {
    if (doc.revision_state === 'SUPERSEDED') {
      return {
        status: 'OUTDATED',
        reason: 'Superseded by a newer document of the same type',
        matchesExpectedRevision: false,
        matchesExpectedDrawing: null,
        isLinkedToSku: true,
        isCurrentBestCandidate: false,
      };
    }
    return {
      status: 'UNKNOWN',
      reason: 'Expected revision unavailable — cannot determine document authority',
      matchesExpectedRevision: false,
      matchesExpectedDrawing: null,
      isLinkedToSku: true,
      isCurrentBestCandidate: doc.revision_state === 'CURRENT',
    };
  }

  const docRev    = doc.canonical_revision?.toUpperCase() ?? null;
  const canonRev  = context.skuCanonicalRevision.toUpperCase();
  const matchesRevision = Boolean(docRev && docRev === canonRev);

  // Expected drawing match (only meaningful for INTERNAL_DRAWING)
  let matchesExpectedDrawing: boolean | null = null;
  if (doc.document_type === 'INTERNAL_DRAWING' && context.expectedApogeeDrawingNumber) {
    matchesExpectedDrawing =
      (doc.drawing_number?.toUpperCase() ?? null) === context.expectedApogeeDrawingNumber.toUpperCase();
  }

  const authorityKey   = DOC_TYPE_TO_AUTHORITY_KEY[doc.document_type] ?? null;
  const comparison     = authorityKey
    ? (context.comparisons.find(c => c.source === authorityKey)?.comparison ?? null)
    : null;

  const canonicalDocType = context.skuCanonicalSource
    ? (CANONICAL_SOURCE_TO_DOC_TYPE[context.skuCanonicalSource] ?? null)
    : null;
  const isCanonicalType = canonicalDocType === doc.document_type;
  const isCurrent       = doc.revision_state === 'CURRENT';

  // Rule 3 — CANONICAL
  if (isCanonicalType && matchesRevision && isCurrent) {
    const drawingNote =
      matchesExpectedDrawing === false ? ' (drawing number mismatch)' :
      matchesExpectedDrawing === true  ? ' · expected drawing confirmed' : '';
    return {
      status: 'CANONICAL',
      reason: `Canonical source for revision ${context.skuCanonicalRevision}${drawingNote}`,
      matchesExpectedRevision: true,
      matchesExpectedDrawing,
      isLinkedToSku: true,
      isCurrentBestCandidate: true,
    };
  }

  // SUPERSEDED takes priority over comparison-based rules (structural, unambiguous)
  if (doc.revision_state === 'SUPERSEDED') {
    return {
      status: 'OUTDATED',
      reason: 'Superseded — a newer document of the same type has been uploaded',
      matchesExpectedRevision: matchesRevision,
      matchesExpectedDrawing,
      isLinkedToSku: true,
      isCurrentBestCandidate: false,
    };
  }

  // Rule 4 — MATCHING
  if (!isCanonicalType && matchesRevision && isCurrent) {
    return {
      status: 'MATCHING',
      reason: `Matches canonical revision ${context.skuCanonicalRevision}`,
      matchesExpectedRevision: true,
      matchesExpectedDrawing,
      isLinkedToSku: true,
      isCurrentBestCandidate: false,
    };
  }

  // Rule 6 (CONFLICT via comparison — GREATER)
  if (comparison === 'GREATER') {
    return {
      status: 'CONFLICT',
      reason: `Revision ${docRev ?? '—'} is ahead of canonical ${context.skuCanonicalRevision}`,
      matchesExpectedRevision: false,
      matchesExpectedDrawing,
      isLinkedToSku: true,
      isCurrentBestCandidate: false,
    };
  }

  // Rule 6 (CONFLICT via comparison — INCOMPARABLE)
  if (comparison === 'INCOMPARABLE') {
    return {
      status: 'CONFLICT',
      reason: `Revision ${docRev ?? '—'} is incomparable with canonical ${context.skuCanonicalRevision}`,
      matchesExpectedRevision: false,
      matchesExpectedDrawing,
      isLinkedToSku: true,
      isCurrentBestCandidate: false,
    };
  }

  // Rule 5 — OUTDATED (comparison LESS)
  if (comparison === 'LESS') {
    return {
      status: 'OUTDATED',
      reason: `Revision ${docRev ?? '—'} is older than canonical ${context.skuCanonicalRevision}`,
      matchesExpectedRevision: false,
      matchesExpectedDrawing,
      isLinkedToSku: true,
      isCurrentBestCandidate: false,
    };
  }

  // Rule 6 (CONFLICT — canonical type, current, but revision disagreement)
  if (isCanonicalType && !matchesRevision && isCurrent) {
    return {
      status: 'CONFLICT',
      reason: `Expected revision ${context.skuCanonicalRevision} from ${context.skuCanonicalSource ?? '?'}, document has ${docRev ?? 'no revision'}`,
      matchesExpectedRevision: false,
      matchesExpectedDrawing,
      isLinkedToSku: true,
      isCurrentBestCandidate: false,
    };
  }

  // Rule 7 — UNKNOWN
  return {
    status: 'UNKNOWN',
    reason: 'Insufficient data to determine document authority',
    matchesExpectedRevision: matchesRevision,
    matchesExpectedDrawing,
    isLinkedToSku: true,
    isCurrentBestCandidate: false,
  };
}

// ---------------------------------------------------------------------------
// Batch helpers
// ---------------------------------------------------------------------------

export function resolveCanonicalDocuments<T extends DocumentInput>(
  documents: T[],
  context: CanonicalDocumentContext | null,
): Array<{ doc: T; resolution: CanonicalDocumentResolution }> {
  return documents.map(doc => ({
    doc,
    resolution: resolveCanonicalDocument(doc, context),
  }));
}

/**
 * Sort a resolved list: CANONICAL first, then MATCHING, CONFLICT, OUTDATED,
 * PENDING, UNLINKED, UNKNOWN. Within each tier, most recently uploaded first.
 */
export function sortByCanonicalStatus<T extends DocumentInput>(
  resolved: Array<{ doc: T; resolution: CanonicalDocumentResolution }>,
): Array<{ doc: T; resolution: CanonicalDocumentResolution }> {
  return [...resolved].sort((a, b) => {
    const statusDiff =
      CANONICAL_STATUS_SORT_ORDER[a.resolution.status] -
      CANONICAL_STATUS_SORT_ORDER[b.resolution.status];
    if (statusDiff !== 0) return statusDiff;
    const aDate = (a.doc as Record<string, unknown>).uploaded_at as string ?? '';
    const bDate = (b.doc as Record<string, unknown>).uploaded_at as string ?? '';
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });
}

/**
 * Generate a human-readable summary sentence for the SKU-level document authority state.
 * Returns null when no meaningful sentence can be produced honestly.
 */
export function summarizeCanonicalResolution(
  resolutions: CanonicalDocumentResolution[],
  context: CanonicalDocumentContext | null,
): string | null {
  if (resolutions.length === 0) return null;

  const allUnresolved = resolutions.every(r => r.status === 'UNLINKED' || r.status === 'PENDING');
  if (!context?.skuCanonicalRevision) {
    if (allUnresolved) return 'No documents linked to a resolved SKU yet';
    return 'Expected revision unavailable — cannot determine document authority';
  }

  const canonical = resolutions.filter(r => r.status === 'CANONICAL');
  const conflicts  = resolutions.filter(r => r.status === 'CONFLICT');
  const outdated   = resolutions.filter(r => r.status === 'OUTDATED');

  if (conflicts.length > 0) {
    return `${conflicts.length} conflicting revision${conflicts.length > 1 ? 's' : ''} detected — review required`;
  }
  if (canonical.length > 0) {
    const extra = outdated.length > 0
      ? ` · ${outdated.length} older version${outdated.length > 1 ? 's' : ''} present`
      : '';
    return `${canonical.length} canonical document${canonical.length > 1 ? 's' : ''} found for revision ${context.skuCanonicalRevision}${extra}`;
  }
  return `No uploaded document matches expected revision ${context.skuCanonicalRevision}`;
}
