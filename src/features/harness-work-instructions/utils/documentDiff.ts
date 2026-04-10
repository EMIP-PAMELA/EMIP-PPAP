const HEADER_PATTERNS = [/^page\s+\d+/i, /^confidential/i, /^proprietary/i, /^revision\s+/i];
const FUNCTIONAL_PATTERNS = [
  /wire/i,
  /awg/i,
  /length/i,
  /strip/i,
  /pin/i,
  /terminal/i,
  /conn/i,
  /plug/i,
  /hsg/i,
  /applicator/i,
  /te#/i,
  /qty\s*per/i,
  /\b\d+(\.\d+)?\s*(mm|cm|in|"|')/i,
];

export interface DocumentDiffSummary {
  changed: boolean;
  changed_line_count: number;
  added_lines: string[];
  removed_lines: string[];
  likely_functional_change: boolean;
  summary_message: string;
}

const PREVIEW_LIMIT = 10;

export function normalizeLines(text: string): string[] {
  if (!text) return [];
  const lines = text
    .split(/\r?\n/) // split by line
    .map(line => line.trim())
    .map(line => line.replace(/\s+/g, ' ')) // collapse whitespace
    .filter(line => line.length > 0)
    .filter(line => !HEADER_PATTERNS.some(pattern => pattern.test(line)));

  const freq = new Map<string, number>();
  lines.forEach(line => {
    freq.set(line, (freq.get(line) ?? 0) + 1);
  });

  return lines.filter(line => {
    const count = freq.get(line) ?? 0;
    return count <= 5; // drop overly repetitive headers/footers
  });
}

function containsFunctionalSignal(lines: string[]): boolean {
  return lines.some(line => FUNCTIONAL_PATTERNS.some(pattern => pattern.test(line)));
}

export function summarizeLineDiff(previousText: string, nextText: string): DocumentDiffSummary {
  const prevLines = normalizeLines(previousText);
  const nextLines = normalizeLines(nextText);
  const prevSet = new Set(prevLines);
  const nextSet = new Set(nextLines);

  const added: string[] = [];
  const removed: string[] = [];

  nextLines.forEach(line => {
    if (!prevSet.has(line)) added.push(line);
  });
  prevLines.forEach(line => {
    if (!nextSet.has(line)) removed.push(line);
  });

  const changedLineCount = added.length + removed.length;
  const addedPreview = added.slice(0, PREVIEW_LIMIT);
  const removedPreview = removed.slice(0, PREVIEW_LIMIT);
  const likelyFunctionalChange = containsFunctionalSignal([...added, ...removed]);

  let summaryMessage = 'Minor metadata change detected';
  if (changedLineCount === 0) {
    summaryMessage = 'No textual differences detected';
  } else if (likelyFunctionalChange) {
    summaryMessage = 'Lines referencing wires/connectors changed — likely functional impact';
  } else if (changedLineCount > PREVIEW_LIMIT) {
    summaryMessage = 'Multiple textual differences detected — review recommended';
  } else {
    summaryMessage = 'Text differences detected — likely non-critical, but review suggested';
  }

  return {
    changed: changedLineCount > 0,
    changed_line_count: changedLineCount,
    added_lines: addedPreview,
    removed_lines: removedPreview,
    likely_functional_change: likelyFunctionalChange,
    summary_message: summaryMessage,
  };
}
