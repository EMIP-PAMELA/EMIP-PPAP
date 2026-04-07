-- V5.3 Artifact Storage + Projection Layer
-- Link BOM records to original engineering master PDFs

-- ============================================================================
-- ADD ARTIFACT LINK COLUMNS
-- ============================================================================

-- artifact_url: Public URL to the engineering master PDF in Supabase Storage
ALTER TABLE bom_records 
ADD COLUMN artifact_url TEXT;

-- artifact_path: Storage path for the artifact (for internal reference)
ALTER TABLE bom_records 
ADD COLUMN artifact_path TEXT;

-- ============================================================================
-- ADD INDEX FOR ARTIFACT QUERIES
-- ============================================================================

-- Query pattern: Find all BOM records for a specific artifact
CREATE INDEX idx_bom_artifact_path ON bom_records(artifact_path);

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN bom_records.artifact_url IS 'V5.3: Public URL to the original engineering master PDF in Supabase Storage. Enables dual-view system (raw artifact vs structured projection).';

COMMENT ON COLUMN bom_records.artifact_path IS 'V5.3: Storage path for the artifact. Format: /engineering-masters/{partNumber}/{revision}/{batchId}.pdf';

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================

-- Query to verify artifact linkage
-- SELECT 
--   parent_part_number,
--   revision,
--   ingestion_batch_id,
--   artifact_url,
--   COUNT(*) as record_count
-- FROM bom_records
-- WHERE artifact_url IS NOT NULL
-- GROUP BY parent_part_number, revision, ingestion_batch_id, artifact_url
-- ORDER BY parent_part_number, revision;
