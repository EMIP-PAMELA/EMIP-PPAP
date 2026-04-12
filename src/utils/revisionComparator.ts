export type RevisionComparisonResult = 'GREATER' | 'LESS' | 'EQUAL' | 'UNKNOWN' | 'INCOMPARABLE';

type ClassifiedValue = {
  kind: 'NUMERIC' | 'ALPHA' | 'UNKNOWN';
  normalized: string | null;
};

function normalizeInput(value: string | null | undefined): string | null {
  if (value == null) return null;
  const cleaned = value.trim().toUpperCase();
  return cleaned.length === 0 ? null : cleaned;
}

function classifyValue(raw: string | null | undefined): ClassifiedValue {
  const normalized = normalizeInput(raw);
  if (!normalized) {
    return { kind: 'UNKNOWN', normalized: null };
  }

  if (/^\d+$/.test(normalized)) {
    return { kind: 'NUMERIC', normalized };
  }

  if (/^[A-Z]+$/.test(normalized)) {
    return { kind: 'ALPHA', normalized };
  }

  return { kind: 'UNKNOWN', normalized: null };
}

function compareNumeric(a: string, b: string): RevisionComparisonResult {
  const numA = parseInt(a, 10);
  const numB = parseInt(b, 10);

  if (!Number.isFinite(numA) || !Number.isFinite(numB)) {
    return 'UNKNOWN';
  }

  if (numA > numB) return 'GREATER';
  if (numA < numB) return 'LESS';
  return 'EQUAL';
}

function compareAlpha(a: string, b: string): RevisionComparisonResult {
  if (a === b) return 'EQUAL';
  if (a > b) return 'GREATER';
  if (a < b) return 'LESS';
  return 'UNKNOWN';
}

export function compareRevisions(
  a: string | null | undefined,
  b: string | null | undefined,
): RevisionComparisonResult {
  const left = classifyValue(a);
  const right = classifyValue(b);

  if (!left.normalized || !right.normalized) {
    return 'UNKNOWN';
  }

  if (left.kind !== right.kind) {
    return 'INCOMPARABLE';
  }

  if (left.kind === 'NUMERIC') {
    return compareNumeric(left.normalized, right.normalized);
  }

  if (left.kind === 'ALPHA') {
    return compareAlpha(left.normalized, right.normalized);
  }

  return 'UNKNOWN';
}
