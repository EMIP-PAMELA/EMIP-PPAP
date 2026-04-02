# EMIP-PPAP REHYDRATION SNAPSHOT
# Generated: 2026-04-02
# Purpose: Paste into a new Claude chat to fully orient it on this project.
# The new chat cannot access the repo — everything it needs is here.

---

## SECTION 1: PROJECT OVERVIEW

EMIP-PPAP is a web-based PPAP (Production Part Approval Process) coordination and document generation system built for an automotive cable/connector manufacturer. It manages the full lifecycle of PPAP submissions — from initial intake through acknowledgement, document creation, validation, and submission to the customer.

**What it does:**
- Manages PPAP records through a defined lifecycle (NEW → PRE_ACK_IN_PROGRESS → SUBMITTED → APPROVED/REJECTED)
- Tracks which documents are required for each PPAP and whether they are uploaded or generated
- Coordinates assignment of PPAPs to engineers
- Provides an AI-powered Document Copilot that uses Claude to generate PPAP documents from BOM data
- Stores generated and uploaded files in a Vault (Supabase Storage)
- Maintains a complete event-sourced audit trail for every state change

**Who it is for:**
- PPAP Coordinators — manage intake, assignment, acknowledgement, and submission
- Engineers — execute document creation and upload for assigned PPAPs
- QA / Management — review, approve, and gain visibility into workload
- Admins — manage users, upload customer templates, configure system

**What EMIP-PPAP is NOT:**
- Not a document storage system (that is SharePoint/drives)
- Not a customer portal
- Not a generic task tracker
- Not a CRM

**Current system status as of 2026-04-02:**
V3.2F-3c is complete and pushed. The Document Copilot is fully wired end-to-end:
BOM PDF upload → text extraction → parsing → normalization → Claude API → draft preview → Vault storage.
The PPAP workflow (create/list/detail) is stable. The next implementation phase is V3.2G-2 (Excel workbook output).

---

## SECTION 2: TECH STACK

| Layer | Technology | Version / Notes |
|-------|-----------|-----------------|
| Framework | Next.js | 16.2 — HAS BREAKING CHANGES vs prior versions. Read node_modules/next/dist/docs/ before writing any Next.js code. |
| UI | React | 19 |
| Styling | Tailwind CSS | 4 |
| Language | TypeScript | 5 |
| Database | Supabase (PostgreSQL) | With RLS and Supabase Auth |
| AI | Anthropic Claude API | Model: claude-sonnet-4-20250514 |
| PDF parsing | pdfjs-dist | For BOM PDF text extraction |
| Excel handling | ExcelJS | For workbook rendering (presentation layer only — NOT generation) |
| File storage | Supabase Storage | Buckets: ppap-documents (vault), ppap-templates (customer workbooks) |
| Hosting | Vercel | Zero-config deployment |

**Environment variables required in .env.local (gitignored — must be provisioned manually):**
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- ANTHROPIC_API_KEY (server-side only — never expose to browser)

**App Router directory:** The canonical route directory is `app/` at the repo root.
NEVER create routes or pages under `src/app/`. DIAG-01 confirmed app/ as the single canonical directory.

---

## SECTION 3: DOMAIN ARCHITECTURE (V3.2A)

The system is organized into six domains. Each domain has strict ownership boundaries.

---

### Domain 1: Core Platform

**Owns:**
- Supabase Auth (user sessions, login/logout)
- Database connection (`src/lib/supabaseClient.ts`)
- User management (`ppap_users` table)
- Notification infrastructure (defined, not fully implemented)

**Must NOT:**
- Own business logic from any other domain

**Status:** Operational. Auth and DB connection working.

---

### Domain 2: PPAP Workflow

**Owns:**
- PPAP lifecycle state machine (`src/features/ppap/utils/stateMachine.ts`)
- PPAP record creation, listing, and detail
- Assignment of PPAPs to engineers
- Required document tracking and readiness
- Pre-ack / post-ack workflow gates
- Acknowledgement authority (coordinator-only action)
- `ppap.status` — the ONLY source of truth for PPAP status

**Must NOT:**
- Delegate status decisions to any other domain
- Allow direct DB writes to `ppap.status` — all writes go through `updatePPAPState()`

**Status:** Operational. Create/list/detail flow stable. Workflow phase persisted in DB.

**Key rule:** This is the ONLY domain that may compute or mutate PPAP status and readiness.

---

### Domain 3: Document Copilot

