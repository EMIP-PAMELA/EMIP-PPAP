import type { RevisionComparisonResult } from '@/src/utils/revisionComparator';
import type { RevisionValidationSource } from '@/src/types/revisionValidation';

const LOOKBACK_DAYS = 90;
const LOOKBACK_UPLOAD_LIMIT = 30;
const MIN_HISTORY_FOR_TRENDS = 5;
const OVERRIDE_MEDIUM_THRESHOLD = 2;
const OVERRIDE_HIGH_THRESHOLD = 3;
const OUTDATED_MEDIUM_THRESHOLD = 2;
const OUTDATED_HIGH_THRESHOLD = 4;
const CONFLICT_MEDIUM_THRESHOLD = 2;
const CONFLICT_HIGH_THRESHOLD = 3;
const WEAK_DETECTION_THRESHOLD = 3;
const WEAK_DETECTION_HIGH_RATIO = 0.5;
const SOURCE_RELIABILITY_MIN_COUNT = 3;
const SOURCE_RELIABILITY_MIN_SHARE = 0.6;
const RECENT_OVERRIDE_DAYS = 30;
const INCOMPLETE_COVERAGE_THRESHOLD = 3;

const ORDERED_SEVERITY: RevisionRiskSeverity[] = ['LOW', 'MEDIUM', 'HIGH'];
const SEVERITY_SCORE: Record<RevisionRiskSeverity, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
};

export type RevisionRiskSeverity = 'LOW' | 'MEDIUM' | 'HIGH';
export type RevisionRiskLevel = 'NONE' | RevisionRiskSeverity;
export type RevisionRiskSignalType =
  | 'REPEATED_OVERRIDE'
  | 'FREQUENT_OUTDATED_UPLOADS'
  | 'FREQUENT_CONFLICT_UPLOADS'
  | 'WEAK_REVISION_DETECTION'
  | 'LOW_SOURCE_RELIABILITY'
  | 'RECENT_MANUAL_OVERRIDE'
  | 'CHRONIC_INCOMPLETE_COVERAGE';

export interface RevisionRiskSignal {
  signal_type: RevisionRiskSignalType;
  severity: RevisionRiskSeverity;
  count: number;
  lookback_window: {
    uploads_considered: number;
    days: number;
    cutoff: string;
  };
  rationale: string;
  affected_sources?: RevisionValidationSource[];
}

export interface RevisionRiskSummary {
  aggregate_level: RevisionRiskLevel;
  sufficient_history: boolean;
  lookback: {
    uploads_considered: number;
    days: number;
    cutoff: string;
    total_records: number;
  };
  stats: {
    total_uploads: number;
    considered_uploads: number;
    override_count: number;
    outdated_upload_count: number;
    conflict_upload_count: number;
    weak_detection_count: number;
    incomplete_context_count: number;
  };
  signals: RevisionRiskSignal[];
}

export interface RevisionAuditSnapshot {
  id?: string;
  document_type?: string | null;
  uploaded_at?: string | null;
  revision_comparison?: RevisionComparisonResult | null;
  revision_override_used?: boolean | null;
  revision_validation_source?: RevisionValidationSource | null;
  uploaded_revision?: string | null;
  expected_revision?: string | null;
}

