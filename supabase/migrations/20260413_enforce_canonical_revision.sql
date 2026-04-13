-- Phase 3H.25: Canonical Revision Enforcement — Data Fix Migration
--
-- GOAL: Ensure that normalized_revision (the canonical field) contains the best
-- available revision value for every existing sku_documents record.
--
-- CANONICAL FIELD: normalized_revision
--   - Used by revisionEvaluator, revisionCrossValidator, and all UI displays via canonical_revision
--   - Must never contain sentinel strings ('UNSPECIFIED', 'UNKNOWN', etc.)
--
-- RAW FIELD: revision
--   - Original manual/extracted input; preserved for audit/debug only
--   - May contain sentinels; NOT used directly by UI after this phase
--
-- SAFE: all updates only SET normalized_revision = revision when normalized_revision
-- is currently null and revision contains a non-sentinel parseable value.
-- No records are deleted. No values are invented. Ambiguous records remain null.

-- -----------------------------------------------------------------------------
-- CASE 1: normalized_revision is missing but revision has a valid (non-sentinel) value
--   e.g. revision = '00', normalized_revision = NULL  →  set normalized_revision = '00'
-- This repairs records uploaded before revisionSignal extraction was wired up.
-- -----------------------------------------------------------------------------
UPDATE public.sku_documents
SET normalized_revision = trim(revision)
WHERE normalized_revision IS NULL
  AND revision IS NOT NULL
  AND trim(revision) <> ''
  AND upper(trim(revision)) NOT IN (
    'UNSPECIFIED', 'UNKNOWN', 'N/A', 'NA', 'TBD', 'NONE', 'MISSING'
  );

-- -----------------------------------------------------------------------------
-- CASE 2: revision = 'UNSPECIFIED' (sentinel) and normalized_revision IS NOT NULL
--   These records are already correct. canonical_revision = normalized_revision at runtime.
--   No action needed — left as-is.
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- CASE 3: Both revision and normalized_revision are null/UNSPECIFIED
--   Canonical revision is null — correct, no action.
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- Verification: show counts of each state after migration
-- Run manually after applying:
--
--   SELECT
--     CASE
--       WHEN normalized_revision IS NOT NULL THEN 'canonical_present'
--       WHEN revision IS NOT NULL AND upper(trim(revision)) NOT IN ('UNSPECIFIED','UNKNOWN') THEN 'raw_only_valid'
--       ELSE 'no_revision'
--     END AS state,
--     count(*) AS record_count
--   FROM public.sku_documents
--   GROUP BY 1;
-- -----------------------------------------------------------------------------
