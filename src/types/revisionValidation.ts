import type { RevisionComparisonResult } from '@/src/utils/revisionComparator';

export type RevisionValidationSource = 'BOM' | 'RHEEM' | 'APOGEE' | 'GENERIC' | 'UNKNOWN';

export interface RevisionValidationAuditMetadata {
  /** Revision detected from the uploaded artifact at validation time. */
  uploaded_revision?: string | null;
  /** Canonical revision the uploader expected to match; null when unknown. */
  expected_revision?: string | null;
  /** Result of comparing uploaded vs expected revision (EQUAL/LESS/GREATER/INCOMPARABLE/UNKNOWN). */
  revision_comparison?: RevisionComparisonResult | null;
  /** Which extraction path produced the uploaded revision snapshot (BOM/RHEEM/APOGEE/GENERIC/UNKNOWN). */
  revision_validation_source?: RevisionValidationSource | null;
  /** True when the user explicitly overrode a blocking validation warning. */
  revision_override_used?: boolean | null;
  /** UTC timestamp when the validation metadata was captured. */
  revision_validated_at?: string | null;
}
