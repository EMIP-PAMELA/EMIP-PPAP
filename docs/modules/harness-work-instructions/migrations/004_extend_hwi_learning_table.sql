-- Migration 004: Extend HWI Resolution Memory metadata
-- Adds usage tracking and conflict counters for guardrails / drift detection.

ALTER TABLE hwi_resolution_memory
  ADD COLUMN IF NOT EXISTS usage_count   integer     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_used_at  timestamptz NULL,
  ADD COLUMN IF NOT EXISTS conflict_count integer    NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS hwi_resolution_memory_usage_idx
  ON hwi_resolution_memory (usage_count DESC, conflict_count DESC);
