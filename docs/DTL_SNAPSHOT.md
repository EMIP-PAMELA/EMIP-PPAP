# Database Translation Layer (DTL) Snapshot

**Last Updated:** 2026-03-20 03:57 CT  
**Status:** ✅ VERIFIED AGAINST LIVE DATABASE - AUTHORITATIVE CONTRACT

## Purpose

This file is the **single source of truth** for the database schema contract. It documents the **actual live Supabase database structure** that all code must align to.

## ✅ VERIFIED AGAINST LIVE DATABASE – 2026-03-20 03:57 CT

All table schemas in this document have been verified against the live Supabase database using `information_schema.columns` queries. This document now represents the **authoritative contract** between the database and application code.

**DO NOT ASSUME ANY COLUMN EXISTS UNLESS LISTED IN THIS FILE.**

## Critical Rules

1. **Do NOT guess schema** - If code assumes a column exists, verify it in this file first
2. **Stop on mismatch** - If a task reveals code/database mismatch:
   - Stop implementation immediately
   - Verify actual schema in live database
   - Update this file first
   - Record delta in BUILD_LEDGER.md
   - Then update code to match reality
3. **This is authoritative** - When DATA_MODEL.md conflicts with this file, **this file wins**
4. **Track all changes** - Every schema change must update this file and BUILD_LEDGER.md
5. **Database is source of truth** - This file documents reality, not aspirations

---

## Table: ppap_records

**Purpose:** Core PPAP record tracking across all sites

**Verified Schema (9 columns):**

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `id` | UUID | NOT NULL, DEFAULT gen_random_uuid() | Unique record identifier |
| `ppap_number` | VARCHAR | NOT NULL | Business identifier (e.g., PPAP-123456-26) |
| `part_number` | VARCHAR | NOT NULL | Part identification number |
| `customer_name` | VARCHAR | NOT NULL | Customer name |
| `plant` | VARCHAR | NOT NULL | Manufacturing plant/site |
| `request_date` | TIMESTAMPTZ | NOT NULL | Date PPAP was requested |
| `status` | VARCHAR | NOT NULL, DEFAULT 'NEW' | Workflow status (NEW, IN_PROGRESS, SUBMITTED, APPROVED, REJECTED) |
| `created_at` | TIMESTAMPTZ | NULL, DEFAULT now() | Record creation timestamp |
| `updated_at` | TIMESTAMPTZ | NULL, DEFAULT now() | Record update timestamp |

**Safe Query Operations:**
- ✅ `SELECT * FROM ppap_records` returns 9 columns
- ✅ Filter by: `status`, `plant`, `customer_name` (use ILIKE for case-insensitive)
- ✅ Order by: `created_at`, `updated_at`, `request_date`
- ✅ No soft delete filtering needed (deleted_at does not exist)

**Safe Mutation Payload:**
```typescript
// INSERT
{
  ppap_number: string;    // REQUIRED
  part_number: string;    // REQUIRED
  customer_name: string;  // REQUIRED
  plant: string;          // REQUIRED
  request_date: string;   // REQUIRED (ISO date)
  status?: 'NEW';         // OPTIONAL (defaults to 'NEW')
}

// UPDATE
{
  status?: string;
  updated_at?: string;  // Auto-updated by trigger
}
```

---

## Table: ppap_events

**Purpose:** Immutable audit trail for all PPAP mutations

**Verified Schema (7 columns):**

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `id` | UUID | NOT NULL, DEFAULT gen_random_uuid() | Event unique identifier |
| `ppap_id` | UUID | NOT NULL | Parent PPAP record |
| `event_type` | VARCHAR | NOT NULL | Event type (STATUS_CHANGED, DOCUMENT_ADDED, etc.) |
| `event_data` | JSONB | NULL | Event payload (previous/new values) |
| `actor` | VARCHAR | NOT NULL | User who performed action |
| `actor_role` | VARCHAR | NULL | User role at time of action |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | Event timestamp |

**Safe Query Operations:**
- ✅ Always query by `ppap_id`
- ✅ Order by `created_at DESC` for chronological history
- ⚠️ `ppap_id` must never be null (NOT NULL constraint)

