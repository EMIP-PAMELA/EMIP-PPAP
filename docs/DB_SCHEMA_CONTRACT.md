# Database Schema Contract

This contract enumerates the tables required by Vault ingestion, classification, and linking flows. Any change requires updating this document and rerunning the verification checklist.

## sku_documents (public)
| Column | Type | Nullable | Notes / Consumers |
| --- | --- | --- | --- |
| id | uuid | NOT NULL | Primary key; used everywhere. |
| sku_id | uuid | NULL | Links to `sku.id`; set by ingestion/linking. |
| document_type | text | NOT NULL | Enum subset {BOM, CUSTOMER_DRAWING, INTERNAL_DRAWING, UNKNOWN}. Used by ingestion + linking. |
| revision | text | NOT NULL | Vault UI + SKU dashboard. |
| file_url | text | NOT NULL | Vault UI download. |
| file_name | text | NOT NULL | Vault table display. |
| storage_path | text | NULL | Needed for extracted text load. |
| uploaded_at | timestamptz | NOT NULL DEFAULT now() | Canonical timestamp; linking uses for time proximity. |
| is_current | boolean | NOT NULL DEFAULT true | Determines CURRENT vs OBSOLETE. |
| content_hash | text | NULL | Phantom detection + dedupe. |
| extracted_text_hash | text | NULL | Linking signals. |
| phantom_rev_flag | boolean | NOT NULL DEFAULT false | Vault badges + pipeline safety. |
| phantom_rev_note | text | NULL | Operator note. |
| phantom_diff_summary | jsonb | NULL | UI diff summary. |
| compared_to_document_id | uuid | NULL | FK to `sku_documents`. |
| classification_status | text | NOT NULL DEFAULT 'PENDING' | Classification queue + Vault filters. |
| classification_attempts | integer | NOT NULL DEFAULT 0 | Retry engine + UI. |
| last_classified_at | timestamptz | NULL | Classification ordering. |
| classification_confidence | real | NULL | Vault table. |
| classification_notes | text | NULL | Operator notes. |
| inferred_part_number | text | NULL | Linking and UI. |
| drawing_number | text | NULL | Linking heuristics. |
| created_at | timestamptz (generated) | NOT NULL | Alias of uploaded_at for legacy code; still in DB. |

## sku (public)
| Column | Type | Nullable | Notes |
| --- | --- | --- | --- |
| id | uuid | NOT NULL | PK. |
| part_number | text | NOT NULL UNIQUE | Core key for SKU routes. |
| revision | text | NULL | Header display. |
| description | text | NULL | SKU dashboard. |
| created_from | text | NULL, constrained to BOM/CUSTOMER_DRAWING/INTERNAL_DRAWING | Guarded in SKU service. |
| created_at | timestamptz | NOT NULL DEFAULT now() | Auditing. |

## sku_aliases (public)
| Column | Type | Nullable | Notes |
| --- | --- | --- | --- |
| id | uuid | NOT NULL | PK. |
| alias_type | text | NOT NULL CHECK in ('DRAWING_NUMBER') | Linking heuristics. |
| alias_value | text | NOT NULL | Value matched. |
| part_number | text | NOT NULL | Target SKU. |
| source | text | NOT NULL DEFAULT 'LEARNED' CHECK in ('LOOKUP','LEARNED') | Tracking provenance. |
| confidence | double precision | NOT NULL DEFAULT 1.0 | Used when ranking signals. |
| created_at | timestamptz | NOT NULL DEFAULT timezone('utc', now()) | Auditing. |

## document_links (public)
| Column | Type | Nullable | Notes |
| --- | --- | --- | --- |
| document_id_a | uuid | NOT NULL | PK part; always sorted pair. |
| document_id_b | uuid | NOT NULL | PK part. |
| link_type | text | NOT NULL | Values: SAME_SKU, PHANTOM_REV, CONFLICT. |
| confidence_score | double precision | NOT NULL | Linking UI chips. |
| signals_used | text[] | NULL | Explainability. |
| created_at | timestamptz | NOT NULL DEFAULT now() | Ordering. |
| updated_at | timestamptz | NOT NULL DEFAULT now() | Trigger-managed (if added later). |

## Other referenced tables
- `harness_instruction_jobs`, `harness_instruction_artifacts` (Harness Work Instructions pipeline): see `docs/modules/harness-work-instructions/migrations`. No direct Vault dependency but included in migration set.

## Consumers
- **Vault UI**: requires all `sku_documents` fields plus `sku.part_number` via FK.
- **Classification API**: `classification_status`, `_attempts`, `_confidence`, `_notes`, `last_classified_at`.
- **Linking Service**: `uploaded_at`, `inferred_part_number`, `drawing_number`, `phantom_rev_flag`, `document_links` table.
- **Retry Engine**: `classification_attempts`, `classification_status`.

## Change Procedure Reminder
Any new column must be:
1. Added via migration in repo.
2. Reflected here with type + consumers.
3. Included in `docs/DB_VERIFICATION_CHECKLIST.md` for auditing.
