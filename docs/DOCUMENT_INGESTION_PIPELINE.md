# Document Ingestion Pipeline

## Stage 1 — Vault Intake

- Accept all BOMs, drawings, scans, and unknown PDFs via the Vault uploader or SKU detail shortcuts.
- Store every file immediately in Supabase storage + `sku_documents` (even when extracted text is missing).
- When no part number is supplied or derivable, generate a provisional `PENDING-{file}-{timestamp}` SKU placeholder so the document still belongs to a trackable record.
- Set `classification_status = 'PENDING'` and `classification_attempts = 0` on insert (explicitly in application code, not just via DB defaults).

## Stage 2 — Classification Engine

The asynchronous classification service wakes up after each upload to resolve metadata without blocking ingestion. Retries are driven by status: documents that resolve to `PARTIAL` or `PARTIAL_MISMATCH` retain those diagnostic statuses in the database and are re-processed by the retry scheduler. In-process timers (`setTimeout`) are not used — all retries require an external trigger (e.g., a cron call to `POST /api/vault/classification/retry`).

### Pass 1 — Deterministic
- Extract part numbers using strict regex + domain-specific parsing.
- Extract drawing numbers and consult the alias system/drawing database.
- Store alias learnings when a drawing number successfully maps to a part number.
- Outcome: mark `classification_status = RESOLVED` when confidence is high.
- When a resolved part number is found on a document whose SKU starts with `PENDING-`, the classifier automatically reassigns the document to the correct (or newly created) real SKU.

### Pass 2 — Heuristic
- Detect BOM vs drawing via structure/keyword analysis.
- Infer document intent from layout length, tables, quantities, etc.
- Outcome: `PARTIAL` when signals are incomplete, or `PARTIAL_MISMATCH` when the inferred type disagrees with the stored type; both path remain retryable while attempts < 3.

### Pass 3 — AI (future)
- Placeholder stub for contextual inference (LLM/classifier integration).
- Provides low-confidence hints today, but scaffolding ensures we can plug models in later without restructuring the queue.

## Status Model

| Status            | Meaning                                                                       |
|-------------------|-------------------------------------------------------------------------------|
| PENDING           | Newly stored, awaiting classification or retry.                               |
| PROCESSING        | Currently being classified (locks row while passes run).                      |
| RESOLVED          | Deterministic data found; ingestion can safely consume the document.          |
| PARTIAL           | Some signals found, but more passes needed (auto-retry below max tries).      |
| PARTIAL_MISMATCH  | Signals indicate a document type mismatch vs stored type (still retryable).   |
| NEEDS_REVIEW      | Escalated to human review after exhausting automated attempts.                |

## Retry Logic

- `classification_attempts` increments every time the service runs.
- `MAX_ATTEMPTS = 3`.
- If status is not `RESOLVED` and attempts < 3 → preserve the diagnostic status (`PARTIAL`, `PARTIAL_MISMATCH`) so it is visible and queryable.
- If attempts ≥ 3 and still unresolved → set `classification_status = NEEDS_REVIEW` and stop auto-retrying.
- Retry scheduler: `POST /api/vault/classification/retry` queries all retryable documents and triggers classification for up to 20 at a time. Must be called externally (cron, admin action, or CI pipeline) — it does not self-schedule.
- `last_classified_at` updated after each pass for auditability.

## Manual Intervention

- Triggered only when documents land in `NEEDS_REVIEW` or when confidence remains too low for automation.
- Admin tooling (future) will call `manuallyClassify(documentId, data)` to override status/notes.

## Drawing Database (Alias System)

- Source CSV: `/data/drawing-database.csv` (must be processed offline into `/src/data/drawingLookup.ts`; the CSV alone is not read at runtime)
- Generated mapping: `/src/data/drawingLookup.ts`
- Learned mappings: stored in `sku_aliases` each time classification or ingestion resolves a new drawing → part pairing.

Purpose:
- Map internal drawing numbers → canonical part numbers.
- Provide deterministic signals for drawing uploads that lack explicit SKUs.

Flow:
```
drawing_number → lookup (database + learned aliases) → part_number → SKU link
```

This lookup runs during deterministic classification and when ingestion tries to resolve drawings without BOM context.
