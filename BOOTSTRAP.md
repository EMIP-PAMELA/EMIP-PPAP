# EMIP-PPAP Repo Bootstrap

## Primary Directive
Build and maintain EMIP-PPAP as a governed, stable, production-usable PPAP coordination system. Favor correctness, data-model alignment, validation, and controlled expansion over speed, elegance, or speculative architecture.

## Mandatory Preflight (must be performed before every task)
Before making any change, the repo agent must read and comply with these files in this order if they exist:

1. BOOTSTRAP.md
2. AGENT_RULES.md
3. docs/BUILD_PLAN.md
4. docs/BUILD_LEDGER.md
5. docs/DECISION_REGISTER.md
6. docs/REPO_GUARDRAILS.md
7. docs/DATA_MODEL.md
8. docs/WORKFLOW_RULES.md
9. docs/ACCEPTANCE_CRITERIA.md
10. **docs/DTL_SNAPSHOT.md** (before any database-related or schema-related work)
11. **docs/MILEMARKER.md** (before any structure-related or major feature work)

If any of these files are missing, report that clearly before proceeding.

## Required Start-of-Task Output
Before implementation, always state:
- current objective
- relevant constraints
- source of truth files consulted
- impacted files likely to change
- schema/workflow risk
- validation plan
- commit checkpoint plan

Do not begin implementation until this summary is produced.

## Sources of Truth
- The live database schema is authoritative unless explicitly told otherwise.
- Governance docs are authoritative for workflow and constraints.
- Existing working behavior should be preserved unless the current task explicitly changes it.
- **docs/DTL_SNAPSHOT.md is the authoritative database contract** - all code must align to it.
- **docs/MILEMARKER.md is the authoritative build state snapshot** - use it to understand current working state and track deltas.

## Database Translation Layer (DTL) Rules
The repo agent must follow these rules for all database-related work:

1. **Never guess schema** - Always check DTL_SNAPSHOT.md before assuming a column exists
2. **Stop on mismatch** - If code assumes a field that DTL_SNAPSHOT.md doesn't document:
   - Stop implementation immediately
   - Inspect live database or verified schema source
   - Update DTL_SNAPSHOT.md with actual schema
   - Record the delta in BUILD_LEDGER.md
   - Update DECISION_REGISTER.md if the contract changed meaningfully
   - Resume implementation aligned to actual schema
3. **DTL is authoritative** - When DATA_MODEL.md conflicts with DTL_SNAPSHOT.md, DTL wins
4. **Track all schema changes** - Every schema change must update DTL_SNAPSHOT.md and BUILD_LEDGER.md atomically
5. **Validate assumptions** - Before writing queries or mutations, verify columns exist in DTL_SNAPSHOT.md

## Milemarker Rules
The repo agent must follow these rules for build state tracking:

1. **MILEMARKER.md is the build state snapshot** - It documents the current verified working state
2. **Use it to understand context** - Read MILEMARKER.md to know what currently works vs what's disabled
3. **Track deltas not discoveries** - Plan changes as deltas from the documented baseline, don't rediscover the system
4. **Update after milestones** - After major stabilization or feature completion:
   - Update MILEMARKER.md with new verified working state
   - Update "Next Controlled Expansion Candidates" priorities
   - Update timestamp
   - Commit with clear milestone message
5. **Report gaps accurately** - If MILEMARKER.md doesn't match reality:
   - Verify the gap exists in live system
   - Update MILEMARKER.md to reflect actual state
   - Record in BUILD_LEDGER.md

## Scope Control
The repo agent must:
- make the smallest change needed
- avoid unrelated refactors
- avoid speculative improvements
- avoid adding libraries unless explicitly approved
- avoid changing schema unless explicitly approved
- avoid renaming canonical business fields casually
- avoid introducing new architecture unless explicitly requested

## Required Governance Actions Per Meaningful Task
For every meaningful task, the repo agent must:
1. read the mandatory files
2. summarize intended change before implementation
3. implement only the scoped task
4. update docs/BUILD_LEDGER.md
5. update docs/DECISION_REGISTER.md if an actual design decision was made
6. summarize validation results
7. provide exact git commands to commit and push
8. explicitly state whether the task is fully squared away

