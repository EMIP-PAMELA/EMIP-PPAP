-- V5.6.3 LIVE DATABASE SCHEMA VERIFICATION
-- Query actual Supabase database to verify bom_records schema

-- ============================================================================
-- QUERY 1: Get all columns for bom_records table
-- ============================================================================

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default,
  ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'bom_records'
ORDER BY ordinal_position;

-- ============================================================================
-- QUERY 2: Verify aci_code column specifically
-- ============================================================================

SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'bom_records'
  AND column_name = 'aci_code';

-- ============================================================================
-- QUERY 3: Count total columns
-- ============================================================================

SELECT COUNT(*) as total_columns
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'bom_records';

-- ============================================================================
-- QUERY 4: Check if table exists
-- ============================================================================

SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public'
  AND table_name = 'bom_records'
) as table_exists;

-- ============================================================================
-- QUERY 5: Get table creation info
-- ============================================================================

SELECT 
  schemaname,
  tablename,
  tableowner
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'bom_records';
