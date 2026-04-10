-- ============================================================
-- HWI.6 — Pattern Learning: add source column
-- Run this in your Supabase SQL Editor before using HWI.6
-- ============================================================

-- Add source tracking to component_classification_patterns.
-- Distinguishes manually-promoted patterns from auto-learned ones.
--
-- Values:
--   'MANUAL'  — created via /api/ai/patterns (operator-submitted)
--   'LEARNED' — auto-generated from approved HWI jobs (HWI.6)
--   NULL      — legacy rows created before this migration

ALTER TABLE component_classification_patterns
  ADD COLUMN IF NOT EXISTS source TEXT;

-- Backfill existing rows as MANUAL (they were all created by the patterns API)
UPDATE component_classification_patterns
SET source = 'MANUAL'
WHERE source IS NULL;

-- Optional index for filtering by source
CREATE INDEX IF NOT EXISTS idx_ccpatterns_source
  ON component_classification_patterns (source);
