-- V6.4.3: Wire Calibration Persistence
-- 
-- Purpose: Store calibration data from 10 ft sample method
-- Enables dynamic copper/insulation weight calculation overrides
-- Replaces hardcoded CALIBRATION_TABLE in bomService.ts

CREATE TABLE IF NOT EXISTS wire_calibration (
  gauge TEXT PRIMARY KEY,
  copper_lbs_per_ft DECIMAL(10, 6) NOT NULL,
  gross_lbs_per_ft DECIMAL(10, 6) NOT NULL,
  insulation_lbs_per_ft DECIMAL(10, 6) GENERATED ALWAYS AS (gross_lbs_per_ft - copper_lbs_per_ft) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_wire_calibration_gauge ON wire_calibration(gauge);

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_wire_calibration_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER wire_calibration_updated_at
  BEFORE UPDATE ON wire_calibration
  FOR EACH ROW
  EXECUTE FUNCTION update_wire_calibration_updated_at();

-- V6.4.3: Enable RLS
ALTER TABLE wire_calibration ENABLE ROW LEVEL SECURITY;

-- V6.4.3: Allow all authenticated users to read calibration data
CREATE POLICY "Allow authenticated users to read calibration"
  ON wire_calibration
  FOR SELECT
  TO authenticated
  USING (true);

-- V6.4.3: Allow authenticated users to insert/update calibration
CREATE POLICY "Allow authenticated users to manage calibration"
  ON wire_calibration
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
