-- V3.3A.5: Add department field for queue-based ownership model
-- Migration: Add department column to ppap_records

-- Add department column (required for queue assignment)
ALTER TABLE ppap_records 
ADD COLUMN department VARCHAR(100);

-- Create index for department-based filtering
CREATE INDEX idx_ppap_records_department ON ppap_records(department);

-- Update existing records to have a default department
-- (In production, you'd want to set appropriate departments based on business logic)
UPDATE ppap_records 
SET department = 'Engineering' 
WHERE department IS NULL;

-- Make department required for new records
ALTER TABLE ppap_records 
ALTER COLUMN department SET NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN ppap_records.department IS 'V3.3A.5: Department queue assignment (Engineering, Quality, etc.). PPAPs appear in department queue until claimed by owner.';
COMMENT ON COLUMN ppap_records.assigned_to IS 'V3.3A.5: Individual owner who claimed the PPAP. NULL = unclaimed (in department queue).';