## Validation Rules
Before claiming a task is complete, the repo agent must verify as applicable:
- TypeScript compiles or likely compiles based on changed surfaces
- imports are valid
- changed code matches the actual data model
- no removed schema fields are still referenced
- no route params are used without guards
- no new query references assume nonexistent columns
- no runtime mutation assumes undefined IDs
- empty, error, and success paths remain sane
- the requested feature actually works end-to-end if testable

If validation cannot be performed, the repo agent must say exactly what remains unverified.

## Build Ledger Requirements
Every meaningful change must append or update docs/BUILD_LEDGER.md with:
- timestamp
- type
- summary
- files changed
- database changes
- decisions made
- risks/follow-ups
- verification
- intended commit message

## Decision Register Requirements
If a task changes architecture, workflow rules, schema strategy, routing strategy, validation approach, or data contract behavior, update docs/DECISION_REGISTER.md with:
- decision id
- date
- context
- decision
- consequences

If no meaningful decision was made, say so explicitly.

## Commit and Push Protocol
No meaningful completed work should be left uncommitted.

At the end of every verified milestone, the repo agent must provide exact commands in this form:

git add .
git commit -m "<clear milestone message>"
git push

The repo agent must not auto-push mentally or assume the task is done until:
- ledger updated
- validation summarized
- exact commit/push commands provided

## Auto-Commit / Auto-Push Policy
- Auto-save is encouraged.
- Auto-commit is allowed only at verified milestone boundaries.
- Auto-push should happen only after validation summary and ledger update.
- Never auto-push uncertain or broken work.
- Never leave the user guessing whether a push is still needed.

## Required End-of-Task Output
At the end of each meaningful task, always output:
- what changed
- files changed
- risks or unresolved items
- validation result
- ledger entry text
- decision entry text if applicable
- exact git add / commit / push commands
- explicit statement: "Task is squared away after push" or "Task is not squared away until push is completed"

## Mandatory Safeguards
The repo agent must stop and report before proceeding if:
- requested code conflicts with live schema
- required governance files are missing and creation was not requested
- route params or IDs are undefined in critical flows
- build errors indicate stale references to removed fields
- database mutations depend on nonexistent columns
- task scope starts drifting beyond the request

## Current Product Priorities
Until explicitly changed, prioritize:
1. stable create/list/detail PPAP flow
2. readable UI over raw debug output
3. conversations, status, and assignment over feature sprawl
4. schema alignment over optimistic coding
5. controlled reintroduction of fields after stability

## Controlled Expansion Rule
After stabilization, add features back one at a time:
- add field
- align schema/code
- validate create/read/update
- ledger update
- commit/push

Never reintroduce multiple data fields at once without a compelling reason.

## Canonical Repo Behavior
The repo agent must behave like a disciplined implementation engineer, not an autonomous architect.

---

## Current Architecture (V3.2F — as of 2026-04-01)

### Tech Stack
- **Framework:** Next.js 16.2 (breaking changes vs prior versions — read `node_modules/next/dist/docs/` before writing any Next.js code)
- **UI:** React 19, Tailwind CSS 4
- **Language:** TypeScript 5
- **Database:** Supabase (PostgreSQL + RLS + Supabase Auth)
- **AI:** Anthropic Claude API — model `claude-sonnet-4-20250514`
- **File parsing:** pdfjs-dist (PDF text extraction), ExcelJS (workbook handling)

### App Directory
The canonical page/route directory is `app/` at the repo root. DIAG-01 confirmed this is the single canonical directory. **Never create routes or pages under `src/app/`.**

### Current Build State
V3.2F-3c is complete. The Document Copilot domain is fully wired end-to-end: BOM PDF upload → text extraction → parsing → normalization → Claude API → draft preview → Vault storage. Outstanding TypeScript errors exist in `app/admin/` pages (see Known Outstanding Issues). No regressions to the PPAP workflow.

### Six-Domain Model

**1. Core Platform**
Owns auth (Supabase Auth), database connection (`src/lib/supabaseClient.ts`), user management (`ppap_users` table), and notification infrastructure. All other domains depend on this layer. Status: operational.

