# Build Milemarker

**Last Updated:** 2026-03-20 14:17 CT  
**Current Milestone:** ✅ PHASE 7 COMPLETE - Status Workflow Implemented

## Purpose

This file captures the **current verified working state** of the EMIP-PPAP application. It allows future work to compare deltas instead of rediscovering the entire system.

## Current Verified Working Flows

### ✅ PPAP Create Flow
- **Entry point:** `/ppap/new`
- **Form fields:** 4 required (part_number, customer_name, plant, request_date)
- **Validation:** Client-side required field checks
- **Submission:** Creates PPAP with status 'NEW', auto-generates ppap_number
- **Event logging:** Logs PPAP_CREATED event with basic fields
- **Redirect:** Returns to list page on success
- **Status:** ✅ Working end-to-end with minimal schema

### ✅ PPAP List Flow
- **Entry point:** `/ppap`
- **Data source:** getAllPPAPs() query
- **Display:** Table with 6 columns (PPAP Number, Part Number, Customer, Plant, Status, Request Date)
- **Interaction:** Clickable PPAP number links to detail page
- **Filters:** Not yet implemented (planned)
- **Empty state:** Shows "Create First PPAP" button
- **Status:** ✅ Working, displays real data

### ✅ PPAP Detail/Dashboard Flow
- **Entry point:** `/ppap/[id]`
- **Params:** Next.js 15 async params (must await)
- **ID validation:** Guards against undefined ID before queries
- **Queries:** Parallel fetch of PPAP + conversations + tasks + documents + events
- **Layout:** 2-column grid (left: conversations/tasks/docs, right: events)
- **Components:** PPAPHeader, ConversationList, TaskList, DocumentList, EventHistory
- **Error handling:** Shows error banner if PPAP not found or query fails
- **Display fields:** ppap_number, part_number, customer_name, plant, status, request_date, created_at
- **Status:** ✅ Stable - aligned to DTL_SNAPSHOT.md confirmed fields only

### ✅ Dashboard Home Flow
- **Entry point:** `/` (root)
- **Data source:** First 10 PPAP records
- **Display:** Clean table (replaced JSON.stringify debug output)
- **Interaction:** Clickable PPAP numbers link to detail
- **Link format:** `href={`/ppap/${ppap.id}`}`
- **Status:** ✅ Working, displays table not JSON

---

## Current Simplified UI State

### What's Working
- ✅ Create PPAP form (4 fields only)
- ✅ PPAP list table with clickable rows
- ✅ PPAP detail page with header and event history
- ✅ Event logging on create
- ✅ Clean dashboard table (no JSON output)
- ✅ Error states for missing/invalid IDs
- ✅ Loading states (implicit via Next.js server components)

### What's Disabled/Removed
- ❌ MoldSection component (exists but returns null, mold fields removed)
- ❌ AssignmentControl component (exists but not used, assignment fields removed)
- ❌ Status update UI (planned, not implemented)
- ❌ Assignment UI (planned, not implemented)
- ❌ Mold tracking UI (removed until schema stabilizes)
- ❌ Due date tracking (removed until schema stabilizes)
- ❌ Priority tracking (removed until schema stabilizes)
- ❌ Interactive conversation/task/document forms (display-only)
- ❌ Filters on list page (planned, not implemented)
- ❌ Soft delete (pattern removed entirely)

---

## Current Schema Strategy

### Minimal Stable Schema (9 fields)
The system enforces a **minimal guaranteed safe field set** for `ppap_records`:
- `id`, `ppap_number`, `part_number`, `customer_name`, `plant`
- `status`, `request_date`, `created_at`, `updated_at`

### Why Minimal?
- Live database schema did not match code assumptions
- Multiple runtime errors (missing columns, invalid UUIDs)
- Schema mismatch caused query failures
- Decision: Reduce to known safe baseline, expand controllably

### Removed Fields (Intentional)
See DTL_SNAPSHOT.md for complete list. All removed fields documented in:
- BUILD_LEDGER.md (2026-03-20 02:00 CT entry)
- DECISION_REGISTER.md (DEC-008, DEC-009)
- DATA_MODEL.md (Fields Removed for Stability section)

