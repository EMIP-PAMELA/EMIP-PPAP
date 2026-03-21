# EMIP-PPAP Build Plan

**Last Updated:** 2026-03-20 04:20 CT  
**Status:** Phase-Driven, DTL-Aligned Execution Plan

---

## Mission

Build a production-usable PPAP operations module that centralizes intake, status, documents, conversations, task flow, and cross-site visibility for PPAP records across all EMIP locations.

**Goal:** Operational by Monday - reduce confusion, protect handoffs, provide single source of truth.

---

## System Scope

### In Scope

**Core PPAP Management:**
- PPAP record creation and tracking
- PPAP list view with filtering and sorting
- PPAP dashboard/detail page
- Status workflow tracking
- Task assignment and tracking
- Internal conversation log (cross-site communication)
- Document vault (metadata and storage)
- Event audit trail (immutable history)
- Multi-site coordination

**PPAP Intake:**
- PPAP Intake (manual entry, structured initiation)
- Data normalization layer for all PPAP inputs
- Phase-based workflow execution

**Data Integrity:**
- Validated inputs
- Required field enforcement
- Event logging for all mutations
- Immutable audit trail

**User Experience:**
- Loading states
- Empty states
- Error states
- Clear feedback on actions

### Explicitly Out of Scope (v1)

- ❌ Reliance integration
- ❌ ERP integration
- ❌ Email ingestion or parsing
- ❌ OCR or AI document processing
- ❌ Customer-facing portal
- ❌ Advanced notifications or alerts
- ❌ Full permissions matrix (trust-based for v1)
- ❌ Reporting beyond basic dashboard counts
- ❌ Real-time collaboration features
- ❌ Mobile-specific UI
- ❌ Mold tracking (removed from v1 scope)
- ❌ Direct API integrations with external systems (future phase)
- ❌ Real-time synchronization with customer systems
- ❌ External system schema dependency

---

## PPAP Intake Architecture

**Status:** AUTHORITATIVE

### Overview

The system shall implement a normalized PPAP intake layer that governs how all PPAP records enter the system.

### Intake Sources

All PPAPs must originate from one of the following sources:

1. **Manual Entry** (current state)
   - Internal users create PPAP records directly in the system
   - Structured initiation forms guide data entry
   - Immediate validation and normalization

2. **Customer Portal** (future state)
   - External users initiate PPAP requests
   - Self-service intake with guided workflows
   - Auto-population where possible

3. **External System Integration** (future state)
   - Rheem ETQ Reliance
   - Trane Windchill
   - Other OEM PPAP systems
   - API-based or file-based ingestion

### Core Principle

**All incoming PPAP data must be normalized into the system's internal data model before being persisted.**

- **Internal schema (DTL_SNAPSHOT.md) is the single source of truth**
- **External systems must map INTO the internal model**
- **External schemas must NEVER dictate internal structure**

### Design Intent

This architecture ensures:

- **Consistent data structure** across all PPAPs regardless of source
- **Elimination of schema drift** from external system changes
- **Clean upgrade path to integration** without breaking existing functionality
- **Ability to support multiple customer systems** with different data models
- **System autonomy** - external systems initiate, internal system governs

### Normalization Layer

All intake sources flow through a normalization layer that:

1. **Validates** required fields and data types
2. **Maps** external field names to internal schema
3. **Enriches** data with system-generated metadata
4. **Logs** intake events for audit trail
5. **Persists** only normalized data to database

### Integration Philosophy

**Integration is an input mechanism, not a control mechanism.**

External systems may:
- ✅ Initiate PPAP requests
- ✅ Provide initial data
- ✅ Request status updates

External systems may NOT:
- ❌ Dictate internal workflow
- ❌ Override internal validation
- ❌ Bypass normalization layer
- ❌ Directly modify internal schema

---

## Core User Roles

