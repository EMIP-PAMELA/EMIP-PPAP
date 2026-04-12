-- Adds optional audit columns that capture revision validation context at upload time
-- These columns remain nullable to preserve backward compatibility with historical records
-- and uploads that do not provide client-side validation metadata.

alter table if exists public.sku_documents
  add column if not exists uploaded_revision text;

alter table if exists public.sku_documents
  add column if not exists expected_revision text;

alter table if exists public.sku_documents
  add column if not exists revision_comparison text check (
    revision_comparison in ('EQUAL', 'LESS', 'GREATER', 'INCOMPARABLE', 'UNKNOWN')
  );

alter table if exists public.sku_documents
  add column if not exists revision_validation_source text check (
    revision_validation_source in ('BOM', 'RHEEM', 'APOGEE', 'GENERIC', 'UNKNOWN')
  );

alter table if exists public.sku_documents
  add column if not exists revision_override_used boolean;

alter table if exists public.sku_documents
  add column if not exists revision_validated_at timestamptz;

comment on column public.sku_documents.uploaded_revision is 'Revision detected from the uploaded document at the moment of ingestion.';
comment on column public.sku_documents.expected_revision is 'Canonical revision that the uploader expected to match when the document was uploaded.';
comment on column public.sku_documents.revision_comparison is 'Result of comparing uploaded_revision vs expected_revision (EQUAL/LESS/GREATER/INCOMPARABLE/UNKNOWN).';
comment on column public.sku_documents.revision_validation_source is 'Which extractor/validation path produced uploaded_revision (BOM/RHEEM/APOGEE/GENERIC/UNKNOWN).';
comment on column public.sku_documents.revision_override_used is 'True when the user explicitly overrode a blocking validation warning to proceed with the upload.';
comment on column public.sku_documents.revision_validated_at is 'UTC timestamp when the validation metadata was captured.';