### Controlled Expansion Rule
From BOOTSTRAP.md:
1. Add one field at a time
2. Verify field exists in live database
3. Update DTL_SNAPSHOT.md
4. Align TypeScript types
5. Validate create/read/update
6. Update BUILD_LEDGER.md
7. Commit atomic change
8. Repeat for next field

---

## Current Known Limitations

### Schema Limitations
- No assignment tracking (assigned_to, assigned_role fields removed)
- No mold tracking (mold_required, mold_supplier, etc. removed)
- No workflow dates (due_date, acknowledged_date, etc. removed)
- No priority levels (priority field removed)
- No soft delete (deleted_at removed entirely)
- No user tracking (created_by, updated_by removed)

### UI Limitations
- List page has no filters (status, plant, customer planned)
- Detail page has no edit capability
- No status update UI
- No assignment UI
- Conversations/tasks/documents display-only (no add/edit/delete)
- No dashboard analytics/stats (planned)

### Validation Limitations
- ID validation guards in place but basic (just check undefined)
- No UUID format validation
- No business rule validation (e.g., status transitions)
- No duplicate PPAP number prevention (relies on DB unique constraint)

### Architecture Limitations
- No authentication/authorization (trust-based)
- No role-based access control (roles exist in data but not enforced)
- No real-time updates (static server-rendered pages)
- No optimistic UI updates
- No client-side state management
- No form libraries (vanilla HTML forms)

---

## Next Controlled Expansion Candidates

### Priority 1: Core Workflow
1. **Status update UI** - Allow manual status changes with validation
2. **Status transition rules** - Enforce valid state machine (see WORKFLOW_RULES.md)
3. **Assignment fields** - Reintroduce `assigned_to`, `assigned_role` to schema and UI
4. **Assignment UI** - Allow assigning PPAPs to engineers

### Priority 2: Critical Dates
5. **Due date field** - Reintroduce `due_date` for workflow tracking
6. **Overdue tracking** - Calculate and display overdue PPAPs
7. **Workflow dates** - Reintroduce `acknowledged_date`, `submitted_date`, `approved_date`

### Priority 3: Enhanced Tracking
8. **Mold tracking** - Reintroduce `mold_required`, `mold_supplier`, `mold_status`
9. **Priority levels** - Reintroduce `priority` field (NORMAL, HIGH, CRITICAL)
10. **Part metadata** - Reintroduce `part_name`, `revision`, `submission_level`

### Priority 4: Interactions
11. **Add conversation UI** - Form to create new conversation entries
12. **Add task UI** - Form to create and complete tasks
13. **Document upload** - Actual file upload integration (currently metadata-only)

### Priority 5: Filters and Search
14. **List filters** - Status, plant, customer, assignee filters
15. **Search** - Part number and customer name search
16. **Dashboard stats** - Count by status, overdue count, etc.

---

## Verification Checklist

Use this to verify system is in expected state:

### Database
- [ ] ppap_records has exactly 9 columns (see DTL_SNAPSHOT.md)
- [ ] No deleted_at column in any table
- [ ] ppap_events table exists and logs all mutations
- [ ] Foreign keys enforced (ppap_id → ppap_records.id)

### Code
- [ ] src/types/database.types.ts PPAPRecord has 9 fields only
- [ ] No references to deleted_at in queries or mutations
- [ ] ID validation guards in place (getPPAPById, getEventsByPPAPId, etc.)
- [ ] No references to removed fields (mold_*, assigned_*, due_date, etc.) in active UI

### UI
- [ ] /ppap/new form has 4 fields only
- [ ] /ppap list displays table (not JSON)
- [ ] /ppap/[id] detail page loads without "Invalid PPAP ID" error
- [ ] / dashboard displays table (not JSON)
- [ ] MoldSection component returns null
- [ ] AssignmentControl not rendered

### Functionality
- [ ] Can create new PPAP
- [ ] Can view PPAP list
- [ ] Can click PPAP to view detail
- [ ] Can see event history
- [ ] PPAP_CREATED event logged on create

---

