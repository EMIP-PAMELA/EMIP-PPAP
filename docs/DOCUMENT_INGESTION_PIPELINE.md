# Document Ingestion Pipeline

## Stage 1 — Vault Intake

- Accept all BOMs, drawings, and unknown PDFs via the Vault uploader or SKU detail shortcuts.
- Store every file immediately in Supabase storage + `sku_documents`.
- Set `classification_status = 'PENDING'` and `classification_attempts = 0` on insert.

## Stage 2 — Classification Engine

The asynchronous classification service wakes up after each upload (and during retries) to resolve metadata without blocking ingestion.

### Pass 1 — Deterministic
- Extract part numbers using strict regex + domain-specific parsing.
- Extract drawing numbers and consult the alias system/drawing database.
- Store alias learnings when a drawing number successfully maps to a part number.
- Outcome: mark `classification_status = RESOLVED` when confidence is high.

### Pass 2 — Heuristic
- Detect BOM vs drawing via structure/keyword analysis.
- Infer document intent from layout length, tables, quantities, etc.
- Outcome: typically `PARTIAL` (still retryable) when deterministic data is missing.

### Pass 3 — AI (future)
- Placeholder stub for contextual inference (LLM/classifier integration).
- Provides low-confidence hints today, but scaffolding ensures we can plug models in later without restructuring the queue.

## Status Model

| Status        | Meaning                                                                 |
|---------------|-------------------------------------------------------------------------|
| PENDING       | Newly stored, awaiting classification or retry.                         |
| PROCESSING    | Currently being classified (locks row while passes run).                |
| RESOLVED      | Deterministic data found; ingestion can safely consume the document.    |
| PARTIAL       | Some signals found, but more passes needed (auto-retry below max tries).|
| NEEDS_REVIEW  | Escalated to human review after exhausting automated attempts.          |

## Retry Logic

- `classification_attempts` increments every time the service runs.
- `MAX_ATTEMPTS = 3`.
- If status is not `RESOLVED` and attempts < 3 → schedule another pass (status returns to `PENDING`).
- If attempts ≥ 3 and still unresolved → set `classification_status = NEEDS_REVIEW` and stop auto-retrying.
- `last_classified_at` updated after each pass for auditability.

## Manual Intervention

- Triggered only when documents land in `NEEDS_REVIEW` or when confidence remains too low for automation.
- Admin tooling (future) will call `manuallyClassify(documentId, data)` to override status/notes.

## Drawing Database (Alias System)

- Source CSV: `/data/drawing-database.csv`
- Generated mapping: `/src/data/drawingLookup.ts`

Purpose:
- Map internal drawing numbers → canonical part numbers.
- Provide deterministic signals for drawing uploads that lack explicit SKUs.

Flow:
```
drawing_number → lookup (database + learned aliases) → part_number → SKU link
```

This lookup runs during deterministic classification and when ingestion tries to resolve drawings without BOM context.
