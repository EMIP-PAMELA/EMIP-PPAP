-- Phase 3H.26 — Pattern Classification Engine
-- Stores deterministic part number patterns that can bypass AI classification

CREATE TABLE IF NOT EXISTS component_classification_patterns (
  id BIGSERIAL PRIMARY KEY,
  pattern TEXT NOT NULL,
  match_type TEXT NOT NULL DEFAULT 'prefix' CHECK (match_type IN ('prefix', 'contains')),
  category TEXT NOT NULL,
  confidence NUMERIC DEFAULT 1 CHECK (confidence >= 0 AND confidence <= 1),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT component_classification_patterns_category_check CHECK (
    category IN (
      'WIRE',
      'TERMINAL',
      'CONNECTOR',
      'SEAL',
      'HARDWARE',
      'LABEL',
      'SLEEVING',
      'HOUSING',
      'UNKNOWN'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_pattern_lookup
  ON component_classification_patterns(pattern);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pattern_unique
  ON component_classification_patterns(pattern, match_type);

ALTER TABLE component_classification_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read classification patterns"
  ON component_classification_patterns
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow insert classification patterns"
  ON component_classification_patterns
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow update classification patterns"
  ON component_classification_patterns
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);
