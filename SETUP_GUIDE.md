# EMIP-PPAP Setup Guide

## What's Been Built

This project now has a complete MVP foundation with:

### ✅ Governance & Documentation
- Complete project plan and scope (`docs/BUILD_PLAN.md`)
- Database schema documentation (`docs/DATA_MODEL.md`)
- Workflow rules and business logic (`docs/WORKFLOW_RULES.md`)
- Acceptance criteria checklist (`docs/ACCEPTANCE_CRITERIA.md`)
- Architecture decisions log (`docs/DECISION_REGISTER.md`)
- Development guidelines (`docs/REPO_GUARDRAILS.md`)
- Change history (`docs/BUILD_LEDGER.md`)

### ✅ Database Schema
- 5 tables fully defined in `supabase/schema.sql`:
  - `ppap_records` - Core PPAP data
  - `ppap_documents` - Document metadata
  - `ppap_conversations` - Internal communication log
  - `ppap_tasks` - Task tracking
  - `ppap_events` - Audit trail
- Row Level Security (RLS) policies configured
- Indexes for performance
- Helper functions for PPAP number generation

### ✅ Data Access Layer
- TypeScript types for all entities (`src/types/database.types.ts`)
- Query functions for fetching data
- Mutation functions with automatic event logging
- Separate modules for each feature domain

### ✅ User Interface
- **PPAP List Page** (`/ppap`) - View all PPAPs with filters
- **Create PPAP Form** (`/ppap/new`) - Create new records
- **PPAP Dashboard** (`/ppap/[id]`) - Complete record view with:
  - Header with status and key info
  - Conversation log
  - Task list
  - Document list
  - Mold tracking section (when applicable)
  - Event history

### ✅ Features Implemented
- PPAP creation with auto-generated PPAP numbers
- Overdue indicators on list and dashboard
- Mold-required indicators
- Status badges with color coding
- Empty states for all sections
- Error handling and display
- Loading states (server-side rendering)

---

## Next Steps to Get Running

### 1. Create Supabase Database

**You must do this before the app will work:**

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project (choose a region close to you)
3. Wait for the project to finish provisioning (~2 minutes)
4. Go to **SQL Editor** in the left sidebar
5. Click **New Query**
6. Open `supabase/schema.sql` in this project
7. Copy the entire contents
8. Paste into the SQL Editor
9. Click **Run** (or press Ctrl/Cmd + Enter)
10. Verify success - you should see "Success. No rows returned"
11. Go to **Table Editor** and verify all 5 tables exist

### 2. Configure Environment Variables

**You must create this file manually:**

1. In the project root, create a file named `.env.local`
2. Add these two lines (replace with your actual values):

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

3. Get your values from Supabase:
   - Click **Settings** (gear icon) in Supabase sidebar
   - Click **API**
   - Copy **Project URL** → use as `NEXT_PUBLIC_SUPABASE_URL`
   - Copy **anon/public** key → use as `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 3. Start the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 4. Create Your First PPAP

1. The app should redirect to `/ppap` (PPAP list page)
2. You'll see an empty state
3. Click **"Create First PPAP"**
4. Fill in the form:
   - **Part Number**: Required (e.g., "12345-ABC")
   - **Customer Name**: Required (e.g., "Acme Corp")
   - **Plant**: Required (select from dropdown)
   - **Request Date**: Required
   - **Due Date**: Optional but recommended
5. Click **"Create PPAP"**
6. You'll be redirected to the dashboard for your new PPAP

---

## What's Working Now

### ✅ You Can:
- Create PPAP records
- View list of all PPAPs
- Filter by status, plant, customer, assignee
- See overdue indicators
- See mold-required indicators
- View PPAP dashboard with all details
- See conversation history (read-only)
- See task list (read-only)
- See document list (read-only)
- See mold section (when applicable)
- See complete event history

### ⚠️ Not Yet Implemented (Coming Next):
- **Interactive forms** for adding conversations, tasks, documents
- **Status change** functionality (change PPAP status)
- **Assignment** functionality (assign to users)
- **Task completion** (mark tasks as done)
- **Document upload** (actual file storage)
- **Filters** on list page (UI exists but not wired up)
- **Dashboard stats** on home page
- **User authentication** (currently trust-based)

---

## Troubleshooting

### "Failed to fetch PPAPs"

**Cause**: Database not set up or environment variables incorrect

**Fix**:
1. Verify `.env.local` exists with correct values
2. Verify database tables were created in Supabase
3. Check Supabase project is not paused
4. Restart dev server after creating `.env.local`

### "Cannot find module" TypeScript errors

**Cause**: IDE hasn't picked up new files yet

**Fix**:
1. Restart TypeScript server in your IDE
2. Or run `npm run build` to verify everything compiles

### Empty PPAP list but you created records

**Cause**: RLS policies or database connection issue

**Fix**:
1. Check Supabase Table Editor - do records exist?
2. Check browser console for errors
3. Verify RLS policies are enabled (they should be from schema.sql)

### Page shows "Error loading PPAP"

**Cause**: Invalid PPAP ID or database connection issue

**Fix**:
1. Check the URL - is the ID valid?
2. Check Supabase logs for errors
3. Verify the PPAP exists in the database

---

## Architecture Overview

### Folder Structure

```
app/                    # Next.js pages (server components)
src/
  features/             # Feature modules (domain-driven)
    ppap/               # PPAP core
      queries.ts        # Data fetching
      mutations.ts      # Data changes
      components/       # UI components
    conversations/      # Conversation log
    tasks/              # Task tracking
    documents/          # Document management
    events/             # Event logging
  lib/                  # Shared utilities
  types/                # TypeScript types