**Owns:**
- Claude API orchestration (`src/features/documentEngine/core/claudeOrchestrator.ts`)
- Copilot session lifecycle (`src/features/documentEngine/services/copilotSessionManager.ts`)
- Prompt template registry (`src/features/documentEngine/templates/promptRegistry.ts`)
- BOM parsing pipeline (pdfToText → bomParser → bomNormalizer)
- Conversation history
- Draft document state
- AI provenance metadata

**Must NOT:**
- Mutate PPAP workflow state directly (emits events; PPAP Workflow acts on them)
- Finalize documents without user review
- Store files directly (must go through Vault)

**Two operating modes:**
1. PPAP-Bound: Context auto-loaded from PPAP record + EMIP stub. Route: /ppap/[id]/copilot
2. Standalone: User manually uploads BOM PDF. Route: /copilot. No PPAP context.

**Status:** Fully wired as of V3.2F-3c.

---

### Domain 4: Engineer Command Center

**Owns:**
- Aggregated user-facing work surface
- Assigned PPAPs view
- Document visibility across assignments
- Copilot session history for user
- Quick actions

**Must NOT:**
- Compute workflow state
- Mutate any domain's data
- This domain is READ-ONLY aggregation only

**Status:** Scaffolded. Not fully implemented.

---

### Domain 5: Workspace / Vault

**Owns:**
- File storage and retrieval (`src/features/vault/services/vaultService.ts`)
- Access metadata
- Storage path conventions

**Must NOT:**
- Interpret file content
- Infer relationships between files
- Make business decisions

**Storage buckets:**
- `ppap-documents`: All vault files. Path: `vault/{year}/{month}/{uuid}-{filename}`
- `ppap-templates`: Customer workbook templates. Path: `ppap-templates/{customerName}/workbook.xlsx`

**Rule:** ALL file writes from ANY domain must go through vaultService.ts. No exceptions.

**Status:** Service layer implemented. Schema migration for ppap_documents split deferred.

---

### Domain 6: EMIP

**Owns:**
- Component master data
- SKU definitions
- BOM structures
- Parent/child product relationships

**Must NOT:**
- Be queried for real data until persistent EMIP storage is built (it does not exist yet)

**Status:** FULLY STUBBED. `getEmipContext()` in `src/features/documentEngine/stubs/emipContextStub.ts` returns hardcoded mock data. No EMIP database tables exist. Do not attempt real EMIP queries.

---

### Domain Ownership Quick Reference

| Domain | Owns | Must NOT |
|--------|------|----------|
| Core Platform | Auth, DB connection, user mgmt | Own business logic from other domains |
| PPAP Workflow | PPAP status, state machine, readiness, ack | Delegate status to other domains |
| Document Copilot | Claude calls, session, prompts, drafts | Mutate PPAP state, store files directly |
| Engineer Command Center | Aggregated user work surface | Compute state, mutate data |
| Workspace / Vault | File storage, retrieval, metadata | Interpret content, make decisions |
| EMIP | Component data, SKUs — STUBBED | Be queried until storage is built |

---

## SECTION 4: LOCKED ARCHITECTURAL DECISIONS

These decisions CANNOT be reversed. They are locked in BOOTSTRAP.md and DECISION_REGISTER.md.

---

### LOCK 1: Claude API is the document generation engine (V3.2F-1, LOCKED)

Prior to V3.2F, the system attempted to generate PPAP documents by injecting BOM data directly into Excel cell coordinates. This was abandoned after repeated ExcelJS serialization failures from corrupted internal workbook metadata (phases V2.8B.1 through V2.8B.5).

**What is locked:**
- The system does NOT generate documents directly. Claude API is the generation engine.
- Model: `claude-sonnet-4-20250514`
- The system is orchestration and governance only — it assembles inputs, calls Claude, routes drafts through user review to Vault.
- All Claude output requires explicit user review before Vault storage. Claude drafts are proposals, not completed documents.

**Do not:**
- Reintroduce direct Excel template injection as a generation mechanism
- Reintroduce cell coordinate mapping as primary generation
- Treat Claude output as final without user approval

---

### LOCK 2: Excel injection reinstated as PRESENTATION layer only (V3.2G-1)

Excel injection as a GENERATION mechanism is abandoned (see Lock 1).
Excel injection as a PRESENTATION layer is reinstated as of V3.2G-1.

**What this means:**
- Generation = Claude produces structured JSON
- User approves the draft
- Injection = ExcelJS injects approved content into customer workbook template for delivery
- ExcelJS is cosmetic rendering only. It does not generate content.