## How to Use This File

**When starting a new task:**
1. Read this file to understand current working state
2. Identify what currently works vs what's disabled
3. Plan changes as deltas from this baseline
4. Don't rediscover or re-verify what's already documented here

**When completing a milestone:**
1. Update this file with new verified working state
2. Move items from "disabled" to "working" if they're now functional
3. Update "Next Controlled Expansion Candidates" to reflect new priorities
4. Update timestamp at top of file
5. Commit with milestone message

**When discovering a gap:**
1. Don't assume file is wrong
2. Verify gap exists in live system
3. Update this file if state changed
4. Record in BUILD_LEDGER.md

---

## Change History

| Date | Milestone | Key Changes |
|------|-----------|-------------|
| 2026-03-20 14:17 CT | Phase 7 Complete - Status Workflow | Implemented controlled status workflow with validated transitions (NEW→PRE_ACK→SUBMITTED→APPROVED/REJECTED). UI enforces valid transitions only. APPROVED state locked. Event logging enhanced with from/to tracking. Visual status indicators with color coding. No schema changes. |
| 2026-03-20 13:02 CT | Document Upload + PPAP Deletion | Implemented document upload with Supabase Storage (bucket: ppap-documents, path: ppap/{id}/{filename}). Added PPAP deletion with confirmation dialog and event logging before delete. Both features use DTL-verified fields only. No permissions system. |
| 2026-03-20 11:49 CT | Status Update UI Fixed | Fixed StatusUpdateControl error handling. Now properly checks Supabase errors before calling router.refresh(). Status updates provide user feedback on failure. UI only refreshes on successful database update. |
| 2026-03-20 04:31 CT | Phase 2 Complete - Tasks System | Implemented Phase 2 from BUILD_PLAN. Reintroduced task fields (assigned_to, due_date, phase, title, completed_at) from DTL. Created AddTaskForm component. Added Mark Complete workflow. Event logging on create/complete. Tasks now fully functional. |
| 2026-03-20 04:06 CT | Documents Module Aligned | Aligned documents module to verified DTL schema. Fixed field names: document_name→file_name, document_type→category, storage_path→file_url. Removed non-existent fields (file_size_bytes, mime_type, etc.). Documents now functional with correct schema. |
| 2026-03-20 03:57 CT | DTL Verified - System Aligned | **FULL DTL REBASELINE:** Verified all 5 tables against live Supabase. Rewrote DTL_SNAPSHOT.md with actual schemas. Discovered extensive mismatches (conversations: body/site, documents: file_name/category/file_url, tasks: assigned_to/due_date exist). DTL now authoritative. Documented controlled re-expansion roadmap. |
| 2026-03-20 03:40 CT | Critical Schema Alignment | **CRITICAL:** DTL_SNAPSHOT.md was completely wrong for ppap_conversations. Verified actual schema from live DB. Column is `body` not `message`, `site` not `author_site`. Fixed all code to match reality. DTL unreliable for all tables. |
| 2026-03-20 03:35 CT | Add Note Functional | Fixed DTL mismatch - removed author_site from ppap_conversations (doesn't exist in live DB). Debug logging confirmed button state correct. Add Note now creates conversations successfully. |
| 2026-03-20 03:21 CT | Conversations Schema Corrected | Fixed DTL mismatch - removed author_role from ppap_conversations (doesn't exist in live DB). Updated DTL_SNAPSHOT.md, removed all code references. Conversations now display author only. |
| 2026-03-20 03:01 CT | Documents Schema Corrected | Fixed DTL mismatch - removed uploaded_at from ppap_documents (doesn't exist in live DB). Updated DTL_SNAPSHOT.md, removed all code references. Documents now display without timestamp. |
| 2026-03-20 02:52 CT | Detail Page Stabilized | Removed debug logging, verified all components use only DTL confirmed fields. PPAPHeader displays 7 confirmed fields. No invalid schema references found. |
| 2026-03-20 02:43 CT | Minimal Stable Schema Enforced | Initial milemarker snapshot after schema stabilization. Documented working create/list/detail flows, disabled features, and controlled expansion roadmap. |
