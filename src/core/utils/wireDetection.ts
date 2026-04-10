export function looksLikeWirePart(partNumber: string | null | undefined): boolean {
  if (!partNumber) return false;

  const normalized = partNumber.toUpperCase().trim();

  // Standard wire pattern: W18, W12, etc.
  const basicPattern = /^W\d{2}/;

  // Optional extended patterns (future-safe)
  const altPatterns = [
    /^CABLE/i,
    /^LEAD/i
  ];

  return (
    basicPattern.test(normalized) ||
    altPatterns.some((pattern) => pattern.test(normalized))
  );
}
