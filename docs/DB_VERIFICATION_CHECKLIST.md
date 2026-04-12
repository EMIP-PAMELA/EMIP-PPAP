# DB Verification Checklist (Vault / Classification / Linking)

Run this checklist after every migration push or weekly during active development. All queries are read-only.

## 1. sku_documents columns
- [ ] `SELECT column_name FROM information_schema.columns WHERE table_name = 'sku_documents';`
- Confirm the following columns exist: `sku_id`, `document_type`, `revision`, `file_url`, `file_name`, `storage_path`, `uploaded_at`, `is_current`, `phantom_rev_flag`, `phantom_rev_note`, `phantom_diff_summary`, `compared_to_document_id`, `classification_status`, `classification_attempts`, `last_classified_at`, `classification_confidence`, `classification_notes`, `inferred_part_number`, `drawing_number`, `content_hash`, `extracted_text_hash`.
- [ ] Validate `uploaded_at` is **NOT NULL** defaulting to `now()` and `created_at` (generated) exists.

### Vault critical columns (runtime guard)

Run the following read-only snippet in the Supabase SQL Editor before and after any migration touching `sku_documents`:

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'sku_documents'
  AND column_name IN (
    'classification_status', 'classification_attempts', 'last_classified_at',
    'classification_confidence', 'classification_notes',
    'inferred_part_number', 'drawing_number',
    'uploaded_at', 'sku_id', 'revision', 'file_name', 'file_url'
  )
ORDER BY column_name;
```

- **Vault API** requires: `file_name`, `document_type`, `revision`, `sku_id`, `uploaded_at`, `is_current`, `classification_status`, `classification_attempts`, `classification_confidence`, `classification_notes`, `last_classified_at`, `inferred_part_number`, `drawing_number`, `storage_path`, `phantom_rev_flag`, `phantom_rev_note`.
- **Classification service** requires: `storage_path`, `classification_status`, `classification_attempts`, `classification_confidence`, `classification_notes`, `last_classified_at`, `inferred_part_number`, `drawing_number`, `sku_id`.
- **Linking service** requires: `sku_id`, `document_type`, `file_name`, `storage_path`, `inferred_part_number`, `drawing_number`, `extracted_text_hash`, `phantom_rev_flag`, `uploaded_at`, `classification_status`.

Missing any of the above must block release until the reconciliation migration is applied.

## 2. document_links columns
- [ ] `SELECT column_name FROM information_schema.columns WHERE table_name = 'document_links';`
- Required columns: `document_id_a`, `document_id_b`, `link_type`, `confidence_score`, `signals_used`.
- Ensure PK/unique constraint on `(document_id_a, document_id_b)` is present.

## 3. sku table
- [ ] `SELECT column_name FROM information_schema.columns WHERE table_name = 'sku';`
- Required columns: `id`, `part_number`, `revision`, `description`, `created_from`, `created_at`.
- Confirm `created_from` constraint only allows BOM/CUSTOMER_DRAWING/INTERNAL_DRAWING.

## 4. sku_aliases table
- [ ] `SELECT column_name FROM information_schema.columns WHERE table_name = 'sku_aliases';`
- Ensure `alias_type`, `alias_value`, `part_number`, `source`, `confidence` exist with proper CHECK constraints.

## 5. Migration health
- [ ] `pnpm db:migration:list` — verify latest repo migrations show as `Applied`.
- [ ] `pnpm db:push:dry` — expect "Project is up to date".

## 6. Type generation freshness
- [ ] `pnpm db:types` — ensure `src/types/database.types.ts` timestamp matches last migration date.

## Reporting
- Log checklist runs + findings in `docs/BUILD_PLAN.md` under Active Objectives.
- Any missing column triggers a reconciliation task before code changes proceed.
