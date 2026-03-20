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
