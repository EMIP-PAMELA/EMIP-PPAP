import { compareRevisions } from '@/src/utils/revisionComparator';
import type { RevisionState } from '@/src/utils/revisionEvaluator';

export type CrossSourceRevisionStatus =
  | 'SYNCHRONIZED'
  | 'OUT_OF_SYNC'
  | 'CONFLICT'
  | 'INCOMPLETE'
  | 'INCOMPARABLE';

export interface CrossSourceValidationResult {
  status: CrossSourceRevisionStatus;
  bom_revision: string | null;
  customer_revision: string | null;
  internal_revision: string | null;
  details: string[];
  recommended_action: string;
}

export interface RevisionDocumentInput {
  id?: string;
  document_type?: string | null;
  revision?: string | null;
  normalized_revision?: string | null;
  revision_state?: RevisionState;
}

type FamilyType = 'BOM' | 'CUSTOMER_DRAWING' | 'INTERNAL_DRAWING';

type FamilyStatus = 'READY' | 'MISSING' | 'CONFLICT';

interface FamilyDescriptor {
  type: FamilyType;
  status: FamilyStatus;
  currentDocs: RevisionDocumentInput[];
  displayRevision: string | null;
  normalizedRevision: string | null;
}

const RECOMMENDED_ACTION: Record<CrossSourceRevisionStatus, string> = {
  SYNCHRONIZED: 'No action required — BOM and drawings share the same revision.',
  OUT_OF_SYNC: 'Upload the updated BOM or drawing so both sources reflect the same revision.',
  CONFLICT: 'Resolve duplicate CURRENT documents within each family before comparing revisions.',
  INCOMPLETE: 'Add the missing BOM or drawing so the system can evaluate revision alignment.',
  INCOMPARABLE: 'Normalize revision formats (e.g., both numeric or both alpha) or correct metadata.',
};

const FAMILY_LABEL: Record<FamilyType, string> = {
  BOM: 'BOM',
  CUSTOMER_DRAWING: 'Customer Drawing',
  INTERNAL_DRAWING: 'Internal Drawing',
};

function materializeFamily(input?: string | null): FamilyType | null {
  if (!input) return null;
  if (input === 'BOM') return 'BOM';
  if (input === 'CUSTOMER_DRAWING') return 'CUSTOMER_DRAWING';
  if (input === 'INTERNAL_DRAWING') return 'INTERNAL_DRAWING';
  return null;
}

function normalizeValue(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.toUpperCase();
}

function buildFamilies(documents: RevisionDocumentInput[]): Record<FamilyType, FamilyDescriptor> {
  const base: Record<FamilyType, FamilyDescriptor> = {
    BOM: {
      type: 'BOM',
      status: 'MISSING',
      currentDocs: [],
      displayRevision: null,
      normalizedRevision: null,
    },
    CUSTOMER_DRAWING: {
      type: 'CUSTOMER_DRAWING',
      status: 'MISSING',
      currentDocs: [],
      displayRevision: null,
      normalizedRevision: null,
    },
    INTERNAL_DRAWING: {
      type: 'INTERNAL_DRAWING',
      status: 'MISSING',
      currentDocs: [],
      displayRevision: null,
      normalizedRevision: null,
    },
  };

  for (const doc of documents) {
    if (doc.revision_state !== 'CURRENT') continue;
    const family = materializeFamily(doc.document_type);
    if (!family) continue;
    base[family].currentDocs.push(doc);
  }

  Object.values(base).forEach(family => {
    if (family.currentDocs.length === 0) {
      family.status = 'MISSING';
      return;
    }
    if (family.currentDocs.length > 1) {
      family.status = 'CONFLICT';
      return;
    }
    const [doc] = family.currentDocs;
    const normalized = normalizeValue(doc.normalized_revision ?? doc.revision ?? null);
    family.displayRevision = doc.revision ?? doc.normalized_revision ?? null;
    if (!normalized) {
      family.status = 'MISSING';
      family.displayRevision = doc.revision ?? null;
      family.normalizedRevision = null;
      return;
    }
    family.normalizedRevision = normalized;
    family.status = 'READY';
  });

  return base;
}

