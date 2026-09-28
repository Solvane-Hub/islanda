-- ============================================================================
-- Islanda (formerly FoundryAI) · Public waitlist
-- Migration: 20260916000000_waitlist_signups
--
-- A brand-neutral, minimal waitlist capture table for the public launch
-- landing page. Genuinely persistent — not a form that only displays a
-- success message. RLS-locked so a public visitor can CREATE a signup but
-- can never READ, UPDATE, or DELETE any signup, including their own; the
-- table is a write-only surface from the API's point of view. Reporting
-- (total signups, signups by date/source) reads through the service-role
-- client only, exactly like `ai_usage`/`audit_log`.
--
-- Deliberately named `waitlist_signups`, not `islanda_waitlist` or
-- `foundry_waitlist` — a domain concept, not a product-branded one, matching
-- every other table in this schema.
-- ============================================================================

begin;

create type public.waitlist_signup_status as enum ('pending', 'invited', 'declined');

create table public.waitlist_signups (
  id            uuid                           primary key default gen_random_uuid(),
  email         text                           not null,
  first_name    text,
  business_name text,
  role          text,
  -- Auto-captured context (e.g. 'landing_page'), never asked of the visitor.
  source        text,
  status        public.waitlist_signup_status not null default 'pending',
  created_at    timestamptz                    not null default now(),
  updated_at    timestamptz                    not null default now(),

  constraint ws_email_length check (char_length(email) between 3 and 255),
  constraint ws_email_format check (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  constraint ws_first_name_length
    check (first_name is null or char_length(btrim(first_name)) between 1 and 100),
  constraint ws_business_name_length
    check (business_name is null or char_length(btrim(business_name)) between 1 and 200),
  constraint ws_role_length check (role is null or char_length(btrim(role)) between 1 and 100),
  constraint ws_source_length check (source is null or char_length(btrim(source)) between 1 and 100)
);

comment on table public.waitlist_signups is
  'Public launch waitlist. Brand-neutral domain table, not named after the product. RLS: anon/authenticated may INSERT only — nobody may SELECT/UPDATE/DELETE via the API. Reporting reads use the service-role client.';
comment on column public.waitlist_signups.email is
  'Stored lowercased by the application; deduplicated case-insensitively via waitlist_signups_email_unique_idx regardless.';

-- An email cannot create unlimited duplicate rows.
create unique index waitlist_signups_email_unique_idx
  on public.waitlist_signups (lower(email));

create index waitlist_signups_created_at_idx
  on public.waitlist_signups (created_at desc);
create index waitlist_signups_status_idx
  on public.waitlist_signups (status);

create trigger waitlist_signups_set_updated_at
  before update on public.waitlist_signups
  for each row execute function app.set_updated_at();


-- ----------------------------------------------------------------------------
-- Row Level Security — public may INSERT only. No SELECT, no UPDATE, no DELETE
-- policy for any role: this table is written to, never browsed, through the
-- API. A visitor cannot enumerate emails, read their own row back, edit
-- another signup, or delete anything.
-- ----------------------------------------------------------------------------

alter table public.waitlist_signups enable row level security;
alter table public.waitlist_signups force  row level security;

create policy waitlist_signups_insert_public
  on public.waitlist_signups for insert to anon, authenticated
  with check (true);

revoke all on public.waitlist_signups from anon, authenticated;
grant insert on public.waitlist_signups to anon, authenticated;


-- ----------------------------------------------------------------------------
-- Rate-limit infrastructure extension.
--
-- public.consume_rate_limit (20260825000000_nova_platform_hardening.sql) was
-- granted to `authenticated` only — every caller until now was a signed-in
-- founder (Nova). The public waitlist form is the first ANONYMOUS caller, so
-- the grant is extended to `anon`. The function's behaviour is unchanged and
-- generic (scope/subject/window/limit are caller-supplied parameters); this
-- does not expose `rate_limit_counters` itself, which remains policy-less and
-- reachable only through this SECURITY DEFINER function.
-- ----------------------------------------------------------------------------

grant execute on function public.consume_rate_limit(text, text, integer, integer) to anon;

commit;
