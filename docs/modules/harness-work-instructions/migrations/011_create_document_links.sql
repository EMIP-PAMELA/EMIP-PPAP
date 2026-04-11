-- Migration 011: Document link intelligence
-- Stores scored, explainable relationships between documents.

CREATE TABLE IF NOT EXISTS document_links (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id_a    uuid NOT NULL REFERENCES sku_documents(id) ON DELETE CASCADE,
  document_id_b    uuid NOT NULL REFERENCES sku_documents(id) ON DELETE CASCADE,
  link_type        text NOT NULL CHECK (link_type IN ('SAME_SKU', 'RELATED', 'CONFLICT')),
  confidence_score real NOT NULL,
  signals_used     jsonb,
  created_at       timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS document_links_pair_idx
  ON document_links (document_id_a, document_id_b);

CREATE INDEX IF NOT EXISTS document_links_type_idx
  ON document_links (link_type);