**Safe Mutation Payload:**
```typescript
{
  ppap_id: string;              // REQUIRED - NOT NULL
  event_type: string;           // REQUIRED - NOT NULL
  event_data?: Record<string, unknown>; // OPTIONAL - can be null
  actor: string;                // REQUIRED - NOT NULL
  actor_role?: string;          // OPTIONAL - can be null
}
```

---

## Table: ppap_conversations

**Purpose:** Internal conversation log tied to each PPAP

**Verified Schema (7 columns):**

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `id` | UUID | NOT NULL, DEFAULT gen_random_uuid() | Conversation unique identifier |
| `ppap_id` | UUID | NULL | Parent PPAP record |
| `body` | TEXT | NULL | Conversation message content |
| `message_type` | TEXT | NULL | Message type (NOTE, QUESTION, BLOCKER, etc.) |
| `author` | TEXT | NULL | Message author |
| `site` | TEXT | NULL | Author site/plant |
| `created_at` | TIMESTAMP | DEFAULT now() | Message timestamp |

**Safe Query Operations:**
- ✅ Query by `ppap_id`
- ✅ Order by `created_at DESC` for reverse chronological
- ✅ All columns except `id` are nullable

**Safe Mutation Payload:**
```typescript
{
  ppap_id: string;        // OPTIONAL (nullable in DB)
  body: string;           // OPTIONAL (nullable in DB)
  message_type?: string;  // OPTIONAL (nullable in DB)
  author: string;         // OPTIONAL (nullable in DB)
  site?: string;          // OPTIONAL (nullable in DB)
}
```

---

## Table: ppap_tasks

**Purpose:** Task tracking tied to each PPAP

**Verified Schema (9 columns):**

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `id` | UUID | NOT NULL, DEFAULT gen_random_uuid() | Task unique identifier |
| `ppap_id` | UUID | NULL | Parent PPAP record |
| `phase` | TEXT | NULL | Workflow phase |
| `title` | TEXT | NULL | Task title |
| `status` | TEXT | DEFAULT 'pending' | Task status (pending, in_progress, completed) |
| `assigned_to` | TEXT | NULL | Assigned person |
| `due_date` | DATE | NULL | Task due date |
| `completed_at` | TIMESTAMP | NULL | Completion timestamp |
| `created_at` | TIMESTAMP | DEFAULT now() | Creation timestamp |

**Safe Query Operations:**
- ✅ Query by `ppap_id`
- ✅ Filter by `status`, `assigned_to`, `phase`
- ✅ Order by `created_at`, `due_date`
- ✅ All columns except `id` are nullable

**Safe Mutation Payload:**
```typescript
{
  ppap_id?: string;        // OPTIONAL (nullable)
  phase?: string;          // OPTIONAL (nullable)
  title?: string;          // OPTIONAL (nullable)
  status?: string;         // OPTIONAL (defaults to 'pending')
  assigned_to?: string;    // OPTIONAL (nullable)
  due_date?: string;       // OPTIONAL (nullable, DATE type)
  completed_at?: string;   // OPTIONAL (nullable)
}
```

---

## Table: ppap_documents

**Purpose:** Document metadata tracking for PPAP attachments

**Verified Schema (7 columns):**

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `id` | UUID | NOT NULL, DEFAULT gen_random_uuid() | Document unique identifier |
| `ppap_id` | UUID | NULL | Parent PPAP record |
| `category` | TEXT | NULL | Document category/type |
| `file_name` | TEXT | NULL | Document filename |
| `file_url` | TEXT | NULL | Storage URL/path |
| `uploaded_by` | TEXT | NULL | Uploader name |
| `created_at` | TIMESTAMP | DEFAULT now() | Upload timestamp |

**Safe Query Operations:**
- ✅ Query by `ppap_id`
- ✅ Order by `created_at` for chronological sorting
- ✅ All columns except `id` are nullable

**Safe Mutation Payload:**
```typescript
{
  ppap_id?: string;        // OPTIONAL (nullable)
  category?: string;       // OPTIONAL (nullable)
  file_name?: string;      // OPTIONAL (nullable)
  file_url?: string;       // OPTIONAL (nullable)
  uploaded_by?: string;    // OPTIONAL (nullable)
}
```

