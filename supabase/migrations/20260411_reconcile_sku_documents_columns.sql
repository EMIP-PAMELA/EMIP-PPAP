-- Migration: Live schema reconciliation for sku_documents (HWI.15.4.5)
-- Ensures Vault/classification/linking-critical columns exist even if live environments drifted.

ALTER TABLE IF EXISTS public.sku_documents
  ADD COLUMN IF NOT EXISTS classification_status text NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS classification_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_classified_at timestamptz,
  ADD COLUMN IF NOT EXISTS classification_confidence real,
  ADD COLUMN IF NOT EXISTS classification_notes text,
  ADD COLUMN IF NOT EXISTS inferred_part_number text,
  ADD COLUMN IF NOT EXISTS drawing_number text;
