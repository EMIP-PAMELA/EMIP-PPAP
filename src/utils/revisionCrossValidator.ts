import { compareRevisions, type RevisionComparisonResult } from '@/src/utils/revisionComparator';
import type { RevisionState } from '@/src/utils/revisionEvaluator';
import type { RevisionSource } from '@/src/utils/revisionParser';
import { selectCanonicalRevision } from '@/src/utils/revisionCanonical';

export type CrossSourceRevisionStatus =
  | 'SYNCHRONIZED'
  | 'OUT_OF_SYNC'
  | 'CONFLICT'
  | 'INCOMPLETE'
  | 'INCOMPARABLE';

type AuthorityLabel = 'BOM' | 'APOGEE' | 'RHEEM';

interface AuthorityConfig {
  label: AuthorityLabel;
  revisionSource: RevisionSource;
}

const AUTHORITIES: AuthorityConfig[] = [
  { label: 'BOM', revisionSource: 'HEADER_EXPLICIT' },
  { label: 'APOGEE', revisionSource: 'REVISION_BOX_APOGEE' },
  { label: 'RHEEM', revisionSource: 'TITLE_BLOCK_RHEEM' },
];

const CANONICAL_PRIORITY: AuthorityLabel[] = ['BOM', 'APOGEE', 'RHEEM'];

const STATUS_RECOMMENDATIONS: Record<string, string> = {
  SYNCHRONIZED: 'No action required — all sources share the canonical revision.',
  OUT_OF_SYNC_GENERAL: 'Align the non-canonical sources with the canonical revision.',
  OUT_OF_SYNC_DRAWINGS_BEHIND: 'Update drawings to match the BOM revision.',
  CONFLICT_BOM_BEHIND: 'Investigate whether the BOM is outdated or incorrect.',
  INCOMPLETE: 'Missing required documents — upload the outstanding sources.',
  INCOMPARABLE: 'Manual review required — normalize revision formats or correct metadata.',
};

export interface RevisionSourceSnapshot {
  document_id: string | null;
  document_type: string | null;
  revision: string | null;
  normalized_revision: string | null;
  revision_source: RevisionSource | null;
}

export interface RevisionComparisonEntry {
  source: AuthorityLabel;
  comparison: RevisionComparisonResult | 'CANONICAL' | 'MISSING' | 'NO_CANONICAL' | 'INCOMPARABLE';
}

export interface CrossSourceValidationResult {
  status: CrossSourceRevisionStatus;
  bom_revision: string | null;
  customer_revision: string | null;
  internal_revision: string | null;
  canonical_revision: string | null;
  canonical_source: AuthorityLabel | null;
  sources: Record<AuthorityLabel, RevisionSourceSnapshot>;
  comparisons: RevisionComparisonEntry[];
  signals_used: RevisionSource[];
  details: string[];
  recommended_action: string;
}

export interface RevisionDocumentInput {
  id?: string;
  document_type?: string | null;
  revision?: string | null;
  normalized_revision?: string | null;
  revision_state?: RevisionState;
  revision_source?: RevisionSource | null;
  uploaded_at?: string | null;
}

function normalizeValue(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.toUpperCase();
}

function pickLatestDocument(documents: RevisionDocumentInput[]): RevisionDocumentInput | null {
  if (documents.length === 0) return null;
  return documents.reduce<RevisionDocumentInput | null>((latest, current) => {
    if (!latest) return current;
    if (!latest.uploaded_at) return current;
    if (!current.uploaded_at) return latest;
    return current.uploaded_at > latest.uploaded_at ? current : latest;
  }, null);
}

function snapshotAuthority(
  documents: RevisionDocumentInput[],
  config: AuthorityConfig,
): RevisionSourceSnapshot {
  const currentDocs = documents.filter(doc => doc.revision_state === 'CURRENT');
  const matches = currentDocs.filter(doc => doc.revision_source === config.revisionSource);
  const selected = pickLatestDocument(matches);

  if (!selected) {
    return {
      document_id: null,
      document_type: null,
      revision: null,
      normalized_revision: null,
      revision_source: null,
    };
  }

  // Use selectCanonicalRevision to prevent sentinels (e.g. 'UNSPECIFIED') from leaking into
  // cross-source comparisons. canonical_revision takes precedence over raw revision.
  const revision = selectCanonicalRevision({
    normalizedRevision: selected.normalized_revision,
    rawRevision: selected.revision,
  });
  const normalized = selected.normalized_revision ?? normalizeValue(revision);

  return {
    document_id: selected.id ?? null,
    document_type: selected.document_type ?? null,
    revision,
    normalized_revision: normalized,
    revision_source: selected.revision_source ?? null,
  };
}

function determineCanonicalSource(
  snapshots: Record<AuthorityLabel, RevisionSourceSnapshot>,
): { label: AuthorityLabel; snapshot: RevisionSourceSnapshot } | null {
  for (const label of CANONICAL_PRIORITY) {
    const snapshot = snapshots[label];
    if (snapshot.revision) {
      return { label, snapshot };
    }
  }
  return null;
}

