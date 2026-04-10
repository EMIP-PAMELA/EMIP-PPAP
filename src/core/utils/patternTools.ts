export const DEFAULT_PATTERN_MIN_LENGTH = 4;
export const DEFAULT_PATTERN_MAX_LENGTH = 8;

export function derivePatternPrefix(
  partNumber: string,
  minLength: number = DEFAULT_PATTERN_MIN_LENGTH,
  maxLength: number = DEFAULT_PATTERN_MAX_LENGTH
): string | null {
  if (!partNumber) return null;
  const normalized = partNumber.trim().toUpperCase();
  if (normalized.length < minLength) {
    return null;
  }

  const condensed = normalized.replace(/\s+/g, '');
  if (condensed.length < minLength) {
    return null;
  }

  const length = Math.min(Math.max(minLength, maxLength), condensed.length);
  return condensed.slice(0, length);
}
