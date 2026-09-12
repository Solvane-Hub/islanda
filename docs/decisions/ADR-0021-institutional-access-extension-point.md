# ADR-0021 — Institutional access extension point

**Date:** 2026-09-11 · **Status:** Accepted (documentation only — no code change)

## Context

The P7 architecture audit asked whether FoundryAI can eventually support
advisors and institutions (SBDC-style, Chamber-style, or future enterprise
deployments) alongside individual entrepreneurs, without a rewrite or a second
product. ADR-0006 (2026-08-05) already answered this, before P0–P6 existed:

> "To keep the documented future (organisation workspaces, government portals,
> investor workspaces) reachable without a rewrite, ownership is resolved
> through **a single `business_access` SQL helper function** used by every
> policy... Introducing organizations later becomes a change to that one
> function plus a membership table, instead of an edit to every policy in the
> schema."

This ADR does not change that decision. It documents the seam precisely, now
that P0–P6 have exercised it across 25+ tables, so a future institutional build
does not have to rediscover it from ADR-0006's prose alone.

## The seam, as it exists today

```sql
create or replace function app.business_access(p_business_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.businesses b
    where b.id = p_business_id and b.owner_id = (select auth.uid())
  );
$$;
```

Every business-owned table's RLS policies call this one function — never
`owner_id = auth.uid()` inline. Confirmed by the P7 audit across every table
created in P0–P6 (`business_profiles`, `business_identifiers`,
`business_financial_periods`, `business_documents`, `business_metrics`,
`business_goals`, `business_cases`, and `storage.objects` for the document
vault) with no exceptions.

## Decision

**Reaffirm ADR-0006's design and record the exact extension shape**, without
building it now:

1. A future `business_access_grants` table
   (`business_id, grantee_user_id, role, granted_at`) would record advisor or
   institution membership on a business.
2. `app.business_access()`'s body would change to an OR: the existing direct
   `owner_id` check, plus an `EXISTS` against the grants table.
3. **No other table, policy, or application code changes.** Every existing
   policy across every table calls the same function; none needs to be touched,
   edited, or re-reviewed.

This ADR intentionally does **not**:

- Create the grants table.
- Modify `app.business_access()`.
- Define roles, permission levels, or an institution entity.
- Decide what an "advisor" or "institution" is allowed to see or do.

Those are explicit future decisions — product decisions about what an advisor
role actually grants, not merely a schema question — and building them now
would be guessing at requirements no institutional pilot has yet stated.

## Relationship to `business_cases` (P7.1)

The P7.1 `business_cases` table (`docs/architecture/business-intelligence-core.md`)
includes a nullable `advisor_id uuid references auth.users(id)` column,
reserved for this future. It is deliberately inert: RLS on `business_cases` is
keyed on `business_id` via `app.business_access()`, exactly like every other
table, and `advisor_id` grants no access by itself. Naming a user as an
advisor today has no security effect — the column exists so that when
`business_access_grants` is eventually built, a case's advisor and the
business's grant can be the same fact, not two disconnected ones.

## Consequences

- Institutional/advisor access remains a two-part additive change (one table,
  one function body) whenever it is actually built — unchanged from ADR-0006's
  original claim, now verified against a much larger schema than existed when
  that claim was made.
- No table built in P0–P7 needs to be revisited when that day comes.
- This ADR itself requires no migration and changes no runtime behaviour.

## References

ADR-0006 (tenancy model) · ADR-0009 (RLS policy pattern) ·
`docs/architecture/business-intelligence-core.md` · P7 architecture audit
(2026-09-10/11, private, not yet mirrored to a standalone document).
