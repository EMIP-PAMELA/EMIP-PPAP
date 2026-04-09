/**
 * V6.6: Ingestion History Tables
 * 
 * Purpose: Track batch ingestion runs and individual file processing for audit trail
 * 
 * Tables:
 * - ingestion_runs: Batch-level metadata
 * - ingestion_items: Per-file processing details
 */

-- Ingestion Runs (Batch-level tracking)
CREATE TABLE IF NOT EXISTS ingestion_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  total_files INTEGER NOT NULL,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  skipped_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Per-file Ingestion Items
CREATE TABLE IF NOT EXISTS ingestion_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES ingestion_runs(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  part_number TEXT,
  revision TEXT,
  status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'success', 'failed', 'skipped', 'retrying')),
  attempts INTEGER DEFAULT 0,
  error TEXT,
  error_type TEXT, -- 'transient' | 'permanent' | null
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ingestion_items_run_id ON ingestion_items(run_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_items_status ON ingestion_items(status);
CREATE INDEX IF NOT EXISTS idx_ingestion_items_part_rev ON ingestion_items(part_number, revision);
CREATE INDEX IF NOT EXISTS idx_ingestion_runs_started ON ingestion_runs(started_at DESC);

-- RLS policies (allow authenticated users)
ALTER TABLE ingestion_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingestion_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read ingestion_runs"
  ON ingestion_runs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert ingestion_runs"
  ON ingestion_runs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update ingestion_runs"
  ON ingestion_runs FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to read ingestion_items"
  ON ingestion_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert ingestion_items"
  ON ingestion_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update ingestion_items"
  ON ingestion_items FOR UPDATE
  TO authenticated
  USING (true);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ingestion_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ingestion_items_updated_at
  BEFORE UPDATE ON ingestion_items
  FOR EACH ROW
  EXECUTE FUNCTION update_ingestion_items_updated_at();