**V2.8B.6 rehydration pattern must be preserved:**
Load template → inject → create clean workbook → copy values + safe styles → serialize.
This pattern is already implemented in `src/features/documentEngine/export/excelTemplateInjector.ts`.

---

### LOCK 3: All PPAP status writes through updatePPAPState() only (DEC-016)

- Direct database writes to `ppap.status` are prohibited
- Bypassing the state machine is prohibited
- UI renders based on `ppap.status` — React state cannot override DB
- Single source of truth: `ppap.status` column only

---

### LOCK 4: Pre-ack / post-ack boundary is foundational (DEC-016)

- Pre-ack = validation and readiness (coordinator controls this gate)
- Post-ack = execution and document creation
- The acknowledgement gate is a hard control point — coordinator-only authority
- This boundary cannot be softened or worked around

---

### LOCK 5: Document Copilot must not mutate PPAP workflow state directly

- Use the Event Contract pattern: Copilot emits a DocumentDraftCreatedEvent
- PPAP Workflow decides what to do with that event
- Copilot has no authority to change PPAP status

---

### LOCK 6: All file storage through vaultService.ts

No domain may write files to Supabase Storage by any path other than:
`src/features/vault/services/vaultService.ts`

---

### LOCK 7: EMIP context is stubbed — do not query EMIP tables

EMIP database tables do not exist. Use `getEmipContext()` from the stub file.
Do not attempt real EMIP queries until EMIP storage is explicitly built.

---

### LOCK 8: Canonical app directory is app/ (DIAG-01)

Never create pages or routes under `src/app/`. The canonical directory is `app/` at repo root.

---

### LOCK 9: Soft delete pattern is removed (DEC-009)

`deleted_at` column does not exist in any table. All `.is('deleted_at', null)` filters were removed. Hard deletes only.

---

### LOCK 10: Live database schema is the source of truth (DEC-010)

`supabase/schema.sql` may be outdated. The live Supabase database is authoritative.
Before adding any DB query or mutation, check `docs/DTL_SNAPSHOT.md` for verified schema.
If code assumes a field not in DTL_SNAPSHOT.md: STOP. Verify live DB. Update DTL_SNAPSHOT.md. Then proceed.

---

### LOCK 11: ID validation guards at all query boundaries (DEC-011)

All functions accepting ID parameters must validate the ID is not undefined/null before querying.
Non-UUID strings (e.g. 'current-user', 'test-user') must be coerced to null before Supabase UUID FK columns.
UUID regex: `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`

---

### LOCK 12: Event-sourced audit trail for all mutations (DEC-003)

Every mutation writes to `ppap_events` table with actor, timestamp, event_type, and payload.
This is not optional — it is the compliance and audit mechanism.

---

## SECTION 5: CURRENT BUILD STATE

### What Is Working (as of V3.2F-3c / 2026-04-02)

**PPAP Workflow Domain:**
- PPAP record creation, listing, detail page — stable
- Workflow phase persisted in database (`workflow_phase` column on `ppap_records`)
- Status state machine enforced — valid transitions only
- Event logging on all mutations
- Assignment tracking
- Pre-ack / post-ack boundary enforced
- Conversation log per PPAP
- Task tracking with overdue/priority detection

**Document Copilot Domain — FULLY WIRED:**
- BOM PDF upload → pdfToText extraction → bomParser → bomNormalizer → structured data
- CopilotWorkspace UI (4 phases: setup → active → review → complete)
- CopilotChatPanel — sends messages to Claude, renders conversation
- CopilotDraftPreview — displays Claude-generated draft for review
- Claude Orchestrator — validates inputs, builds message array, calls API, parses response
- Server-side API route (`app/api/copilot/route.ts`) proxies to Anthropic — ANTHROPIC_API_KEY never exposed to browser
- Standalone mode (/copilot route) — user uploads BOM PDF, selects document type
- PPAP-Bound mode (/ppap/[id]/copilot route) — context auto-loaded from PPAP record
- Session persistence via copilotSessionManager (in-memory cache + Supabase)
- UUID validation on `created_by` before Supabase inserts
- State resets correctly on new session start
- Files passed as base64 to Claude API (BOM PDF, Excel template, engineering drawing)
- Draft stored in Vault on approval

**Vault Domain:**
- `vaultService.ts` implemented — `storeFile()`, `retrieveFileUrl()`, `checkFileExists()`, `deleteFile()`
- Files stored at `vault/{year}/{month}/{uuid}-{filename}` in `ppap-documents` bucket