docs/                   # Governance docs
supabase/               # Database schema
```

### Data Flow

1. **Server Component** (page.tsx) fetches data using query functions
2. **Query functions** use Supabase client to fetch from database
3. **Data passed** to client components as props
4. **Client components** render UI and handle user interactions
5. **User actions** call mutation functions
6. **Mutation functions** update database and log events
7. **Page refreshes** to show updated data

### Event Logging

Every mutation automatically logs to `ppap_events`:
- PPAP creation → `PPAP_CREATED`
- Status change → `STATUS_CHANGED`
- Assignment → `ASSIGNED`
- Task creation → `TASK_CREATED`
- Task completion → `TASK_COMPLETED`
- Document addition → `DOCUMENT_ADDED`
- Conversation entry → `CONVERSATION_ADDED`

This provides complete audit trail for compliance and debugging.

---

## Next Development Priorities

Based on `docs/BUILD_PLAN.md`, the next features to build are:

### Phase 1: Make It Interactive
1. **Add conversation form** - Let users add notes/comments
2. **Add task form** - Let users create and complete tasks
3. **Add document form** - Let users add document metadata
4. **Status change dialog** - Let users update PPAP status
5. **Assignment dialog** - Let users reassign PPAPs

### Phase 2: Enhance UX
1. **Wire up filters** on list page
2. **Add dashboard stats** on home page
3. **Add loading spinners** for async actions
4. **Add success toasts** after mutations
5. **Add confirmation dialogs** for destructive actions

### Phase 3: Polish
1. **Add validation** to all forms
2. **Improve error messages**
3. **Add keyboard shortcuts**
4. **Optimize performance** (pagination, caching)
5. **Add seed data** for demos

---

## Important Files to Know

- **`docs/BUILD_PLAN.md`** - Overall project plan and scope
- **`docs/DATA_MODEL.md`** - Database schema reference
- **`docs/WORKFLOW_RULES.md`** - Business logic and validation rules
- **`docs/ACCEPTANCE_CRITERIA.md`** - Feature completion checklist
- **`docs/REPO_GUARDRAILS.md`** - Development guidelines
- **`docs/BUILD_LEDGER.md`** - Change history (update after each milestone)

---

## Commit Checklist

Before committing:

1. ✅ Code compiles (`npm run build`)
2. ✅ No console errors in browser
3. ✅ Feature works as expected
4. ✅ BUILD_LEDGER updated
5. ✅ Relevant docs updated (DATA_MODEL, WORKFLOW_RULES, etc.)
6. ✅ Meaningful commit message

Example commit:
```bash
git add .
git commit -m "feat: implement complete PPAP MVP with list, create, and dashboard pages"
```

---

## Questions?

- Check `docs/` folder for detailed documentation
- Review `docs/BUILD_LEDGER.md` for recent changes
- Check Supabase dashboard for database issues
- Review `README.md` for setup instructions
