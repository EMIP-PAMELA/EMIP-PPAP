# EMIP-PPAP Build Plan and Governance

## Mission

Build a standalone, production-usable PPAP operations module by Monday that centralizes intake, status, documents, conversations, task flow, and cross-site visibility for PPAP records, including mold/overmold complexity where applicable.

## Build Priorities

1. Get a stable end-to-end vertical slice working first.
2. Prefer clarity and reliability over feature breadth.
3. Every record-changing action must leave an audit trail.
4. Keep architecture simple enough to finish this weekend.
5. Design for multi-site coordination from day one.

## MVP Scope

### In scope

* PPAP record creation
* PPAP list view
* PPAP dashboard/detail page
* Status tracking
* Task tracking
* Internal conversation log tied to each PPAP
* Document vault metadata and upload plumbing
* Mold/overmold tracking fields
* Audit/event log
* Basic role awareness

### Out of scope for v1

* Reliance integration
* ERP integration
* Email ingestion
* OCR or AI document parsing
* Customer-facing portal
* Advanced notifications
* Full permissions matrix
* Reporting beyond basic dashboard counts

## Core User Roles

* **Coordinator**: creates PPAP, assigns ownership, updates intake state
* **Engineer**: completes pre-ack work, records issues, progresses status
* **Quality / Plant**: completes post-ack build and validation tasks
* **Manager / Admin**: monitors load, blockers, aging, and handoffs

## Core Workflow

1. PPAP request received
2. PPAP record created
3. Intake data entered
4. Supporting docs attached
5. Pre-ack tasks assigned
6. Pre-ack work completed
7. Status moved to ready/acknowledged
8. Post-ack tasks assigned
9. Build/validation activity logged
10. Submission prepared
11. Closed/approved/on hold/blocked

## Canonical Statuses

* NEW
* INTAKE_COMPLETE
* PRE_ACK_ASSIGNED
* PRE_ACK_IN_PROGRESS
* READY_TO_ACKNOWLEDGE
* ACKNOWLEDGED
* POST_ACK_ASSIGNED
* POST_ACK_IN_PROGRESS
* AWAITING_SUBMISSION
* SUBMITTED
* APPROVED
* ON_HOLD
* BLOCKED
* CLOSED

## Canonical Tables

* `ppap_records` 
* `ppap_documents` 
* `ppap_conversations` 
* `ppap_tasks` 
* `ppap_events` 

## Required Product Behaviors

### PPAP list

* Filter by status, plant, assignee, customer, due date
* Show aging and overdue items
* Show mold-required indicator

### PPAP dashboard

* Header summary card
* Key identifiers and ownership
* Status and due dates
* Conversation/activity stream
* Documents section
* Tasks/checklist section
* Mold section when applicable
* Event history
* Risks/blockers panel

### Conversation log

* Every PPAP has internal threaded updates or flat chronological notes
* Capture author, site, timestamp, type
* Used to preserve cross-site context and reduce lost information

### Audit trail

* Creation, assignment, status changes, task completion, document additions, major notes
* All timestamps stored in UTC

## Mold / Overmold Requirements

Add first-class support for parts that involve molding or overmolding.

### Required fields

* `process_type` 
* `mold_required` 
* `mold_supplier` 
* `mold_status` 
* `mold_lead_time_days` 

### UI behavior

* Show mold panel only when relevant
* Surface mold status on list and detail pages
* Treat mold delays as blockers/risk signals

## Build Sequence

### Phase 1: Foundation

* Verify local dev runs
* Verify GitHub remote and Vercel deployment
* Verify Supabase connectivity
* Add env handling
* Establish core folder structure

### Phase 2: Data access

* Create typed data access helpers
* Create basic query helpers for ppap records
* Create mutation helpers for create/update actions
* Ensure event log entries are written during mutations

### Phase 3: First vertical slice

* Build PPAP list page
* Build create PPAP form
* Build dashboard detail page
* Confirm create -> view -> update cycle works

### Phase 4: Operational value

* Add conversations
* Add tasks
* Add status transitions
* Add document metadata and storage hooks
* Add mold section and indicators

### Phase 5: Hardening

* Empty states
* Error states
* Loading states
* Validation
* Basic access handling
* Seed data for demos/tests
* Readme and quick-start guide

## Folder Conventions

