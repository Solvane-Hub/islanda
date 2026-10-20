# Migrations

Every `.sql` file here is named `<version>_<name>.sql`, where `<version>` is the
**14-digit version the production database recorded** in
`supabase_migrations.schema_migrations` when the migration was applied. The
filename is the link between this folder and the database's history; if the two
disagree, `supabase db push` / `migration list` treat the file as unapplied and
the next push tries to run it again.

## Applying a migration

1. Write the file with a provisional version (`YYYYMMDDHHMMSS`, later than
   every existing file) and dry-run it against a branch or inside a transaction
   that is rolled back.
2. Get approval before applying anything to production (approval is per release).
3. Apply it. **Tools that apply SQL directly (the Supabase MCP
   `apply_migration`, the dashboard SQL editor's "save as migration") record
   the time of application as the version, not the filename's version.**
4. Read the recorded version back (`list_migrations`, or
   `select version, name from supabase_migrations.schema_migrations order by version`)
   and `git mv` the file to that version in the same pull request, or in a
   follow-up straight after.

Before applying, run `npm run test:db`: it replays every migration into an isolated
PGlite with production's default privileges. A rollback, when one is prepared, lives in
`supabase/rollbacks/` (not a migration; run only with approval).

Never edit a migration that has been applied — write a new one. Never re-run an
applied migration to "fix" a filename; rename the file instead.

## Reconciliation of 2026-10-19

Eleven files had been committed under provisional versions while production
recorded the application time. Their contents were compared with the recorded
statements (normalised md5 / spot checks) before renaming; no SQL changed.

| Previous filename version | Recorded (current) version | Name                             |
| ------------------------- | -------------------------- | -------------------------------- |
| 20260907000000            | 20260907043221             | business_object_foundation       |
| 20260908000000            | 20260909020613             | business_intelligence_core       |
| 20260908010000            | 20260909024557             | business_documents_storage       |
| 20260909000000            | 20260909060524             | ai_usage                         |
| 20260911000000            | 20260911235640             | ai_usage_force_rls               |
| 20260911010000            | 20260911235645             | business_cases                   |
| 20260911020000            | 20260912002318             | business_cases_owner_integrity   |
| 20260912010000            | 20260917020153             | business_evidence_foundation     |
| 20260916000000            | 20260917020157             | waitlist_signups                 |
| 20261017000000            | 20261017160038             | waitlist_survey_and_recruitment  |
| 20261018000000            | 20261019171608             | admin_portal_and_analytics       |

Older documents (and comments inside applied migrations, which are never edited)
may still cite the previous versions; this table resolves them.

`waitlist_multi_select` followed the same procedure on 2026-10-20: written as
`20261019200000`, applied through the Supabase MCP and recorded as
**`20261020185611`** (the recorded statement's md5 matched the reviewed SQL), then
renamed. Its rollback is `supabase/rollbacks/20261020185611_waitlist_multi_select.down.sql`.

**Resolved 2026-10-20:** `20260928000000_add_waitlist_last_name.sql` had been applied
by hand and was missing from the recorded history. After verifying all three of its
effects in production (the nullable `last_name` column, `waitlist_signups_last_name_check`
and the column comment) and that no row with that version or name existed, its history
row was inserted — guarded so the insert could only happen while all three held — with
the file's exact text as its statement (md5 matched). No SQL was re-run. Production's
recorded history now matches this folder one-to-one (23 versions).