**2. PPAP Workflow**
Owns the PPAP lifecycle state machine, record creation/listing/detail, assignment, required document tracking, and pre-ack/post-ack workflow gates. This is the ONLY domain that may compute or mutate PPAP status and readiness. Status: operational — create/list/detail flow stable.

**3. Document Copilot**
Owns Claude API orchestration, copilot session lifecycle, prompt template registry, BOM parsing pipeline, conversation history, draft document state, and AI provenance metadata. Operates in two modes: PPAP-Bound (auto-loads context) and Standalone (user uploads files). Status: fully wired as of V3.2F-3c.

**4. Engineer Command Center**
Owns the aggregated user-facing work surface — assigned PPAPs, document visibility, copilot sessions, quick actions. This domain is READ-ONLY aggregation only; it must not compute workflow state or mutate any owned domain's data. Status: scaffolded, not fully implemented.

**5. Workspace / Vault**
Owns file storage, organization, and retrieval. All file writes from any domain must go through `src/features/vault/services/vaultService.ts`. Vault is a dumb storage layer — it stores bytes and tracks metadata. It does not interpret content, infer relationships, or make business decisions. Status: service layer implemented; schema migration for `ppap_documents` split deferred.

**6. EMIP**
Owns component master data, SKU definitions, BOM structures, and parent/child product relationships. Currently **fully stubbed** — `getEmipContext()` returns mock data. No persistent EMIP storage exists. Do not attempt real EMIP database queries until EMIP storage is built. Status: stubbed.

---

## Document Copilot Pivot — Architectural Decision (LOCKED)

**This decision is locked. Do not reverse, work around, or reintroduce the prior approach.**

### What Changed and Why

Prior to V3.2F, the system attempted to generate PPAP documents by injecting BOM data directly into Excel cell coordinates in template workbooks. This approach was abandoned after repeated ExcelJS serialization failures caused by corrupted internal workbook metadata (V2.8B.1 through V2.8B.5).

### Current Architecture (Locked)

- **The system does NOT generate documents directly.** Claude API is the document generation engine.
- **Model:** `claude-sonnet-4-20250514`
- **The system is orchestration and governance only.** It assembles inputs, sends them to Claude, receives structured drafts, and routes them through user review to Vault storage.
- **Two modes exist:**
  - **PPAP-Bound:** Context auto-loaded from PPAP record and EMIP stub. Route: `/ppap/[id]/copilot`. Emits `DocumentDraftCreatedEvent` to PPAP Workflow on draft acceptance.
  - **Standalone:** User manually uploads BOM PDF and selects document type. Route: `/copilot`. No PPAP context. Draft stored in Vault as standalone file.
- **Input package sent to Claude:** Raw BOM text + parsed BOM data + normalized BOM (as structured JSON) + optional Excel template (base64) + optional engineering drawing (base64) + PPAP context (PPAP-Bound only).
- **Direct Excel template injection as a GENERATION mechanism is abandoned.** Do not reintroduce ExcelJS as a content generation strategy. **Excel injection as a PRESENTATION layer (injecting Claude-generated content into customer workbook templates) is reinstated as of V3.2G-1.** Generation = Claude. Injection = ExcelJS presentation only. See `docs/BUILD_PLAN.md` V3.2G-1 for full architecture.
- **All Claude output requires explicit user review** before being routed to Vault. Claude drafts are proposals; the user approves.
- **Document Copilot must not mutate PPAP workflow state directly.** It emits events; PPAP Workflow acts on them.

---

## Domain Ownership — Quick Reference

| Domain | Owns | Must NOT |
|--------|------|----------|
| **Core Platform** | Auth, database connection, user management, storage primitives | Own business logic from any other domain |
| **PPAP Workflow** | PPAP status, lifecycle state machine, assignments, readiness, approval eligibility | Delegate status decisions to any other domain |
| **Document Copilot** | Claude API calls, session lifecycle, prompt construction, draft state, conversation history | Mutate PPAP state, finalize documents, store files directly |
| **Engineer Command Center** | Aggregated user work surface, task visibility, quick actions | Compute workflow state, mutate any owned domain's data |
| **Workspace / Vault** | File storage, retrieval, access metadata | Interpret file content, infer meaning, make business decisions |
| **EMIP** | Component data, SKU definitions, BOM structures — **currently STUBBED** | Be queried for real data until persistent EMIP storage is built |