function compareAgainstCanonical(
  source: AuthorityLabel,
  snapshot: RevisionSourceSnapshot,
  canonical: { label: AuthorityLabel; snapshot: RevisionSourceSnapshot } | null,
): RevisionComparisonEntry {
  if (!canonical || !canonical.snapshot.revision) {
    return { source, comparison: 'NO_CANONICAL' };
  }

  if (!snapshot.revision) {
    return { source, comparison: 'MISSING' };
  }

  if (source === canonical.label) {
    return { source, comparison: 'CANONICAL' };
  }

  const canonicalNorm = canonical.snapshot.normalized_revision;
  const sourceNorm = snapshot.normalized_revision;

  if (!canonicalNorm || !sourceNorm) {
    return { source, comparison: 'INCOMPARABLE' };
  }

  const result = compareRevisions(sourceNorm, canonicalNorm);
  if (result === 'UNKNOWN') {
    return { source, comparison: 'INCOMPARABLE' };
  }
  return { source, comparison: result };
}

function buildDetails(
  comparisons: RevisionComparisonEntry[],
  snapshots: Record<AuthorityLabel, RevisionSourceSnapshot>,
  canonical: { label: AuthorityLabel; snapshot: RevisionSourceSnapshot } | null,
): string[] {
  const details: string[] = [];

  comparisons.forEach(entry => {
    if (!canonical || !canonical.snapshot.revision) {
      return;
    }
    const snapshot = snapshots[entry.source];
    const canonicalRevision = canonical.snapshot.revision ?? '—';
    const sourceRevision = snapshot.revision ?? '—';
    if (entry.comparison === 'GREATER') {
      details.push(`${entry.source} revision ${sourceRevision} is ahead of canonical ${canonical.label} ${canonicalRevision}.`);
    } else if (entry.comparison === 'LESS') {
      details.push(`${entry.source} revision ${sourceRevision} is behind canonical ${canonical.label} ${canonicalRevision}.`);
    } else if (entry.comparison === 'INCOMPARABLE') {
      details.push(`${entry.source} revision ${sourceRevision} is incomparable with canonical ${canonicalRevision}.`);
    } else if (entry.comparison === 'MISSING') {
      details.push(`${entry.source} revision is missing.`);
    }
  });

  return details;
}

export function validateSKURevisionSet(documents: RevisionDocumentInput[]): CrossSourceValidationResult {
  const snapshots = AUTHORITIES.reduce<Record<AuthorityLabel, RevisionSourceSnapshot>>((acc, config) => {
    acc[config.label] = snapshotAuthority(documents, config);
    return acc;
  }, {} as Record<AuthorityLabel, RevisionSourceSnapshot>);

  const canonical = determineCanonicalSource(snapshots);
  const comparisons = AUTHORITIES.map(({ label }) => compareAgainstCanonical(label, snapshots[label], canonical));
  const details = buildDetails(comparisons, snapshots, canonical);

  const signals_used = AUTHORITIES.map(({ label }) => snapshots[label].revision_source).filter(
    (source): source is RevisionSource => Boolean(source),
  );

  const availableSourceCount = AUTHORITIES.filter(({ label }) => Boolean(snapshots[label].revision)).length;
  const hasMissingSources = comparisons.some(entry => entry.comparison === 'MISSING');
  const hasIncomparable = comparisons.some(entry => entry.comparison === 'INCOMPARABLE');
  const hasGreater = comparisons.some(entry => entry.comparison === 'GREATER');
  const hasLess = comparisons.some(entry => entry.comparison === 'LESS');

  let status: CrossSourceRevisionStatus = 'SYNCHRONIZED';
  let recommended_action = STATUS_RECOMMENDATIONS.SYNCHRONIZED;

  if (!canonical || !canonical.snapshot.revision) {
    status = 'INCOMPLETE';
    recommended_action = STATUS_RECOMMENDATIONS.INCOMPLETE;
    details.push('No canonical revision (BOM → Apogee → Rheem) is available.');
  } else if (availableSourceCount < 2 || hasMissingSources) {
    status = 'INCOMPLETE';
    recommended_action = STATUS_RECOMMENDATIONS.INCOMPLETE;
    if (availableSourceCount < 2) {
      details.push('At least two authoritative sources are required to validate revisions.');
    }
  } else if (hasIncomparable) {
    status = 'INCOMPARABLE';
    recommended_action = STATUS_RECOMMENDATIONS.INCOMPARABLE;
  } else if (canonical.label === 'BOM') {
    if (hasGreater) {
      status = 'CONFLICT';
      recommended_action = STATUS_RECOMMENDATIONS.CONFLICT_BOM_BEHIND;
    } else if (hasLess) {
      status = 'OUT_OF_SYNC';
      recommended_action = STATUS_RECOMMENDATIONS.OUT_OF_SYNC_DRAWINGS_BEHIND;
    } else {
      status = 'SYNCHRONIZED';
      recommended_action = STATUS_RECOMMENDATIONS.SYNCHRONIZED;
    }
  } else if (hasGreater || hasLess) {
    status = 'OUT_OF_SYNC';
    recommended_action = STATUS_RECOMMENDATIONS.OUT_OF_SYNC_GENERAL;
  } else {
    status = 'SYNCHRONIZED';
    recommended_action = STATUS_RECOMMENDATIONS.SYNCHRONIZED;
  }

  return {
    status,
    bom_revision: snapshots.BOM.revision,
    customer_revision: snapshots.RHEEM.revision,
    internal_revision: snapshots.APOGEE.revision,
    canonical_revision: canonical?.snapshot.revision ?? null,
    canonical_source: canonical?.label ?? null,
    sources: snapshots,
    comparisons,
    signals_used,
    details,
    recommended_action,
  };
}
