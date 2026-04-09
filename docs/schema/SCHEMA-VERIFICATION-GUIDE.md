# Phase 3H.16.8 - Schema Verification & Reconciliation Guide

## Overview

This guide walks you through verifying and fixing any schema mismatches between your Supabase database and the application code.

---

## Quick Start

### Step 1: Verify Database Schema

```bash
npx ts-node scripts/verify-schema.ts
```

**This script will:**
- Connect to your Supabase database
- Query the actual column names and types
- Compare against expected schema from `bomSchema.ts`
- Identify missing or mismatched columns
- Generate migration SQL if needed

---

### Step 2: Review Results

The verification script outputs:

#### ✅ If Schema is Correct:
```
✅ Schema verification PASSED
✅ All critical columns exist
✅ Ready for backfill execution
```

**Next Action:** Proceed to Step 3 (Run Backfill)

#### ❌ If Schema Has Issues:
```
❌ Schema verification FAILED
❌ Missing 2 critical column(s)
  ⚠️  normalizedcolor
  ⚠️  category
```

**Next Action:** Proceed to Step 2A (Fix Schema)

---

### Step 2A: Fix Database Schema (If Needed)

If verification detects missing columns, the script will output SQL like:

```sql
-- Phase 3H.16.8: Add missing critical columns

ALTER TABLE bom_records ADD COLUMN IF NOT EXISTS normalizedcolor TEXT;
ALTER TABLE bom_records ADD COLUMN IF NOT EXISTS category TEXT;
```

**Execute this SQL:**

1. Open Supabase Dashboard
2. Go to SQL Editor
3. Paste the generated SQL
4. Click "Run"
5. Verify success message

**OR use the pre-written migration:**

1. Open: `supabase/migrations/phase_3h_16_8_schema_fix.sql`
2. Copy the entire file
3. Paste into Supabase SQL Editor
4. Run

---

### Step 3: Run Backfill

After schema is verified/fixed:

**Option A - Admin UI:**
1. Navigate to: `http://localhost:3000/admin/backfill`
2. Click: "Run Classification Backfill"
3. Wait for completion
4. Review results

**Option B - Browser Console:**
```javascript
await window.runBackfill()
```

---

### Step 4: Verify Results

#### Expected Backfill Output:
```
🔄 BACKFILL STARTED
📡 Creating Supabase client...
📊 Fetching BOM records...
🔍 SCHEMA VERIFICATION - Sample Record: { ... }
🔍 Critical Fields Check:
  category:        ✅ EXISTS
  normalizedcolor: ✅ EXISTS

📝 Processing 150 records...
  ↳ Record 10 (W20GR1015-BC): UNKNOWN → WIRE
  ↳ Record 11 (W18WH/BK1015-BC): UNKNOWN → WIRE
  ↳ Record 12 (SVH-21T-P1.1): UNKNOWN → TERMINAL
  ↳ Record 13 (VHR-5N): UNKNOWN → CONNECTOR
  ✓ Updated 50 records so far...
  ✓ Updated 100 records so far...
✅ BACKFILL COMPLETE: {
  updated: 120,
  skipped: 30,
  errors: 0,
  duration: '2500ms'
}
```

#### Verify UI:
1. Navigate to BOM detail page
2. Check that yellow UNKNOWN badges are gone
3. Verify gray category badges show: WIRE, TERMINAL, CONNECTOR
4. Check browser console for any errors

---

## Troubleshooting

### Error: "column does not exist"

**Symptom:**
```
❌ Fetch error: column "normalizedcolor" does not exist
```

**Cause:** Database missing required column

**Fix:**
1. Run verification script: `npx ts-node scripts/verify-schema.ts`
2. Execute generated migration SQL
3. Re-run backfill

---

### Error: "Missing critical database columns"

**Symptom:**
```
❌ CRITICAL SCHEMA ERROR: Missing required fields: category, normalizedcolor
```

**Cause:** Database schema not aligned with code expectations

**Fix:**
1. Run migration: `supabase/migrations/phase_3h_16_8_schema_fix.sql`
2. Verify columns exist:
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'bom_records' 
   AND column_name IN ('category', 'normalizedcolor');
   ```
3. Should return 2 rows
4. Re-run backfill

---

### Error: "Updated count = 0"

**Possible Causes:**

1. **All records already classified**
   - Check: `category` column already populated
   - Expected: Skip count high, update count low
   - Action: No fix needed

2. **Schema mismatch preventing updates**
   - Check: Console logs for schema errors
   - Action: Run verification script

3. **Update logic issue**
   - Check: Sample record in console logs
   - Verify: `category` and `normalizedcolor` fields exist
   - Action: Report issue with console output

---

## Manual Database Verification

If you prefer to manually verify the schema:

### Query 1: List All Columns
```sql
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'bom_records'
ORDER BY column_name;
```

### Query 2: Check Critical Columns
```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'bom_records'
AND column_name IN ('category', 'normalizedcolor', 'color')
ORDER BY column_name;
```

**Expected Result (3 rows):**
- `category`
- `color`
- `normalizedcolor`

### Query 3: Sample Data Inspection
```sql
SELECT 
  id,
  component_part_number,
  color,
  normalizedcolor,
  category
FROM bom_records
LIMIT 5;
```

**Expected:**
- `color`: Original value (may be abbreviation like "GR", "BK")
- `normalizedcolor`: Normalized (e.g., "green", "black") OR NULL (before backfill)
- `category`: Classification OR NULL (before backfill)

---

## Expected Database State

### Before Backfill:
```
component_part_number | color | normalizedcolor | category
--------------------- | ----- | --------------- | --------
W20GR1015-BC         | GR    | NULL            | NULL
SVH-21T-P1.1         | NULL  | NULL            | NULL
VHR-5N               | NULL  | NULL            | NULL
```

### After Backfill:
```
component_part_number | color | normalizedcolor | category
--------------------- | ----- | --------------- | ---------
W20GR1015-BC         | GR    | green           | WIRE
SVH-21T-P1.1         | NULL  | NULL            | TERMINAL
VHR-5N               | NULL  | NULL            | CONNECTOR
```

---

## Success Criteria Checklist

- [ ] Verification script runs without errors
- [ ] All critical columns exist in database
- [ ] Backfill completes with `errors: 0`
- [ ] Updated count > 0 (unless all records already classified)
- [ ] UI shows correct categories (WIRE, TERMINAL, CONNECTOR)
- [ ] No "column does not exist" errors in console
- [ ] Category badges display correctly (gray, not yellow)

---

## Support

If issues persist after following this guide:

1. Run verification script and save output
2. Run backfill and save console logs
3. Query database for sample records
4. Provide all outputs for diagnosis

---

**Last Updated:** Phase 3H.16.8  
**Status:** Schema verification and reconciliation utilities ready
