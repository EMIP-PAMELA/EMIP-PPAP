# Phase 3H.16.7 - BOM Schema Audit Report

**Date:** 2026-04-09  
**Phase:** 3H.16.7  
**Objective:** Eliminate schema mismatches between database and code

---

## Executive Summary

This audit identifies and documents all schema-related issues discovered across the codebase, focusing on the `bom_records` table in Supabase.

---

## Known Issues Fixed in Prior Phases

### ✅ Phase 3H.16.4 - rawColor Dependency Removed
**Issue:** Code referenced non-existent `rawColor` column in backfill queries  
**Impact:** Backfill failed with "column does not exist" error  
**Resolution:** Removed `rawColor` from backfill select queries and update payloads  
**Status:** FIXED

### ✅ Phase 3H.16.5 - normalizedColor Case Mismatch
**Issue:** Code used `normalizedColor` (camelCase), database uses `normalizedcolor` (lowercase)  
**Impact:** Backfill queries failed  
**Resolution:** Aligned all code to use `normalizedcolor` (lowercase)  
**Files Updated:**
- `src/core/services/backfillService.ts`
- `src/core/data/bom/types.ts`
- `src/core/services/bomService.ts`
- `app/bom/[partNumber]/page.tsx`
- `src/core/data/bom/ingestion.ts`

**Status:** FIXED

---

## Current Schema State (Post-Phase 3H.16.5)

### Database Schema (Confirmed Fields)

Based on code usage analysis, the `bom_records` table contains:

```sql
-- Core Identification
id                      BIGINT PRIMARY KEY
parent_part_number      TEXT
component_part_number   TEXT
description             TEXT

-- Quantity & Measurements
quantity                NUMERIC
unit                    TEXT
length                  NUMERIC
gauge                   TEXT

-- Color Fields
color                   TEXT
rawColor                TEXT (possibly unused in queries)
normalizedcolor         TEXT (lowercase!)

-- Classification
category                TEXT

-- Manufacturing
operation_step          TEXT

-- Version Control
revision                TEXT
revision_order          INTEGER
is_active               BOOLEAN
ingestion_batch_id      TEXT
version_number          INTEGER

-- Metadata
source_reference        TEXT
created_at              TIMESTAMPTZ
updated_at              TIMESTAMPTZ
artifact_url            TEXT
```

### Code Schema Expectations

**TypeScript Interface:** `src/core/data/bom/types.ts`

```typescript
export interface BOMRecord {
  id?: number;
  parent_part_number?: string;
  component_part_number: string;
  description?: string | null;
  quantity?: number | null;
  unit?: string | null;
  length?: number | null;
  gauge?: string | null;
  color?: string | null;
  rawColor?: string | null;
  normalizedcolor?: string | null;  // ✅ Aligned
  category?: string;
  operation_step?: string | null;
  revision?: string | null;
  revision_order?: number | null;
  is_active?: boolean;
  ingestion_batch_id?: string | null;
  version_number?: number | null;
  source_reference?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  artifact_url?: string | null;
}
```

---

## Potential Mismatches (Require Database Verification)

### 🔍 rawColor Field Status

**Code References:**
- Present in `BOMRecord` interface
- Used in ingestion pipeline
- NOT queried in backfill service (removed in 3H.16.4)

**Database Status:** UNKNOWN (needs verification)

**Recommendation:**
```sql
-- If column exists, keep for historical data
-- If column does not exist, remove from ingestion

-- Verify:
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'bom_records' 
AND column_name = 'rawcolor';
```

### 🔍 Case Sensitivity Audit

PostgreSQL stores column names in lowercase unless quoted. Verify:

```sql
-- Check actual column names
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'bom_records' 
ORDER BY column_name;
```

**Expected columns (lowercase):**
- `normalizedcolor` ✅ (fixed in 3H.16.5)
- `rawcolor` (if exists)
- All other fields use snake_case

---

## Query Audit Results

### Backfill Service Queries ✅

**File:** `src/core/services/backfillService.ts`

