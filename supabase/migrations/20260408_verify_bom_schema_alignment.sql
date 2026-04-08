-- ============================================================================
-- V5.6.1: BOM Schema Alignment Verification
-- ============================================================================
--
-- PURPOSE:
-- Verify that bom_records table has all columns required by the ingestion
-- payload. This migration ensures schema consistency and adds any missing
-- columns that may not have been created in previous migrations.
--
-- APPROACH:
-- Use ADD COLUMN IF NOT EXISTS to safely add columns without errors if they
-- already exist. This makes the migration idempotent and safe to re-run.
--
-- ============================================================================

-- ============================================================================
-- VERIFY CORE COLUMNS (from 20260407_create_bom_records.sql)
-- ============================================================================

-- These should already exist, but we verify for safety
ALTER TABLE bom_records 
ADD COLUMN IF NOT EXISTS parent_part_number TEXT NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN IF NOT EXISTS child_part_number TEXT NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN IF NOT EXISTS quantity NUMERIC NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS unit TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS aci_code TEXT,
ADD COLUMN IF NOT EXISTS operation_step TEXT,
ADD COLUMN IF NOT EXISTS resource_id TEXT,
ADD COLUMN IF NOT EXISTS length NUMERIC,
ADD COLUMN IF NOT EXISTS metadata JSONB,
ADD COLUMN IF NOT EXISTS source_reference TEXT NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'manual_entry',
ADD COLUMN IF NOT EXISTS ingestion_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS parser_version TEXT,
ADD COLUMN IF NOT EXISTS revision TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================================
-- VERIFY VERSION CONTROL COLUMNS (from 20260407_add_bom_version_control.sql)
-- ============================================================================

ALTER TABLE bom_records 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true NOT NULL,
ADD COLUMN IF NOT EXISTS ingestion_batch_id UUID;

-- ============================================================================
-- VERIFY REVISION INTELLIGENCE (from 20260407_add_bom_revision_order.sql)
-- ============================================================================

ALTER TABLE bom_records 
ADD COLUMN IF NOT EXISTS revision_order INTEGER DEFAULT 0;

-- ============================================================================
-- VERIFY ARTIFACT LINKS (from 20260407_add_bom_artifact_links.sql)
-- ============================================================================

ALTER TABLE bom_records 
ADD COLUMN IF NOT EXISTS artifact_url TEXT,
ADD COLUMN IF NOT EXISTS artifact_path TEXT;

-- ============================================================================
-- DROP DEFAULT CONSTRAINTS FOR COLUMNS THAT SHOULDN'T HAVE THEM
-- ============================================================================

-- Remove temporary defaults added for IF NOT EXISTS safety
ALTER TABLE bom_records 
ALTER COLUMN parent_part_number DROP DEFAULT,
ALTER COLUMN child_part_number DROP DEFAULT,
ALTER COLUMN quantity DROP DEFAULT,
ALTER COLUMN source_reference DROP DEFAULT,
ALTER COLUMN source_type DROP DEFAULT,
ALTER COLUMN ingestion_timestamp DROP DEFAULT;

-- ============================================================================
-- VERIFY INDEXES EXIST
-- ============================================================================

-- These should already exist, but we check for completeness
CREATE INDEX IF NOT EXISTS idx_bom_parent_part_number ON bom_records(parent_part_number);
CREATE INDEX IF NOT EXISTS idx_bom_source_reference ON bom_records(source_reference);
CREATE INDEX IF NOT EXISTS idx_bom_ingestion_timestamp ON bom_records(ingestion_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_bom_parent_source ON bom_records(parent_part_number, source_reference);
CREATE INDEX IF NOT EXISTS idx_bom_child_part_number ON bom_records(child_part_number);
CREATE INDEX IF NOT EXISTS idx_bom_is_active ON bom_records(parent_part_number, is_active);
CREATE INDEX IF NOT EXISTS idx_bom_ingestion_batch_id ON bom_records(ingestion_batch_id);
CREATE INDEX IF NOT EXISTS idx_bom_revision_order ON bom_records(parent_part_number, revision_order DESC);
CREATE INDEX IF NOT EXISTS idx_bom_artifact_path ON bom_records(artifact_path);

-- ============================================================================
-- VERIFY SOURCE TYPE CONSTRAINT
-- ============================================================================

-- Ensure source_type constraint exists
DO $$ 
BEGIN
  -- Check if constraint exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'bom_records_source_type_check'
  ) THEN
    -- Add constraint if missing
    ALTER TABLE bom_records 
    ADD CONSTRAINT bom_records_source_type_check 
    CHECK (source_type IN ('visual_export', 'engineering_master', 'manual_entry', 'system_import'));
  END IF;
END $$;

-- ============================================================================
-- SCHEMA ALIGNMENT VERIFICATION QUERY
-- ============================================================================
--
-- Run this query to verify all columns exist:
--
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'bom_records'
-- ORDER BY ordinal_position;
--
-- Expected columns (22 total):
-- 1. id (uuid)
-- 2. parent_part_number (text, NOT NULL)
-- 3. child_part_number (text, NOT NULL)
-- 4. quantity (numeric, NOT NULL)
-- 5. unit (text)
-- 6. description (text)
-- 7. length (numeric)
-- 8. aci_code (text)
-- 9. operation_step (text)
-- 10. resource_id (text)
-- 11. metadata (jsonb)
-- 12. source_reference (text, NOT NULL)
-- 13. source_type (text, NOT NULL)
-- 14. ingestion_timestamp (timestamptz, NOT NULL)
-- 15. parser_version (text)
-- 16. revision (text)
-- 17. created_at (timestamptz)
-- 18. updated_at (timestamptz)
-- 19. is_active (boolean, NOT NULL)
-- 20. ingestion_batch_id (uuid)
-- 21. revision_order (integer)
-- 22. artifact_url (text)
-- 23. artifact_path (text)
--
-- ============================================================================

-- Log verification completion
DO $$
BEGIN
  RAISE NOTICE '🧪 V5.6.1 SCHEMA ALIGNMENT COMPLETE - All columns verified';
END $$;
