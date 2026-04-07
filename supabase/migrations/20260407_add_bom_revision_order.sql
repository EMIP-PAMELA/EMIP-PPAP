-- V5.2.5 Revision Intelligence Layer
-- Add revision_order for truth-based BOM activation

-- ============================================================================
-- ADD REVISION ORDER COLUMN
-- ============================================================================

-- revision_order: Numeric comparison value for revision ordering
-- Higher value = newer revision
-- Used to determine which BOM should be active based on revision, not timestamp
ALTER TABLE bom_records 
ADD COLUMN revision_order INTEGER DEFAULT 0;

-- ============================================================================
-- ADD INDEX FOR REVISION QUERIES
-- ============================================================================

-- Query pattern: Find highest revision for a part
CREATE INDEX idx_bom_revision_order ON bom_records(parent_part_number, revision_order DESC);

-- ============================================================================
-- BACKFILL REVISION ORDER FROM EXISTING REVISION FIELD
-- ============================================================================

-- This function normalizes existing revision values to revision_order
DO $$
DECLARE
  record_data RECORD;
  normalized_order INTEGER;
BEGIN
  -- For each record with a revision value
  FOR record_data IN 
    SELECT id, revision 
    FROM bom_records 
    WHERE revision IS NOT NULL 
      AND revision != ''
      AND revision_order = 0
  LOOP
    -- Simple normalization logic (mirrors revisionService.ts)
    normalized_order := 0;
    
    -- Check if pure numeric (e.g., "01", "02")
    IF record_data.revision ~ '^\d+$' THEN
      normalized_order := CAST(record_data.revision AS INTEGER);
      
    -- Check if single letter (e.g., "A", "B")
    ELSIF record_data.revision ~ '^[A-Z]$' THEN
      normalized_order := ASCII(record_data.revision) - 64; -- A=1, B=2, etc.
      
    -- Check if double letter (e.g., "AA", "AB")
    ELSIF record_data.revision ~ '^[A-Z]{2}$' THEN
      normalized_order := ((ASCII(SUBSTRING(record_data.revision, 1, 1)) - 64) * 26) 
                        + (ASCII(SUBSTRING(record_data.revision, 2, 1)) - 64);
    
    -- Unknown format, leave as 0
    ELSE
      normalized_order := 0;
    END IF;
    
    -- Update the record
    UPDATE bom_records
    SET revision_order = normalized_order
    WHERE id = record_data.id;
    
  END LOOP;
  
  RAISE NOTICE 'Backfilled revision_order for existing records';
END $$;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN bom_records.revision_order IS 'V5.2.5: Numeric order for revision comparison. Higher value = newer revision. Used for truth-based BOM activation.';
