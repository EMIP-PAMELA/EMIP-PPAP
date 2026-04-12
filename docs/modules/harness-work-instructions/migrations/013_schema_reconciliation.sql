-- Migration 013: Schema Reconciliation Audit (HWI.15.4.2)
-- Audit date: 2026-04-11
--
-- AUDIT FINDINGS:
-- One naming mismatch detected between sku_documents schema and linkingService.ts:
--
--   Actual column:   sku_documents.uploaded_at (migration 005)
--   Code reference:  created_at  (linkingService.ts DocumentRow interface,
--                    SELECT strings, ORDER BY clause, and computeSignals time-proximity)
--
-- Impact:
--   PostgREST rejects any SELECT that names a column that does not exist.
--   fetchDocument() and fetchCandidates() both fail and return null / [],
--   silently disabling the entire linking engine at runtime.
--
-- Fix strategy (per ENGINEERING_RULES.md — prefer additive DB fixes):
--   Add `created_at` as a stored generated column aliasing `uploaded_at`.
--   This is additive, backward-compatible, and requires no code changes.
--   Existing code that already uses `uploaded_at` (vault routes, skuService)
--   continues to work unchanged.
--
-- All other columns verified present and consistent across:
--   sku_documents, document_links, sku, sku_aliases
-- No other mismatches detected.

ALTER TABLE sku_documents
  ADD COLUMN IF NOT EXISTS created_at timestamptz GENERATED ALWAYS AS (uploaded_at) STORED;

-- Index to support ORDER BY created_at DESC used in fetchCandidates (linkingService.ts)
CREATE INDEX IF NOT EXISTS sku_documents_created_at_idx
  ON sku_documents (created_at DESC);