function describeFamilyState(family: FamilyDescriptor): string | null {
  if (family.status === 'MISSING') {
    return `${FAMILY_LABEL[family.type]} missing a CURRENT document`;
  }
  if (family.status === 'CONFLICT') {
    const ids = family.currentDocs.map(doc => doc.id ?? 'unknown').join(', ');
    return `${FAMILY_LABEL[family.type]} has multiple CURRENT revisions (${ids})`;
  }
  if (!family.normalizedRevision) {
    return `${FAMILY_LABEL[family.type]} revision cannot be normalized`;
  }
  return null;
}

function compareFamilies(
  readyFamilies: FamilyDescriptor[],
  details: string[],
): { mismatch: boolean; incomparable: boolean } {
  let mismatch = false;
  let incomparable = false;

  for (let i = 0; i < readyFamilies.length; i += 1) {
    for (let j = i + 1; j < readyFamilies.length; j += 1) {
      const first = readyFamilies[i];
      const second = readyFamilies[j];
      const label = `${FAMILY_LABEL[first.type]} vs ${FAMILY_LABEL[second.type]}`;

      if (!first.normalizedRevision || !second.normalizedRevision) {
        incomparable = true;
        details.push(`${label} revisions cannot be compared (missing normalized value).`);
        continue;
      }

      const result = compareRevisions(first.normalizedRevision, second.normalizedRevision);
      if (result === 'INCOMPARABLE' || result === 'UNKNOWN') {
        incomparable = true;
        details.push(`${label} revisions are incomparable (${first.displayRevision ?? '—'} vs ${second.displayRevision ?? '—'}).`);
        continue;
      }

      if (result !== 'EQUAL') {
        mismatch = true;
        const leading = result === 'GREATER' ? first : second;
        const trailing = result === 'GREATER' ? second : first;
        details.push(
          `${FAMILY_LABEL[leading.type]} (${leading.displayRevision ?? '—'}) is ahead of ${FAMILY_LABEL[trailing.type]} (${trailing.displayRevision ?? '—'}).`,
        );
      }
    }
  }

  return { mismatch, incomparable };
}

export function validateSKURevisionSet(documents: RevisionDocumentInput[]): CrossSourceValidationResult {
  const details: string[] = [];
  const families = buildFamilies(documents);
  const familyList = Object.values(families);

  const conflictFamilies = familyList.filter(fam => fam.status === 'CONFLICT');
  const missingFamilies = familyList.filter(fam => fam.status === 'MISSING');
  const readyFamilies = familyList.filter(fam => fam.status === 'READY');

  conflictFamilies.map(describeFamilyState).filter(Boolean).forEach(message => details.push(message!));
  missingFamilies.map(describeFamilyState).filter(Boolean).forEach(message => details.push(message!));

  let status: CrossSourceRevisionStatus = 'SYNCHRONIZED';

  if (conflictFamilies.length > 0) {
    status = 'CONFLICT';
  } else if (missingFamilies.length > 0 || readyFamilies.length < 2) {
    status = 'INCOMPLETE';
  } else {
    const { mismatch, incomparable } = compareFamilies(readyFamilies, details);
    if (incomparable) {
      status = 'INCOMPARABLE';
    } else if (mismatch) {
      status = 'OUT_OF_SYNC';
    } else {
      status = 'SYNCHRONIZED';
      const [reference] = readyFamilies;
      if (reference) {
        details.push(`All active documents share revision ${reference.displayRevision ?? reference.normalizedRevision ?? '—'}.`);
      }
    }
  }

  return {
    status,
    bom_revision: families.BOM.displayRevision,
    customer_revision: families.CUSTOMER_DRAWING.displayRevision,
    internal_revision: families.INTERNAL_DRAWING.displayRevision,
    details,
    recommended_action: RECOMMENDED_ACTION[status],
  };
}