**Core Platform:**
- Supabase client operational (`src/lib/supabaseClient.ts`)
- Auth session available via Supabase Auth

---

### What Is Stubbed

- **EMIP domain** — `getEmipContext()` returns hardcoded mock data. No real EMIP tables exist.
- **ANTHROPIC_API_KEY** — must be in `.env.local` which is gitignored. App will return 500 from /api/copilot if not set.

---

### What Is Scaffolded But Not Fully Implemented

- **Engineer Command Center** — route exists, not fully built
- **Admin pages** — `app/admin/customers/page.tsx` and `app/admin/templates/page.tsx` have broken imports and will not compile (see Outstanding Issues)
- **Customer template admin upload UI** — not built yet (needed for V3.2G-2 Excel output)
- **Export pipeline** — V3.2G-2 scope: `customerTemplateService.ts`, `injectionSchemas.ts`, `exportOrchestrator.ts` not yet created

---

### What Is Defined But Not Implemented

- **V3.2D temporal gaps** — versioned reads, reference integrity enforcement, event ordering rules defined but not implemented
- **ppap_documents schema split** — Vault ownership of file storage architecture defined, migration not run
- **DocumentDraftCreatedEvent** — event contract defined, emission not yet wired to PPAP Workflow state changes

---

## SECTION 6: KEY FILE LOCATIONS

### Governance / Documentation

| File | Purpose |
|------|---------|
| `BOOTSTRAP.md` | Primary directive, mandatory preflight, governance rules, architecture summary |
| `docs/BUILD_PLAN.md` | Implementation-grade architectural blueprint — 12,000+ lines. Read V3.2A+ for current architecture. |
| `docs/BUILD_LEDGER.md` | Reverse-chronological record of every meaningful change |
| `docs/DECISION_REGISTER.md` | All locked architectural decisions with rationale |
| `docs/DTL_SNAPSHOT.md` | Authoritative database schema contract — check before any DB query |
| `docs/MILEMARKER.md` | Authoritative build state snapshot — check before structural/feature work |
| `docs/REPO_GUARDRAILS.md` | Hard rules the agent must never violate |
| `docs/DATA_MODEL.md` | Data model documentation (DTL_SNAPSHOT wins if conflict) |
| `docs/WORKFLOW_RULES.md` | Workflow rules and constraints |
| `docs/ACCEPTANCE_CRITERIA.md` | Feature acceptance criteria |

---

### Core Platform

| File | Purpose |
|------|---------|
| `src/lib/supabaseClient.ts` | Supabase client — used by all persistence layers |

---

### PPAP Workflow Domain

| File | Purpose |
|------|---------|
| `src/features/ppap/utils/stateMachine.ts` | PPAP state machine — single source of truth for status transitions |
| `src/features/ppap/constants/statusFlow.ts` | Canonical status definitions and valid transition map |
| `src/features/ppap/constants/workflowPhases.ts` | Workflow phase constants (INITIATION, DOCUMENTATION, SAMPLE, REVIEW, COMPLETE) |
| `app/ppap/page.tsx` | PPAP listing page |
| `app/ppap/[id]/page.tsx` | PPAP detail / workspace page |
| `app/ppap/[id]/copilot/page.tsx` | PPAP-Bound Copilot entry |

---

### Document Copilot Domain

