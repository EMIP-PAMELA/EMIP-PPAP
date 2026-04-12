const DEFAULT_LINE_LIMIT = 80;

const PART_NUMBER_PATTERNS = [
  /\b(\d{3}-\d{4,5}-\d{3,4}[A-Z]?)\b/, // 123-45678-123 or similar
  /\b([A-Z]{2,6}-\d{4,6}(?:-[A-Z0-9]{1,5})?)\b/, // NH45-110858-01
  /part\s*(?:number|no\.?|#)\s*[:\s]+([A-Z0-9]{2}[A-Z0-9\-]{4,})/i,
];

const WEAK_PN_TOKENS = new Set([
  'REV',
  'DWG',
  'DRW',
  'NOTE',
  'ITEM',
  'DOC',
  'PAGE',
  'SHEET',
  'DATE',
  'APP',
  'CHK',
  'ENG',
  'TITLE',
  'SIZE',
  'SCALE',
  'ZONE',
  'CAGE',
  'FSCM',
]);

function normalizeLines(text: string, limit: number): string[] {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && line.length < 200)
    .slice(0, limit);
}

export function extractPartNumberFromText(
  text: string | null | undefined,
  options?: { lineLimit?: number },
): string | null {
  if (!text || text.trim().length === 0) {
    return null;
  }

  const limit = options?.lineLimit ?? DEFAULT_LINE_LIMIT;
  const lines = normalizeLines(text, limit);

  for (const line of lines) {
    for (const pattern of PART_NUMBER_PATTERNS) {
      const match = line.match(pattern);
      if (!match) continue;
      const candidate = match[1]?.trim().toUpperCase();
      if (!candidate) continue;
      if (candidate.length < 6 || candidate.length > 40) continue;
      if (WEAK_PN_TOKENS.has(candidate)) continue;
      if (/^[A-Z]-$/i.test(candidate)) continue;
      return candidate;
    }
  }

  return null;
}