function toMillis(value?: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function hasValue(value?: string | null): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function rankSeverity(a: RevisionRiskSeverity, b: RevisionRiskSeverity): number {
  return SEVERITY_SCORE[b] - SEVERITY_SCORE[a];
}

export function analyzeRevisionValidationRisk(documents: RevisionAuditSnapshot[]): RevisionRiskSummary {
  const totalUploads = documents.length;
  const now = Date.now();
  const cutoffTime = now - LOOKBACK_DAYS * 24 * 60 * 60 * 1000;

  const sorted = [...documents].sort((a, b) => {
    const aTs = toMillis(a.uploaded_at) ?? 0;
    const bTs = toMillis(b.uploaded_at) ?? 0;
    return bTs - aTs;
  });

  const lookback: RevisionAuditSnapshot[] = [];
  const included = new Set<number>();

  sorted.forEach((doc, idx) => {
    const ts = toMillis(doc.uploaded_at);
    if (ts !== null && ts >= cutoffTime && lookback.length < LOOKBACK_UPLOAD_LIMIT) {
      lookback.push(doc);
      included.add(idx);
    }
  });

  for (let idx = 0; idx < sorted.length && lookback.length < LOOKBACK_UPLOAD_LIMIT; idx += 1) {
    if (included.has(idx)) continue;
    lookback.push(sorted[idx]);
    included.add(idx);
  }

  const considered = lookback.length;
  const sufficientHistory = considered >= MIN_HISTORY_FOR_TRENDS;

  const overrides = lookback.filter(doc => Boolean(doc.revision_override_used));
  const outdated = lookback.filter(doc => doc.revision_comparison === 'LESS');
  const conflicts = lookback.filter(doc => doc.revision_comparison === 'GREATER' || doc.revision_comparison === 'INCOMPARABLE');
  const weakDetections = lookback.filter(
    doc => !hasValue(doc.uploaded_revision) || doc.revision_validation_source === 'UNKNOWN',
  );
  const incompleteContext = lookback.filter(
    doc => !hasValue(doc.expected_revision) || doc.revision_comparison === 'UNKNOWN' || doc.revision_comparison == null,
  );

  const stats = {
    total_uploads: totalUploads,
    considered_uploads: considered,
    override_count: overrides.length,
    outdated_upload_count: outdated.length,
    conflict_upload_count: conflicts.length,
    weak_detection_count: weakDetections.length,
    incomplete_context_count: incompleteContext.length,
  };

  const lookbackWindow = {
    uploads_considered: considered,
    days: LOOKBACK_DAYS,
    cutoff: new Date(cutoffTime).toISOString(),
  };

  const signals: RevisionRiskSignal[] = [];

  if (sufficientHistory && overrides.length >= OVERRIDE_MEDIUM_THRESHOLD) {
    const severity: RevisionRiskSeverity = overrides.length >= OVERRIDE_HIGH_THRESHOLD ? 'HIGH' : 'MEDIUM';
    signals.push({
      signal_type: 'REPEATED_OVERRIDE',
      severity,
      count: overrides.length,
      lookback_window: lookbackWindow,
      rationale: `${overrides.length} manual override${overrides.length === 1 ? '' : 's'} within the last ${considered} uploads indicates users routinely bypass validation.`,
    });
  }

  if (sufficientHistory && outdated.length >= OUTDATED_MEDIUM_THRESHOLD) {
    const severity: RevisionRiskSeverity = outdated.length >= OUTDATED_HIGH_THRESHOLD ? 'HIGH' : 'MEDIUM';
    signals.push({
      signal_type: 'FREQUENT_OUTDATED_UPLOADS',
      severity,
      count: outdated.length,
      lookback_window: lookbackWindow,
      rationale: `${outdated.length} upload${outdated.length === 1 ? '' : 's'} carried revisions older than expected (comparison LESS).`,
    });
  }

  if (sufficientHistory && conflicts.length >= CONFLICT_MEDIUM_THRESHOLD) {
    const severity: RevisionRiskSeverity = conflicts.length >= CONFLICT_HIGH_THRESHOLD ? 'HIGH' : 'MEDIUM';
    signals.push({
      signal_type: 'FREQUENT_CONFLICT_UPLOADS',
      severity,
      count: conflicts.length,
      lookback_window: lookbackWindow,
      rationale: `${conflicts.length} upload${conflicts.length === 1 ? '' : 's'} introduced ahead-of-canonical or incomparable revisions.`,
    });
  }

  if (sufficientHistory && weakDetections.length >= WEAK_DETECTION_THRESHOLD) {
    const ratio = considered === 0 ? 0 : weakDetections.length / considered;
    const severity: RevisionRiskSeverity = ratio >= WEAK_DETECTION_HIGH_RATIO ? 'HIGH' : 'MEDIUM';
    signals.push({
      signal_type: 'WEAK_REVISION_DETECTION',
      severity,
      count: weakDetections.length,
      lookback_window: lookbackWindow,
      rationale: `${(ratio * 100).toFixed(0)}% of recent uploads lacked reliable revision extraction (missing revision or UNKNOWN source).`,
    });
  }

  if (sufficientHistory && incompleteContext.length >= INCOMPLETE_COVERAGE_THRESHOLD) {
    signals.push({
      signal_type: 'CHRONIC_INCOMPLETE_COVERAGE',
      severity: 'MEDIUM',
      count: incompleteContext.length,
      lookback_window: lookbackWindow,
      rationale: `${incompleteContext.length} upload${incompleteContext.length === 1 ? '' : 's'} were missing expected revision context or produced UNKNOWN comparisons.`,
    });
  }

  // Source reliability checks consider trend share even if overall history is limited.
  if (considered > 0) {
    const issueBySource = new Map<RevisionValidationSource, number>();
    lookback.forEach(doc => {
      const hasIssue = Boolean(doc.revision_override_used) || doc.revision_comparison === 'LESS' || doc.revision_comparison === 'GREATER' || doc.revision_comparison === 'INCOMPARABLE';
      if (!hasIssue) return;
      const source = doc.revision_validation_source ?? 'UNKNOWN';
      issueBySource.set(source, (issueBySource.get(source) ?? 0) + 1);
    });

    const sourceFindings = Array.from(issueBySource.entries()).filter(([, count]) => {
      if (count < SOURCE_RELIABILITY_MIN_COUNT) return false;
      return count / considered >= SOURCE_RELIABILITY_MIN_SHARE;
    });

    if (sourceFindings.length > 0) {
      const affectedSources = sourceFindings.map(([src]) => src as RevisionValidationSource);
      const totalIssues = sourceFindings.reduce((sum, [, count]) => sum + count, 0);
      const severity: RevisionRiskSeverity = totalIssues >= SOURCE_RELIABILITY_MIN_COUNT * 2 ? 'HIGH' : 'MEDIUM';
      signals.push({
        signal_type: 'LOW_SOURCE_RELIABILITY',
        severity,
        count: totalIssues,
        lookback_window: lookbackWindow,
        rationale: `${affectedSources.join(', ')} produced ${totalIssues} of ${considered} recent issues, indicating unreliable extraction path(s).`,
        affected_sources: affectedSources,
      });
    }
  }

  // Recent override (even if history limited)
  const recentCutoff = now - RECENT_OVERRIDE_DAYS * 24 * 60 * 60 * 1000;
  const recentOverride = sorted.find(doc => {
    const ts = toMillis(doc.uploaded_at);
    return Boolean(doc.revision_override_used && ts !== null && ts >= recentCutoff);
  });
  if (recentOverride) {
    signals.push({
      signal_type: 'RECENT_MANUAL_OVERRIDE',
      severity: sufficientHistory ? 'MEDIUM' : 'LOW',
      count: 1,
      lookback_window: lookbackWindow,
      rationale: 'Most recent uploads required a manual override; monitor closely for ongoing drift.',
      affected_sources: recentOverride.revision_validation_source ? [recentOverride.revision_validation_source] : undefined,
    });
  }

  signals.sort((a, b) => {
    const diff = rankSeverity(a.severity, b.severity);
    if (diff !== 0) return diff;
    return a.signal_type.localeCompare(b.signal_type);
  });

  const aggregateLevel: RevisionRiskLevel = signals.length === 0 ? 'NONE' : signals[0].severity;

  return {
    aggregate_level: aggregateLevel,
    sufficient_history: sufficientHistory,
    lookback: {
      ...lookbackWindow,
      total_records: totalUploads,
    },
    stats,
    signals,
  };
}
