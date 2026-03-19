# Repository Guardrails

Operating rules for developers and AI agents working in this repository.

---

## Core Principles

1. **Minimal viable changes**: Make only the changes required for the current task
2. **Preserve business logic**: Never casually rename core fields or change canonical enums
3. **Document before changing**: Check DATA_MODEL and BUILD_LEDGER before schema changes
4. **Audit everything**: Every mutation must log to ppap_events
5. **Fail visibly**: Show errors clearly; never fail silently
6. **No speculative architecture**: Build what's needed now, not what might be needed later

---

## Before Making Changes

### Schema Changes

Before modifying database schema:
1. ✅ Check `docs/DATA_MODEL.md` for current schema
2. ✅ Check `docs/BUILD_LEDGER.md` for recent schema changes
3. ✅ Verify change doesn't break canonical enums or workflow rules
4. ✅ Update DATA_MODEL.md with the change
5. ✅ Add entry to BUILD_LEDGER.md
6. ✅ Test migration locally before committing

### Status or Workflow Changes

Before changing status values or workflow logic:
1. ✅ Check `docs/WORKFLOW_RULES.md` for current rules
2. ✅ Verify change aligns with business requirements
3. ✅ Update WORKFLOW_RULES.md if behavior changes
4. ✅ Update ACCEPTANCE_CRITERIA.md if user-facing behavior changes
5. ✅ Ensure all status transitions remain valid

### Adding Dependencies

Before adding a new npm package:
1. ✅ Verify it's actually needed (can we solve this without a library?)
2. ✅ Check package size and maintenance status
3. ✅ Document decision in DECISION_REGISTER.md
4. ✅ Add to BUILD_LEDGER.md

---

## Mandatory Practices

### Every Mutation Must

1. **Validate inputs** before writing to database
2. **Write to ppap_events** audit log (except for events table itself)
3. **Handle errors** and return meaningful error messages
4. **Use transactions** when multiple tables are affected
5. **Return success/failure** status clearly

### Every Feature Must Have

1. **Loading state**: Show spinner/skeleton while data loads
2. **Error state**: Show clear error message when operation fails
3. **Empty state**: Show helpful message when no data exists
4. **Success feedback**: Confirm when operation succeeds

### Every Component Should

1. **Be typed**: Use TypeScript interfaces for all props and data
2. **Be focused**: Do one thing well
3. **Be testable**: Separate logic from presentation where practical
4. **Be readable**: Prefer clarity over cleverness

---

## Forbidden Practices

### Never

- ❌ Hard delete PPAP records (use soft delete via deleted_at)
- ❌ Modify canonical status enums without updating DATA_MODEL and WORKFLOW_RULES
- ❌ Skip event logging for mutations
- ❌ Commit code that doesn't compile
- ❌ Commit code with console.error or TODO comments without tracking
- ❌ Push directly to main without testing locally
- ❌ Make schema changes without documenting in BUILD_LEDGER
- ❌ Rename core business fields casually (part_number, ppap_number, status, etc.)
- ❌ Add features not in BUILD_PLAN without discussing first
- ❌ Bypass validation "just to make it work"
- ❌ Leave broken states in the UI (always show loading/error/empty states)

### Avoid

- ⚠️ Giant commits with unrelated changes
- ⚠️ Vague commit messages ("fix stuff", "updates")
- ⚠️ Deeply nested component trees
- ⚠️ Business logic in page files
- ⚠️ Magic numbers or hardcoded values
- ⚠️ Duplicate code (extract to shared helpers)
- ⚠️ Overly generic utility files (keep helpers focused)

---

## Code Organization Rules

### Folder Structure

```
app/
  ppap/
    page.tsx              # PPAP list page
    [id]/
      page.tsx            # PPAP dashboard page
    new/
      page.tsx            # Create PPAP form
      
src/
  lib/
    supabaseClient.ts     # Supabase client singleton
    
  features/
    ppap/
      types.ts            # TypeScript interfaces
      queries.ts          # Data fetching functions
      mutations.ts        # Data mutation functions
      components/         # PPAP-specific UI components
      
    conversations/
      types.ts
      queries.ts
      mutations.ts
      components/
      
    tasks/
      types.ts
      queries.ts
      mutations.ts
      components/
      
    documents/
      types.ts
      queries.ts
      mutations.ts
      components/
      
  components/
    ui/                   # Shared UI components (buttons, cards, etc.)
    
docs/
  BUILD_PLAN.md
  BUILD_LEDGER.md
  DATA_MODEL.md
  WORKFLOW_RULES.md
  ACCEPTANCE_CRITERIA.md
  DECISION_REGISTER.md
  REPO_GUARDRAILS.md
```

### File Naming

- **Pages**: `page.tsx` (Next.js convention)
- **Components**: `PascalCase.tsx` (e.g., `PPAPCard.tsx`)
- **Utilities**: `camelCase.ts` (e.g., `formatDate.ts`)
- **Types**: `types.ts` or `{feature}.types.ts`
- **Queries**: `queries.ts` or `{feature}.queries.ts`
- **Mutations**: `mutations.ts` or `{feature}.mutations.ts`

