# Database Change Protocol (DCL.01)

This protocol is mandatory for every schema-affecting task.

## Step-by-Step Process
1. **Inspect live schema**
   - `supabase db remote commit --project-ref <ref> --dry-run` (read-only snapshot) or `supabase migration list` to see applied migrations.
   - Document current columns vs. `docs/DB_SCHEMA_CONTRACT.md`.
2. **Compare with repo migrations**
   - Review `supabase/migrations/` (canonical) plus module-specific SQL under `docs/modules/.../migrations/`.
   - Flag any live-only changes; either capture as new migration or revert.
3. **Create migration**
   - `supabase migration new <short-description>` (writes to `supabase/migrations/`).
   - For module-specific context, keep SQL adjacent to module docs but reference the Supabase migration ID in commit notes.
4. **Dry-run push**
   - `pnpm db:push:dry` (alias for `supabase db push --dry-run`).
   - Resolve any drift errors before proceeding.
5. **Apply migration**
   - `pnpm db:push` (applies to linked Supabase project) or `supabase db push --env-file=.env.local`.
6. **Verify schema**
   - Re-run `pnpm db:migration:list`.
   - Execute checklist/script from `docs/DB_VERIFICATION_CHECKLIST.md`.
7. **Regenerate types**
   - `pnpm db:types` (writes `src/types/database.types.ts`).
8. **Update schema contract doc**
   - Edit `docs/DB_SCHEMA_CONTRACT.md` with new columns/types and dependent app areas.
9. **Merge dependent code only after** steps 1–8 succeed and Supabase UI shows the migration applied.

## Required Commands
- **List migrations**: `pnpm db:migration:list`
- **Repair migration history**: `supabase migration repair --status applied --name <migration-name>` (use sparingly; document rationale).
- **Dry-run push**: `pnpm db:push:dry`
- **Apply push**: `pnpm db:push`
- **Generate TS types**: `pnpm db:types`

## Notes
- Do not run `supabase db push` against production without a dry run + verification + approval logged in `docs/SYSTEM_GOVERNANCE.md`.
- Legacy SQL stored outside `supabase/migrations/` remains valid but must be referenced in new migrations for consistency.
- Remote SQL editor actions must be captured as retroactive migrations within 24 hours or rolled back.
