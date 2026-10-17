-- ============================================================================
-- Islanda · Waitlist — optional entrepreneur survey and pilot recruitment
-- Migration: 20261017000000_waitlist_survey_and_recruitment
--
-- Extends the EXISTING `waitlist_signups` table; it does not create a second
-- waitlist. Every new column is nullable or has a default, so existing signups
-- survive unchanged: their survey answers read as "not answered" and their
-- recruitment status as 'not_contacted'.
--
-- Three concerns, kept deliberately separate:
--
--   1. Signup        — phone (optional) joins the existing contact columns.
--   2. Survey        — four optional answers, written by the visitor through
--                      one SECURITY DEFINER function gated by a one-time
--                      random token. The visitor still cannot SELECT, UPDATE
--                      or DELETE any row directly.
--   3. Recruitment   — status + internal notes, readable and writable only by
--                      team members holding the `waitlist_admin` staff role.
--
-- Testing interest (what the visitor said) and recruitment status (what the
-- team has done) are separate columns on purpose: answering "Yes" changes
-- nothing about recruitment, and nothing here records or implies consent.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Signup — optional phone number.
-- ----------------------------------------------------------------------------

alter table public.waitlist_signups
  add column phone text,
  add constraint ws_phone_format check (
    phone is null
    or (char_length(btrim(phone)) between 7 and 30 and phone ~ '^[0-9+(). -]+$')
  );

comment on column public.waitlist_signups.phone is
  'Optional phone number, stored as entered (trimmed). Collected under the same "Islanda early access" contact scope as the email address.';


-- ----------------------------------------------------------------------------
-- 2. Survey — four optional questions asked after a successful signup.
-- ----------------------------------------------------------------------------

create type public.waitlist_business_stage as enum (
  'just_exploring',
  'planning_to_start',
  'trying_to_register',
  'already_operating'
);

create type public.waitlist_challenge as enum (
  'finding_information',
  'understanding_registration',
  'knowing_next_steps',
  'finding_customers',
  'managing_business',
  'other'
);

create type public.waitlist_testing_interest as enum ('yes', 'maybe', 'not_right_now');

alter table public.waitlist_signups
  add column survey_country      text,
  add column survey_city_island  text,
  add column business_stage      public.waitlist_business_stage,
  add column biggest_challenge   public.waitlist_challenge,
  add column challenge_other     text,
  add column testing_interest    public.waitlist_testing_interest,
  -- Null until the visitor submits at least one answer. Skipping writes nothing.
  add column survey_completed_at timestamptz,
  -- SHA-256 (hex) of the random token handed to the browser at signup. The
  -- token itself is never stored, and this column is never readable via the API.
  add column survey_token_hash   text,

  add constraint ws_survey_country_length
    check (survey_country is null or char_length(btrim(survey_country)) between 1 and 100),
  add constraint ws_survey_city_island_length
    check (survey_city_island is null or char_length(btrim(survey_city_island)) between 1 and 100),
  add constraint ws_challenge_other_length
    check (challenge_other is null or char_length(btrim(challenge_other)) between 1 and 300),
  add constraint ws_challenge_other_only_for_other
    check (challenge_other is null or biggest_challenge = 'other'),
  add constraint ws_survey_token_hash_format
    check (survey_token_hash is null or survey_token_hash ~ '^[0-9a-f]{64}$');

create unique index waitlist_signups_survey_token_hash_idx
  on public.waitlist_signups (survey_token_hash)
  where survey_token_hash is not null;

comment on column public.waitlist_signups.testing_interest is
  'What the visitor SAID about trying Islanda before launch. Not consent, not selection, and independent of recruitment_status.';
comment on column public.waitlist_signups.survey_completed_at is
  'First time the optional survey was submitted with at least one answer. Null when skipped or never answered.';


-- ----------------------------------------------------------------------------
-- 3. Recruitment — internal pilot tracking. Never writable by the public.
-- ----------------------------------------------------------------------------

create type public.waitlist_recruitment_status as enum (
  'not_contacted',
  'contacted',
  'confirmed',
  'tested'
);

alter table public.waitlist_signups
  add column recruitment_status     public.waitlist_recruitment_status not null default 'not_contacted',
  add column recruitment_notes      text,
  add column recruitment_updated_at timestamptz,

  add constraint ws_recruitment_notes_length
    check (recruitment_notes is null or char_length(recruitment_notes) <= 2000);

comment on column public.waitlist_signups.recruitment_status is
  'Team-maintained pilot recruitment progress. Defaults to not_contacted; never changed by anything the visitor does.';
comment on column public.waitlist_signups.recruitment_updated_at is
  'Set by trigger whenever recruitment_status or recruitment_notes changes.';

create index waitlist_signups_recruitment_status_idx
  on public.waitlist_signups (recruitment_status);
create index waitlist_signups_testing_interest_idx
  on public.waitlist_signups (testing_interest)
  where testing_interest is not null;

create or replace function app.waitlist_track_recruitment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.recruitment_status is distinct from old.recruitment_status
     or new.recruitment_notes is distinct from old.recruitment_notes then
    new.recruitment_updated_at := now();
  end if;
  return new;