### Import Order

1. React/Next.js imports
2. Third-party library imports
3. Local type imports
4. Local component imports
5. Local utility imports

---

## Commit Guidelines

### Commit Message Format

```
<type>: <short description>

<optional longer description>
<optional reference to issue/task>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code restructuring without behavior change
- `chore`: Maintenance tasks (docs, deps, config)
- `data`: Schema or data changes
- `test`: Adding or updating tests

### Examples

✅ Good:
```
feat: add PPAP list page with status filter

- Created app/ppap/page.tsx
- Added queries.ts for fetching PPAP records
- Implemented status filter dropdown
- Added loading and empty states
```

```
data: add mold tracking fields to ppap_records

- Added mold_required, mold_supplier, mold_status, mold_lead_time_days
- Updated DATA_MODEL.md with new fields
- Added migration script
```

❌ Bad:
```
updates
```

```
fixed some stuff
```

```
WIP
```

---

## Pull Request Guidelines

### Before Creating PR

1. ✅ Code compiles without errors
2. ✅ No console errors in browser
3. ✅ Feature works as expected locally
4. ✅ Loading/error/empty states implemented
5. ✅ BUILD_LEDGER updated
6. ✅ Relevant docs updated (DATA_MODEL, WORKFLOW_RULES, etc.)

### PR Description Should Include

- What changed and why
- How to test the change
- Screenshots (if UI change)
- Any breaking changes or migration steps
- Reference to BUILD_LEDGER entry

---

## Testing Checklist

Before marking a feature as done:

### Functional Testing
- [ ] Happy path works (create → view → update)
- [ ] Validation catches invalid inputs
- [ ] Error handling works (network failure, validation errors)
- [ ] Loading states appear during async operations
- [ ] Empty states appear when no data exists

### Data Integrity
- [ ] Mutations write to ppap_events
- [ ] Foreign keys enforced
- [ ] No orphaned records
- [ ] Soft deletes work correctly
- [ ] Timestamps in UTC

### UI/UX
- [ ] No layout shifts during loading
- [ ] Error messages are clear and actionable
- [ ] Forms validate before submission
- [ ] Success feedback shown after mutations
- [ ] Responsive on different screen sizes (basic check)

---

## When Stuck

### If You're Unsure About

- **Schema changes**: Check DATA_MODEL.md and ask before changing
- **Workflow logic**: Check WORKFLOW_RULES.md
- **Feature requirements**: Check ACCEPTANCE_CRITERIA.md
- **Architecture decisions**: Check DECISION_REGISTER.md
- **What to build next**: Check BUILD_PLAN.md

### If Something Breaks

1. Check browser console for errors
2. Check server logs (terminal running dev server)
3. Check Supabase logs (if database-related)
4. Check BUILD_LEDGER for recent changes
5. Roll back to last known good commit if needed

### If You Need to Deviate from Plan

1. Document why in BUILD_LEDGER
2. Update affected docs (DATA_MODEL, WORKFLOW_RULES, etc.)
3. Note in commit message
4. Consider updating BUILD_PLAN if it affects future work

---

## AI Agent Specific Rules

When using Cascade or other AI coding assistants:

1. **Always check docs first**: Before making changes, read relevant docs (DATA_MODEL, WORKFLOW_RULES, etc.)
2. **Make scoped changes**: Only change what's needed for the current task
3. **Update BUILD_LEDGER**: After each meaningful milestone, add an entry
4. **Suggest commits**: After completing a feature, suggest a commit message
5. **Surface uncertainty**: If requirements are unclear, ask instead of guessing
6. **Preserve patterns**: Follow existing code patterns in the repo
7. **No speculative code**: Don't add "nice to have" features not in BUILD_PLAN
8. **Validate before submitting**: Ensure code compiles and basic functionality works

---

## Definition of Done

A task is only done when:

1. ✅ Code works against real Supabase data
2. ✅ TypeScript compiles without errors
3. ✅ No console errors in browser
4. ✅ Loading/error/empty states implemented
5. ✅ Event logging implemented (if mutation)
6. ✅ BUILD_LEDGER updated
7. ✅ Relevant docs updated
8. ✅ Committed with meaningful message
9. ✅ Tested locally

---

## Emergency Procedures

### If Production is Broken

1. Immediately roll back to last known good deployment
2. Document issue in BUILD_LEDGER with [FIX] tag
3. Fix in local environment
4. Test thoroughly
5. Deploy fix
6. Add post-mortem to DECISION_REGISTER if architectural issue

### If Database is Corrupted

1. Do NOT run destructive queries
2. Check Supabase dashboard for backups
3. Document issue in BUILD_LEDGER
4. Restore from backup if available
5. Identify root cause
6. Add safeguards to prevent recurrence

---
