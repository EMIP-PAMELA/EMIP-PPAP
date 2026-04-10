-- Test Script for component_classification_map
-- Run this in Supabase SQL Editor to verify schema is correct

-- 1. Check table exists and view structure
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'component_classification_map'
ORDER BY ordinal_position;

-- 2. Check constraints
SELECT
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'component_classification_map'::regclass;

-- 3. Test insert with AI_APPROVED source (new)
INSERT INTO component_classification_map
(part_number, category, confidence, source, description)
VALUES
('TEST-WIRE-001', 'WIRE', 0.92, 'AI_APPROVED', 'Test wire component')
ON CONFLICT (part_number) DO UPDATE SET
  category = EXCLUDED.category,
  confidence = EXCLUDED.confidence,
  source = EXCLUDED.source,
  description = EXCLUDED.description;

-- 4. Test insert with MANUAL source
INSERT INTO component_classification_map
(part_number, category, confidence, source, description)
VALUES
('TEST-TERMINAL-001', 'TERMINAL', 1.0, 'MANUAL', 'Manually classified terminal')
ON CONFLICT (part_number) DO UPDATE SET
  category = EXCLUDED.category,
  confidence = EXCLUDED.confidence,
  source = EXCLUDED.source,
  description = EXCLUDED.description;

-- 5. Test insert with all canonical categories
INSERT INTO component_classification_map
(part_number, category, confidence, source, description)
VALUES
('TEST-WIRE', 'WIRE', 0.85, 'AI', 'Wire test'),
('TEST-TERMINAL', 'TERMINAL', 0.90, 'AI', 'Terminal test'),
('TEST-CONNECTOR', 'CONNECTOR', 0.88, 'AI', 'Connector test'),
('TEST-SEAL', 'SEAL', 0.87, 'AI', 'Seal test'),
('TEST-HARDWARE', 'HARDWARE', 0.86, 'AI', 'Hardware test'),
('TEST-LABEL', 'LABEL', 0.89, 'AI', 'Label test'),
('TEST-SLEEVING', 'SLEEVING', 0.84, 'AI', 'Sleeving test'),
('TEST-HOUSING', 'HOUSING', 0.91, 'AI', 'Housing test'),
('TEST-UNKNOWN', 'UNKNOWN', 0.50, 'AI', 'Unknown test')
ON CONFLICT (part_number) DO UPDATE SET
  category = EXCLUDED.category,
  confidence = EXCLUDED.confidence,
  source = EXCLUDED.source,
  description = EXCLUDED.description;

-- 6. View inserted test data
SELECT 
  part_number,
  category,
  confidence,
  source,
  description,
  created_at
FROM component_classification_map
WHERE part_number LIKE 'TEST-%'
ORDER BY created_at DESC;

-- 7. Clean up test data
DELETE FROM component_classification_map WHERE part_number LIKE 'TEST-%';

-- 8. Verify RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'component_classification_map';
