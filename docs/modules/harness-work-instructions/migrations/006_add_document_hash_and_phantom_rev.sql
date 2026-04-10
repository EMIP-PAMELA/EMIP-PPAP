-- Migration 006: Content-based validation for SKU documents
-- Adds hashing + phantom revision metadata to sku_documents for integrity tracking.

ALTER TABLE sku_documents
  ADD COLUMN IF NOT EXISTS content_hash        text,
  ADD COLUMN IF NOT EXISTS extracted_text_hash text,
  ADD COLUMN IF NOT EXISTS phantom_rev_flag    boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS phantom_rev_note    text;

CREATE INDEX IF NOT EXISTS sku_documents_revision_idx
  ON sku_documents (sku_id, document_type, revision);

CREATE INDEX IF NOT EXISTS sku_documents_content_hash_idx
  ON sku_documents (content_hash);
