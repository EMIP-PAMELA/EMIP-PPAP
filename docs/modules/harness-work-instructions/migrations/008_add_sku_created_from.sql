-- Migration 008: Add created_from to sku table
-- Tracks the document source type that first created this SKU stub.
-- Priority: CUSTOMER_DRAWING > INTERNAL_DRAWING > BOM

ALTER TABLE sku
  ADD COLUMN IF NOT EXISTS created_from TEXT
    CHECK (created_from IN ('BOM', 'CUSTOMER_DRAWING', 'INTERNAL_DRAWING'));
