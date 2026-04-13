const DEFAULT_LINE_LIMIT = 80;
const DRAWING_REGEX = /\b\d{3}-\d{4}-\d{3}\b/;

function normalizeLines(text: string, limit: number): string[] {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && line.length < 200)
    .slice(0, limit);
}

export function extractDrawingNumberFromText(
  text: string | null | undefined,
  options?: { lineLimit?: number },
): string | null {
  if (!text || text.trim().length === 0) {
    return null;
  }

  const limit = options?.lineLimit ?? DEFAULT_LINE_LIMIT;
  const lines = normalizeLines(text, limit);

  for (const line of lines) {
    const match = line.match(DRAWING_REGEX);
    if (match) {
      return match[0].trim().toUpperCase();
    }
  }

  return null;
}

/**
 * Extract a drawing number (NNN-NNNN-NNN format) from a filename.
 *
 * Used as a last-resort fallback when the document text layer is sparse or absent.
 * The extension is stripped first; the regex is applied to the stem only.
 * Source should be tagged as FILENAME_FALLBACK by callers.
 */
export function extractDrawingNumberFromFilename(
  fileName: string | null | undefined,
): string | null {
  if (!fileName) return null;
  const stem = fileName.replace(/\.[^.]+$/, '');
  const match = stem.match(DRAWING_REGEX);
  return match ? match[0].trim().toUpperCase() : null;
}
