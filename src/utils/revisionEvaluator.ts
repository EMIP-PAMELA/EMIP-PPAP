import { normalizeRevisionValue, type RevisionKind } from '@/src/utils/revisionParser';
import { compareRevisions } from '@/src/utils/revisionComparator';

export type RevisionState = 'CURRENT' | 'SUPERSEDED' | 'CONFLICT' | 'UNKNOWN';

export interface RevisionEvaluationInput {
  documentId: string;
  revision: string | null;
  normalizedRevision?: string | null;
  uploadedAt?: string | null;
}

export interface RevisionEvaluationResult {
  documentId: string;
  revision: string | null;
  normalizedRevision: string | null;
  state: RevisionState;
}

interface EnrichedDocument {
  id: string;
  revision: string | null;
  normalized: string | null;
  kind: RevisionKind;
  uploadedAt: string | null;
}

type SupportedKind = 'NUMERIC' | 'ALPHA';

const SUPPORTED_KINDS: SupportedKind[] = ['NUMERIC', 'ALPHA'];

function isSupportedKind(kind: RevisionKind): kind is SupportedKind {
  return SUPPORTED_KINDS.includes(kind as SupportedKind);
}

type EvaluationOptions = {
  log?: boolean;
  context?: Record<string, unknown>;
};

function buildEnrichedDocuments(documents: RevisionEvaluationInput[]): EnrichedDocument[] {
  return documents.map(doc => {
    if (doc.normalizedRevision) {
      const normalizedUpper = doc.normalizedRevision.trim().toUpperCase();
      const kind: RevisionKind = /^[0-9]+$/.test(normalizedUpper)
        ? 'NUMERIC'
        : /^[A-Z]+$/.test(normalizedUpper)
          ? 'ALPHA'
          : 'UNKNOWN';
      return {
        id: doc.documentId,
        revision: doc.revision,
        normalized: normalizedUpper.length > 0 ? normalizedUpper : null,
        kind,
        uploadedAt: doc.uploadedAt ?? null,
      };
    }

    const parsed = normalizeRevisionValue(doc.revision);
    return {
      id: doc.documentId,
      revision: doc.revision,
      normalized: parsed.normalized,
      kind: parsed.revisionKind,
      uploadedAt: doc.uploadedAt ?? null,
    };
  });
}

function pickLeaders(kindDocs: EnrichedDocument[], logEntries: string[]): EnrichedDocument[] {
  if (kindDocs.length === 0) return [];
  let leaders: EnrichedDocument[] = [kindDocs[0]];

  for (let i = 1; i < kindDocs.length; i += 1) {
    const candidate = kindDocs[i];
    const comparison = compareRevisions(candidate.normalized!, leaders[0].normalized!);
    logEntries.push(
      `[REVISION] ${candidate.id} (${candidate.normalized}) vs ${leaders[0].id} (${leaders[0].normalized}) = ${comparison}`,
    );

    if (comparison === 'GREATER') {
      leaders = [candidate];
    } else if (comparison === 'EQUAL') {
      leaders.push(candidate);
    }
  }

  return leaders;
}

export function evaluateRevisionSet(
  documents: RevisionEvaluationInput[],
  options?: EvaluationOptions,
): RevisionEvaluationResult[] {
  if (documents.length === 0) {
    return [];
  }

  const logEntries: string[] = [];
  const enriched = buildEnrichedDocuments(documents);
  const enrichedMap = new Map(enriched.map(doc => [doc.id, doc]));
  const stateMap = new Map<string, RevisionState>();

  const grouped: Record<SupportedKind, EnrichedDocument[]> = {
    NUMERIC: [],
    ALPHA: [],
  };
  const unknownDocs: EnrichedDocument[] = [];

  for (const doc of enriched) {
    if (!doc.normalized || !isSupportedKind(doc.kind)) {
      unknownDocs.push(doc);
      continue;
    }
    grouped[doc.kind].push(doc);
  }

  if (grouped.NUMERIC.length === 0 && grouped.ALPHA.length === 0) {
    for (const doc of enriched) {
      stateMap.set(doc.id, 'UNKNOWN');
    }
    if (options?.log) {
      console.log('[REVISION] Evaluation (all unknown)', {
        context: options.context,
        documents: enriched.map(doc => ({ id: doc.id, revision: doc.revision })),
      });
    }
    return documents.map(doc => ({
      documentId: doc.documentId,
      revision: doc.revision,
      normalizedRevision: null,
      state: 'UNKNOWN',
    }));
  }

  const leaderMap = new Map<SupportedKind, EnrichedDocument[]>();

  (Object.keys(grouped) as SupportedKind[]).forEach(kind => {
    const sorted = grouped[kind].sort((a, b) => {
      if (a.normalized === b.normalized) return 0;
      const result = compareRevisions(b.normalized!, a.normalized!);
      if (result === 'GREATER') return 1;
      if (result === 'LESS') return -1;
      return 0;
    });
    const leaders = pickLeaders(sorted, logEntries);
    leaderMap.set(kind, leaders);

    const leaderIds = new Set(leaders.map(doc => doc.id));
    for (const doc of sorted) {
      if (leaderIds.has(doc.id)) {
        stateMap.set(doc.id, 'CURRENT');
      } else {
        stateMap.set(doc.id, 'SUPERSEDED');
      }
    }
  });

  const leaderKinds = Array.from(leaderMap.entries()).filter(([, docs]) => docs.length > 0);
  if (leaderKinds.length > 1) {
    for (const [, docs] of leaderKinds) {
      docs.forEach(doc => stateMap.set(doc.id, 'CONFLICT'));
    }
    logEntries.push('[REVISION] Top revisions are incomparable — marking conflict');
  }

  unknownDocs.forEach(doc => stateMap.set(doc.id, 'UNKNOWN'));

  if (options?.log) {
    console.log('[REVISION] Evaluation complete', {
      context: options.context,
      logEntries,
      results: Array.from(stateMap.entries()),
    });
  }

  return documents.map(doc => ({
    documentId: doc.documentId,
    revision: doc.revision,
    normalizedRevision: enrichedMap.get(doc.documentId)?.normalized ?? null,
    state: stateMap.get(doc.documentId) ?? 'UNKNOWN',
  }));
}
