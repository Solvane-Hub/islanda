-- ============================================================================
-- FoundryAI · Post-competition · P7.1 — Business Case primitive
-- Migration: 20260911010000_business_cases
--
-- The thin, generic correlation object the P7 audit recommends: a business
-- objective with an owner, an optional future advisor, and a review-lifecycle
-- status — nothing else. It deliberately does NOT model questions,
-- requirements, documents, evidence, recommendations or actions as columns or
-- child tables; those either already have a home (business_goals, business_
-- documents) or are an explicit future decision (durable evidence/
-- recommendation storage, human-review states) that this migration does not
-- make. See docs/decisions/ADR-0021-institutional-access-extension-point.md
-- and docs/architecture/business-intelligence-core.md.
--
-- Ownership follows the exact ADR-0009 pattern used by every business-owned
-- table since P0: ENABLE + FORCE RLS, one policy per operation, ownership
-- resolved through the single `app.business_access()` helper (ADR-0006), no
-- DELETE policy. `app.business_access()` itself is NOT modified — a case is
-- visible/writable exactly when its business is, which today means the
-- business owner. `advisor_id` is a plain, unconstrained reference to
-- auth.users for now; it grants no additional access on its own (RLS is keyed
-- on `business_id`, not `advisor_id`) — wiring advisor-based access is the
-- explicitly deferred next step named in ADR-0021, not part of this migration.
-- ============================================================================

begin;

create type public.business_case_status as enum ('open', 'in_review', 'resolved', 'archived');

create table public.business_cases (
  id          uuid                        primary key default gen_random_uuid(),
  business_id uuid                        not null references public.businesses (id) on delete cascade,
  title       text                        not null,
  objective   text                        not null,
  -- The founder/primary actor for this case. Cascades with the account, same
  -- as businesses.owner_id — this is not necessarily the business owner in a
  -- future collaborator model, but is today (only owners can reach their
  -- business at all).
  owner_id    uuid                        not null references auth.users (id) on delete cascade,
  -- Nullable, unconstrained. No advisor exists in the product yet; this column
  -- only reserves the shape. SET NULL (not CASCADE) so a case survives an
  -- advisor account being removed — same reasoning as audit_log.actor_id.
  advisor_id  uuid                        references auth.users (id) on delete set null,
  status      public.business_case_status not null default 'open',
  created_at  timestamptz                 not null default now(),
  updated_at  timestamptz                 not null default now(),

  constraint bc_title_length check (char_length(btrim(title)) between 1 and 200),
  constraint bc_objective_length check (char_length(btrim(objective)) between 1 and 5000)
);

comment on table public.business_cases is
  'A thin, generic business objective with an owner, an optional future advisor, and a review-lifecycle status. Deliberately does not model questions/requirements/documents/evidence/recommendations/actions — those are either existing primitives (business_goals, business_documents) or an explicit future decision. See ADR-0021.';
comment on column public.business_cases.advisor_id is
  'Reserved for future advisor/institution workflows. Grants no access by itself — RLS is keyed on business_id via app.business_access(), unchanged by this column.';

create trigger business_cases_set_updated_at
  before update on public.business_cases
  for each row execute function app.set_updated_at();

create index business_cases_business_id_idx
  on public.business_cases (business_id, status);

-- ── RLS (ADR-0009) — identical pattern to every business-owned table ────────
alter table public.business_cases enable row level security;
alter table public.business_cases force  row level security;

create policy business_cases_select_own
  on public.business_cases for select to authenticated
  using (app.business_access(business_id));

create policy business_cases_insert_own
  on public.business_cases for insert to authenticated
  with check (app.business_access(business_id));

create policy business_cases_update_own
  on public.business_cases for update to authenticated
  using (app.business_access(business_id))
  with check (app.business_access(business_id));
-- No DELETE policy: cases are not exposed to removal through the API (ADR-0009 D7).

revoke all on public.business_cases from anon, authenticated;
grant select, insert, update on public.business_cases to authenticated;

commit;
