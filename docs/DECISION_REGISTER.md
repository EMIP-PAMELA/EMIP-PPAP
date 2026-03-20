# Decision Register

Important architectural and design decisions for EMIP-PPAP.

---

## DEC-013: Client-Side Task Filtering and Priority Model
- Date: 2026-03-20
- Status: Accepted
- Context: Tasks needed intelligent prioritization and filtering to transform system from passive tracking to active work management. Users needed to quickly identify overdue and high-priority work without navigating through all tasks.
- Decision: Implement client-side task filtering with priority-based sorting. Overdue tasks automatically float to top. Visual indicators (red borders, badges) for overdue/due-today. All filtering logic derived from existing DTL fields (due_date, status, completed_at). No server-side changes.
- Consequences:
  - ✅ Overdue tasks immediately visible (red indicators)
  - ✅ Priority sorting automatic (no manual intervention)
  - ✅ Multiple filter dimensions (status, due date, assignee)
  - ✅ Quick toggles for common workflows
  - ✅ Task metrics visible at PPAP level
  - ✅ Client-side only (no database queries)
  - ✅ Performant with memoization
  - ✅ No schema changes required
  - ⚠️ Filtering happens after data fetch (not server-side)
  - ⚠️ Priority logic hardcoded in client
  - ⚠️ Large task lists (100+) may need pagination later
- Implementation:
  - `taskUtils.ts` - Priority detection and sorting logic
  - Priority order: Overdue → Due Today → In-Progress → Pending → Completed
  - Visual indicators: Red (overdue), Yellow (due today), Gray (normal)
  - Filters: Status, Due Date, Assignee + Quick toggles
  - Task summary in PPAPHeader: Total/Active/Completed/Overdue

---

## DEC-012: Controlled Status Transition Model
- Date: 2026-03-20
- Status: Accepted
- Context: Status workflow needed strict enforcement to prevent invalid state transitions and ensure PPAP process integrity. Previous implementation allowed any status change without validation.
- Decision: Implement controlled status workflow with canonical flow (NEW → PRE_ACK_IN_PROGRESS → SUBMITTED → APPROVED/REJECTED) defined in code constants. UI enforces valid transitions only. APPROVED state is locked (finalized). Event logging enhanced to track from/to states.
- Consequences:
  - ✅ Status transitions strictly validated
  - ✅ UI prevents invalid status changes
  - ✅ APPROVED state cannot be changed (finalized)
  - ✅ Clear audit trail with from/to tracking
  - ✅ Visual status indicators (color coding)
  - ✅ Rejected PPAPs can return to PRE_ACK_IN_PROGRESS for rework
  - ✅ No schema changes required (uses existing status field)
  - ⚠️ Status workflow changes require code updates
  - ⚠️ Must maintain STATUS_TRANSITIONS map in statusFlow.ts
  - ⚠️ Dropdown only shows valid transitions (reduced flexibility)
- Implementation:
  - `src/features/ppap/constants/statusFlow.ts` - Canonical status definitions
  - `src/features/ppap/utils/statusStyles.ts` - Visual color indicators
  - `StatusUpdateControl` - Enforces transitions, locks APPROVED
  - Event logging: `{ from: oldStatus, to: newStatus }`

---

## DEC-008: Minimal stable schema enforcement
- Date: 2026-03-20
- Status: Accepted
- Context: Live database schema did not match code expectations, causing multiple runtime errors (missing columns, invalid UUIDs). System was unstable due to references to non-existent fields.
- Decision: Reduce PPAPRecord to minimal guaranteed safe field set (9 fields only: id, ppap_number, part_number, customer_name, plant, status, request_date, created_at, updated_at). Remove all optional fields until system is proven stable.
- Consequences:
  - ✅ System stability guaranteed - no schema mismatch errors
  - ✅ Code strictly aligned to live database
  - ✅ Create/read/update operations will succeed
  - ✅ Clear baseline for controlled expansion
  - ⚠️ Reduced functionality temporarily (no mold tracking, assignment, dates)
  - ⚠️ Must reintroduce fields one at a time with validation
  - ⚠️ Some UI components (MoldSection, AssignmentControl) exist but unused

---

## DEC-009: Remove soft delete pattern
- Date: 2026-03-20
- Status: Accepted
- Context: Code referenced deleted_at column across all tables (ppap_records, ppap_tasks, ppap_documents, ppap_conversations) but column did not exist in live database, causing query failures.
- Decision: Remove soft delete pattern entirely. Remove all deleted_at references, remove all .is('deleted_at', null) filters, remove softDelete functions.
- Consequences:
  - ✅ Queries work without deleted_at column
  - ✅ Simpler data model
  - ✅ No hidden/filtered records
  - ⚠️ No soft delete capability (hard deletes only if needed)
  - ⚠️ Cannot restore deleted records
  - ⚠️ May need to reintroduce if audit requirements demand it

---

