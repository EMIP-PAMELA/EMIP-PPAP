# Database Translation Layer (DTL) Snapshot

**Last Updated:** 2026-03-20 02:43 CT

## Purpose

This file is the **single source of truth** for the current known database schema contract. It documents the actual live database structure that code must align to.

## Critical Rules

1. **Do NOT guess schema** - If code assumes a column exists, verify it in this file first
2. **Stop on mismatch** - If a task reveals code/database mismatch:
   - Stop implementation
   - Inspect live database or verified schema source
   - Update this file
   - Record delta in BUILD_LEDGER.md
   - Update DECISION_REGISTER.md if contract changed meaningfully
3. **This is authoritative** - When DATA_MODEL.md conflicts with this file, this file wins
4. **Track all changes** - Every schema change must update this file and BUILD_LEDGER.md

---

## Current Schema State

### Minimal Stable Schema Enforced (as of 2026-03-20)

The system currently uses a **minimal guaranteed safe field set**. Optional fields have been intentionally removed until system stability is confirmed.

---

## Table: ppap_records

**Purpose:** Core PPAP record tracking across all sites

**Confirmed Columns (9 fields - LIVE DATABASE):**

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique record identifier |
| `ppap_number` | VARCHAR(50) | UNIQUE NOT NULL | Business identifier (e.g., PPAP-123456-26) |
| `part_number` | VARCHAR(100) | NOT NULL | Part identification number |
| `customer_name` | VARCHAR(255) | NOT NULL | Customer name |
| `plant` | VARCHAR(100) | NOT NULL | Manufacturing plant/site |
| `status` | VARCHAR(50) | NOT NULL, DEFAULT 'NEW' | Workflow status (see WORKFLOW_RULES.md) |
| `request_date` | TIMESTAMPTZ | NOT NULL | Date PPAP was requested |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Record creation timestamp |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Record update timestamp |

**Columns Intentionally Removed from Code (as of 2026-03-20):**

These fields were removed during stabilization (BUILD_LEDGER 2026-03-20 02:00 CT). They can be reintroduced following the Controlled Expansion Rule in BOOTSTRAP.md.

- `part_name` - Part description (VARCHAR(255))
- `revision` - Part revision (VARCHAR(50))
- `customer_code` - Customer reference code (VARCHAR(50))
- `assigned_to` - Assigned engineer (VARCHAR(255))
- `assigned_role` - Assigned role (VARCHAR(50))
- `priority` - Priority level (VARCHAR(20))
- `due_date` - Workflow due date (TIMESTAMPTZ)
- `acknowledged_date` - Acknowledgment date (TIMESTAMPTZ)
- `submitted_date` - Submission date (TIMESTAMPTZ)
- `approved_date` - Approval date (TIMESTAMPTZ)
- `process_type` - Manufacturing process (VARCHAR(50))
- `mold_required` - Mold tracking flag (BOOLEAN)
- `mold_supplier` - Mold supplier (VARCHAR(255))
- `mold_status` - Mold status (VARCHAR(50))
- `mold_lead_time_days` - Mold lead time (INTEGER)
- `submission_level` - PPAP level (VARCHAR(10))
- `notes` - General notes (TEXT)
- `risk_flags` - Risk indicators (TEXT[])
- `deleted_at` - Soft delete timestamp (TIMESTAMPTZ) - **Pattern removed entirely**
- `created_by` - Record creator (VARCHAR(255))
- `updated_by` - Record updater (VARCHAR(255))

