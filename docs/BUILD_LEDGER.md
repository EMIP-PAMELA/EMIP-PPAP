# Build Ledger

All significant changes to the EMIP-PPAP system are recorded here in reverse chronological order.

---

## 2026-03-20 02:43 CT - [GOV] Add DTL snapshot and build milemarker tracking
- Summary: Extended governance system with Database Translation Layer (DTL) snapshot and build milemarker to track known structure and deltas instead of rediscovering system state
- Files changed:
  - `docs/DTL_SNAPSHOT.md` (created) - Authoritative database schema contract with all 5 tables documented
  - `docs/MILEMARKER.md` (created) - Current verified working build state snapshot
  - `BOOTSTRAP.md` (updated) - Added DTL_SNAPSHOT.md and MILEMARKER.md to mandatory preflight, added DTL and Milemarker rules
  - `docs/BUILD_LEDGER.md` (updated) - This entry
- Database changes: None (documentation only)
- Decisions made:
  - DTL_SNAPSHOT.md is single source of truth for database contract
  - Code must never guess schema, must check DTL first
  - Schema mismatches require stop/inspect/update/resume protocol
  - MILEMARKER.md captures verified working state for delta tracking
  - Milemarker must be updated after every major milestone
- Risks / follow-ups:
  - Must discipline to update DTL when schema changes
  - Must discipline to update Milemarker after milestones
  - Both files must stay synchronized with reality
- Verification:
  - DTL_SNAPSHOT.md documents current minimal schema (9 fields in ppap_records)
  - DTL_SNAPSHOT.md lists all intentionally removed fields
  - MILEMARKER.md documents all currently working flows
  - MILEMARKER.md documents all disabled/removed features
  - BOOTSTRAP.md preflight list includes both new files
  - DTL and Milemarker rules clearly defined in BOOTSTRAP.md
- Commit: `chore: add DTL snapshot and milemarker governance tracking`

---

## 2026-03-20 02:28 CT - [FIX] Fix Next.js 15 async params in dynamic route
- Summary: Fixed "Invalid PPAP ID" error caused by Next.js 15 breaking change where params are now async Promises that must be awaited
- Files changed:
  - `app/ppap/[id]/page.tsx` - Changed params type to Promise<{ id: string }> and added await
- Database changes: None
- Decisions made: None (framework requirement)
- Risks / follow-ups:
  - Debug console.log added temporarily to verify id is received correctly
  - Should be removed after user confirms fix works
  - Other dynamic routes may need same fix if they exist
- Verification:
  - TypeScript compiles with new Promise-based params type
  - Link generation in dashboard confirmed correct: href={`/ppap/${ppap.id}`}
  - Existing validation guards preserved
- Commit: `fix: await async params in Next.js 15 dynamic route`

---

## 2026-03-20 02:00 CT - [FIX] Complete schema stabilization and alignment
- Summary: Performed comprehensive schema alignment to match live Supabase database, removing all references to non-existent fields and implementing validation guards to prevent undefined UUID errors
- Files changed:
  - `src/types/database.types.ts` - Reduced PPAPRecord to 9 minimal safe fields, removed deleted_at from all interfaces
  - `src/features/ppap/queries.ts` - Removed deleted_at filters, added ID validation guards, removed mold_required from stats
  - `src/features/ppap/mutations.ts` - Removed softDeletePPAP, added ID validation, added data.id guard before event logging
  - `src/features/tasks/mutations.ts` - Removed deleted_at filter, removed softDeleteTask, added ppapId validation
  - `src/features/documents/mutations.ts` - Removed deleted_at filter, removed softDeleteDocument, added ppapId validation
  - `src/features/conversations/mutations.ts` - Removed deleted_at filter, added ppapId validation
  - `src/features/events/mutations.ts` - Added ppap_id and ppapId validation guards
  - `src/features/ppap/components/PPAPHeader.tsx` - Removed references to due_date, mold_required, part_name, assigned_to, assigned_role, submission_level
  - `src/features/ppap/components/PPAPListTable.tsx` - Removed assigned_to, due_date, mold_required columns
  - `src/features/ppap/components/MoldSection.tsx` - Replaced with safe placeholder returning null
  - `src/features/ppap/components/CreatePPAPForm.tsx` - Reduced to 4 required fields only
  - `app/ppap/[id]/page.tsx` - Removed MoldSection usage, added ID validation guard
  - `app/page.tsx` - Replaced JSON.stringify debug output with clean table UI
- Database changes: None (aligned code to existing minimal schema)
- Decisions made:
  - Use minimal stable schema (9 fields) for PPAPRecord
  - Remove soft delete pattern entirely (no deleted_at)
  - Validate all IDs before database queries
  - Guard event logging to require valid ppap_id
  - Remove all optional fields until system is stable
