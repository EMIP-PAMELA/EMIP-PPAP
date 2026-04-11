-- Phase HWI.14.3: Alias learning table
CREATE TABLE IF NOT EXISTS public.sku_aliases (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  alias_type text NOT NULL CHECK (alias_type IN ('DRAWING_NUMBER')),
  alias_value text NOT NULL,
  part_number text NOT NULL,
  source text NOT NULL CHECK (source IN ('LOOKUP', 'LEARNED')) DEFAULT 'LEARNED',
  confidence double precision NOT NULL DEFAULT 1.0,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS sku_aliases_alias_unique
  ON public.sku_aliases (alias_type, alias_value);