| Role | Responsibilities |
|------|-----------------|
| **Coordinator** | Creates PPAP, enters intake data, assigns ownership, monitors progress |
| **Engineer** | Completes pre-ack work, records technical issues, updates status |
| **Quality / Plant** | Completes post-ack build and validation, updates completion status |
| **Manager / Admin** | Monitors workload, blockers, aging, handoffs across sites |

---

## Canonical Workflow

1. **PPAP request received** → Coordinator creates record
2. **Intake data entered** → Part details, customer, plant, request date
3. **Pre-ack tasks assigned** → Engineering work identified
4. **Pre-ack work completed** → Technical review, tooling, samples
5. **Status moved to acknowledged** → Ready for production validation
6. **Post-ack tasks assigned** → Build, test, validate
7. **Build/validation logged** → Quality checks, measurements
8. **Submission prepared** → Documentation package assembled
9. **PPAP submitted** → Sent to customer
10. **Approved/closed** → Customer approval received

---

## Canonical Statuses

| Status | Meaning |
|--------|---------|
| `NEW` | PPAP request created, intake pending |
| `INTAKE_COMPLETE` | All initial data entered |
| `PRE_ACK_ASSIGNED` | Engineering tasks assigned |
| `PRE_ACK_IN_PROGRESS` | Engineering work underway |
| `READY_TO_ACKNOWLEDGE` | Pre-ack complete, ready for ack |
| `ACKNOWLEDGED` | Officially acknowledged with customer |
| `POST_ACK_ASSIGNED` | Build/validation tasks assigned |
| `POST_ACK_IN_PROGRESS` | Build/validation underway |
| `AWAITING_SUBMISSION` | Package ready, pending submission |
| `SUBMITTED` | Submitted to customer |
| `APPROVED` | Customer approved |
| `ON_HOLD` | Temporarily paused |
| `BLOCKED` | Blocked by external dependency |
| `CLOSED` | Complete and archived |

---

## DTL Dependency Rule

**CRITICAL: No feature may be implemented without verified DTL fields.**

Before implementing any feature:
1. ✅ Identify required database fields
2. ✅ Check `docs/DTL_SNAPSHOT.md` for field existence
3. ✅ Verify field names, types, and constraints
4. ✅ Use ONLY fields listed in DTL
5. ✅ If field missing, STOP and update DTL first

**DTL_SNAPSHOT.md is authoritative.** Code must align to DTL, never assume fields exist.

---

## Execution Rules for Repo Agent

### Mandatory Preflight Checklist

Before starting any work:
1. ✅ Read `BOOTSTRAP.md`
2. ✅ Read `AGENT_RULES.md`
3. ✅ Read `docs/BUILD_PLAN.md` (this file)
4. ✅ Read `docs/DTL_SNAPSHOT.md`
5. ✅ Read `docs/MILEMARKER.md`
6. ✅ Identify current phase
7. ✅ Verify DTL fields needed
8. ✅ State objective, constraints, validation plan

### Phase Execution Rules

1. **Do NOT skip phases** - Complete phases sequentially
2. **Do NOT assume fields** - Verify every field in DTL_SNAPSHOT.md
3. **Do NOT modify schema** - Work with existing verified schema only
4. **Do NOT expand scope** - Stay within current phase boundaries
5. **Do update documentation** - BUILD_LEDGER and MILEMARKER after each milestone

### Definition of Done (per phase)

A phase is complete when:
- ✅ All features work against live Supabase data
- ✅ All inputs validated
- ✅ Loading, empty, and error states implemented
- ✅ Event logging added where applicable
- ✅ DTL_SNAPSHOT.md verified (no mismatches)
- ✅ BUILD_LEDGER.md updated
- ✅ MILEMARKER.md updated
- ✅ Code committed with clear message
- ✅ Manual validation completed

---

## Integration Readiness Strategy

**Status:** FUTURE PHASES

### Overview

The system is designed to support future integration with external PPAP systems such as:

- **Rheem ETQ Reliance**
- **Trane Windchill**
- **Other OEM PPAP systems**

### Integration Modes (Planned)