---

## Previously Incorrect Assumptions (Corrected)

**This section documents schema mismatches discovered during the 2026-03-20 DTL rebaseline.**

### ppap_conversations - Column Name Mismatches
- ❌ **Assumed:** `message` column → ✅ **Actual:** `body` column
- ❌ **Assumed:** `author_site` column → ✅ **Actual:** `site` column
- ❌ **Assumed:** `author_role` column → ✅ **Actual:** Does not exist
- ❌ **Assumed:** `edited_at` column → ✅ **Actual:** Does not exist
- ❌ **Assumed:** `deleted_at` column → ✅ **Actual:** Does not exist

### ppap_documents - Column Name Mismatches
- ❌ **Assumed:** `document_name` column → ✅ **Actual:** `file_name` column
- ❌ **Assumed:** `document_type` column → ✅ **Actual:** `category` column
- ❌ **Assumed:** `storage_path` column → ✅ **Actual:** `file_url` column
- ❌ **Assumed:** `uploaded_at` column → ✅ **Actual:** Does not exist (use `created_at`)
- ❌ **Assumed:** `file_size_bytes`, `mime_type`, `storage_bucket`, `version`, `notes` → ✅ **Actual:** Do not exist

### ppap_tasks - Fields That Actually Exist
- ✅ **`assigned_to`** - EXISTS in live database (was incorrectly removed from code)
- ✅ **`due_date`** - EXISTS in live database (was incorrectly removed from code)
- ✅ **`phase`** - EXISTS in live database (was incorrectly removed from code)
- ✅ **`title`** - EXISTS in live database (was incorrectly removed from code)
- ✅ **`completed_at`** - EXISTS in live database
- ❌ **Assumed:** `description`, `task_type`, `assigned_role`, `priority`, `completed_by`, `updated_at` → ✅ **Actual:** Do not exist

### Root Cause
The original DTL_SNAPSHOT.md was created from an outdated `schema.sql` file that did not match the live Supabase database. This led to:
- Incorrect column names being used in code
- Code referencing fields that never existed
- Code NOT using fields that DO exist

**All schemas have now been verified against live database queries.**

---

## Controlled Re-Expansion Roadmap

**Phase 1: Reintroduce Existing Task Fields**
- `assigned_to` - Already exists in DB, need to add back to code
- `due_date` - Already exists in DB, need to add back to code
- `phase` - Already exists in DB, need to add back to code
- `title` - Already exists in DB, need to add back to code
- Update TypeScript interfaces
- Update task creation/display components
- Verify task list shows assignments and due dates

**Phase 2: Fix Document Field Names**
- Rename `document_name` → `file_name` in code
- Rename `document_type` → `category` in code
- Rename `storage_path` → `file_url` in code
- Remove references to non-existent fields (file_size_bytes, mime_type, etc.)
- Update document mutations and queries
- Update document list display

**Phase 3: Use created_at for Sorting**
- Documents: Use `created_at` for chronological sorting
- Tasks: Use `created_at` for default ordering
- Conversations: Already using `created_at`

**Phase 4: Enhance Event Logging**
- Utilize `event_data` JSONB field for richer audit trails
- Store before/after values in status changes
- Track detailed context in events

**Note:** No code changes in this commit - this is documentation/planning only.

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

To verify live schema matches this document, run these queries in Supabase SQL Editor:

```sql
-- ppap_records
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'ppap_records'
ORDER BY ordinal_position;

-- ppap_events
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'ppap_events'
ORDER BY ordinal_position;

-- ppap_conversations
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'ppap_conversations'
ORDER BY ordinal_position;

-- ppap_tasks
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'ppap_tasks'
ORDER BY ordinal_position;

-- ppap_documents
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'ppap_documents'
ORDER BY ordinal_position;
```

**Compare output to this file. If mismatch found:**
1. Update this file first (DTL is source of truth)
2. Record discrepancy in BUILD_LEDGER.md
3. Then update code to match reality