* Keep feature logic grouped by domain where practical
* Do not bury business logic inside page files
* Prefer small helpers over giant utility files
* Separate database access from presentational components

Suggested structure:

* `app/` 
* `src/lib/` 
* `src/features/ppap/` 
* `src/features/conversations/` 
* `src/features/tasks/` 
* `src/features/documents/` 
* `docs/` 

## Guardrails

1. No schema changes without recording them in the build ledger.
2. No status changes without using canonical status values.
3. No silent destructive deletes.
4. Every mutation should write an event log row when feasible.
5. No feature is done without loading, empty, and error states.
6. No UI work that bypasses the actual data model.
7. Keep dummy/test data clearly labeled.
8. Prefer shipping a narrow working path over broad incomplete scaffolding.

## Definition of Done

A feature is only done when:

* It works against real Supabase data
* Inputs are validated
* Success and failure states are visible
* Event logging is handled where applicable
* The build ledger is updated
* Code is committed with a meaningful message

## Branching and Commit Policy

### Branches

* `main`: always deployable
* `dev`: optional integration branch if needed
* short-lived feature branches if the workflow remains manageable

### Commit rules

* Commit at the end of every meaningful unit of work
* Prefer small commits over giant dumps
* Commit messages must describe the change clearly

Examples:

* `feat: add ppap_records dashboard query` 
* `feat: create ppap intake form` 
* `fix: correct Supabase client import path` 
* `chore: add build ledger and governance docs` 

## Automatic Save / Commit Guidance

### Automatic save

* Enable editor auto-save in Windsurf
* Save after every file edit if auto-save is not trusted

### Automatic commit guidance

Do **not** auto-commit every file keystroke.
Use controlled commit checkpoints instead:

* after schema changes
* after working UI milestones
* after successful end-to-end tests
* after bug fixes

Reason: frequent junk commits make the ledger useless and rollback painful.

## Build Ledger System

Create `docs/BUILD_LEDGER.md` and append entries in reverse chronological order.

### Entry template

```md
## YYYY-MM-DD HH:MM CT - [TYPE] Short title
- Summary:
- Files changed:
- Database changes:
- Decisions made:
- Risks / follow-ups:
- Verification:
- Commit:
```

### Types

* ARCH
* FEAT
* FIX
* DATA
* GOV
* DEPLOY

## Decision Register

Create `docs/DECISION_REGISTER.md`.
Record important architectural decisions.

### Entry template

```md
## DEC-001: Use Next.js + Supabase + Vercel
- Date:
- Status:
- Context:
- Decision:
- Consequences:
```

## Required Docs

Create and maintain:

* `docs/BUILD_PLAN.md` 
* `docs/BUILD_LEDGER.md` 
* `docs/DECISION_REGISTER.md` 
* `docs/WORKFLOW_RULES.md` 
* `docs/DATA_MODEL.md` 
* `docs/ACCEPTANCE_CRITERIA.md` 
* `docs/REPO_GUARDRAILS.md` 

## Repo Agent Operating Rules

Use these rules for Cascade or any repo agent:

1. Make only scoped changes requested by the current task.
2. Prefer minimal working implementations over speculative architecture.
3. Before modifying schema, check DATA_MODEL and BUILD_LEDGER.
4. After each meaningful milestone, update BUILD_LEDGER and suggest a commit.
5. Never rename core business fields casually.
6. Preserve canonical workflow statuses.
7. If a change affects product behavior, update acceptance criteria or workflow docs.
8. Surface uncertainty instead of inventing requirements.
9. Keep code simple, typed, and readable.
10. Do not add libraries unless they clearly reduce delivery risk.

## Immediate Next Tasks

1. Add docs folder and governance files
2. Add Supabase client and env wiring
3. Replace starter homepage with a live dashboard shell
4. Seed 2-3 PPAP records manually in Supabase
5. Build PPAP list page
6. Build create PPAP form
7. Build PPAP dashboard page
8. Add conversation log
9. Add tasks module
10. Add event logging to mutations

## Monday Go-Live Threshold

The app is ready for internal live use when it can:

* create a PPAP
* list PPAPs
* open a PPAP dashboard
* track status
* record internal communication per PPAP
* track tasks
* indicate mold complexity
* preserve an event history

## Notes

This system should feel operational before it feels fancy. The goal is to reduce confusion, protect handoffs, and give everyone one source of truth for PPAP activity across locations.
