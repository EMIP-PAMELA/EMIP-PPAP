-- Migration 005: SKU Model System (Vault + Source of Truth)
-- Establishes persistent SKU metadata and revision-controlled document storage.

CREATE TABLE IF NOT EXISTS sku (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  part_number  text        NOT NULL UNIQUE,
  description  text,
  created_at   timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at   timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS sku_documents (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_id         uuid        NOT NULL REFERENCES sku(id) ON DELETE CASCADE,
  document_type  text        NOT NULL,
  revision       text        NOT NULL DEFAULT 'UNSPECIFIED',
  file_url       text        NOT NULL,
  file_name      text        NOT NULL,
  storage_path   text        NOT NULL,
  uploaded_at    timestamptz NOT NULL DEFAULT timezone('utc', now()),
  is_current     boolean     NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS sku_part_number_idx
  ON sku (part_number);

CREATE INDEX IF NOT EXISTS sku_documents_current_idx
  ON sku_documents (sku_id, document_type, is_current);

COMMENT ON TABLE sku IS 'Canonical SKU records (one per harness SKU / part number).';
COMMENT ON TABLE sku_documents IS 'Revision-controlled document references per SKU (BOM + drawings).';
