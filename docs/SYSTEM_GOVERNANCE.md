# System Governance — EMIP / PPAP Document Intelligence

## CORE PRINCIPLES

1. **NEVER reject documents** — every upload is data, even when incomplete.
2. **STORE FIRST, understand later** — persistence precedes enrichment or validation.
3. **ALL intelligence must be explainable** — classifiers, linkers, and learning layers must emit auditable signals.
4. **NO silent data mutation** — every change must be intentional, logged, and reviewable.
5. **ALL relationships must be confidence-scored** — links and hints require explicit confidence metadata.

---

## HARD RULES

- No document deletion under any circumstance.
- No automatic SKU merge without explicit high-confidence thresholds and audit trails.
- No linking without signals (part number, drawing number, alias, or equivalent evidence).
- No ingestion blocking for missing data (text, part numbers, revisions, etc.).

---

## CLASSIFICATION RULES

- Multi-pass only: deterministic → heuristic → AI (future-ready scaffolding).
- Status must reflect the true diagnostic state; do not overwrite PARTIAL/PARTIAL_MISMATCH with generic values.
- Retry must be state-based (status cycling) rather than timer-based, so behavior is deterministic in serverless environments.

---

## LINKING RULES

- Linking must use multi-signal scoring (part numbers, drawing numbers, aliases, hashes, recency, etc.).
- Links must be reversible; conflicts must be detectable and auditable.
- Linking may not override existing data blindly — attachments must honor confidence thresholds and respect current SKU ownership.
