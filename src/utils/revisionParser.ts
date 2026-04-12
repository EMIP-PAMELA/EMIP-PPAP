export type RevisionKind = 'ALPHA' | 'NUMERIC' | 'MIXED' | 'UNKNOWN';
export type RevisionSource = 'TEXT' | 'FILENAME' | 'MANUAL' | 'FALLBACK' | 'HEADER_EXPLICIT' | 'UNKNOWN';

export interface NormalizedRevisionValue {
  raw: string | null;
  normalized: string | null;
  revisionKind: RevisionKind;
}

export interface RevisionSignal extends NormalizedRevisionValue {
  parseSource: RevisionSource;
  confidence: number;
}

const INVALID_VALUES = new Set(['M', 'REV', 'REVISION', 'UNSPECIFIED', 'UNKNOWN']);
const MAX_NUMERIC_REVISION = 999;

function sanitizeInput(value: string): string {
  return value
    .replace(/[–—]/g, '-')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripWrappers(value: string): string {
  let working = value;
  if (working.startsWith('(') && working.endsWith(')')) {
    working = working.slice(1, -1).trim();
  }
  working = working.replace(/^[,\-]+/, '').replace(/[,:]+$/, '').trim();
  return working;
}

function removePrefixes(value: string): string {
  let working = value;
  working = working.replace(/^(?:REV(?:ISION)?\.?\s*[-:]?)/, '').trim();
  if (/^R[-\s]?[A-Z0-9]{1,3}$/.test(working)) {
    working = working.replace(/^R[-\s]?/, '');
  }
  return working.trim();
}

function classifyKind(token: string): RevisionKind {
  if (/^\d+$/.test(token)) return 'NUMERIC';
  if (/^[A-Z]+$/.test(token)) return 'ALPHA';
  if (/^[A-Z0-9]+$/.test(token)) return 'MIXED';
  return 'UNKNOWN';
}

function normalizeNumeric(token: string): string | null {
  if (!/^\d+$/.test(token)) return null;
  const value = parseInt(token, 10);
  if (!Number.isFinite(value) || value < 0 || value > MAX_NUMERIC_REVISION) {
    return null;
  }
  if (value < 10) return `0${value}`;
  if (token.length === 1) return `0${token}`;
  return token;
}

function normalizeAlpha(token: string): string {
  return token;
}

function normalizeMixed(token: string): string {
  return token;
}

export function normalizeRevisionValue(rawInput: string | null | undefined): NormalizedRevisionValue {
  if (!rawInput || rawInput.trim() === '') {
    return { raw: null, normalized: null, revisionKind: 'UNKNOWN' };
  }

  const raw = rawInput.trim();
  let working = sanitizeInput(raw.toUpperCase());
  if (!working) {
    return { raw, normalized: null, revisionKind: 'UNKNOWN' };
  }

  working = stripWrappers(working);
  working = removePrefixes(working);
  working = working.replace(/[^A-Z0-9]/g, '');

  if (!working || INVALID_VALUES.has(working)) {
    return { raw, normalized: null, revisionKind: 'UNKNOWN' };
  }

  const revisionKind = classifyKind(working);
  if (revisionKind === 'NUMERIC') {
    const normalized = normalizeNumeric(working);
    return {
      raw,
      normalized,
      revisionKind: normalized ? 'NUMERIC' : 'UNKNOWN',
    };
  }

  if (revisionKind === 'ALPHA') {
    return {
      raw,
      normalized: normalizeAlpha(working),
      revisionKind,
    };
  }

  if (revisionKind === 'MIXED') {
    return {
      raw,
      normalized: normalizeMixed(working),
      revisionKind,
    };
  }

  return { raw, normalized: null, revisionKind: 'UNKNOWN' };
}

function findRevisionToken(source: string): string | null {
  const padded = source.replace(/[()]/g, ' ').replace(/\s+/g, ' ');
  const patterns = [
    /\bREV(?:ISION)?\.?\s*[-:]?\s*[A-Z0-9]{1,3}\b/gi,
    /\bR[-\s]?[0-9]{1,3}\b/gi,
    /\bR[-\s]?[A-Z]{1,2}\b/gi,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(padded);
    if (match) {
      return match[0];
    }
  }

  return null;
}

function buildSignal(raw: string | null, source: RevisionSource, confidence: number): RevisionSignal | null {
  if (!raw || raw.trim().length === 0) return null;
  const normalized = normalizeRevisionValue(raw);
  if (!normalized.normalized) return null;
  return {
    ...normalized,
    parseSource: source,
    confidence,
  };
}

function detectFromText(text: string | null | undefined): string | null {
  if (!text) return null;
  const sample = text.slice(0, 6000);
  return findRevisionToken(sample.toUpperCase());
}

function detectFromFilename(fileName: string | null | undefined): string | null {
  if (!fileName) return null;
  const sample = fileName.replace(/\.[^.]+$/, '');
  return findRevisionToken(sample.toUpperCase());
}

export function extractRevisionSignal(input: {
  manualRevision?: string | null;
  extractedText?: string | null;
  fileName?: string | null;
}): RevisionSignal {
  const manual = buildSignal(input.manualRevision ?? null, 'MANUAL', 0.95);
  if (manual) {
    return manual;
  }

  const textCandidate = detectFromText(input.extractedText);
  const textSignal = buildSignal(textCandidate, 'TEXT', 0.8);
  if (textSignal) {
    return textSignal;
  }

  const fileCandidate = detectFromFilename(input.fileName);
  const fileSignal = buildSignal(fileCandidate, 'FILENAME', 0.65);
  if (fileSignal) {
    return fileSignal;
  }

  return {
    raw: null,
    normalized: null,
    revisionKind: 'UNKNOWN',
    parseSource: 'UNKNOWN',
    confidence: 0,
  };
}
