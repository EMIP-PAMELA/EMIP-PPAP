# Acceptance Criteria

Specific, testable criteria that define when features are complete and ready for use.

---

## Monday Go-Live Criteria

The system is ready for internal production use when ALL of the following are true:

### Core Functionality
- [ ] User can create a new PPAP record with all required intake fields
- [ ] User can view a list of all PPAP records
- [ ] User can filter PPAP list by status, plant, customer, assignee
- [ ] User can open a PPAP dashboard showing full record details
- [ ] User can update PPAP status following valid workflow transitions
- [ ] User can assign/reassign PPAP ownership
- [ ] User can add internal conversation entries to any PPAP
- [ ] User can create and complete tasks tied to a PPAP
- [ ] User can upload document metadata (storage integration can be stubbed)
- [ ] User can see mold tracking fields when mold_required=true
- [ ] User can view complete event history for any PPAP

### Data Integrity
- [ ] All status transitions follow canonical workflow rules
- [ ] All mutations write to ppap_events audit log
- [ ] All timestamps stored in UTC
- [ ] No hard deletes (soft delete via deleted_at)
- [ ] Foreign key constraints enforced

### User Experience
- [ ] Loading states shown during async operations
- [ ] Error states shown with clear messages when operations fail
- [ ] Empty states shown when no data exists (e.g., no PPAPs, no tasks)
- [ ] Overdue PPAPs visually indicated on list view
- [ ] Mold-required PPAPs visually indicated on list view

### Technical Quality
- [ ] All database tables created with proper indexes
- [ ] TypeScript types defined for all database entities
- [ ] Data access layer separated from UI components
- [ ] No console errors in browser
- [ ] No TypeScript compilation errors
- [ ] App runs locally via `npm run dev`
- [ ] App deploys successfully to Vercel

### Documentation
- [ ] BUILD_LEDGER updated with all schema changes
- [ ] DATA_MODEL reflects actual database schema
- [ ] README includes setup instructions and .env.local template
- [ ] Seed data script or instructions provided

---

## Feature-Specific Acceptance Criteria

### PPAP List Page

**Given** I am on the PPAP list page  
**When** the page loads  
**Then** I should see:
- [ ] A table or card grid showing all non-deleted PPAP records
- [ ] Columns/fields: PPAP number, part number, customer, plant, status, assigned to, due date
- [ ] Visual indicator for overdue items (due_date < today and status not APPROVED/CLOSED)
- [ ] Visual indicator for mold-required items
- [ ] Filter controls for status, plant, customer, assignee
- [ ] "Create New PPAP" button

**Given** I apply a filter  
**When** I select a status from the status filter  
**Then** the list should show only PPAPs matching that status

**Given** there are no PPAP records  
**When** the page loads  
**Then** I should see an empty state message with a "Create First PPAP" button

---

### PPAP Creation Form

**Given** I click "Create New PPAP"  
**When** the form appears  
**Then** I should see input fields for:
- [ ] Part number (required)
- [ ] Part name
- [ ] Customer name (required)
- [ ] Plant (required, dropdown)
- [ ] Request date (required)
- [ ] Due date (required)
- [ ] Submission level (dropdown: 1-5)
- [ ] Mold required (checkbox)
- [ ] Notes (textarea)

**Given** I fill out the required fields  
**When** I submit the form  
**Then**:
- [ ] A new PPAP record is created with status='NEW'
- [ ] A PPAP number is auto-generated
- [ ] A PPAP_CREATED event is logged
- [ ] I am redirected to the new PPAP's dashboard page

**Given** I submit the form with missing required fields  
**When** I click submit  
**Then**:
- [ ] Form validation errors are shown
- [ ] Form is not submitted
- [ ] Error messages clearly indicate which fields are required

---

### PPAP Dashboard Page

**Given** I open a PPAP dashboard  
**When** the page loads  
**Then** I should see:
- [ ] Header card with PPAP number, part number, customer, status
- [ ] Ownership section showing assigned_to and plant
- [ ] Due date with overdue indicator if applicable
- [ ] Status badge with current status
- [ ] "Change Status" button
- [ ] "Reassign" button
- [ ] Conversation/activity stream section
- [ ] Documents section (may be empty initially)
- [ ] Tasks section (may be empty initially)
- [ ] Mold section (only if mold_required=true)
- [ ] Event history section (collapsed by default)

**Given** I click "Change Status"  
**When** the status change dialog appears  
**Then**:
- [ ] I see only valid next statuses based on current status
- [ ] I can select a new status
- [ ] I can optionally add a note explaining the change
- [ ] On submit, status updates and STATUS_CHANGED event is logged

**Given** I click "Reassign"  
**When** the reassignment dialog appears  
**Then**:
- [ ] I can enter a new assignee name
- [ ] I can select a role
- [ ] On submit, assigned_to updates and ASSIGNED event is logged

---

### Conversation Log

**Given** I am on a PPAP dashboard  
**When** I scroll to the conversation section  
**Then** I should see:
- [ ] All conversation entries in reverse chronological order
- [ ] Each entry showing: author, timestamp, message, message_type
- [ ] "Add Note" button

**Given** I click "Add Note"  
**When** the note form appears  
**Then**:
- [ ] I can enter a message (required)
- [ ] I can select a message type (NOTE, QUESTION, BLOCKER, etc.)
- [ ] On submit, conversation entry is created
- [ ] CONVERSATION_ADDED event is logged
- [ ] New entry appears at top of conversation stream

