-- Migration: Add workflow_phase column to ppap_records
-- Date: 2026-03-20
-- Purpose: Persist PPAP workflow phase state across page reloads

-- Add workflow_phase column with default 'INITIATION'
ALTER TABLE ppap_records
ADD COLUMN workflow_phase VARCHAR(50) NOT NULL DEFAULT 'INITIATION';

-- Add check constraint to ensure valid phase values
ALTER TABLE ppap_records
ADD CONSTRAINT workflow_phase_valid_values
CHECK (workflow_phase IN ('INITIATION', 'DOCUMENTATION', 'SAMPLE', 'REVIEW', 'COMPLETE'));

-- Create index for phase filtering (optional but recommended for performance)
CREATE INDEX idx_ppap_records_workflow_phase ON ppap_records(workflow_phase);

-- Verify column added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'ppap_records' AND column_name = 'workflow_phase';
