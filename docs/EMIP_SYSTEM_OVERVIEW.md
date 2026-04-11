# EMIP System Overview

## System Purpose

The EMIP / PPAP Document Intelligence System is a centralized platform for ingesting every harness-related document the organization receives. Its primary goals are:

- Build trustworthy SKU models even when inputs arrive incomplete or out of order.
- Link BOMs, drawings, internal specs, and ad-hoc documents into a single source of truth.
- Preserve every upload (good or bad) so downstream teams can reason about lineage, integrity, and readiness.

## Core Components

- **Document Vault (storage layer):** Browser-facing uploader + query surface for every PDF. Stores all files immediately, captures extracted text, and exposes filters/visibility without blocking ingestion.
- **Classification Engine (async processing):** Multi-pass service that resolves part numbers, document type confidence, and escalation state after storage. Operates independently of the upload flow.
- **Ingestion Pipeline (deterministic processing):** Reuses the Harness Work Instructions ingestion service to parse BOMs, draw metadata, and update SKU records once a document can be resolved.
- **Alias System:** A drawing-number-to-part-number knowledge base (supplied by the drawing database) that accelerates deterministic classification when documents lack explicit identifiers.
- **Future: Auto-Linking Engine:** Planned automation that will link related documents/SKUs automatically once the classification confidence is high enough.

## Data Flow

```
UPLOAD → STORE → CLASSIFY → RESOLVE → LINK → SKU MODEL
```

1. **Upload:** Users drop single or multiple files into the Vault UI.
2. **Store:** Files land in Supabase storage + `sku_documents` regardless of content quality.
3. **Classify:** The asynchronous classification service attempts deterministic, heuristic, then AI passes. Results update `classification_status` without blocking the user.
4. **Resolve:** When the system determines a part number + document type, the ingestion pipeline runs to update SKU context.
5. **Link:** Finalized documents are marked current/archived and linked to SKUs, preserving revision history.
6. **SKU Model:** Downstream features (operator instructions, analytics) consume the canonical SKU model.

## Key Principles

- **Never reject documents:** Every upload is valuable data. Failure to understand something now should not prevent storage.
- **Store first, understand later:** Persist first, then iterate through classification passes until the document becomes actionable.
- **Multi-pass classification:** Deterministic rules run before heuristics; heuristics run before AI. Each pass adds context without regressing earlier guarantees.
- **Deterministic > heuristic > AI:** Confidence ordering ensures we trust hard signals over probabilistic guesses.
- **Continuous learning system:** Alias mappings, diff insights, and future AI passes all feed back into the pipeline so classification improves without rewriting ingestion.