| File | Purpose |
|------|---------|
| `src/features/documentEngine/core/claudeOrchestrator.ts` | Assembles input package, calls /api/copilot, returns CopilotDraft |
| `src/features/documentEngine/templates/promptRegistry.ts` | Maps document types to Claude prompt templates (system prompt, instructions, output format) |
| `src/features/documentEngine/ui/CopilotWorkspace.tsx` | Main Copilot UI — manages 4 phases: setup, active chat, review, complete |
| `src/features/documentEngine/ui/CopilotChatPanel.tsx` | Chat UI — sends messages to Claude, renders conversation history |
| `src/features/documentEngine/ui/CopilotDraftPreview.tsx` | Draft review UI — displays Claude output for user approval |
| `src/features/documentEngine/services/copilotSessionManager.ts` | Session manager — in-memory cache + Supabase persistence |
| `src/features/documentEngine/persistence/sessionService.ts` | Supabase persistence for copilot sessions. Validates UUID before insert. |
| `src/features/documentEngine/entryPoints/standaloneCopilot.ts` | Entry point for Standalone mode — creates session, returns sessionId |
| `src/features/documentEngine/entryPoints/ppapBoundCopilot.ts` | Entry point for PPAP-Bound mode — loads EMIP context, creates session |
| `src/features/documentEngine/stubs/emipContextStub.ts` | EMIP stub — returns mock data. Only source of EMIP context until real storage is built. |
| `src/features/documentEngine/core/bomParser.ts` | Parses raw BOM text into RawBOMData structure |
| `src/features/documentEngine/core/bomNormalizer.ts` | Normalizes RawBOMData into NormalizedBOM business entities |
| `src/features/documentEngine/utils/pdfToText.ts` | Extracts text from BOM PDF using pdfjs-dist |
| `src/features/documentEngine/types/copilotTypes.ts` | TypeScript types: CopilotInputPackage, CopilotDraft, PromptTemplate, PPAPContext |
| `src/features/documentEngine/types/bomTypes.ts` | TypeScript types: RawBOMData, NormalizedBOM |
| `src/features/documentEngine/export/excelTemplateInjector.ts` | V2.8B.6 rehydration pattern — injects content into customer workbook (presentation only) |

---

### Vault Domain

| File | Purpose |
|------|---------|
| `src/features/vault/services/vaultService.ts` | ALL file storage goes through here. storeFile(), retrieveFileUrl(), checkFileExists(), deleteFile() |

---

### API Routes (Server-Side)

| File | Purpose |
|------|---------|
| `app/api/copilot/route.ts` | Server-side proxy for Claude API. Reads ANTHROPIC_API_KEY. Forwards ClaudeRequest to Anthropic. |

---

### Admin Pages (Currently Broken — See Outstanding Issues)

| File | Purpose |
|------|---------|
| `app/admin/customers/page.tsx` | Customer management — broken imports, will not compile |
| `app/admin/templates/page.tsx` | Template management — broken imports, will not compile |

---

## SECTION 7: OUTSTANDING ISSUES

These are known problems that must be resolved. They are tracked in BOOTSTRAP.md.

**Issue 1: TypeScript errors in admin pages**
`app/admin/customers/page.tsx` and `app/admin/templates/page.tsx` import from modules that were deleted or not yet created:
- `features/auth/userService`
- `features/customer/customerService`
- `features/documentEngine/templates/registry`
- `features/documentEngine/templates/templateIngestionService`
- `features/documentEngine/templates/templatePersistenceService`

These pages will not compile. Fix requires either creating the missing modules or correcting the imports.

**Issue 2: EMIP domain has no persistent storage**
`getEmipContext()` in `src/features/documentEngine/stubs/emipContextStub.ts` returns hardcoded mock data. All PPAP-Bound Claude calls use this stub. Real EMIP database tables and query layer have not been built. Do not attempt to build EMIP storage without explicit instruction.

**Issue 3: ppap_documents table schema split deferred**
The architectural plan calls for Vault to take ownership of file storage and `ppap_documents` to be restructured accordingly. The schema migration has not been executed. Current `ppap_documents` table shape does not reflect final Vault ownership.

**Issue 4: V3.2D temporal gaps not implemented**
Versioned reads, reference integrity enforcement, and event ordering rules were defined in V3.2D but not implemented. These gaps remain open and may affect audit trail reliability.

