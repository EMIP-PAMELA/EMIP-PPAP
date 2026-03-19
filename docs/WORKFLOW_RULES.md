# Workflow Rules

Business rules and workflow logic for EMIP-PPAP system.

---

## Status Transition Rules

### Valid Transitions

```
NEW
  → INTAKE_COMPLETE (when all required intake fields populated)

INTAKE_COMPLETE
  → PRE_ACK_ASSIGNED (when pre-ack tasks created and assigned)

PRE_ACK_ASSIGNED
  → PRE_ACK_IN_PROGRESS (when any pre-ack task started)

PRE_ACK_IN_PROGRESS
  → READY_TO_ACKNOWLEDGE (when all pre-ack tasks completed)
  → BLOCKED (when blocker identified)

READY_TO_ACKNOWLEDGE
  → ACKNOWLEDGED (when formal acknowledgment recorded)
  → BLOCKED (when blocker identified)

ACKNOWLEDGED
  → POST_ACK_ASSIGNED (when post-ack tasks created and assigned)

POST_ACK_ASSIGNED
  → POST_ACK_IN_PROGRESS (when any post-ack task started)

POST_ACK_IN_PROGRESS
  → AWAITING_SUBMISSION (when all post-ack tasks completed)
  → BLOCKED (when blocker identified)

AWAITING_SUBMISSION
  → SUBMITTED (when submission package uploaded and sent)
  → BLOCKED (when blocker identified)

SUBMITTED
  → APPROVED (when customer approval received)
  → ON_HOLD (when customer requests changes)
  → BLOCKED (when customer rejects)

APPROVED
  → CLOSED (when final archival complete)

ON_HOLD
  → PRE_ACK_IN_PROGRESS (if rework needed in pre-ack phase)
  → POST_ACK_IN_PROGRESS (if rework needed in post-ack phase)
  → AWAITING_SUBMISSION (if only submission needs update)

BLOCKED
  → [previous status] (when blocker resolved)
  → CLOSED (if PPAP cancelled)

CLOSED
  → [no transitions allowed]
```

### Transition Guards

- **INTAKE_COMPLETE**: Requires part_number, customer_name, plant, request_date, due_date
- **PRE_ACK_ASSIGNED**: Requires at least one task with phase='PRE_ACK'
- **READY_TO_ACKNOWLEDGE**: All PRE_ACK tasks must have status='COMPLETED'
- **ACKNOWLEDGED**: Requires acknowledged_date to be set
- **POST_ACK_ASSIGNED**: Requires at least one task with phase='POST_ACK'
- **AWAITING_SUBMISSION**: All POST_ACK tasks must have status='COMPLETED'
- **SUBMITTED**: Requires submitted_date and at least one document of type='SUBMISSION_PACKAGE'
- **APPROVED**: Requires approved_date

---

## Task Assignment Rules

### Pre-Ack Tasks (typical)

1. Review customer requirements
2. Verify part design feasibility
3. Create/update control plan
4. Create/update PFMEA
5. Identify measurement requirements
6. Plan capability studies
7. Review mold design (if mold_required=true)

### Post-Ack Tasks (typical)

1. Execute first article build
2. Complete dimensional inspection
3. Complete material testing
4. Execute capability studies
5. Complete appearance approval (if applicable)
6. Validate measurement systems (MSA)
7. Prepare submission package
8. Mold validation (if mold_required=true)

### Task Auto-Creation

When PPAP moves to PRE_ACK_ASSIGNED or POST_ACK_ASSIGNED:
- System can suggest standard task templates
- User can customize before finalizing
- All tasks must have assigned_to before status advances

---

## Mold Workflow Rules

### When mold_required = true

1. Mold status must be tracked separately
2. Mold lead time must be factored into due_date
3. Mold supplier must be specified
4. Pre-ack tasks must include mold design review
5. Post-ack tasks must include mold validation
6. Mold delays automatically trigger risk flags

### Mold Status Values

- NOT_STARTED
- DESIGN_IN_PROGRESS
- DESIGN_APPROVED
- FABRICATION_IN_PROGRESS
- FIRST_ARTICLE_COMPLETE
- VALIDATION_IN_PROGRESS
- VALIDATED
- BLOCKED

### Mold Risk Triggers

