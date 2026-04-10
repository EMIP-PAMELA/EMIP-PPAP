# AI Classification Save 500 Error - Debug Guide

## Phase 3H.25.7 — Comprehensive Logging Added

### What Was Added

1. **API Route Logging** (`app/api/ai/classify-save/route.ts`)
   - `[CLASSIFY_SAVE_PAYLOAD]` - Shows incoming request body
   - `[CLASSIFY_SAVE_ERROR]` - Shows detailed error with Supabase response
   - Source validation improved with clear warning logs

2. **Service Layer Logging** (`src/core/services/classificationLookup.ts`)
   - `[AI CLASSIFICATION UPSERT] Attempting insert` - Shows exact payload before Supabase
   - `[AI CLASSIFICATION STORE] Failed to upsert mapping` - Shows detailed Supabase error
   - `[AI CLASSIFICATION UPSERT] Success` - Confirms successful insert with data

### How to Debug

#### Step 1: Reproduce the Error
1. Open `/ai-classification` in the browser
2. Click "Analyze" on an UNKNOWN part
3. Wait for AI suggestion
4. Select a category in the dropdown (or leave AI suggestion)
5. Click "💾 Save"
6. Open browser DevTools Console and Server Console

#### Step 2: Check Browser Console Logs
Look for:
```
[AI REQUEST] Classify PART-123
[AI RESPONSE] PART-123 → TERMINAL (85%)
[USER_MODIFIED] PART-123 selection FERRULE
[USER_ACTION] Save requested: PART-123 TERMINAL [MANUAL]
```

#### Step 3: Check Server Console Logs
Look for this sequence:
```
[CLASSIFY_SAVE_PAYLOAD] {
  partNumber: 'PART-123',
  category: 'TERMINAL',
  confidence: 0.85,
  source: 'MANUAL',
  description: 'Some description'
}

[AI CLASSIFICATION UPSERT] Attempting insert {
  part_number: 'PART-123',
  category: 'TERMINAL',
  confidence: 0.85,
  source: 'MANUAL',
  description: 'Some description'
}
```

#### Step 4: Identify the Error

**If you see:**
```
[AI CLASSIFICATION STORE] Failed to upsert mapping {
  error: { ... },
  errorMessage: "new row violates check constraint ...",
  errorCode: "23514",
  ...
}
```

**Possible causes:**

1. **Category Constraint Violation**
   - Error mentions `component_classification_category_check`
   - The category being sent doesn't match DB constraint
   - **Fix:** Check CATEGORY_TO_CANONICAL mapping in UI
   - DB allows: WIRE, TERMINAL, CONNECTOR, SEAL, HARDWARE, LABEL, SLEEVING, HOUSING, UNKNOWN

2. **Source Field Issue**
   - Error mentions invalid source value
   - **Fix:** DB schema may need source constraint update
   - Current allowed: AI, AI_APPROVED, MANUAL

3. **Confidence Out of Range**
   - Error mentions confidence check constraint
   - **Fix:** Ensure 0 <= confidence <= 1

4. **NULL Constraint**
   - Error mentions "not-null constraint"
   - **Fix:** Ensure required fields are not null

### Common Issues & Fixes

#### Issue 1: Category Mapping
**Symptom:** Error says "violates check constraint component_classification_category_check"

**Root Cause:** UI sends category not in DB constraint list

**Fix:** Verify CATEGORY_TO_CANONICAL in `app/ai-classification/page.tsx`:
```typescript
const CATEGORY_TO_CANONICAL: Record<CategoryOption, CanonicalCategory> = {
  WIRE: 'WIRE',
  TERMINAL: 'TERMINAL',
  CONNECTOR: 'CONNECTOR',
  SEAL: 'SEAL',
  FERRULE: 'TERMINAL',    // Maps to TERMINAL
  HOUSING: 'HOUSING',
  PLUG: 'CONNECTOR',       // Maps to CONNECTOR
  HARDWARE: 'HARDWARE',
  LABEL: 'LABEL',
  SLEEVING: 'SLEEVING',
  OTHER: 'UNKNOWN'         // Maps to UNKNOWN
};
```

#### Issue 2: RLS Policy
**Symptom:** Error says "new row violates row-level security policy"

**Root Cause:** Supabase RLS policy blocks the insert

**Fix:** Check migration `20260410_create_component_classification_map.sql` has:
```sql
CREATE POLICY "Allow insert classification map"
  ON component_classification_map
  FOR INSERT
  TO public
  WITH CHECK (true);
```

#### Issue 3: Database Connection
**Symptom:** Error says "Failed to reach database" or connection timeout

**Root Cause:** Supabase client not configured or credentials wrong

**Fix:** Verify `.env.local` has:
```
NEXT_PUBLIC_SUPABASE_URL=your-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key
```

### Verification Steps

After fix:
1. Click Save on a classification
2. Check server logs for `[AI CLASSIFICATION UPSERT] Success`
3. Verify row disappears from UI
4. Query Supabase directly:
   ```sql
   SELECT * FROM component_classification_map ORDER BY created_at DESC LIMIT 5;
   ```

### Schema Reference

Table: `component_classification_map`

| Column | Type | Constraints |
|--------|------|-------------|
| part_number | TEXT | PRIMARY KEY |
| category | TEXT | NOT NULL, CHECK (IN allowed list) |
| confidence | NUMERIC(3,2) | NOT NULL, CHECK (0-1) |
| source | TEXT | NOT NULL, DEFAULT 'AI' |
| description | TEXT | NULL allowed |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

Allowed categories:
- WIRE
- TERMINAL
- CONNECTOR
- SEAL
- HARDWARE
- LABEL
- SLEEVING
- HOUSING
- UNKNOWN

### Next Steps If Still Failing

1. Copy the `[CLASSIFY_SAVE_PAYLOAD]` log output
2. Copy the `[CLASSIFY_SAVE_ERROR]` log output
3. Run this SQL in Supabase SQL Editor:
   ```sql
   -- Test insert manually
   INSERT INTO component_classification_map
   (part_number, category, confidence, source, description)
   VALUES
   ('TEST-PART', 'TERMINAL', 0.85, 'MANUAL', 'Test description')
   ON CONFLICT (part_number) DO UPDATE SET
     category = EXCLUDED.category,
     confidence = EXCLUDED.confidence,
     source = EXCLUDED.source;
   ```
4. If manual insert works, issue is in app code
5. If manual insert fails, issue is in DB schema or RLS