1. **Manual Entry** (current baseline)
   - Internal users create PPAPs directly in the system
   - Full control over data entry and validation
   - Immediate normalization and persistence

2. **Structured Import** (CSV / JSON upload)
   - Bulk PPAP creation from formatted files
   - Pre-validation before import
   - Batch normalization and event logging

3. **API-Based Intake** (future)
   - Real-time PPAP creation via REST/GraphQL API
   - External system authentication and authorization
   - Webhook notifications for status updates

### Core Rules

All imported data must adhere to the following principles:

1. **Validation First**
   - All imported data must be validated against internal schema
   - Invalid data rejected with clear error messages
   - No partial imports (all-or-nothing transactions)

2. **Normalization Required**
   - External field names mapped to internal schema
   - Data types converted to internal formats
   - Enrichment with system-generated metadata

3. **External Identifiers Preserved but Not Authoritative**
   - External PPAP IDs, Project Numbers stored for reference
   - Internal UUIDs remain primary keys
   - External IDs used for correlation only

4. **Internal Workflow Always Governs**
   - External systems cannot bypass validation
   - Internal status workflow remains authoritative
   - External systems receive status updates, not control workflow

### Architectural Principle

**Integration is an input mechanism, not a control mechanism.**

**External systems initiate requests —  
The internal system executes, validates, and governs the PPAP lifecycle.**

This ensures:
- **System autonomy** - external changes do not break internal workflow
- **Data consistency** - all PPAPs follow same validation rules
- **Audit trail integrity** - all changes logged through internal event system
- **Flexibility** - can integrate with multiple external systems without conflicts

---

## Current System State

### Completed Phases

✅ **PHASE 0: Foundation** (completed 2026-03-19)
- Next.js 15 + Supabase + Vercel deployed
- Environment variables configured
- Feature folder structure established
- Supabase client working

✅ **PHASE 1: Core PPAP Tracking** (completed 2026-03-20 02:00 CT)
- PPAP create form (4 required fields)
- PPAP list page (displays all records)
- PPAP detail page (dashboard view)
- PPAPHeader component (displays 7 fields)
- Basic event logging on create

✅ **PHASE 4: Conversations Module** (completed 2026-03-20 03:40 CT)
- ConversationList component displays messages
- AddConversationForm working (Add Note)
- Aligned to DTL (body, site fields)
- Chronological display with author/site/timestamp

✅ **PHASE 3: Documents Module** (completed 2026-03-20 04:06 CT)
- DocumentList component displays files
- Aligned to DTL (file_name, category, file_url, created_at)
- Chronological sorting
- Category badges

✅ **PHASE 5: Event System** (working)
- EventHistory component displays audit trail
- Event logging on mutations
- PPAP_CREATED, DOCUMENT_ADDED, STATUS_CHANGED events

### Active Phase

🔄 **PHASE 2: Tasks System** (NEXT - in progress)
- DTL fields available: assigned_to, due_date, phase, title, status, completed_at
- Need to reintroduce fields to code
- Need to build task creation UI
- Need to build task completion workflow

### Pending Phases

⏳ **PHASE 6: Dashboard & UX**
⏳ **PHASE 7: Status Workflow**
⏳ **PHASE 8: Filtering & Search**

---

## Phase Definitions

---

## PHASE 0 — Foundation

**Status:** ✅ COMPLETED

### Objective
Establish technical foundation and deployment pipeline.

### Features
- Next.js 15 App Router configured
- Supabase client configured
- Environment variables managed
- Vercel deployment working
- Feature folder structure established

### DTL Dependencies
- ✅ Supabase connection tested
- ✅ Basic query execution verified

### UI Components
- Root layout
- Basic homepage

### Acceptance Criteria
- ✅ `npm run dev` works locally
- ✅ Supabase queries execute
- ✅ Vercel deployment succeeds
- ✅ Environment variables secure

---

## PHASE 1 — Core PPAP Tracking

**Status:** ✅ COMPLETED