---

## Known Outstanding Issues (must be resolved)

1. **TypeScript errors in `app/admin/customers/page.tsx` and `app/admin/templates/page.tsx`** — Both files import from modules that were deleted or not yet created: `features/auth/userService`, `features/customer/customerService`, `features/documentEngine/templates/registry`, `features/documentEngine/templates/templateIngestionService`, `features/documentEngine/templates/templatePersistenceService`. These pages will not compile until the imports are corrected or the missing modules are created.

2. **EMIP domain has no persistent storage** — `getEmipContext()` in `src/features/documentEngine/stubs/emipContextStub.ts` returns hardcoded mock data. All PPAP-Bound Claude calls use this stub. Real EMIP database tables and query layer have not been built.

3. **`ppap_documents` table schema split deferred** — The architectural plan calls for Vault to take ownership of file storage and `ppap_documents` to be restructured accordingly. The schema migration has not been executed. Current `ppap_documents` table shape does not yet reflect final Vault ownership.

4. **V3.2D temporal gaps not implemented** — Versioned reads, reference integrity enforcement, and event ordering rules were defined in V3.2D but not implemented. These gaps remain open and may affect audit trail reliability.

5. **Supabase credentials must be in `.env.local`** — The app cannot connect to the database until `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set in `.env.local`. This file is gitignored and must be provisioned manually per environment.

---

## Additional Agent Rules (V3.2F)

- **Never reintroduce direct Excel template injection** or cell coordinate mapping as a document generation mechanism. This approach was abandoned after V2.8B failures. The replacement is Claude API generation.
- **Never treat Claude API output as final.** All drafts must go through user review before Vault storage. Claude output is a proposal, not a completed document.
- **Never allow Document Copilot to mutate PPAP workflow state directly.** Use the Event Contract pattern: emit an event, let PPAP Workflow decide what to do with it.
- **Always route file storage through `src/features/vault/services/vaultService.ts`.** No domain may write files to storage by any other path.
- **EMIP context is stubbed.** Do not attempt to query EMIP database tables — they do not exist yet. Use `getEmipContext()` from `src/features/documentEngine/stubs/emipContextStub.ts` until EMIP storage is built.
- **The canonical app directory is `app/`.** Never create pages or routes under `src/app/`. DIAG-01 confirmed `app/` as the single canonical directory.
- **No shell commands in agent prompts** unless the user has explicitly approved them for the current task.
- **Read `node_modules/next/dist/docs/` before writing Next.js code.** This version has breaking changes from training data.

---

## Key File Locations

| File | Purpose |
|------|---------|
| `src/features/documentEngine/core/claudeOrchestrator.ts` | Claude API orchestrator — assembles input package, calls Claude, returns CopilotDraft |
| `src/features/documentEngine/templates/promptRegistry.ts` | Prompt template registry — maps document types to Claude prompt templates |
| `src/features/documentEngine/stubs/emipContextStub.ts` | EMIP stub — returns mock component/BOM data until real EMIP storage is built |
| `src/features/vault/services/vaultService.ts` | Vault service — all file storage must go through this |
| `src/features/documentEngine/entryPoints/` | Copilot entry points — `standaloneCopilot.ts` and `ppapBoundCopilot.ts` |
| `src/features/documentEngine/ui/CopilotWorkspace.tsx` | Main Copilot UI — setup phase, active chat phase, review phase, complete phase |
| `src/features/documentEngine/ui/CopilotChatPanel.tsx` | Chat UI component — sends messages to Claude, renders conversation |
| `src/features/documentEngine/services/copilotSessionManager.ts` | Session manager — in-memory cache + Supabase persistence for copilot sessions |
| `src/features/ppap/utils/stateMachine.ts` | PPAP state machine — single source of truth for PPAP status transitions |
| `src/lib/supabaseClient.ts` | Supabase client — database connection, used by all persistence layers |
| `docs/DTL_SNAPSHOT.md` | Authoritative database schema contract — check before any DB query or mutation |
| `docs/MILEMARKER.md` | Authoritative build state snapshot — check before any structural or feature work |
