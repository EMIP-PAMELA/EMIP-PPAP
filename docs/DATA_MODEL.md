# Data Model

Database schema for EMIP-PPAP system.

## Schema Principles

1. All timestamps in UTC
2. Soft deletes where applicable (deleted_at column)
3. Foreign keys enforced at database level
4. Audit trail via ppap_events table
5. Use canonical enums for statuses and types

---

## Tables

### ppap_records

Core PPAP record table.

```sql
CREATE TABLE ppap_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identifiers
  ppap_number VARCHAR(50) UNIQUE NOT NULL,
  part_number VARCHAR(100) NOT NULL,
  part_name VARCHAR(255),
  revision VARCHAR(50),
  
  -- Customer & ownership
  customer_name VARCHAR(255) NOT NULL,
  customer_code VARCHAR(50),
  plant VARCHAR(100) NOT NULL,
  assigned_to VARCHAR(255),
  assigned_role VARCHAR(50),
  
  -- Status & workflow
  status VARCHAR(50) NOT NULL DEFAULT 'NEW',
  priority VARCHAR(20) DEFAULT 'NORMAL',
  
  -- Dates
  request_date TIMESTAMPTZ NOT NULL,
  due_date TIMESTAMPTZ,
  acknowledged_date TIMESTAMPTZ,
  submitted_date TIMESTAMPTZ,
  approved_date TIMESTAMPTZ,
  
  -- Mold/overmold tracking
  process_type VARCHAR(50),
  mold_required BOOLEAN DEFAULT false,
  mold_supplier VARCHAR(255),
  mold_status VARCHAR(50),
  mold_lead_time_days INTEGER,
  
  -- Additional context
  submission_level VARCHAR(10),
  notes TEXT,
  risk_flags TEXT[],
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by VARCHAR(255),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by VARCHAR(255),
  deleted_at TIMESTAMPTZ,
  
  CONSTRAINT valid_status CHECK (status IN (
    'NEW',
    'INTAKE_COMPLETE',
    'PRE_ACK_ASSIGNED',
    'PRE_ACK_IN_PROGRESS',
    'READY_TO_ACKNOWLEDGE',
    'ACKNOWLEDGED',
    'POST_ACK_ASSIGNED',
    'POST_ACK_IN_PROGRESS',
    'AWAITING_SUBMISSION',
    'SUBMITTED',
    'APPROVED',
    'ON_HOLD',
    'BLOCKED',
    'CLOSED'
  ))
);

CREATE INDEX idx_ppap_records_status ON ppap_records(status);
CREATE INDEX idx_ppap_records_plant ON ppap_records(plant);
CREATE INDEX idx_ppap_records_customer ON ppap_records(customer_name);
CREATE INDEX idx_ppap_records_assigned_to ON ppap_records(assigned_to);
CREATE INDEX idx_ppap_records_due_date ON ppap_records(due_date);
CREATE INDEX idx_ppap_records_deleted_at ON ppap_records(deleted_at);
```

---

### ppap_documents

Document metadata and storage references.

```sql
CREATE TABLE ppap_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ppap_id UUID NOT NULL REFERENCES ppap_records(id) ON DELETE CASCADE,
  
  -- Document info
  document_name VARCHAR(255) NOT NULL,
  document_type VARCHAR(100),
  file_size_bytes BIGINT,
  mime_type VARCHAR(100),
  
  -- Storage
  storage_path VARCHAR(500),
  storage_bucket VARCHAR(100),
  
  -- Metadata
  uploaded_by VARCHAR(255) NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  version INTEGER DEFAULT 1,
  notes TEXT,
  
  deleted_at TIMESTAMPTZ,
  
  CONSTRAINT valid_document_type CHECK (document_type IN (
    'DRAWING',
    'SPECIFICATION',
    'CONTROL_PLAN',
    'PROCESS_FLOW',
    'FMEA',
    'MSA',
    'CAPABILITY_STUDY',
    'APPEARANCE_APPROVAL',
    'SAMPLE_PRODUCT',
    'MASTER_SAMPLE',
    'CHECKING_AIDS',
    'CUSTOMER_SPECIFIC',
    'OTHER'
  ))
);

CREATE INDEX idx_ppap_documents_ppap_id ON ppap_documents(ppap_id);
CREATE INDEX idx_ppap_documents_type ON ppap_documents(document_type);
CREATE INDEX idx_ppap_documents_deleted_at ON ppap_documents(deleted_at);
```

---

### ppap_conversations

Internal communication log per PPAP.

```sql
CREATE TABLE ppap_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ppap_id UUID NOT NULL REFERENCES ppap_records(id) ON DELETE CASCADE,
  
  -- Message content
  message TEXT NOT NULL,
  message_type VARCHAR(50) DEFAULT 'NOTE',
  
  -- Author info
  author VARCHAR(255) NOT NULL,
  author_role VARCHAR(50),
  author_site VARCHAR(100),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  
  CONSTRAINT valid_message_type CHECK (message_type IN (
    'NOTE',
    'QUESTION',
    'ANSWER',
    'BLOCKER',
    'RESOLUTION',
    'HANDOFF',
    'STATUS_UPDATE'
  ))
);

CREATE INDEX idx_ppap_conversations_ppap_id ON ppap_conversations(ppap_id);
CREATE INDEX idx_ppap_conversations_created_at ON ppap_conversations(created_at DESC);
CREATE INDEX idx_ppap_conversations_deleted_at ON ppap_conversations(deleted_at);
```

