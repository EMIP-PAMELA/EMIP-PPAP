-- Adds revision intelligence metadata columns to sku_documents without altering existing behaviors
-- Ensures normalization and state tracking remain optional until populated by services.

alter table if exists public.sku_documents
  add column if not exists normalized_revision text;

alter table if exists public.sku_documents
  add column if not exists revision_kind text check (revision_kind in ('ALPHA', 'NUMERIC', 'MIXED', 'UNKNOWN'));

alter table if exists public.sku_documents
  add column if not exists revision_source text check (revision_source in ('TEXT', 'FILENAME', 'MANUAL', 'FALLBACK', 'UNKNOWN'));

alter table if exists public.sku_documents
  add column if not exists revision_confidence numeric;

alter table if exists public.sku_documents
  add column if not exists revision_state text check (revision_state in ('CURRENT', 'SUPERSEDED', 'CONFLICT', 'UNKNOWN', 'UNCONTROLLED')) default 'UNKNOWN';

alter table if exists public.sku_documents
  add column if not exists revision_state_reason text;

alter table if exists public.sku_documents
  add column if not exists revision_evaluated_at timestamptz;