### Objective
Build minimal end-to-end PPAP create → list → detail flow.

### Features
- PPAP creation form (intake)
- PPAP list page with table view
- PPAP detail page (dashboard)
- PPAP header component
- Basic event logging

### DTL Dependencies

**ppap_records (9 fields):**
- `id`, `ppap_number`, `part_number`, `customer_name`, `plant`
- `request_date`, `status`, `created_at`, `updated_at`

**ppap_events (7 fields):**
- `id`, `ppap_id`, `event_type`, `event_data`, `actor`, `actor_role`, `created_at`

### UI Components
- `/ppap/new` - Create form
- `/ppap` - List page
- `/ppap/[id]` - Detail page
- `PPAPHeader` - Record summary card

### Acceptance Criteria
- ✅ Create PPAP with 4 required fields (part_number, customer_name, plant, request_date)
- ✅ Auto-generate ppap_number
- ✅ List displays all PPAPs in table
- ✅ Clickable PPAP number links to detail
- ✅ Detail page loads with ID validation
- ✅ Event logged on create (PPAP_CREATED)
- ✅ No schema errors in console

---

## PHASE 2 — Tasks System

**Status:** 🔄 ACTIVE (NEXT)

### Objective
Reintroduce task tracking fields and build task management UI.

### Features
- Display tasks in detail page
- Create task form
- Task completion workflow
- Task assignment
- Due date tracking
- Phase-based organization

### DTL Dependencies

**ppap_tasks (9 fields):**
- `id`, `ppap_id`, `phase`, `title`, `status`
- `assigned_to`, `due_date`, `completed_at`, `created_at`

**Note:** These fields EXIST in live database but are NOT used in code yet.

### UI Components
- `TaskList` - Display tasks (update existing component)
- `AddTaskForm` - Create new task (new)
- `TaskItem` - Individual task with complete button (new)
- Update `database.types.ts` - Add task fields back

### Implementation Steps

1. **Update TypeScript interfaces:**
   - Add `assigned_to`, `due_date`, `phase`, `title` to `PPAPTask`
   - Update `CreateTaskInput` interface

2. **Update mutations:**
   - Add fields to task insert payload
   - Log TASK_CREATED events

3. **Update TaskList component:**
   - Display phase, title, assigned_to, due_date
   - Show status badge
   - Add "Mark Complete" button

4. **Create AddTaskForm:**
   - Fields: title (required), phase, assigned_to, due_date
   - Default status: 'pending'
   - Validation

5. **Add task completion:**
   - Update status to 'completed'
   - Set completed_at timestamp
   - Log TASK_COMPLETED event

### Acceptance Criteria
- ✅ Task list displays all tasks for PPAP
- ✅ Tasks show title, phase, assignee, due date, status
- ✅ Can create new task with form
- ✅ Can mark task complete
- ✅ completed_at timestamp set on completion
- ✅ Tasks ordered by created_at or due_date
- ✅ Event logged on task creation and completion
- ✅ No schema errors

---

## PHASE 3 — Documents Module

**Status:** ✅ COMPLETED

### Objective
Display and track document metadata aligned to verified DTL schema.

### Features
- Document list display
- File metadata tracking
- Category badges
- Chronological sorting

### DTL Dependencies

**ppap_documents (7 fields):**
- `id`, `ppap_id`, `category`, `file_name`
- `file_url`, `uploaded_by`, `created_at`

### UI Components
- `DocumentList` - Display documents (aligned)
- Displays: file_name, category, uploaded_by, created_at

### Acceptance Criteria
- ✅ Documents display in detail page
- ✅ Shows file_name, category badge, uploader, timestamp
- ✅ Ordered by created_at (chronological)
- ✅ No schema errors
- ✅ All field names match DTL

---

## PHASE 4 — Conversations Module

**Status:** ✅ COMPLETED

### Objective
Internal conversation log for cross-site communication.

