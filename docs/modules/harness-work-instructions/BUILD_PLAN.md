# Harness Work Instruction Generator — Build Plan

## Module Overview

**Module:** Harness Work Instruction Generator  
**Phase:** HWI.0 (Initialization)  
**Mode:** Foundation + Repo Structure  
**Status:** Scaffolding

---

## Purpose

Generate standardized, deterministic PDF work instructions for wire harness assembly processes by extracting structured data from source documents (BOMs, engineering drawings) and transforming them into human-readable, print-ready manufacturing instructions.

---

## Architecture

### Two-Phase Workflow

**Phase 1: Extraction + Review**
- AI-powered extraction of harness assembly steps from source documents
- Human-in-the-loop review and approval workflow
- Structured data storage (job, steps, materials, tooling)

**Phase 2: PDF Generation**
- Deterministic template-based rendering
- No AI in PDF generation (repeatability guaranteed)
- Version-controlled template system
- Print-ready output

---

## Core Principles

1. **Manual Governance** — Every AI extraction requires explicit human approval
2. **Deterministic Rendering** — PDF output is 100% reproducible given same approved data
3. **Single Source of Truth** — Approved job data drives PDF generation
4. **No Dual Systems** — Reuse existing document engine patterns where possible
5. **Additive Only** — No modification of existing EMIP modules

---

## Module Structure

```
src/features/harness-work-instructions/
  components/       # UI components
  hooks/            # React hooks
  services/         # Business logic and API clients
  types/            # TypeScript interfaces
  utils/            # Helper functions
  templates/        # PDF templates
  constants/        # Configuration constants
```

---

## Data Flow

```
Source Document Upload
    ↓
AI Extraction (Phase 1)
    ↓
Review Dashboard (Human Approval)
    ↓
Approved Job Data (Persisted)
    ↓
PDF Template Renderer (Phase 2)
    ↓
Work Instruction PDF (Download)
```

---

## API Routes

### Job Management
- `POST /api/harness-instructions/create-job` — Initialize new job
- `GET /api/harness-instructions/get-job` — Retrieve job by ID
- `GET /api/harness-instructions/list-jobs` — List all jobs

### Extraction Workflow
- `POST /api/harness-instructions/upload-source` — Upload source document
- `POST /api/harness-instructions/extract-phase1` — AI extraction
- `POST /api/harness-instructions/save-review` — Save review edits
- `POST /api/harness-instructions/approve-job` — Finalize approval

### Generation
- `POST /api/harness-instructions/generate-pdf` — Render PDF from approved job

---

## Database Schema (Future)

```sql
harness_instruction_jobs (
  id, part_number, revision, status,
  source_document_url, extracted_data,
  approved_data, created_at, approved_at
)
```

---

## UI Routes

- `/harness-instructions` — Main dashboard
- `/harness-instructions/[jobId]` — Job detail + review UI

---

## Non-Goals (This Phase)

- ❌ AI extraction implementation
- ❌ PDF generation logic
- ❌ Database migrations
- ❌ Full UI implementation

---

## Build Phases

**HWI.0** (This Phase) — Scaffolding  
**HWI.1** — Database + Types  
**HWI.2** — AI Extraction  
**HWI.3** — Review UI  
**HWI.4** — PDF Generation  
**HWI.5** — Integration Testing

---

**Last Updated:** 2026-04-10  
**Status:** Scaffold Initialized
