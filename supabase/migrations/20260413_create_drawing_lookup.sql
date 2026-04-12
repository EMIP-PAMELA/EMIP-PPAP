-- Drawing lookup table for resolving canonical drawing numbers per SKU
-- Stores normalized part numbers mapped to expected drawing references.

create table if not exists public.drawing_lookup (
  part_number   text        not null,
  drawing_number text       not null,
  source        text,
  revision      text,
  created_at    timestamptz not null default timezone('utc', now())
);

comment on table public.drawing_lookup is 'Canonical lookup between SKU part numbers and their expected drawing identifiers.';
comment on column public.drawing_lookup.part_number is 'Normalized SKU part number (NH##-#####-### format).';
comment on column public.drawing_lookup.drawing_number is 'Normalized drawing reference (e.g., 527-1234-010).';

create unique index if not exists drawing_lookup_part_drawing_idx
  on public.drawing_lookup (part_number, drawing_number);

create index if not exists drawing_lookup_drawing_number_idx
  on public.drawing_lookup (drawing_number);