---

### ppap_tasks

Task/checklist items per PPAP.

```sql
CREATE TABLE ppap_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ppap_id UUID NOT NULL REFERENCES ppap_records(id) ON DELETE CASCADE,
  
  -- Task details
  title VARCHAR(255) NOT NULL,
  description TEXT,
  task_type VARCHAR(50),
  phase VARCHAR(50),
  
  -- Assignment
  assigned_to VARCHAR(255),
  assigned_role VARCHAR(50),
  
  -- Status
  status VARCHAR(50) DEFAULT 'PENDING',
  priority VARCHAR(20) DEFAULT 'NORMAL',
  
  -- Dates
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completed_by VARCHAR(255),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by VARCHAR(255),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  CONSTRAINT valid_task_status CHECK (status IN (
    'PENDING',
    'IN_PROGRESS',
    'BLOCKED',
    'COMPLETED',
    'CANCELLED'
  )),
  
  CONSTRAINT valid_phase CHECK (phase IN (
    'PRE_ACK',
    'POST_ACK',
    'SUBMISSION',
    'OTHER'
  ))
);

CREATE INDEX idx_ppap_tasks_ppap_id ON ppap_tasks(ppap_id);
CREATE INDEX idx_ppap_tasks_assigned_to ON ppap_tasks(assigned_to);
CREATE INDEX idx_ppap_tasks_status ON ppap_tasks(status);
CREATE INDEX idx_ppap_tasks_due_date ON ppap_tasks(due_date);
CREATE INDEX idx_ppap_tasks_deleted_at ON ppap_tasks(deleted_at);
```

---

### ppap_events

Audit trail / event log.

```sql
CREATE TABLE ppap_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ppap_id UUID NOT NULL REFERENCES ppap_records(id) ON DELETE CASCADE,
  
  -- Event details
  event_type VARCHAR(100) NOT NULL,
  event_data JSONB,
  
  -- Actor
  actor VARCHAR(255) NOT NULL,
  actor_role VARCHAR(50),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_event_type CHECK (event_type IN (
    'PPAP_CREATED',
    'STATUS_CHANGED',
    'ASSIGNED',
    'DOCUMENT_ADDED',
    'DOCUMENT_REMOVED',
    'TASK_CREATED',
    'TASK_COMPLETED',
    'CONVERSATION_ADDED',
    'MOLD_STATUS_CHANGED',
    'RISK_FLAGGED',
    'RISK_CLEARED',
    'SUBMITTED',
    'APPROVED',
    'BLOCKED',
    'UNBLOCKED'
  ))
);

CREATE INDEX idx_ppap_events_ppap_id ON ppap_events(ppap_id);
CREATE INDEX idx_ppap_events_type ON ppap_events(event_type);
CREATE INDEX idx_ppap_events_created_at ON ppap_events(created_at DESC);
```

---

## Canonical Enums

### PPAP Status
- NEW
- INTAKE_COMPLETE
- PRE_ACK_ASSIGNED
- PRE_ACK_IN_PROGRESS
- READY_TO_ACKNOWLEDGE
- ACKNOWLEDGED
- POST_ACK_ASSIGNED
- POST_ACK_IN_PROGRESS
- AWAITING_SUBMISSION
- SUBMITTED
- APPROVED
- ON_HOLD
- BLOCKED
- CLOSED

### Task Status
- PENDING
- IN_PROGRESS
- BLOCKED
- COMPLETED
- CANCELLED

### Task Phase
- PRE_ACK
- POST_ACK
- SUBMISSION
- OTHER

### Document Types
- DRAWING
- SPECIFICATION
- CONTROL_PLAN
- PROCESS_FLOW
- FMEA
- MSA
- CAPABILITY_STUDY
- APPEARANCE_APPROVAL
- SAMPLE_PRODUCT
- MASTER_SAMPLE
- CHECKING_AIDS
- CUSTOMER_SPECIFIC
- OTHER

### Message Types
- NOTE
- QUESTION
- ANSWER
- BLOCKER
- RESOLUTION
- HANDOFF
- STATUS_UPDATE

### Event Types
- PPAP_CREATED
- STATUS_CHANGED
- ASSIGNED
- DOCUMENT_ADDED
- DOCUMENT_REMOVED
- TASK_CREATED
- TASK_COMPLETED
- CONVERSATION_ADDED
- MOLD_STATUS_CHANGED
- RISK_FLAGGED
- RISK_CLEARED
- SUBMITTED
- APPROVED
- BLOCKED
- UNBLOCKED

---

## Row Level Security (RLS)

For v1, RLS will be minimal:
- All authenticated users can read all PPAP records
- All authenticated users can create/update records (trust-based)
- Audit trail preserved via ppap_events

Future versions will add:
- Plant-based access restrictions
- Role-based write permissions
- Customer-specific visibility rules

---

## Migration Strategy

1. Create tables in order: ppap_records → ppap_documents, ppap_conversations, ppap_tasks, ppap_events
2. Add indexes after initial data load
3. Enable RLS policies after schema stabilizes
4. Seed with 2-3 test records for development

---
