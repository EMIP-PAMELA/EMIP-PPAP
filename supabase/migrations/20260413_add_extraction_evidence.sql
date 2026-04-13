-- Phase 3H.29: Add structured extraction evidence store to sku_documents
--
-- Persists the full evidence bundle captured during document ingestion:
--   fragments   — raw OCR regions and filename tokens
--   signals     — all candidate revision / drawing number values with source + confidence
--   structure   — heuristic document layout analysis (title block, connectors, wire mapping)
--   resolved    — which values were actually written to revision / drawing_number
--
-- The column is nullable: documents uploaded before Phase 3H.29 will have NULL.
-- Evidence is captured once at ingestion time and never rewritten.

ALTER TABLE sku_documents
  ADD COLUMN IF NOT EXISTS extraction_evidence jsonb DEFAULT NULL;

COMMENT ON COLUMN sku_documents.extraction_evidence IS
  'Phase 3H.29: Structured extraction evidence bundle. '
  'Contains fragments (OCR regions + filename), revision_signals, drawing_number_signals, '
  'document_structure (heuristic layout), and resolved values. '
  'Nullable for documents uploaded before Phase 3H.29.';