**Current Safe Query Notes:**
- ✅ SELECT * works (returns 9 columns)
- ✅ No need to filter by `deleted_at` (column doesn't exist)
- ✅ Filter by: status, plant, customer_name (ilike)
- ✅ Order by: created_at, updated_at, request_date
- ⚠️ Do NOT reference removed fields in WHERE, ORDER BY, or SELECT

**Current Safe Mutation Payload:**
```typescript
// INSERT (minimal required)
{
  ppap_number: string;    // Auto-generated via timestamp
  part_number: string;    // User input
  customer_name: string;  // User input
  plant: string;          // User input
  request_date: string;   // User input (ISO date string)
  status: 'NEW';          // Default
}

// UPDATE (any subset)
{
  status?: PPAPStatus;
  // Other fields can be updated but most don't exist yet
}
```

---

## Table: ppap_events

**Purpose:** Immutable audit trail for all PPAP mutations

**Confirmed Columns:**

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `id` | UUID | PRIMARY KEY | Event unique identifier |
| `ppap_id` | UUID | NOT NULL, FK → ppap_records.id | Parent PPAP record |
| `event_type` | VARCHAR(50) | NOT NULL | Event type (STATUS_CHANGED, etc.) |
| `event_data` | JSONB | NULL | Event payload (previous/new values) |
| `actor` | VARCHAR(255) | NOT NULL | User who performed action |
| `actor_role` | VARCHAR(50) | NULL | User role at time of action |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Event timestamp |

**Current Safe Query Notes:**
- ✅ Always query by `ppap_id` (indexed)
- ✅ Order by `created_at DESC` for chronological history
- ⚠️ `ppap_id` must never be null/undefined (validation guards in place)

**Current Safe Mutation Payload:**
```typescript
{
  ppap_id: string;              // REQUIRED - validated before insert
  event_type: EventType;        // REQUIRED
  event_data?: Record<string, unknown>; // Optional payload
  actor: string;                // REQUIRED
  actor_role?: string;          // Optional
}
```

---

## Table: ppap_conversations

**Purpose:** Internal conversation log tied to each PPAP

**Confirmed Columns:**

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `id` | UUID | PRIMARY KEY | Conversation unique identifier |
| `ppap_id` | UUID | NOT NULL, FK → ppap_records.id | Parent PPAP record |
| `message` | TEXT | NOT NULL | Conversation message content |
| `message_type` | VARCHAR(50) | NOT NULL | Message type (NOTE, STATUS_UPDATE, etc.) |
| `author` | VARCHAR(255) | NOT NULL | Message author |
| `author_role` | VARCHAR(50) | NULL | Author role |
| `author_site` | VARCHAR(100) | NULL | Author site/plant |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Message timestamp |
| `edited_at` | TIMESTAMPTZ | NULL | Edit timestamp |

**Columns Removed:**
- `deleted_at` - Soft delete (removed 2026-03-20)

**Current Safe Query Notes:**
- ✅ Query by `ppap_id`
- ✅ Order by `created_at DESC` for reverse chronological
- ⚠️ No soft delete filtering needed (column removed)

---

## Table: ppap_tasks

**Purpose:** Task tracking tied to each PPAP

**Confirmed Columns:**

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `id` | UUID | PRIMARY KEY | Task unique identifier |
| `ppap_id` | UUID | NOT NULL, FK → ppap_records.id | Parent PPAP record |
| `title` | VARCHAR(255) | NOT NULL | Task title |
| `description` | TEXT | NULL | Task description |
| `task_type` | VARCHAR(50) | NULL | Task type/category |
| `phase` | VARCHAR(50) | NULL | Workflow phase |
| `assigned_to` | VARCHAR(255) | NULL | Assigned person |
| `assigned_role` | VARCHAR(50) | NULL | Assigned role |
| `status` | VARCHAR(50) | NOT NULL | Task status (PENDING, IN_PROGRESS, COMPLETED) |
| `priority` | VARCHAR(20) | NOT NULL | Task priority |
| `due_date` | TIMESTAMPTZ | NULL | Task due date |
| `completed_at` | TIMESTAMPTZ | NULL | Completion timestamp |
| `completed_by` | VARCHAR(255) | NULL | Completer |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Update timestamp |

**Columns Removed:**
- `deleted_at` - Soft delete (removed 2026-03-20)

**Current Safe Query Notes:**
- ✅ Query by `ppap_id`
- ✅ Order by `created_at ASC` for chronological task list
- ⚠️ No soft delete filtering needed

---

## Table: ppap_documents

**Purpose:** Document metadata tracking for PPAP attachments

**Confirmed Columns:**

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `id` | UUID | PRIMARY KEY | Document unique identifier |
| `ppap_id` | UUID | NOT NULL, FK → ppap_records.id | Parent PPAP record |
| `document_name` | VARCHAR(255) | NOT NULL | Document filename |
| `document_type` | VARCHAR(50) | NULL | Document category |
| `file_size_bytes` | INTEGER | NULL | File size |
| `mime_type` | VARCHAR(100) | NULL | MIME type |
| `storage_path` | TEXT | NULL | Storage location |
| `storage_bucket` | VARCHAR(100) | NULL | Storage bucket name |
| `uploaded_by` | VARCHAR(255) | NOT NULL | Uploader |
| `version` | INTEGER | DEFAULT 1 | Document version |
| `notes` | TEXT | NULL | Document notes |

**Columns Removed:**
- `deleted_at` - Soft delete (removed 2026-03-20)
- `uploaded_at` - Timestamp field (removed 2026-03-20 - doesn't exist in live database)

**Current Safe Query Notes:**
- ✅ Query by `ppap_id`
- ⚠️ No timestamp ordering available (no created_at or uploaded_at column)
- ⚠️ No soft delete filtering needed

---

## Schema Change Protocol

When code needs a field that doesn't exist:

1. ✅ **Stop and verify** - Check this file, don't assume
2. ✅ **Request approval** - Schema changes must be explicitly approved
3. ✅ **Add field to live database** - Use migration or manual SQL
4. ✅ **Update this file** - Document new column with type, constraints, purpose
5. ✅ **Update BUILD_LEDGER.md** - Record schema change with timestamp
6. ✅ **Update DECISION_REGISTER.md** - If meaningful contract change
7. ✅ **Update code** - TypeScript types, queries, mutations
8. ✅ **Validate** - Test create/read/update with new field
9. ✅ **Commit** - Single atomic commit for schema + code alignment

---

## Verification Commands

To verify live schema matches this document:

```sql
-- Check ppap_records columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'ppap_records'
ORDER BY ordinal_position;

-- Repeat for other tables
```

Compare output to this file. If mismatch found, update this file first.
