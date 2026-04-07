-- V5.2 BOM Data Integrity + Active Version Control
-- Add version control and active state management to bom_records

-- ============================================================================
-- ADD VERSION CONTROL COLUMNS
-- ============================================================================

-- is_active: Indicates if this BOM version is the current active version
-- Only ONE active BOM should exist per parent_part_number at a time
ALTER TABLE bom_records 
ADD COLUMN is_active BOOLEAN DEFAULT true NOT NULL;

-- ingestion_batch_id: Groups all records from a single ingestion operation
-- Allows version tracking and batch operations (activate/deactivate)
ALTER TABLE bom_records 
ADD COLUMN ingestion_batch_id UUID;

-- version_number: Optional sequential version number for user reference
-- Can be auto-incremented or manually set during ingestion
ALTER TABLE bom_records 
ADD COLUMN version_number INTEGER;

-- ============================================================================
-- ADD PERFORMANCE INDEX FOR ACTIVE BOM QUERIES
-- ============================================================================

-- Primary query pattern: Get active BOM for a specific part
-- This index dramatically improves performance for getBOM() queries
CREATE INDEX idx_bom_parent_active ON bom_records(parent_part_number, is_active);

-- Batch-level queries (get all records in a specific ingestion batch)
CREATE INDEX idx_bom_ingestion_batch ON bom_records(ingestion_batch_id);

-- ============================================================================
-- ADD UNIQUE CONSTRAINT (Optional - Prevents Exact Duplicates)
-- ============================================================================

-- Prevents duplicate records within the same ingestion batch
-- This ensures data integrity at the batch level
-- Note: Across batches, duplicates are allowed (that's version control)
CREATE UNIQUE INDEX idx_bom_unique_within_batch 
ON bom_records(parent_part_number, child_part_number, operation_step, ingestion_batch_id)
WHERE ingestion_batch_id IS NOT NULL;

-- ============================================================================
-- BACKFILL EXISTING RECORDS (if any exist)
-- ============================================================================

-- Set all existing records to active (they're the only version)
-- Generate a batch ID for existing records (one batch per parent part)
DO $$
DECLARE
  part_record RECORD;
  new_batch_id UUID;
BEGIN
  -- For each unique parent part number in existing data
  FOR part_record IN 
    SELECT DISTINCT parent_part_number 
    FROM bom_records 
    WHERE ingestion_batch_id IS NULL
  LOOP
    -- Generate a new batch ID
    new_batch_id := uuid_generate_v4();
    
    -- Update all records for this part
    UPDATE bom_records
    SET 
      ingestion_batch_id = new_batch_id,
      is_active = true,
      version_number = 1
    WHERE 
      parent_part_number = part_record.parent_part_number
      AND ingestion_batch_id IS NULL;
    
    RAISE NOTICE 'Backfilled batch ID for part: %', part_record.parent_part_number;
  END LOOP;
END $$;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN bom_records.is_active IS 'V5.2: Indicates if this is the current active BOM version. Only one active version per part should exist.';
COMMENT ON COLUMN bom_records.ingestion_batch_id IS 'V5.2: Groups all records from a single ingestion operation. Used for version control.';
COMMENT ON COLUMN bom_records.version_number IS 'V5.2: Optional sequential version number for user reference.';

-- ============================================================================
-- VERIFICATION QUERIES (For Testing)
-- ============================================================================

-- Count active BOMs per part (should be 1 for each part)
-- SELECT parent_part_number, COUNT(*) as active_count
-- FROM bom_records
-- WHERE is_active = true
-- GROUP BY parent_part_number
-- HAVING COUNT(*) > 1;

-- View all versions of a specific part
-- SELECT 
--   parent_part_number,
--   ingestion_batch_id,
--   version_number,
--   is_active,
--   COUNT(*) as record_count,
--   MAX(ingestion_timestamp) as ingested_at
-- FROM bom_records
-- WHERE parent_part_number = 'YOUR_PART_NUMBER'
-- GROUP BY parent_part_number, ingestion_batch_id, version_number, is_active
-- ORDER BY ingested_at DESC;
