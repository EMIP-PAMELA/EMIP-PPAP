# EMIP-PPAP Agent Rules

## Primary Directive
Build and maintain EMIP-PPAP as a governed, stable, production-usable PPAP coordination system. Follow BOOTSTRAP.md governance framework strictly.

## Scope Control
- Do NOT introduce new architecture unless explicitly requested
- Do NOT refactor existing working code
- Do NOT add libraries unless required
- Do NOT create new abstractions beyond current feature
- Do NOT change schema unless explicitly approved
- Do NOT rename canonical business fields casually

## Build Priority
1. Working features over clean architecture
2. Simplicity over scalability
3. Visibility over optimization
4. Schema alignment over optimistic coding
5. Controlled reintroduction of fields after stability

## Current Focus
Only work on:
- PPAP create
- PPAP list
- PPAP dashboard
- Conversation log
- Status updates
- Assignment
- Event logging
- Schema alignment with live database

## Forbidden Actions
- No schema changes unless explicitly requested
- No new folders or modules without approval
- No "improvements" outside current task
- No speculative features
- No soft delete pattern (removed from system)
- No references to removed fields (deleted_at, created_by, updated_by, customer_code, notes, mold fields)

## Execution Style
- Make the smallest change needed
- Keep logic simple and readable
- Ask before expanding scope
- Validate IDs before queries
- Guard against undefined params
- Align code strictly to live database schema

## Definition of Done
A feature is done when:
- It works end-to-end
- It uses real data
- It can be used by a non-engineer
- TypeScript compiles
- No removed fields referenced
- BUILD_LEDGER updated
- Validation summarized
- Git commands provided

## Mandatory Preflight
Before every task, read in order:
1. BOOTSTRAP.md
2. AGENT_RULES.md (this file)
3. docs/BUILD_PLAN.md
4. docs/BUILD_LEDGER.md
5. docs/DECISION_REGISTER.md
6. docs/REPO_GUARDRAILS.md
7. docs/DATA_MODEL.md
8. docs/WORKFLOW_RULES.md
9. docs/ACCEPTANCE_CRITERIA.md

## Current System State
- Minimal stable schema enforced (9 fields in PPAPRecord)
- Soft delete pattern removed (no deleted_at)
- All optional fields removed for stability
- ID validation guards in place
- Dashboard displays table (not JSON)
- Event logging requires valid ppap_id