- Risks / follow-ups:
  - Optional fields (mold, assignment, dates) can be reintroduced one at a time after stability confirmed
  - AssignmentControl and MoldSection components exist but not used
  - Need to verify Vercel build passes with all changes
- Verification:
  - No deleted_at references remain in codebase
  - All query functions validate IDs before use
  - Dashboard displays table instead of JSON
  - TypeScript types match minimal schema
  - No references to removed fields in active UI
- Commit: `fix: align schema with live database and add ID validation guards`

---

## 2026-03-19 14:30 CT - [FEAT] Complete MVP vertical slice implementation
- Summary: Built complete end-to-end PPAP operations module with list, create, and dashboard pages, plus all supporting data access layer and UI components
- Files changed:
  - `app/ppap/page.tsx` (created) - PPAP list page
  - `app/ppap/new/page.tsx` (created) - Create PPAP form page
  - `app/ppap/[id]/page.tsx` (created) - PPAP dashboard page
  - `src/features/ppap/queries.ts` (created) - Data fetching functions
  - `src/features/ppap/mutations.ts` (created) - Data mutation functions
  - `src/features/ppap/components/PPAPListTable.tsx` (created)
  - `src/features/ppap/components/CreatePPAPForm.tsx` (created)
  - `src/features/ppap/components/PPAPHeader.tsx` (created)
  - `src/features/ppap/components/MoldSection.tsx` (created)
  - `src/features/conversations/mutations.ts` (created)
  - `src/features/conversations/components/ConversationList.tsx` (created)
  - `src/features/tasks/mutations.ts` (created)
  - `src/features/tasks/components/TaskList.tsx` (created)
  - `src/features/documents/mutations.ts` (created)
  - `src/features/documents/components/DocumentList.tsx` (created)
  - `src/features/events/mutations.ts` (created)
  - `src/features/events/components/EventHistory.tsx` (created)
  - `src/lib/utils.ts` (created) - Date formatting and utility functions
  - `src/types/database.types.ts` (created) - TypeScript interfaces for all entities
  - `supabase/schema.sql` (created) - Complete database schema
  - `README.md` (updated) - Comprehensive setup and usage instructions
  - `ENV_TEMPLATE.md` (created) - Environment variable setup guide
- Database changes: Complete schema defined for all 5 tables (ppap_records, ppap_documents, ppap_conversations, ppap_tasks, ppap_events)
- Decisions made: 
  - Feature-based folder structure for maintainability
  - Separate queries and mutations files per feature
  - Client components for interactivity, server components for data fetching
  - Event logging integrated into all mutations
- Risks / follow-ups:
  - User needs to manually create .env.local file (cannot be auto-created due to .gitignore)
  - Database tables must be created in Supabase before app will work
  - No interactive forms for adding conversations/tasks/documents yet (read-only display)
  - Status change and assignment features not yet implemented (coming next)
- Verification: All TypeScript files compile without errors, folder structure matches BUILD_PLAN
- Commit: `feat: implement complete PPAP MVP with list, create, and dashboard pages`

---

## 2026-03-19 14:15 CT - [GOV] Initialize governance documentation
- Summary: Created core governance documents including BUILD_PLAN, BUILD_LEDGER, DECISION_REGISTER, and other required docs to establish project structure and operating rules
- Files changed:
  - `docs/BUILD_PLAN.md` (created)
  - `docs/BUILD_LEDGER.md` (created)
  - `docs/DECISION_REGISTER.md` (created)
  - `docs/DATA_MODEL.md` (created)
  - `docs/WORKFLOW_RULES.md` (created)
  - `docs/ACCEPTANCE_CRITERIA.md` (created)
  - `docs/REPO_GUARDRAILS.md` (created)
- Database changes: None
- Decisions made: Established governance framework for weekend build sprint
- Risks / follow-ups: Need to populate DATA_MODEL with actual schema before creating tables
- Verification: Docs folder created with all required governance files
- Commit: `chore: add governance documentation and project structure`

---

## 2026-03-19 14:07 CT - [ARCH] Add Supabase client and initial setup
- Summary: Created Supabase client configuration and updated homepage to test database connectivity
- Files changed:
  - `src/lib/supabaseClient.ts` (created)
  - `app/page.tsx` (updated)
  - `.env.local` (needs manual creation)
- Database changes: None yet - connectivity test only
- Decisions made: Using @supabase/supabase-js client library with environment variables
- Risks / follow-ups: User needs to manually create .env.local with Supabase credentials
- Verification: Dev server restart required after .env.local creation
- Commit: Initial Supabase setup

---
