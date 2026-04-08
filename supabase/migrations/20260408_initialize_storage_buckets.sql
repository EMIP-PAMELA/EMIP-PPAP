-- ============================================================================
-- V5.5.1A: Storage Bucket Initialization
-- ============================================================================
--
-- PURPOSE:
-- Initialize required Supabase Storage buckets for EMIP artifact management.
-- This migration ensures that all storage dependencies referenced in code
-- actually exist at runtime.
--
-- BUCKETS CREATED:
-- - engineering-masters: Stores original engineering master PDFs
--
-- IDEMPOTENCY:
-- Uses ON CONFLICT DO NOTHING to safely run multiple times
--
-- ============================================================================

-- ============================================================================
-- BUCKET: engineering-masters
-- ============================================================================
--
-- Used by: artifactService.ts
-- Purpose: Store immutable engineering master PDF artifacts
-- Path format: /engineering-masters/{partNumber}/{revision}/{batchId}.pdf
--

INSERT INTO storage.buckets (id, name, public)
VALUES ('engineering-masters', 'engineering-masters', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STORAGE POLICIES: engineering-masters
-- ============================================================================
--
-- Policy: Allow public read access to engineering masters
-- Rationale: Engineering masters are accessible to all authenticated users
--

CREATE POLICY IF NOT EXISTS "Public read access for engineering masters"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'engineering-masters');

-- Policy: Allow authenticated insert for engineering masters
-- Rationale: Only authenticated users can upload engineering masters
--

CREATE POLICY IF NOT EXISTS "Authenticated insert for engineering masters"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'engineering-masters');

-- Policy: Allow authenticated update for engineering masters
-- Rationale: Support artifact metadata updates
--

CREATE POLICY IF NOT EXISTS "Authenticated update for engineering masters"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'engineering-masters')
WITH CHECK (bucket_id = 'engineering-masters');

-- Policy: Allow authenticated delete for engineering masters
-- Rationale: Support cleanup of obsolete or erroneous uploads
--

CREATE POLICY IF NOT EXISTS "Authenticated delete for engineering masters"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'engineering-masters');

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================
--
-- Run this query to verify bucket creation:
--
-- SELECT id, name, public, created_at
-- FROM storage.buckets
-- WHERE id = 'engineering-masters';
--
-- Expected: 1 row with id 'engineering-masters', public = true
--
-- ============================================================================

COMMENT ON POLICY "Public read access for engineering masters" ON storage.objects IS 'V5.5.1A: Allow public read access to engineering master PDFs for all users';
COMMENT ON POLICY "Authenticated insert for engineering masters" ON storage.objects IS 'V5.5.1A: Allow authenticated users to upload engineering master PDFs';