### Features
- Conversation list (chronological)
- Add note form
- Message types (NOTE, QUESTION, BLOCKER)
- Author and site tracking

### DTL Dependencies

**ppap_conversations (7 fields):**
- `id`, `ppap_id`, `body`, `message_type`
- `author`, `site`, `created_at`

### UI Components
- `ConversationList` - Display messages (aligned)
- `AddConversationForm` - Add note (working)
- Displays: body, message_type, author, site, timestamp

### Acceptance Criteria
- ✅ Conversations display in detail page
- ✅ Can add new note via form
- ✅ Shows author, site, timestamp
- ✅ Message type badge displayed
- ✅ Ordered by created_at DESC (reverse chronological)
- ✅ No schema errors
- ✅ All field names match DTL (body, site)

---

## PHASE 5 — Event System

**Status:** ✅ WORKING (Enhancement Pending)

### Objective
Immutable audit trail for all PPAP mutations.

### Features
- Event history display
- Event logging on mutations
- Event types: PPAP_CREATED, STATUS_CHANGED, TASK_COMPLETED, DOCUMENT_ADDED
- Event data (JSONB payload)

### DTL Dependencies

**ppap_events (7 fields):**
- `id`, `ppap_id`, `event_type`, `event_data`
- `actor`, `actor_role`, `created_at`

### UI Components
- `EventHistory` - Display audit trail (working)
- Displays: event_type, actor, timestamp

### Current State
- ✅ Basic event logging on PPAP create
- ✅ EventHistory component displays events
- ⏳ Need richer event_data payloads (Phase 5 enhancement)

### Enhancement Tasks (Future)
- Use event_data JSONB for before/after values
- Track status changes with previous/new status
- Track task completions with task details
- Expand event types for all mutations

### Acceptance Criteria
- ✅ Events display in detail page
- ✅ Events logged on PPAP create
- ⏳ Events logged on status change (pending Phase 7)
- ⏳ Events logged on task completion (pending Phase 2)
- ⏳ Event data includes rich context (enhancement)

---

## PHASE 6 — Dashboard & UX

**Status:** ⏳ PENDING

### Objective
Enhance user experience with improved dashboard, filtering, and navigation.

### Features
- Dashboard stats (counts by status, plant)
- List page filters (status, plant, customer)
- List page sorting
- Overdue indicator
- Empty states
- Loading states
- Error handling

### DTL Dependencies

**Uses existing ppap_records fields:**
- `status`, `plant`, `customer_name`, `request_date`, `created_at`

### UI Components
- Dashboard stats cards (new)
- Filter controls on list page (new)
- Sort controls on list page (new)
- Overdue badge (new)

### Implementation Steps

1. **Dashboard stats:**
   - Count PPAPs by status
   - Count PPAPs by plant
   - Show total active
   - Show overdue count

2. **List filters:**
   - Status dropdown (multi-select)
   - Plant dropdown
   - Customer search (ILIKE)
   - Date range (request_date)

3. **List sorting:**
   - Sort by request_date
   - Sort by created_at
   - Sort by ppap_number

4. **Visual indicators:**
   - Overdue badge (red)
   - Status color coding
   - Plant badges

### Acceptance Criteria
- ✅ Dashboard shows stats cards
- ✅ List has working filters
- ✅ List has working sorting
- ✅ Overdue PPAPs clearly marked
- ✅ Empty states when no results
- ✅ Loading states during queries
- ✅ Error states on failures

---

## PHASE 7 — Status Workflow

**Status:** ⏳ PENDING

### Objective
Implement status update UI with workflow validation.

### Features
- Status update control
- Status transition validation
- Workflow state machine
- Status change event logging

### DTL Dependencies

**Uses ppap_records.status:**
- Current: `status` field exists and works
- Need: Update mutation and UI control

**ppap_events for logging:**
- Log STATUS_CHANGED events with before/after values

### UI Components
- `StatusUpdateControl` - Dropdown to change status (new)
- Status validation logic (new)
- Event logging on status change

### Implementation Steps

