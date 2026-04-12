# Database Control Layer (DCL)

## Canonical Truth Order
1. **Repository migrations** (`supabase/migrations/` for Supabase-managed changes, module-specific migrations under `docs/modules/...`) — authoritative change log.
2. **Generated schema contract** (`docs/DB_SCHEMA_CONTRACT.md` + generated `schema.sql` / TS types) — machine + operator view synthesized from migrations.
3. **Live databases** (dev/staging/prod Supabase projects) — must be reconciled to match the repo state before code depending on new columns ships.
4. **Ad-hoc SQL editor snippets** — never canonical; must be captured as migrations immediately after execution or rolled back.

## Core Rules
- No manual SQL in production without a follow-up migration committed to the repo the same day.
- Application code may not reference new tables/columns until the migration that creates them exists in `main`.
- Every DB-dependent feature spec must enumerate required tables/columns; schema drift must be diagnosed before writing remediation code.
- Destructive operations (DROP/ALTER … DROP COLUMN) require explicit approval documented in `docs/SYSTEM_GOVERNANCE.md` and must include a rollback plan.
- Supabase MCP (if used) operates **read-only by default**. Any write-capable MCP tooling must route through the governed migration workflow.

## Environments & Enforcement
| Environment | Source of Truth | Notes |
|-------------|-----------------|-------|
| Local / Dev | Latest `main` migrations applied via Supabase CLI | Use `supabase db remote commit` only for test projects. |
| Staging / Test | Tagged releases applied via Supabase CLI | No manual SQL; drift reconciled before load tests. |
| Production | Change windows coordinated with ops | Requires dry-run + verification checklist before push. |

## Safety Model
- **Migration Workflow**: Supabase CLI + repo-tracked SQL only. No schema designer clicks without resulting SQL captured.
- **MCP Usage**: Permitted for schema audits, table listings, migration history inspection. Write operations remain disabled unless governance grants explicit approval for a maintenance window.
- **Schema Drift Monitoring**: `docs/DB_VERIFICATION_CHECKLIST.md` defines the recurring verification process. Drift findings trigger reconciliation before any new feature work.

## Future Actions
- Gradually consolidate legacy module migrations under `supabase/migrations/` (documented staging plan in `docs/DB_CHANGE_PROTOCOL.md`).
- Automate nightly schema verification using the checklist or a read-only script once CI connectivity is available.
