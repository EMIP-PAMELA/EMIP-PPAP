-- Migration 012: Document signal storage
-- Adds derived metadata used by auto-linking intelligence.

ALTER TABLE sku_documents
  ADD COLUMN IF NOT EXISTS inferred_part_number text,
  ADD COLUMN IF NOT EXISTS drawing_number text;

CREATE INDEX IF NOT EXISTS sku_documents_inferred_part_number_idx
  ON sku_documents (inferred_part_number);

CREATE INDEX IF NOT EXISTS sku_documents_drawing_number_idx
  ON sku_documents (drawing_number);