- mold_status = 'BLOCKED'
- mold_lead_time_days > (due_date - current_date)
- mold_status not 'VALIDATED' when PPAP status = 'POST_ACK_IN_PROGRESS'

---

## Document Requirements

### Minimum Required Documents

For submission (status = SUBMITTED):
- At least one DRAWING
- At least one CONTROL_PLAN
- At least one PROCESS_FLOW

### Document Naming Convention

Recommended: `{part_number}_{document_type}_{revision}_{date}.{ext}`

Example: `12345-ABC_DRAWING_A_20260319.pdf`

---

## Conversation Rules

### Required Conversation Entries

System should auto-create conversation entries for:
- PPAP created
- Status changed
- Assignment changed
- Blocker flagged
- Blocker cleared

### User-Created Entries

Users should add conversation entries for:
- Handoffs between sites
- Questions requiring follow-up
- Decisions made
- Customer communication summaries
- Risk identification

---

## Event Logging Rules

### Events That Must Be Logged

Every mutation must log an event:
- PPAP creation → PPAP_CREATED
- Status change → STATUS_CHANGED
- Assignment change → ASSIGNED
- Document upload → DOCUMENT_ADDED
- Document delete → DOCUMENT_REMOVED
- Task creation → TASK_CREATED
- Task completion → TASK_COMPLETED
- Conversation entry → CONVERSATION_ADDED
- Mold status change → MOLD_STATUS_CHANGED
- Risk flag → RISK_FLAGGED
- Risk clear → RISK_CLEARED

### Event Data Payload

Include in event_data JSONB:
- Previous state (for changes)
- New state
- Reason (if applicable)
- Related entity IDs

---

## Aging and Overdue Rules

### Overdue Definition

PPAP is overdue when:
- due_date < current_date
- status NOT IN ('APPROVED', 'CLOSED')

### Aging Buckets

- 0-7 days: Normal
- 8-14 days: Attention needed
- 15-30 days: At risk
- 31+ days: Critical

### Aging Calculation

Days in current status = current_date - MAX(created_at, last_status_change_date)

---

## Assignment Rules

### Valid Assignments by Status

- NEW → INTAKE_COMPLETE: Coordinator
- PRE_ACK_*: Engineer
- ACKNOWLEDGED → POST_ACK_*: Quality/Plant
- AWAITING_SUBMISSION → SUBMITTED: Coordinator
- Any status: Manager (for oversight)

### Reassignment

- Any user can reassign within their role
- Reassignment creates ASSIGNED event
- Previous assignee notified via conversation entry

---

## Blocker Management

### Flagging a Blocker

1. Set status = 'BLOCKED'
2. Add risk_flags array entry with blocker description
3. Create conversation entry with message_type='BLOCKER'
4. Log BLOCKED event

### Clearing a Blocker

1. Remove from risk_flags array
2. Set status back to previous status
3. Create conversation entry with message_type='RESOLUTION'
4. Log UNBLOCKED event

---

## Multi-Site Coordination

### Handoff Protocol

When PPAP ownership moves between sites:
1. Create conversation entry with message_type='HANDOFF'
2. Include summary of current state
3. List any open questions or blockers
4. Update assigned_to with new site contact

### Cross-Site Visibility

- All sites can view all PPAPs
- Filter by plant to see site-specific workload
- Conversation log preserves cross-site context

---

## Data Validation Rules

### Required Fields by Status

**NEW:**
- ppap_number (auto-generated)
- customer_name
- plant

**INTAKE_COMPLETE:**
- All NEW fields plus:
- part_number
- request_date
- due_date
- submission_level

**PRE_ACK_ASSIGNED:**
- All INTAKE_COMPLETE fields plus:
- assigned_to
- At least one PRE_ACK task

**ACKNOWLEDGED:**
- All previous fields plus:
- acknowledged_date

**SUBMITTED:**
- All previous fields plus:
- submitted_date
- At least 3 required documents

---

## Deletion Policy

### Soft Deletes Only

- Never hard delete PPAP records
- Set deleted_at timestamp
- Preserve in event log
- Hide from default views
- Admin can restore if needed

### Cascade Behavior

When PPAP soft-deleted:
- Related documents soft-deleted
- Related tasks soft-deleted
- Conversations preserved (for audit)
- Events preserved (for audit)

---
