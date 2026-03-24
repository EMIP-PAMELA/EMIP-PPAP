# EMIP-PPAP

Production Parts Approval Process (PPAP) operations module for managing PPAP submissions across multiple sites.


## Features

- ✅ PPAP record creation and management
- ✅ Multi-site coordination and visibility
- ✅ Status tracking through canonical workflow
- ✅ Task management (pre-ack and post-ack phases)
- ✅ Internal conversation log per PPAP
- ✅ Document metadata tracking
- ✅ Mold/overmold complexity tracking
- ✅ Complete audit trail via event logging
- ✅ Overdue and aging indicators

## Tech Stack

- **Frontend/Backend**: Next.js 15 (App Router)
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Vercel
- **Language**: TypeScript
- **Styling**: Tailwind CSS

## Quick Start

### 1. Prerequisites

- Node.js 18+ installed
- Supabase account (free tier works)
- Git

### 2. Clone and Install

```bash
git clone <your-repo-url>
cd EMIP-PPAP
npm install
```

### 3. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor in your Supabase dashboard
3. Copy the contents of `supabase/schema.sql`
4. Paste and run it in the SQL Editor
5. Verify all 5 tables were created: `ppap_records`, `ppap_documents`, `ppap_conversations`, `ppap_tasks`, `ppap_events`

### 4. Configure Environment Variables

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

Get these values from your Supabase project settings → API.

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

### 6. Create Your First PPAP

1. Navigate to the PPAP list page
2. Click "Create New PPAP"
3. Fill in the required fields (Part Number, Customer, Plant, Request Date)
4. Submit to create your first record

## Project Structure

```
EMIP-PPAP/
├── app/                          # Next.js app router pages
│   ├── ppap/                     # PPAP routes
│   │   ├── page.tsx              # List page
│   │   ├── new/page.tsx          # Create form
│   │   └── [id]/page.tsx         # Dashboard page
│   └── page.tsx                  # Home (redirects to /ppap)
├── src/
│   ├── features/                 # Feature modules
│   │   ├── ppap/                 # PPAP core logic
│   │   ├── conversations/        # Conversation log
│   │   ├── tasks/                # Task tracking
│   │   ├── documents/            # Document management
│   │   └── events/               # Event logging
│   ├── lib/                      # Shared utilities
│   │   ├── supabaseClient.ts     # Supabase client
│   │   └── utils.ts              # Helper functions
│   └── types/                    # TypeScript types
│       └── database.types.ts     # Database entity types
├── docs/                         # Governance documentation
│   ├── BUILD_PLAN.md             # Project plan and scope
│   ├── BUILD_LEDGER.md           # Change history
│   ├── DATA_MODEL.md             # Database schema docs
│   ├── WORKFLOW_RULES.md         # Business logic rules
│   ├── ACCEPTANCE_CRITERIA.md    # Feature completion criteria
│   ├── DECISION_REGISTER.md      # Architecture decisions
│   └── REPO_GUARDRAILS.md        # Development guidelines
└── supabase/
    └── schema.sql                # Database schema
```

## Key Workflows

### Creating a PPAP

1. User creates PPAP with intake data
2. System auto-generates PPAP number
3. Status set to `NEW`
4. Event logged: `PPAP_CREATED`

### Status Progression

```
NEW → INTAKE_COMPLETE → PRE_ACK_ASSIGNED → PRE_ACK_IN_PROGRESS → 
READY_TO_ACKNOWLEDGE → ACKNOWLEDGED → POST_ACK_ASSIGNED → 
POST_ACK_IN_PROGRESS → AWAITING_SUBMISSION → SUBMITTED → APPROVED → CLOSED
```

See `docs/WORKFLOW_RULES.md` for complete transition rules.

### Adding Tasks

1. Navigate to PPAP dashboard
2. Tasks section shows all tasks
3. Tasks grouped by phase (PRE_ACK, POST_ACK, SUBMISSION)
4. Mark tasks complete to track progress

### Conversation Log

- Every PPAP has an internal conversation log
- Used for cross-site communication
- Preserves context during handoffs
- Message types: NOTE, QUESTION, BLOCKER, HANDOFF, etc.

## Canonical Statuses

All PPAP records follow these canonical statuses (enforced at database level):

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

## Mold Tracking

When `mold_required = true`:

- Mold section appears on dashboard
- Track mold supplier, status, lead time
- Mold delays trigger risk indicators
- Mold statuses: NOT_STARTED → DESIGN_IN_PROGRESS → FABRICATION_IN_PROGRESS → VALIDATED

## Event Logging

Every mutation writes to the `ppap_events` audit log:

- PPAP creation
- Status changes
- Assignment changes
- Document additions
- Task completions
- Conversation entries
- Mold status updates

View complete event history on PPAP dashboard.

## Development Guidelines

### Before Making Changes

1. Read `docs/REPO_GUARDRAILS.md`
2. Check `docs/DATA_MODEL.md` for schema
3. Review `docs/WORKFLOW_RULES.md` for business logic
4. Update `docs/BUILD_LEDGER.md` after changes

### Commit Conventions

```
feat: add new feature
fix: bug fix
data: schema or data changes
chore: maintenance tasks
refactor: code restructuring
```

### Schema Changes

1. Update `supabase/schema.sql`
2. Update `src/types/database.types.ts`
3. Update `docs/DATA_MODEL.md`
4. Add entry to `docs/BUILD_LEDGER.md`
5. Test migration locally

## Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables (Supabase URL and key)
4. Deploy

### Manual Deployment

```bash
npm run build
npm start
```

## Troubleshooting

### Database Connection Issues

- Verify `.env.local` has correct Supabase credentials
- Check Supabase project is not paused
- Ensure RLS policies are enabled

### TypeScript Errors

- Run `npm run build` to check for compilation errors
- Ensure all types in `src/types/database.types.ts` match schema

### Missing Data

- Check Supabase dashboard → Table Editor
- Verify tables were created correctly
- Check RLS policies allow read/write

## Documentation

Full documentation available in `docs/`:

- **BUILD_PLAN.md**: Project scope and priorities
- **DATA_MODEL.md**: Complete database schema
- **WORKFLOW_RULES.md**: Business logic and validation rules
- **ACCEPTANCE_CRITERIA.md**: Feature completion checklist
- **DECISION_REGISTER.md**: Architecture decisions
- **REPO_GUARDRAILS.md**: Development guidelines

## Support

For questions or issues:

1. Check `docs/` folder for detailed documentation
2. Review `docs/BUILD_LEDGER.md` for recent changes
3. Check Supabase logs for database errors

## License

Internal use only.