**Issue 5: Supabase credentials must be in .env.local**
The app cannot connect to the database until `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set in `.env.local`. ANTHROPIC_API_KEY must also be set for the Copilot to work. This file is gitignored and must be provisioned manually per environment.

**Issue 6: DTL_SNAPSHOT.md does not document document session tables**
`docs/DTL_SNAPSHOT.md` was last updated 2026-03-20. It does NOT document `ppap_document_sessions`, `ppap_generated_documents`, or `ppap_session_state` (created in 2026-03-28 migration). This is a governance gap. DTL_SNAPSHOT.md must be updated before any further DB work touching these tables.

**Issue 7: Supabase RLS policies for dev are auth-only**
All `ppap_document_sessions` table RLS policies are `TO authenticated`. In dev, the anon client has no policies. To test session persistence without auth, manually add anon policies in the Supabase dashboard.

---

## SECTION 8: IMMEDIATE NEXT TASKS

In priority order:

**1. V3.2G-2 — Excel Workbook Output Implementation (next planned phase)**
Implement the export pipeline defined in V3.2G-1:
- Create `src/features/documentEngine/export/customerTemplateService.ts` — retrieve customer workbook from Supabase Storage at `ppap-templates/{customerName}/workbook.xlsx`
- Create `src/features/documentEngine/export/injectionSchemas.ts` — per-document-type cell map schemas aligned to Claude output format
- Create `src/features/documentEngine/export/exportOrchestrator.ts` — coordinate draft → template retrieval → injection → Vault storage
- Create `app/api/export/route.ts` — server-side export API route
- Update `CopilotWorkspace.tsx` — add export action to review phase
- Update `promptRegistry.ts` — align output format schemas to injection schemas
- Update `vaultService.ts` — add `getCustomerTemplate()` method

V3.2G-2 readiness criteria (all 6 must be met — all are met as of V3.2G-1):
1. BUILD_PLAN.md V3.2G-1 section written ✓
2. BOOTSTRAP.md Excel injection rule updated ✓
3. excelTemplateInjector.ts V2.8B.6 pattern verified operational ✓
4. Customer template storage path defined ✓
5. Claude output format schemas drafted for at least one document type — TO DO in V3.2G-2
6. V3.2F-3c pipeline confirmed end-to-end ✓

**2. Fix admin page TypeScript errors (Outstanding Issue 1)**
Either create the missing modules or correct the broken imports in:
- `app/admin/customers/page.tsx`
- `app/admin/templates/page.tsx`

**3. Update DTL_SNAPSHOT.md (Outstanding Issue 6)**
Add the three document session tables created in the 2026-03-28 migration:
- `ppap_document_sessions`
- `ppap_generated_documents`
- `ppap_session_state`

**4. MILEMARKER.md update**
MILEMARKER.md should be updated to reflect V3.2F-3c as the current verified working state before structural work begins on V3.2G-2.

---

## SECTION 9: PRODUCT DIRECTION

### The Three-Layer Architecture (V3.1A)

The system is architected as three complementary layers:

**Layer 1 — Global / Organizational PPAP Layer**
System-wide visibility. All PPAPs. Management, coordination, QA.
Entry: `/ppap`, `/ppap/dashboard`

**Layer 2 — PPAP Workspace Layer**
One PPAP at a time. Document creation, workflow execution, pre/post-ack.
Entry: `/ppap/[id]`, `/ppap/[id]/documents`, `/ppap/[id]/copilot`

**Layer 3 — Engineer Command Center**
User-centric. All of a user's assignments aggregated into a single command view.
Entry: `/engineer` (planned)
Status: Scaffolded, not fully built.

---

### Document Creation Workspace — Two Modes

The Document Copilot is the primary document creation mechanism. It operates in two modes:

**PPAP-Bound Mode**
- Launched from within a PPAP workspace
- Context auto-loaded: PPAP record + EMIP stub (component data, operations)
- Route: `/ppap/[id]/copilot`
- On draft acceptance: emits DocumentDraftCreatedEvent to PPAP Workflow
- Session linked to PPAP ID

**Standalone Mode**
- Launched independently, no PPAP context required
- User uploads BOM PDF manually
- User selects document type (PFMEA, Control Plan, Process Flow, etc.)
- Route: `/copilot`
- Draft stored in Vault as standalone file
- Use case: one-off document generation, tools for engineers not tied to a specific PPAP

---

### Balloon Tool (Ballooned Drawing)

Ballooned Drawing is a required PPAP document — an engineering drawing with all dimensions and characteristics numbered (ballooned) to match the Control Plan and PFMEA.

The system's document action system supports `['upload', 'create']` actions per document type. Ballooned Drawing is the only document currently configured with a Create action. The create flow is intended to launch a markup/annotation tool where the engineer can upload a drawing and add balloons interactively.

As of current build state, the Create button is a placeholder — the markup tool route was removed (referenced non-existent `/tools/*` routes). This is a future implementation item.

---

### SharePoint Integration (Future)

The product roadmap includes integration with SharePoint for:
- Automatic folder creation when a new PPAP is initiated (`Create SharePoint folder structure`)
- Upload of the final submission package to the customer's SharePoint folder
- Sync with Reliance (customer submission tracking system)

This integration is defined in BUILD_PLAN.md Phase 3N / future roadmap but has not been implemented. It is not in scope for V3.2G.

---

### EMIP Integration (Future)

EMIP is the component master data system that holds SKU definitions, BOM structures, and parent/child product relationships. Currently fully stubbed. When EMIP storage is built, `getEmipContext()` will be replaced with real database queries, enabling PPAP-Bound Copilot sessions to receive accurate, live component data rather than mock data.

---

### Role Model

Four roles are defined:
- **Admin** — override capability, NOT primary workflow operator
- **Coordinator** — workflow control, acknowledgement authority, assignment management
- **Engineer** — execution, document creation, no workflow control authority
- **Viewer** — read-only

Full RBAC enforcement was deferred for v1 (DEC-007). Currently trust-based. Must be enforced before external users are added.

---

## SECTION 10: GOVERNANCE RULES FOR NEW AGENT

Every agent working on this repo must follow these rules exactly.

---

### Mandatory Preflight (BEFORE EVERY TASK)

Read these files in this order before making any change:
1. BOOTSTRAP.md
2. AGENT_RULES.md
3. docs/BUILD_PLAN.md
4. docs/BUILD_LEDGER.md
5. docs/DECISION_REGISTER.md
6. docs/REPO_GUARDRAILS.md
7. docs/DATA_MODEL.md
8. docs/WORKFLOW_RULES.md
9. docs/ACCEPTANCE_CRITERIA.md
10. docs/DTL_SNAPSHOT.md (before any DB work)
11. docs/MILEMARKER.md (before any structural or feature work)

If any of these files are missing, report it before proceeding.

---

### Required Start-of-Task Output

Before implementation, always state:
- Current objective
- Relevant constraints
- Source of truth files consulted
- Files likely to change
- Schema/workflow risk
- Validation plan
- Commit checkpoint plan

Do not begin implementation until this summary is produced.

---

### Scope Control Rules

- Make the SMALLEST change needed
- Do not refactor code unrelated to the task
- Do not make speculative improvements
- Do not add libraries unless explicitly approved
- Do not change schema unless explicitly approved
- Do not rename canonical business fields casually
- Do not introduce new architecture unless explicitly requested

---

### Database Rules

- NEVER guess schema. Check DTL_SNAPSHOT.md first.
- STOP on mismatch. If code assumes a field not in DTL_SNAPSHOT.md: stop, verify live DB, update DTL_SNAPSHOT.md, then resume.
- DTL_SNAPSHOT.md wins over DATA_MODEL.md if they conflict.
- Every schema change must update DTL_SNAPSHOT.md and BUILD_LEDGER.md atomically.
- All ID parameters must be validated before reaching DB queries.

---

### Architecture Rules

- Never reintroduce Excel injection as a GENERATION mechanism.
- Never treat Claude API output as final. All drafts need user review.
- Never allow Document Copilot to mutate PPAP workflow state directly.
- Always route file storage through vaultService.ts.
- Never query EMIP database tables — they do not exist yet.
- Never create routes or pages under src/app/. Use app/ only.
- Read node_modules/next/dist/docs/ before writing Next.js code — this version has breaking changes.

---

### Required Governance Actions Per Task

For every meaningful task:
1. Read mandatory preflight files
2. Summarize intended change before implementation
3. Implement only the scoped task
4. Update docs/BUILD_LEDGER.md
5. Update docs/DECISION_REGISTER.md if a design decision was made
6. Summarize validation results
7. Provide exact git add / commit / push commands
8. State explicitly: "Task is squared away after push" or "Task is not squared away until push is completed"

---

### Validation Rules (Before Claiming Task Complete)

- TypeScript compiles or likely compiles based on changed surfaces
- Imports are valid
- Changed code matches the actual data model
- No removed schema fields still referenced
- No route params used without guards
- No new queries assume nonexistent columns
- No runtime mutations assume undefined IDs
- Empty, error, and success paths remain sane
- The feature actually works end-to-end if testable

If validation cannot be performed, say exactly what remains unverified.

---

### Commit Protocol

At the end of every verified milestone:
```
git add <specific files>
git commit -m "<clear milestone message>"
git push
```

- Auto-commit only at verified milestone boundaries
- Never auto-push uncertain or broken work
- Never leave the user guessing whether a push is still needed
- Prefer adding specific files by name rather than `git add -A`

---

### Build Ledger Requirements

Every meaningful change must add an entry to docs/BUILD_LEDGER.md (newest at top) with:
- Timestamp
- Type (FEAT, FIX, ARCH, GOV, etc.)
- Summary
- Files changed
- Database changes
- Decisions made
- Risks / follow-ups
- Verification
- Commit message

---

### Primary Product Priorities (Until Explicitly Changed)

1. Stable create/list/detail PPAP flow
2. Readable UI over raw debug output
3. Conversations, status, and assignment over feature sprawl
4. Schema alignment over optimistic coding
5. Controlled reintroduction of fields after stability

---

### Mandatory Safeguards — STOP AND REPORT IF:

- Requested code conflicts with live schema
- Required governance files are missing and creation was not requested
- Route params or IDs are undefined in critical flows
- Build errors indicate stale references to removed fields
- Database mutations depend on nonexistent columns
- Task scope starts drifting beyond the request

---

## APPENDIX: Claude API Proxy Architecture

The Claude API call is proxied server-side to protect the API key.

**Client side (claudeOrchestrator.ts):**
- Builds the complete ClaudeRequest object (model, messages, system prompt, max_tokens, temperature, top_p)
- Posts to `/api/copilot` with Content-Type: application/json only
- No auth headers sent from client
- Model: `claude-sonnet-4-20250514`
- Max tokens: 8000
- Temperature: 0.3, Top-P: 0.9

**Server side (app/api/copilot/route.ts):**
- Reads ANTHROPIC_API_KEY from process.env
- Returns 500 if key not set
- Forwards request to https://api.anthropic.com/v1/messages
- Adds headers: x-api-key, anthropic-version: 2023-06-01
- Returns 502 on network failure, upstream status on Claude API error
- Returns Claude response JSON on success

**Input package sent to Claude includes:**
- System prompt (expert automotive quality engineer persona)
- Document instructions
- BOM raw text
- Parsed BOM data (structured JSON)
- Normalized BOM data (business entities JSON)
- PPAP context (PPAP-Bound mode only)
- EMIP context (stub data, PPAP-Bound mode only)
- Required output format specification
- Optional: Excel template (base64), engineering drawing (base64)

**Response handling:**
- Parses JSON from Claude response (handles markdown code block wrapping)
- Returns CopilotDraft of type: 'draft' | 'question' | 'error'
- Draft includes confidence metadata, uncertain fields list, and assumptions list

---

## APPENDIX: Recent Commit History (Last 10)

1. `8849855` Fix: Validate createdBy as UUID before inserting into Supabase session
2. `9234598` V3.2G-1: Define PPAP workbook output architecture, customer template storage, reinstate Excel injection as presentation layer
3. `7282b85` Fix: Move Claude API call to server-side API route to resolve ANTHROPIC_API_KEY browser access error
4. `d065a56` Fix CopilotWorkspace file state not persisting through phase transition
5. `36d3cb4` Fix: pass null createdBy in Copilot session launch — dev mode has no auth user
6. `7dafd4a` BOOTSTRAP: Update to reflect V3.2F architecture, domain ownership, and outstanding issues
7. `c7dce1b` V3.2F-3c: Wire BOM PDF pipeline, complete draft preview integration
8. `c7f2143` V3.2F-3b: Build CopilotWorkspace, wire full orchestration end-to-end
9. `fa399a2` V3.2F-3a: Build CopilotChatPanel, DraftPreview components and /copilot route
10. `31fbc37` V3.2F-2-CLEANUP: Remove obsolete deterministic generation files, resolve imports

---

## APPENDIX: Build Phase History Summary

| Phase | Description | Status |
|-------|-------------|--------|
| V1-V2.5 | Initial PPAP workflow, schema, stable create/list/detail | Complete |
| V2.6-V2.9B | Excel template injection attempts (abandoned after V2.8B failures) | Abandoned |
| V3.0A | Strategic pivot to Claude API as document generation engine | Architecture locked |
| V3.1A | Engineer Command Center architecture definition | Defined |
| V3.2A | Six-domain system map definition | Complete |
| V3.2B | Domain interface contracts | Complete |
| V3.2C | Domain interaction scenario validation | Complete |
| V3.2D | Failure and edge case scenario validation | Complete (gaps noted) |
| V3.2E | Workspace/Vault domain extraction | Complete |
| V3.2F-1 | Document Copilot domain definition | Complete |
| V3.2F-2 | Claude API core integration, session wiring | Complete |
| V3.2F-3a | CopilotChatPanel, DraftPreview, /copilot route | Complete |
| V3.2F-3b | CopilotWorkspace full orchestration | Complete |
| V3.2F-3c | BOM PDF pipeline, draft preview integration | Complete |
| V3.2G-1 | PPAP workbook output architecture definition | Complete (docs only) |
| V3.2G-2 | Excel workbook output implementation | NEXT — not started |

---

REHYDRATION COMPLETE — confirm understanding before proceeding.
