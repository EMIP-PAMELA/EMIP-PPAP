export type ClassificationPattern = {
  pattern: string;
  match_type: 'prefix' | 'contains';
  category: string;
  confidence: number | null;
};

export function matchPattern(partNumber: string, patterns: ClassificationPattern[]): ClassificationPattern | null {
  if (!partNumber) return null;

  for (const rule of patterns) {
    if (rule.match_type === 'prefix' && partNumber.startsWith(rule.pattern)) {
      return rule;
    }

    if (rule.match_type === 'contains' && partNumber.includes(rule.pattern)) {
      return rule;
    }
  }

  return null;
}
