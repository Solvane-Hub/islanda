-- ============================================================================
-- FoundryAI · Post-competition · P7.1 fix — business_cases owner_id integrity
-- Migration: 20260911020000_business_cases_owner_integrity
--
-- P7.1 final review finding: `business_cases_insert_own` checked only
-- `app.business_access(business_id)`, so an authenticated caller with
-- legitimate access to a business could insert a case with `owner_id` set to
-- ANY existing auth.users id, including another real user's. Not a
-- cross-business access escalation (owner_id/advisor_id grant nothing —
-- RLS remains keyed on business_id alone) but a genuine data-integrity/
-- audit-trail gap: the column should actually mean "who created this."
--
-- Fix: the INSERT policy now ALSO requires owner_id to equal the caller's own
-- id — the exact same pattern `businesses_insert_own` already uses for its
-- own owner_id column (ADR-0009 item 5: `(select auth.uid())`, not bare
-- `auth.uid()`, for planner InitPlan hoisting). This is enforced at the
-- database boundary, so it holds even against a future direct Supabase client
-- call that bypasses the service layer entirely.
--
-- `app.business_access()` is NOT modified. The business_id RLS boundary is
-- unchanged — this policy still denies outright for a business the caller
-- does not own, exactly as before; it now ALSO denies a same-business insert
-- that misattributes ownership. `advisor_id` is untouched: still unconstrained,
-- still grants nothing (no policy references it, before or after this change).
-- No new table. No change to SELECT/UPDATE policies, `setCaseStatus`, or any
-- other service behaviour — the service already always passes its own trusted
-- `ownerId` parameter, so this migration changes no application-visible
-- behaviour for any correct caller.
-- ============================================================================

drop policy business_cases_insert_own on public.business_cases;

create policy business_cases_insert_own
  on public.business_cases for insert to authenticated
  with check (
    app.business_access(business_id)
    and owner_id = (select auth.uid())
  );
