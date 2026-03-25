-- Phase 3H - Persistent Validation Engine
-- Create ppap_validations table for database-backed validation tracking

CREATE TABLE IF NOT EXISTS ppap_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ppap_id UUID NOT NULL REFERENCES ppap(id) ON DELETE CASCADE,
  validation_key TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('pre-ack', 'post-ack')),
  required BOOLEAN NOT NULL DEFAULT true,
  requires_approval BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'complete', 'approved')),
  completed_by TEXT,
  completed_at TIMESTAMPTZ,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure unique validation per PPAP
  UNIQUE(ppap_id, validation_key)
);

-- Create index for faster queries by ppap_id
CREATE INDEX idx_ppap_validations_ppap_id ON ppap_validations(ppap_id);

-- Create index for faster queries by category
CREATE INDEX idx_ppap_validations_category ON ppap_validations(ppap_id, category);

-- Add RLS policies
ALTER TABLE ppap_validations ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all validations
CREATE POLICY "Users can view all validations"
  ON ppap_validations
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to update validations
CREATE POLICY "Users can update validations"
  ON ppap_validations
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to insert validations
CREATE POLICY "Users can insert validations"
  ON ppap_validations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_ppap_validations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ppap_validations_updated_at
  BEFORE UPDATE ON ppap_validations
  FOR EACH ROW
  EXECUTE FUNCTION update_ppap_validations_updated_at();

-- Add comment
COMMENT ON TABLE ppap_validations IS 'Phase 3H: Persistent validation tracking for PPAP workflow';
