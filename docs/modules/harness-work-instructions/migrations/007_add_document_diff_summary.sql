-- Migration 007: Phantom revision diff metadata
-- Adds lightweight diff insight storage for phantom revisions.

ALTER TABLE sku_documents
  ADD COLUMN IF NOT EXISTS phantom_diff_summary jsonb,
  ADD COLUMN IF NOT EXISTS compared_to_document_id uuid REFERENCES sku_documents(id) ON DELETE SET NULL;
