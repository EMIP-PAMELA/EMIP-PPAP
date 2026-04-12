-- Migration 014: Live DB reconciliation — classification columns (HWI.15.4 follow-up)
--
-- PURPOSE:
--   Ensures live sku_documents schema matches migration 010 exactly.
--   Safe to run even if all columns already exist (IF NOT EXISTS on every ADD).
--
-- EXPECTED COLUMNS FROM MIGRATION 010:
--   classification_status, classification_attempts, last_classified_at,
--   classification_confidence, classification_notes
--
-- HANDLES:
--   A) Columns missing entirely → ADD
--   B) Legacy column classification_last_attempt exists → copy data, leave column
--   C) All columns already present → no-op (IF NOT EXISTS protects all ADDs)

-- ────────────────────────────────────────────────────────────
-- SECTION A: Ensure all migration 010 columns are present
-- ────────────────────────────────────────────────────────────

ALTER TABLE sku_documents
  ADD COLUMN IF NOT EXISTS classification_status     text        NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS classification_attempts   integer     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_classified_at        timestamptz,
  ADD COLUMN IF NOT EXISTS classification_confidence real,
  ADD COLUMN IF NOT EXISTS classification_notes      text;

-- Recreate index if it was never applied
CREATE INDEX IF NOT EXISTS sku_documents_classification_status_idx
  ON sku_documents (classification_status, document_type);

-- ────────────────────────────────────────────────────────────
-- SECTION B: Ensure migration 012 signal columns are present
-- ────────────────────────────────────────────────────────────

ALTER TABLE sku_documents
  ADD COLUMN IF NOT EXISTS inferred_part_number text,
  ADD COLUMN IF NOT EXISTS drawing_number       text;

CREATE INDEX IF NOT EXISTS sku_documents_inferred_part_number_idx
  ON sku_documents (inferred_part_number);

CREATE INDEX IF NOT EXISTS sku_documents_drawing_number_idx
  ON sku_documents (drawing_number);

-- ────────────────────────────────────────────────────────────
-- SECTION C: Legacy column migration (only runs if the legacy
--            column exists; safe no-op otherwise due to the
--            DO $$ block guard)
-- ────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'sku_documents'
      AND column_name  = 'classification_last_attempt'
  ) THEN
    -- Copy data from legacy column into canonical column where not yet set
    UPDATE sku_documents
    SET last_classified_at = classification_last_attempt
    WHERE last_classified_at IS NULL
      AND classification_last_attempt IS NOT NULL;

    RAISE NOTICE 'Legacy column classification_last_attempt detected. Data copied to last_classified_at. Column left in place — drop manually after confirming no remaining consumers.';
  END IF;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- SECTION D: Migration 013 reconciliation column
--            (created_at generated alias — idempotent)
-- ────────────────────────────────────────────────────────────

ALTER TABLE sku_documents
  ADD COLUMN IF NOT EXISTS created_at timestamptz GENERATED ALWAYS AS (uploaded_at) STORED;

CREATE INDEX IF NOT EXISTS sku_documents_created_at_idx
  ON sku_documents (created_at DESC);

-- ────────────────────────────────────────────────────────────
-- VERIFICATION QUERY (run after applying to confirm state)
-- ────────────────────────────────────────────────────────────

-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name   = 'sku_documents'
-- ORDER BY ordinal_position;
