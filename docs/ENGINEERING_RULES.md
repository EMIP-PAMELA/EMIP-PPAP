# Engineering Rules — EMIP / PPAP Document Intelligence

## CHANGE RULES

- Favor minimal, localized changes that solve the specific defect or feature.
- Avoid broad refactors unless explicitly instructed.
- Do not duplicate logic across services; rely on shared utilities when functionality overlaps.

---

## DATA SAFETY RULES

- Never overwrite diagnostic statuses (PENDING, PROCESSING, PARTIAL, PARTIAL_MISMATCH, NEEDS_REVIEW) with less-informative values.
- Preserve PARTIAL and PARTIAL_MISMATCH states to maintain traceability of classifier decisions.
- Never degrade data fidelity — do not drop fields, reduce precision, or discard context without an approved migration path.

---

## PIPELINE RULES

**UPLOAD → STORE → CLASSIFY → LINK → SKU**

- Each stage must remain decoupled and independently recoverable.
- No stage may block another — failures must fall back to logging + retries, not user-facing rejection.

---

## VALIDATION RULES

Every change must ensure that the system:

- Does not break ingestion flows.
- Does not introduce new blocking behavior.
- Does not corrupt SKU relationships or linking confidence.
- Maintains explainability and auditable reasoning throughout the pipeline.
