# Harness Work Instruction Generator

**Module Status:** Scaffold Initialized (Phase HWI.0)

---

## Purpose

Generate standardized PDF work instructions for wire harness assembly from source documents (BOMs, engineering drawings) using AI extraction + human review workflow.

---

## Architecture

### Two-Phase Workflow

**Phase 1: Extraction + Review**
- Upload source document
- AI extracts assembly steps, materials, tooling
- Human reviews and approves extracted data

**Phase 2: PDF Generation**
- Deterministic template-based rendering
- Approved data drives PDF output
- No AI in generation (100% reproducible)

---

## Module Structure

```
harness-work-instructions/
  components/       # React UI components
  hooks/            # Custom React hooks
  services/         # API clients and business logic
  types/            # TypeScript type definitions
  utils/            # Helper functions
  templates/        # PDF template components
  constants/        # Configuration constants
  README.md         # This file
```

---

## Current Status

**Phase HWI.0 — Scaffolding Complete**

✅ Documentation created  
✅ Folder structure established  
✅ Type definitions scaffolded  
✅ API routes scaffolded  
✅ UI shell created  
⏳ Database schema (future)  
⏳ AI extraction (future)  
⏳ Review UI (future)  
⏳ PDF generation (future)

---

## Integration Points

### API Routes
- `/api/harness-instructions/*` — Job management and workflow

### UI Routes
- `/harness-instructions` — Main dashboard
- `/harness-instructions/[jobId]` — Job detail + review

### Dependencies
- Document engine patterns (reference)
- BOM service (data source)
- File upload utilities (source docs)
- React-PDF (future PDF generation)

---

## Governance Rules

1. **NO AI auto-approval** — All extractions require human review
2. **Deterministic PDFs** — Same data = same PDF
3. **Audit trail** — All review actions logged
4. **Additive only** — No modification of existing EMIP modules
5. **Template versioning** — PDF templates version-controlled

---

## Next Steps

See `docs/modules/harness-work-instructions/BUILD_PLAN.md` for detailed roadmap.

---

**Last Updated:** 2026-04-10  
**Phase:** HWI.0  
**Status:** Foundation Complete
