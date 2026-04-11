-- Migration 010: Document classification lifecycle state
-- Adds async classification tracking fields to sku_documents.

ALTER TABLE sku_documents
  ADD COLUMN IF NOT EXISTS classification_status text NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS classification_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_classified_at timestamptz,
  ADD COLUMN IF NOT EXISTS classification_confidence real,
  ADD COLUMN IF NOT EXISTS classification_notes text;

CREATE INDEX IF NOT EXISTS sku_documents_classification_status_idx
  ON sku_documents (classification_status, document_type);
