-- Phase 3H.16.8: Database Schema Reconciliation
-- 
-- This migration ensures all required columns exist in bom_records table
-- to support classification and color normalization features.
--
-- IMPORTANT: Only run this if schema verification identifies missing columns
-- Execute: npx ts-node scripts/verify-schema.ts first

-- =============================================================================
-- CRITICAL COLUMNS (Required for backfill to work)
-- =============================================================================

-- Phase 3H.16.5: Normalized color field (MUST be lowercase)
-- This field stores standardized color names (e.g., "green", "black", "white")
ALTER TABLE bom_records 
ADD COLUMN IF NOT EXISTS normalizedcolor TEXT;

-- Phase 3H.16: Component category field
-- Valid values: WIRE, TERMINAL, CONNECTOR, HOUSING, SEAL, UNKNOWN
ALTER TABLE bom_records 
ADD COLUMN IF NOT EXISTS category TEXT;

-- =============================================================================
-- OPTIONAL COLUMNS (Nice to have, not critical)
-- =============================================================================

-- Phase 3H.15.2: Raw color before normalization
-- Stores original color abbreviations (e.g., "GR", "BK", "WH")
ALTER TABLE bom_records 
ADD COLUMN IF NOT EXISTS rawcolor TEXT;

-- =============================================================================
-- VERIFICATION QUERY
-- =============================================================================

-- After running migration, verify columns exist:
-- 
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'bom_records'
-- AND column_name IN ('normalizedcolor', 'category', 'rawcolor')
-- ORDER BY column_name;
--
-- Expected result (3 rows):
-- category         | text
-- normalizedcolor  | text  
-- rawcolor         | text

-- =============================================================================
-- POST-MIGRATION STEPS
-- =============================================================================

-- 1. Verify columns created:
--    Run verification query above
--
-- 2. Run backfill to populate data:
--    Navigate to: http://localhost:3000/admin/backfill
--    Click: "Run Classification Backfill"
--
-- 3. Verify data populated:
--    SELECT category, normalizedcolor, COUNT(*) 
--    FROM bom_records 
--    WHERE category IS NOT NULL 
--    GROUP BY category, normalizedcolor;

-- =============================================================================
-- ROLLBACK (if needed)
-- =============================================================================

-- WARNING: Only run if you need to remove these columns
-- This will DELETE all classification and normalization data!
--
-- ALTER TABLE bom_records DROP COLUMN IF EXISTS normalizedcolor;
-- ALTER TABLE bom_records DROP COLUMN IF EXISTS category;
-- ALTER TABLE bom_records DROP COLUMN IF EXISTS rawcolor;