1. **Status update UI:**
   - Dropdown showing current status
   - List of valid next statuses
   - Confirm button

2. **Workflow validation:**
   - Define valid transitions in `WORKFLOW_RULES.md`
   - Validate transition on client and server
   - Prevent invalid transitions

3. **Status change mutation:**
   - Update ppap_records.status
   - Update ppap_records.updated_at
   - Log STATUS_CHANGED event

4. **Event logging:**
   - event_type: 'STATUS_CHANGED'
   - event_data: { previous_status, new_status }
   - actor: current user

### Acceptance Criteria
- ✅ Can change status from detail page
- ✅ Only valid transitions allowed
- ✅ Status change logs event
- ✅ updated_at timestamp updated
- ✅ Event shows before/after status
- ✅ Validation prevents invalid transitions

---

## PHASE 8 — Filtering & Search

**Status:** ⏳ PENDING

### Objective
Add comprehensive filtering and search to list page.

### Features
- Full-text search (PPAP number, part number, customer)
- Advanced filters (status, plant, date range)
- Filter persistence (URL query params)
- Clear filters button

### DTL Dependencies

**Uses ppap_records fields:**
- `ppap_number`, `part_number`, `customer_name`
- `status`, `plant`, `request_date`

### UI Components
- Search bar (new)
- Filter panel (new)
- Active filters display (new)
- Clear filters button (new)

### Acceptance Criteria
- ✅ Search works across multiple fields
- ✅ Filters can be combined
- ✅ Filters persist in URL
- ✅ Clear filters resets view
- ✅ Search is performant (<500ms)

---

## PPAP Intake Evolution Roadmap

This roadmap defines the evolution of how PPAPs enter the system, from manual entry to full integration.

### Phase A: Manual PPAP Initiation (Current)

**Status:** ✅ COMPLETED

- Internal users create and manage PPAPs
- Simple form-based data entry (4 required fields)
- Immediate validation and persistence
- Event logging on creation

### Phase B: Structured Initiation UI (In Progress)

**Status:** 🔄 PHASE 9 - IN PROGRESS

- Sectioned initiation form aligned with Rheem workflow
- Phase-based workflow execution
- 6 structured sections:
  - Project Info
  - Contacts
  - Part Info
  - Drawing Data
  - Shipment
  - Warrant
- Phase gating and validation
- Comprehensive data capture before PPAP activation

### Phase C: Customer Portal Initiation (Near Future)

**Status:** ⏳ PLANNED

- External users create PPAPs directly
- Self-service PPAP request interface
- Customer-facing portal with guided workflow
- Auto-population from customer profile
- Internal approval workflow before activation
- Email notifications to internal coordinators

### Phase D: Import-Based Intake (Future)

**Status:** ⏳ PLANNED

- File-based PPAP ingestion (CSV / JSON / Excel)
- Bulk PPAP creation from structured data
- Pre-validation and error reporting
- Auto-population of initiation data
- Import preview and confirmation
- Batch event logging

### Phase E: API-Based Intake from External Systems (Advanced)

**Status:** ⏳ PLANNED

- Real-time PPAP creation via REST/GraphQL API
- Integration with external PPAP systems:
  - Rheem ETQ Reliance
  - Trane Windchill
  - Other OEM systems
- Event-driven PPAP creation
- Webhook notifications for status updates
- External identifier mapping
- Full normalization layer implementation

---

## Controlled Re-Expansion Roadmap

This roadmap was defined during DTL rebaseline (2026-03-20).

### Phase 1: Reintroduce Task Fields ← **CURRENT PHASE**
- `assigned_to` - Already exists in DB
- `due_date` - Already exists in DB
- `phase` - Already exists in DB
- `title` - Already exists in DB
- Update TypeScript interfaces
- Update task creation/display components
- Verify task list shows assignments and due dates

### Phase 2: Fix Document Storage
- Currently: metadata only (file_name, category, file_url)
- Future: Actual file upload to Supabase Storage
- Generate file_url on upload
- Display download links