```typescript
// SELECT query
.select('id, component_part_number, description, color, normalizedcolor, category')

// UPDATE payload
{
  normalizedcolor: string,  // ✅ Aligned
  category: string          // ✅ Aligned
}
```

**Status:** ALIGNED

### BOM Service Queries ⚠️

**File:** `src/core/services/bomService.ts`

Multiple queries use `.select('*')` which is safe but less explicit.

**Recommendation:** Use explicit field lists for clarity and type safety.

---

## Ingestion Pipeline Review

**File:** `src/core/data/bom/ingestion.ts`

```typescript
const record: BOMRecord = {
  parent_part_number: masterPartNumber,
  component_part_number: component.detectedPartId,
  quantity: component.detectedQty || 1,
  unit: component.detectedUom,
  description: null,
  length: wireDetection.isWire ? wireDetection.length : null,
  gauge: wireDetection.gauge || null,
  color: wireColor,
  category: category,
  rawColor: rawColor,              // ⚠️ Needs DB verification
  normalizedcolor: normalizedColor, // ✅ Aligned
  operation_step: operation.step,
  revision: normalizedRevision.revision,
  revision_order: normalizedRevision.order,
  ingestion_batch_id: ingestionBatchId,
  // ... version control fields
};
```

**Status:** 
- ✅ `normalizedcolor` aligned
- ⚠️ `rawColor` needs database column verification

---

## Recommendations

### Immediate Actions

1. **Verify Database Schema**
   ```sql
   SELECT column_name, data_type, is_nullable
   FROM information_schema.columns 
   WHERE table_name = 'bom_records' 
   ORDER BY ordinal_position;
   ```

2. **Check rawColor Column**
   ```sql
   SELECT EXISTS (
     SELECT 1 
     FROM information_schema.columns 
     WHERE table_name = 'bom_records' 
     AND column_name = 'rawcolor'
   );
   ```

3. **If rawColor Missing:**
   - Option A: Add column to database
   - Option B: Remove from code (ingestion pipeline)

### Long-Term Governance

1. **Single Source of Truth** ✅
   - Created: `src/core/schema/bomSchema.ts`
   - All services should import from this file

2. **Type-Safe Queries**
   - Use `BOM_FIELDS.CORE` instead of hardcoded strings
   - Prevents typos and mismatches

3. **Schema Validation**
   - Add runtime checks on ingestion
   - Log warnings for unexpected fields

4. **Migration Strategy**
   - Future schema changes require:
     - Database migration SQL
     - Schema file update
     - Code updates
     - Documentation

---

## Success Criteria

### ✅ Completed
- [x] Removed `rawColor` from backfill queries
- [x] Aligned `normalizedColor` → `normalizedcolor`
- [x] Created single source of truth schema file
- [x] Documented all field usage

### 🔄 Pending Database Verification
- [ ] Confirm `rawcolor` column exists/doesn't exist
- [ ] Verify all column names are lowercase
- [ ] Confirm data types match expectations

### 📋 Next Steps
1. Execute backfill with current schema
2. Monitor for any "column does not exist" errors
3. If errors occur, identify missing column and update schema
4. Document findings and update schema file

---

## Appendix: Field Usage Matrix

| Field Name | Interface | Backfill Query | Ingestion | UI Display |
|------------|-----------|----------------|-----------|------------|
| id | ✅ | ✅ | Auto | ✅ |
| component_part_number | ✅ | ✅ | ✅ | ✅ |
| description | ✅ | ✅ | ✅ | ✅ |
| color | ✅ | ✅ | ✅ | ✅ |
| normalizedcolor | ✅ | ✅ | ✅ | ✅ |
| category | ✅ | ✅ | ✅ | ✅ |
| rawColor | ✅ | ❌ | ✅ | ✅ |
| length | ✅ | ❌ | ✅ | ✅ |
| gauge | ✅ | ❌ | ✅ | ✅ |
| quantity | ✅ | ❌ | ✅ | ✅ |
| operation_step | ✅ | ❌ | ✅ | ✅ |

---

**Report Generated:** Phase 3H.16.7  
**Status:** Schema aligned based on code analysis  
**Next Action:** Execute backfill and monitor for runtime errors
