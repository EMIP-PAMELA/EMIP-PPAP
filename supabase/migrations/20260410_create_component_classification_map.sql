-- Phase 3H.24A: AI Component Classification Persistence
--
-- Stores AI-assisted classifications for UNKNOWN components so results
-- can be reused deterministically before falling back to canonical logic.

CREATE TABLE IF NOT EXISTS component_classification_map (
  part_number TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  confidence NUMERIC(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  source TEXT NOT NULL DEFAULT 'AI',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT component_classification_category_check CHECK (
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

CREATE INDEX IF NOT EXISTS idx_component_classification_map_category
  ON component_classification_map(category);

ALTER TABLE component_classification_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read classification map"
  ON component_classification_map
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow insert classification map"
  ON component_classification_map
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow update classification map"
  ON component_classification_map
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);