**Given** there are no conversation entries yet  
**When** the conversation section loads  
**Then** I should see an empty state message: "No conversation history yet. Add the first note."

---

### Task Tracking

**Given** I am on a PPAP dashboard  
**When** I scroll to the tasks section  
**Then** I should see:
- [ ] List of all tasks for this PPAP
- [ ] Each task showing: title, assigned_to, status, due_date, phase
- [ ] "Add Task" button
- [ ] Ability to mark task as complete

**Given** I click "Add Task"  
**When** the task form appears  
**Then**:
- [ ] I can enter title (required), description, assigned_to, due_date, phase
- [ ] On submit, task is created
- [ ] TASK_CREATED event is logged

**Given** I mark a task as complete  
**When** I click the complete button  
**Then**:
- [ ] Task status changes to 'COMPLETED'
- [ ] completed_at timestamp is set
- [ ] TASK_COMPLETED event is logged

**Given** there are no tasks yet  
**When** the tasks section loads  
**Then** I should see an empty state message: "No tasks yet. Add the first task."

---

### Document Management

**Given** I am on a PPAP dashboard  
**When** I scroll to the documents section  
**Then** I should see:
- [ ] List of all document metadata records for this PPAP
- [ ] Each document showing: name, type, uploaded_by, uploaded_at
- [ ] "Upload Document" button

**Given** I click "Upload Document"  
**When** the upload form appears  
**Then**:
- [ ] I can enter document name (required)
- [ ] I can select document type (required, dropdown)
- [ ] I can add notes
- [ ] On submit, document metadata is created
- [ ] DOCUMENT_ADDED event is logged
- [ ] (Actual file upload can be stubbed for v1)

**Given** there are no documents yet  
**When** the documents section loads  
**Then** I should see an empty state message: "No documents yet. Upload the first document."

---

### Mold Tracking

**Given** a PPAP has mold_required=true  
**When** I view the PPAP dashboard  
**Then** I should see a mold section showing:
- [ ] Mold supplier
- [ ] Mold status
- [ ] Mold lead time (days)
- [ ] "Update Mold Status" button

**Given** I click "Update Mold Status"  
**When** the mold status form appears  
**Then**:
- [ ] I can select a new mold status
- [ ] I can update mold supplier and lead time
- [ ] On submit, mold fields update
- [ ] MOLD_STATUS_CHANGED event is logged

**Given** a PPAP has mold_required=false  
**When** I view the PPAP dashboard  
**Then** the mold section should not be visible

---

### Event History

**Given** I am on a PPAP dashboard  
**When** I expand the event history section  
**Then** I should see:
- [ ] All events for this PPAP in reverse chronological order
- [ ] Each event showing: event_type, actor, timestamp
- [ ] Event data payload (collapsed, expandable)

**Given** there are many events  
**When** the event history loads  
**Then**:
- [ ] Events are paginated or limited to most recent 50
- [ ] "Load More" button available if more events exist

---

### Status Workflow Enforcement

**Given** a PPAP with status='NEW'  
**When** I attempt to change status  
**Then** I should only see 'INTAKE_COMPLETE' and 'BLOCKED' as valid options

**Given** a PPAP with status='PRE_ACK_IN_PROGRESS'  
**When** I attempt to change to 'ACKNOWLEDGED'  
**Then** the system should prevent this and show an error: "Invalid status transition"

**Given** a PPAP with status='PRE_ACK_IN_PROGRESS' and all PRE_ACK tasks completed  
**When** I change status to 'READY_TO_ACKNOWLEDGE'  
**Then** the status should update successfully

---

### Error Handling

**Given** the database is unreachable  
**When** I try to load the PPAP list  
**Then** I should see an error message: "Unable to load PPAPs. Please try again."

**Given** I submit a form with invalid data  
**When** the server validation fails  
**Then**:
- [ ] The form should show validation errors
- [ ] The user should remain on the form
- [ ] No partial data should be saved

**Given** a network timeout occurs during a mutation  
**When** the request fails  
**Then**:
- [ ] An error message should be shown
- [ ] The user should be able to retry
- [ ] No duplicate records should be created on retry

---

### Loading States

**Given** I navigate to the PPAP list page  
**When** data is being fetched  
**Then** I should see a loading spinner or skeleton UI

**Given** I submit a form  
**When** the mutation is in progress  
**Then**:
- [ ] The submit button should be disabled
- [ ] A loading indicator should be shown
- [ ] The user should not be able to submit again

---

### Performance

**Given** there are 100+ PPAP records  
**When** I load the PPAP list  
**Then** the page should load in under 2 seconds

**Given** I open a PPAP dashboard  
**When** the page loads  
**Then** all sections should be visible within 1 second

---

## Out of Scope for v1

The following are explicitly NOT required for Monday go-live:

- [ ] Email notifications
- [ ] Real-time updates (websockets)
- [ ] Advanced reporting/analytics
- [ ] File upload to cloud storage (metadata only is sufficient)
- [ ] Customer-facing portal
- [ ] Integration with external systems (Reliance, ERP)
- [ ] Mobile-optimized UI
- [ ] Bulk operations (import/export)
- [ ] Advanced permissions/RBAC enforcement
- [ ] Automated workflow triggers
- [ ] Custom fields or configurable forms

---