### Phase 3: Use created_at for Sorting
- Documents: Sort by created_at (already done)
- Tasks: Sort by created_at or due_date
- Conversations: Sort by created_at (already done)

### Phase 4: Enhance Event Logging
- Utilize event_data JSONB for richer payloads
- Store before/after values in status changes
- Track detailed context in all events
- Add event filtering in UI

---

## Guardrails

### Schema Changes
1. No schema changes without explicit approval
2. All schema changes must update DTL_SNAPSHOT.md first
3. Record every schema change in BUILD_LEDGER.md
4. Commit schema + code changes atomically

### Status Changes
1. Use only canonical status values
2. Validate transitions against WORKFLOW_RULES.md
3. Log all status changes to ppap_events

### Data Integrity
1. No silent deletes (soft delete pattern removed)
2. Every mutation writes event log
3. Validate all inputs
4. Required fields must be enforced

### Code Quality
1. TypeScript strict mode
2. No `any` types
3. Prefer small focused components
4. Separate data access from presentation
5. Loading, empty, error states required

### Commit Discipline
1. Commit at meaningful milestones
2. Clear commit messages (feat/fix/chore)
3. Update BUILD_LEDGER.md with every commit
4. Update MILEMARKER.md after phase completion

---

## Folder Structure

```
app/                          # Next.js App Router pages
├── page.tsx                  # Dashboard home
├── ppap/
│   ├── page.tsx             # PPAP list
│   ├── new/
│   │   └── page.tsx         # Create PPAP form
│   └── [id]/
│       └── page.tsx         # PPAP detail/dashboard

src/
├── lib/
│   ├── supabaseClient.ts    # Supabase client
│   └── utils.ts             # Utilities
├── types/
│   └── database.types.ts    # TypeScript interfaces
├── features/
│   ├── ppap/
│   │   ├── mutations.ts     # PPAP CRUD
│   │   └── components/      # PPAP-specific components
│   ├── conversations/
│   │   ├── mutations.ts
│   │   └── components/
│   ├── tasks/
│   │   ├── mutations.ts
│   │   └── components/
│   ├── documents/
│   │   ├── mutations.ts
│   │   └── components/
│   └── events/
│       ├── mutations.ts
│       └── components/

docs/
├── BOOTSTRAP.md             # Start here
├── BUILD_PLAN.md            # This file
├── BUILD_LEDGER.md          # Change log
├── DTL_SNAPSHOT.md          # Database schema contract
├── MILEMARKER.md            # Current system state
├── DECISION_REGISTER.md     # Architectural decisions
├── WORKFLOW_RULES.md        # Status workflow rules
├── DATA_MODEL.md            # Data model documentation
├── REPO_GUARDRAILS.md       # Development guidelines
└── ACCEPTANCE_CRITERIA.md   # Go-live criteria
```

---

## Verification Commands

### Check DTL Schema
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'ppap_records'
ORDER BY ordinal_position;
```

### Check System State
```bash
# Verify builds
npm run build

# Verify types
npm run type-check

# Run local
npm run dev
```

---

## Monday Go-Live Criteria

System is ready for internal production use when:

✅ **Core Flows Working:**
- ✅ Create PPAP
- ✅ List PPAPs
- ✅ View PPAP detail
- 🔄 Track tasks (in progress)
- ✅ Record conversations
- ⏳ Update status (pending)

✅ **Data Integrity:**
- ✅ Event logging on mutations
- ✅ Validation on inputs
- ✅ No schema errors

✅ **User Experience:**
- ✅ Loading states
- ✅ Empty states
- ✅ Error states
- ⏳ Filters (pending)

**Target:** Complete Phase 2 (Tasks) before Monday go-live.

---

## Notes

This system prioritizes operational readiness over architectural elegance. The goal is to reduce confusion, protect cross-site handoffs, and provide one source of truth for PPAP activity.

**Start small, expand controllably, verify constantly.**
