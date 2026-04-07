-- V5.1 BOM Database Persistence
-- Create bom_records table with full traceability

-- ============================================================================
-- BOM Records Table (V5.0 Core Foundation)
-- ============================================================================

CREATE TABLE bom_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Core BOM fields
  parent_part_number TEXT NOT NULL,
  child_part_number TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit TEXT,
  description TEXT,
  
  -- Wire/cable specific fields
  length NUMERIC,
  
  -- Additional identification
  aci_code TEXT,
  operation_step TEXT,
  resource_id TEXT,
  
  -- Extended metadata (JSONB for flexibility)
  metadata JSONB,
  
  -- ========================================================================
  -- V5.0 Traceability Fields (REQUIRED)
  -- ========================================================================
  
  source_reference TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('visual_export', 'engineering_master', 'manual_entry', 'system_import')),
  ingestion_timestamp TIMESTAMPTZ NOT NULL,
  parser_version TEXT,
  revision TEXT,
  
  -- ========================================================================
  -- Timestamps
  -- ========================================================================
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Primary query: Get BOM by parent part number
CREATE INDEX idx_bom_parent_part_number ON bom_records(parent_part_number);

-- Query by source reference (find all records from a specific file/import)
CREATE INDEX idx_bom_source_reference ON bom_records(source_reference);

-- Query by ingestion timestamp (audit trail, recent imports)
CREATE INDEX idx_bom_ingestion_timestamp ON bom_records(ingestion_timestamp DESC);

-- Composite index for common query pattern (parent + source)
CREATE INDEX idx_bom_parent_source ON bom_records(parent_part_number, source_reference);

-- Index for child part number (reverse lookup, multi-level BOM explosion)
CREATE INDEX idx_bom_child_part_number ON bom_records(child_part_number);

-- ============================================================================
-- Comments for Documentation
-- ============================================================================

COMMENT ON TABLE bom_records IS 'V5.0 EMIP Core - Canonical BOM data repository with full traceability';
COMMENT ON COLUMN bom_records.parent_part_number IS 'Assembly/parent part number';
COMMENT ON COLUMN bom_records.child_part_number IS 'Component/child part number';
COMMENT ON COLUMN bom_records.quantity IS 'Quantity required per parent assembly';
COMMENT ON COLUMN bom_records.unit IS 'Unit of measure (EA, FT, IN, etc.)';
COMMENT ON COLUMN bom_records.source_reference IS 'Source identifier (file name, system ID, etc.)';
COMMENT ON COLUMN bom_records.source_type IS 'Type of source (visual_export, engineering_master, manual_entry, system_import)';
COMMENT ON COLUMN bom_records.ingestion_timestamp IS 'When this record was ingested into the system';
COMMENT ON COLUMN bom_records.parser_version IS 'Version of parser used to extract this data';
COMMENT ON COLUMN bom_records.metadata IS 'Extended metadata (raw line, candidate IDs, wire detection, etc.)';

-- ============================================================================
-- Row-Level Security (RLS) - Optional, can be enabled later
-- ============================================================================

-- Enable RLS when ready for production
-- ALTER TABLE bom_records ENABLE ROW LEVEL SECURITY;

-- Example policy (all authenticated users can read)
-- CREATE POLICY "Allow authenticated read access" ON bom_records
--   FOR SELECT
--   TO authenticated
--   USING (true);

-- Example policy (only admins can insert/update)
-- CREATE POLICY "Allow admin write access" ON bom_records
--   FOR ALL
--   TO authenticated
--   USING (auth.jwt() ->> 'role' = 'admin');