end;
$$;

create trigger waitlist_signups_track_recruitment
  before update on public.waitlist_signups
  for each row execute function app.waitlist_track_recruitment();


-- ----------------------------------------------------------------------------
-- 4. Staff role — the smallest authorization seam that does not assume every
--    signed-in user is an administrator.
--
-- Rows are granted by hand (SQL editor / service role). There is no INSERT,
-- UPDATE or DELETE policy, so no API caller can grant themselves a role.
-- ----------------------------------------------------------------------------

create type public.staff_role as enum ('waitlist_admin');

create table public.staff_members (
  user_id    uuid              not null references auth.users (id) on delete cascade,
  role       public.staff_role not null,
  created_at timestamptz       not null default now(),
  primary key (user_id, role)
);

comment on table public.staff_members is
  'Solvane Hub team roles. Granted manually; a user may read only their own rows. waitlist_admin may view the waitlist and manage pilot recruitment.';

alter table public.staff_members enable row level security;
alter table public.staff_members force  row level security;

create policy staff_members_select_own
  on public.staff_members for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.staff_members from anon, authenticated;
grant select on public.staff_members to authenticated;

create or replace function app.is_waitlist_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_members s
    where s.user_id = (select auth.uid())
      and s.role = 'waitlist_admin'
  );
$$;

comment on function app.is_waitlist_admin is
  'Single predicate for waitlist administration. Used by RLS on waitlist_signups.';

revoke all on function app.is_waitlist_admin() from public, anon;
grant execute on function app.is_waitlist_admin() to authenticated;


-- ----------------------------------------------------------------------------
-- 5. waitlist_signups access — column grants + admin-only policies.
--
-- Public INSERT stays, narrowed to the columns a visitor legitimately supplies:
-- they can no longer set status, recruitment fields, survey answers or
-- timestamps on insert. SELECT and UPDATE are added for `authenticated`, but
-- the policies admit only waitlist_admin; a signed-in founder still sees and
-- changes nothing. Admins may UPDATE only the two recruitment columns, and the
-- token hash is excluded from every SELECT grant.
-- ----------------------------------------------------------------------------

revoke insert on public.waitlist_signups from anon, authenticated;
grant insert (email, first_name, last_name, phone, business_name, role, source, survey_token_hash)
  on public.waitlist_signups to anon, authenticated;

grant select (
  id, email, first_name, last_name, phone, business_name, role, source, status,
  created_at, updated_at,
  survey_country, survey_city_island, business_stage, biggest_challenge, challenge_other,
  testing_interest, survey_completed_at,
  recruitment_status, recruitment_notes, recruitment_updated_at
) on public.waitlist_signups to authenticated;

grant update (recruitment_status, recruitment_notes)
  on public.waitlist_signups to authenticated;

create policy waitlist_signups_select_admin
  on public.waitlist_signups for select to authenticated
  using ((select app.is_waitlist_admin()));

create policy waitlist_signups_update_admin
  on public.waitlist_signups for update to authenticated
  using ((select app.is_waitlist_admin()))
  with check ((select app.is_waitlist_admin()));


-- ----------------------------------------------------------------------------
-- 6. Survey submission — the one public write path for answers.
--
-- Matches by token hash only; returns whether a row was updated and nothing
-- else, so it cannot be used to discover whether an email is on the list.
-- Re-submission overwrites the previous answers on the SAME row — there is no
-- second row to create. survey_completed_at keeps its first value.
-- Touches no recruitment, status or contact column.
-- ----------------------------------------------------------------------------

create or replace function public.submit_waitlist_survey(
  p_token             text,
  p_country           text,
  p_city_island       text,
  p_business_stage    public.waitlist_business_stage,
  p_biggest_challenge public.waitlist_challenge,
  p_challenge_other   text,
  p_testing_interest  public.waitlist_testing_interest
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  if p_token is null or char_length(p_token) not between 32 and 128 then
    return false;
  end if;

  update public.waitlist_signups w
     set survey_country      = nullif(btrim(p_country), ''),
         survey_city_island  = nullif(btrim(p_city_island), ''),
         business_stage      = p_business_stage,
         biggest_challenge   = p_biggest_challenge,
         challenge_other     = case
                                 when p_biggest_challenge = 'other'
                                   then nullif(btrim(p_challenge_other), '')
                               end,
         testing_interest    = p_testing_interest,
         survey_completed_at = coalesce(w.survey_completed_at, now())
   where w.survey_token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex');

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

comment on function public.submit_waitlist_survey is
  'Public, token-gated write of the optional waitlist survey. Returns true when the token matched a signup.';

revoke all on function public.submit_waitlist_survey(
  text, text, text, public.waitlist_business_stage, public.waitlist_challenge, text,
  public.waitlist_testing_interest
) from public;
grant execute on function public.submit_waitlist_survey(
  text, text, text, public.waitlist_business_stage, public.waitlist_challenge, text,
  public.waitlist_testing_interest
) to anon, authenticated;

commit;