## DEC-010: Strict live database schema alignment
- Date: 2026-03-20
- Status: Accepted
- Context: Multiple schema mismatches between code and live database caused runtime failures. supabase/schema.sql did not reflect actual deployed schema.
- Decision: Treat live Supabase database as single source of truth. Code must align to actual schema, not schema.sql. Add validation guards to prevent undefined IDs from reaching database queries.
- Consequences:
  - ✅ Runtime errors eliminated
  - ✅ Code guaranteed to work with actual database
  - ✅ Clear validation at function boundaries
  - ✅ Prevents invalid UUID errors
  - ⚠️ schema.sql file may be outdated/incorrect
  - ⚠️ Must verify schema before adding fields
  - ⚠️ Requires discipline to check live DB before coding

---

## DEC-011: ID validation guards at all query boundaries
- Date: 2026-03-20
- Status: Accepted
- Context: Undefined IDs were being passed to database queries, causing "invalid input syntax for type uuid: 'undefined'" errors.
- Decision: Add validation guards at start of all functions that accept ID parameters. Throw early with clear error message if ID is undefined or missing.
- Consequences:
  - ✅ Prevents undefined UUID errors
  - ✅ Clear error messages for debugging
  - ✅ Fails fast at function boundary
  - ✅ Protects database from invalid queries
  - ⚠️ Adds boilerplate to every query function
  - ⚠️ Must remember to add guards to new functions

---

## DEC-001: Use Next.js + Supabase + Vercel
- Date: 2026-03-19
- Status: Accepted
- Context: Need to build production-ready PPAP operations module by Monday with minimal infrastructure overhead
- Decision: Use Next.js 15 (App Router) for frontend/backend, Supabase for database and auth, Vercel for hosting
- Consequences:
  - ✅ Fast development with server components and server actions
  - ✅ Built-in auth and real-time capabilities via Supabase
  - ✅ Zero-config deployment via Vercel
  - ✅ TypeScript support throughout stack
  - ⚠️ Vendor lock-in to Supabase ecosystem
  - ⚠️ Learning curve for Next.js 15 App Router patterns

---

## DEC-002: Canonical status workflow
- Date: 2026-03-19
- Status: Accepted
- Context: Need clear, enforceable workflow states that reflect actual PPAP process across multiple sites
- Decision: Define 14 canonical statuses (NEW → INTAKE_COMPLETE → ... → CLOSED) that must be preserved in code
- Consequences:
  - ✅ Clear handoff points between roles
  - ✅ Prevents ad-hoc status proliferation
  - ✅ Enables reliable reporting and filtering
  - ⚠️ Status changes require code updates if workflow evolves
  - ⚠️ Must enforce in database constraints and UI

---

## DEC-003: Event-sourced audit trail
- Date: 2026-03-19
- Status: Accepted
- Context: Need complete audit trail for compliance and debugging cross-site handoffs
- Decision: Every mutation writes to ppap_events table with actor, timestamp, event_type, and payload
- Consequences:
  - ✅ Complete audit history
  - ✅ Can reconstruct state at any point in time
  - ✅ Supports debugging and compliance
  - ⚠️ Adds write overhead to every mutation
  - ⚠️ Event table will grow large over time

---

## DEC-004: Feature-based folder structure
- Date: 2026-03-19
- Status: Accepted
- Context: Need to organize code by domain to keep business logic separate from presentation
- Decision: Use `src/features/{ppap,conversations,tasks,documents}` structure with data access separated from UI
- Consequences:
  - ✅ Clear separation of concerns
  - ✅ Easier to locate related functionality
  - ✅ Supports parallel development
  - ⚠️ May require refactoring as features grow
  - ⚠️ Need discipline to avoid circular dependencies

---

## DEC-005: Mold tracking as first-class concern
- Date: 2026-03-19
- Status: Accepted
- Context: Mold/overmold complexity is critical path item that often causes delays
- Decision: Add mold-specific fields directly to ppap_records table and surface prominently in UI
- Consequences:
  - ✅ Mold status visible at a glance
  - ✅ Can filter and report on mold-related delays
  - ✅ Treats mold as blocker/risk signal
  - ⚠️ Adds complexity to intake form
  - ⚠️ Fields may be null for non-mold parts

---

## DEC-006: Internal conversation log per PPAP
- Date: 2026-03-19
- Status: Accepted
- Context: Cross-site communication often lost in email threads; need centralized context
- Decision: Add ppap_conversations table with flat chronological notes tied to each PPAP record
- Consequences:
  - ✅ Preserves cross-site context
  - ✅ Reduces information loss during handoffs
  - ✅ Single source of truth for internal updates
  - ⚠️ Users must adopt new communication pattern
  - ⚠️ May duplicate some email content initially

---

## DEC-007: Minimal permissions for v1
- Date: 2026-03-19
- Status: Accepted
- Context: Full RBAC system would delay Monday go-live
- Decision: Basic role awareness (coordinator, engineer, quality, manager) without enforced permissions in v1
- Consequences:
  - ✅ Faster delivery
  - ✅ Can add enforcement later
  - ⚠️ Trust-based access control initially
  - ⚠️ Must add proper permissions before external users

---
