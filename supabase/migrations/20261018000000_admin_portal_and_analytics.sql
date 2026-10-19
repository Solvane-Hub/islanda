-- ============================================================================
-- Islanda · Owner-only admin portal, expanded waitlist questionnaire,
--           first-party analytics and admin reporting
-- Migration: 20261018000000_admin_portal_and_analytics
--
-- Additive. Nothing is dropped, no existing row is rewritten, and every new
-- column is nullable or defaulted. Existing waitlist answers keep their
-- values; the six original challenge values stay valid.
--
--   1. Platform administrators — an allowlist bound to auth user ids, limited
--      by a CHECK constraint to the two owner email addresses, and only
--      effective on an MFA (aal2) session whose email is unchanged and
--      confirmed. Granted by a trusted script with the service role; there is
--      no INSERT/UPDATE/DELETE grant for any API role.
--   2. The existing waitlist policies now admit platform administrators only
--      (`app.is_waitlist_admin()` delegates). The `waitlist_admin` staff role
--      is retired: it has no rows and no longer grants anything.
--   3. Expanded questionnaire columns and a token-gated, partial-save function.
--   4. Pilot recruitment dates and feedback summary (admin-only).
--   5. `analytics_events` — first-party, pseudonymous, written only by the
--      server with the service role; readable only by platform administrators.
--   6. Read access to `audit_log` for platform administrators (still
--      append-only: the no-update/no-delete triggers remain).
--   7. Admin reporting functions. Each one refuses (42501) unless the caller
--      is a platform administrator, so a direct PostgREST call by anyone else
--      returns nothing.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 0. Helpers
-- ----------------------------------------------------------------------------

-- Reserved and internal test domains. Records at these domains are automated
-- test fixtures (RLS suite, CI, release checks) and are excluded from every
-- aggregate; the admin tables still show them, labelled.
create or replace function app.is_test_email(p_email text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    lower(split_part(p_email, '@', 2)) = any (array[
      'example.dev', 'example.com', 'example.org', 'example.net',
      'resend.dev', 'foundryai-test.dev', 'foundryai-judge.dev'
    ])
    or lower(split_part(p_email, '@', 2)) like '%.test',
    false
  );
$$;

comment on function app.is_test_email is
  'True for reserved/internal test domains. Used to keep automated test records out of admin aggregates.';


-- ----------------------------------------------------------------------------
-- 1. Platform administrators
-- ----------------------------------------------------------------------------

create table public.platform_admins (
  user_id        uuid        primary key references auth.users (id) on delete cascade,
  -- The verified email the account had when it was provisioned. If the
  -- account's email later changes, authorization stops until re-provisioned.
  email          text        not null unique,
  display_name   text        not null,
  provisioned_at timestamptz not null default now(),
  provisioned_by text        not null,

  constraint pa_email_lowercase check (email = lower(email)),
  -- The allowlist itself. Changing who may be an administrator requires a new
  -- migration — a deliberate change to trusted configuration, never a UI action.
  constraint pa_email_allowlist
    check (email in ('jamilnash@solvanehub.us', 'jonathancash@solvanehub.us')),
  constraint pa_display_name_length check (char_length(btrim(display_name)) between 1 and 100),
  constraint pa_provisioned_by_length check (char_length(btrim(provisioned_by)) between 1 and 200)
);

comment on table public.platform_admins is
  'Owner-only admin allowlist, bound to auth user ids. Provisioned by scripts/provision-admin.ts with the service role. No API role may insert, update or delete.';

alter table public.platform_admins enable row level security;
alter table public.platform_admins force  row level security;

create policy platform_admins_select_own
  on public.platform_admins for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.platform_admins from anon, authenticated;
grant select on public.platform_admins to authenticated;

-- Identity check WITHOUT the MFA requirement: the caller is a provisioned
-- administrator whose account email is unchanged and confirmed.
create or replace function app.platform_admin_identity_ok()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_admins p
    join auth.users u on u.id = p.user_id
    where p.user_id = (select auth.uid())
      and lower(u.email) = p.email
      and u.email_confirmed_at is not null
      and u.deleted_at is null
      and (u.banned_until is null or u.banned_until < now())
  );
$$;

-- THE authorization predicate for every admin read and write.
create or replace function app.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.platform_admin_identity_ok()
     and coalesce((select auth.jwt()) ->> 'aal', 'aal1') = 'aal2';
$$;

comment on function app.is_platform_admin is
  'Provisioned platform administrator, email unchanged and confirmed, on an MFA (aal2) session.';

create or replace function app.require_platform_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;

revoke all on function app.platform_admin_identity_ok() from public, anon;
revoke all on function app.is_platform_admin() from public, anon;
revoke all on function app.require_platform_admin() from public, anon;
grant execute on function app.platform_admin_identity_ok() to authenticated;
grant execute on function app.is_platform_admin() to authenticated;
grant execute on function app.require_platform_admin() to authenticated;

-- What the app needs to route an administrator: are they on the allowlist,
-- and is the session already MFA-verified? Reveals nothing to anyone else
-- (a non-admin always gets allowlisted = false).
create or replace function public.get_admin_access()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'allowlisted', app.platform_admin_identity_ok(),
    'aal', coalesce((select auth.jwt()) ->> 'aal', 'aal1'),
    'display_name', (
      select p.display_name from public.platform_admins p
      where p.user_id = (select auth.uid()) and app.platform_admin_identity_ok()
    )
  );
$$;

revoke all on function public.get_admin_access() from public, anon;
grant execute on function public.get_admin_access() to authenticated;


-- ----------------------------------------------------------------------------
-- 2. Waitlist access now belongs to platform administrators only.
--    The existing policies call app.is_waitlist_admin(); it now delegates.
-- ----------------------------------------------------------------------------

create or replace function app.is_waitlist_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.is_platform_admin();
$$;

comment on function app.is_waitlist_admin is
  'Retained name for the waitlist RLS policies. Delegates to app.is_platform_admin(); the waitlist_admin staff role no longer grants access.';

comment on table public.staff_members is
  'RETIRED (2026-10-18): the waitlist_admin role no longer grants access. Admin access is public.platform_admins only.';


-- ----------------------------------------------------------------------------
-- 3. Expanded questionnaire
-- ----------------------------------------------------------------------------

create type public.waitlist_business_journey as enum (
  'idea_not_started',
  'planning_new_business',
  'preparing_to_register',
  'operating_not_established',
  'established_business',
  'starting_another_business',
  'exploring_ownership',
  'other'
);

create type public.waitlist_industry as enum (
  'food_restaurants_catering',
  'tourism_travel_hospitality',
  'retail_online_shopping',
  'beauty_hair_personal_care',
  'fashion_clothing',
  'construction_home_improvement',
  'real_estate_property',
  'professional_services_consulting',
  'technology_software',
  'media_marketing_creative',
  'transportation_logistics',
  'agriculture_fishing_food_production',
  'healthcare_wellness',
  'education_training',
  'financial_accounting',
  'manufacturing_product_development',
  'entertainment_events_recreation',
  'cleaning_maintenance',
  'automotive_services',
  'nonprofit_community',
  'other',
  'not_sure_yet'
);

create type public.waitlist_primary_goal as enum (
  'start_a_business',
  'register_my_business',
  'licences_permits_approvals',
  'government_requirements',
  'reliable_information',
  'clear_plan',
  'next_steps',
  'organize_documents',
  'finances_budgeting',
  'goals_progress',
  'find_customers',
  'marketing_social_media',
  'daily_operations',
  'funding_investment',
  'prepare_to_launch',
  'requirements_deadlines',
  'evaluate_idea',
  'industry_questions',
  'other',
  'not_sure_yet'
);

-- The original six challenge values remain valid (existing answers keep their
-- meaning); the expanded list adds these.
alter type public.waitlist_challenge add value if not exists 'getting_started';
alter type public.waitlist_challenge add value if not exists 'organizing_documents';
alter type public.waitlist_challenge add value if not exists 'managing_money';
alter type public.waitlist_challenge add value if not exists 'marketing';
alter type public.waitlist_challenge add value if not exists 'day_to_day_operations';
alter type public.waitlist_challenge add value if not exists 'industry_requirements';
alter type public.waitlist_challenge add value if not exists 'finding_funding';
alter type public.waitlist_challenge add value if not exists 'deadlines_requirements';
alter type public.waitlist_challenge add value if not exists 'idea_to_plan';
alter type public.waitlist_challenge add value if not exists 'several_challenges';

alter table public.waitlist_signups
  add column business_journey   public.waitlist_business_journey,
  add column industry           public.waitlist_industry,
  add column industry_other     text,
  add column primary_goal       public.waitlist_primary_goal,
  add column goal_other         text,
  -- "Would you be willing to share feedback?" — interest, not consent.
  add column feedback_interest  public.waitlist_testing_interest,
  add column additional_info    text,
  -- First partial save; survey_completed_at is now the final submission.
  add column survey_started_at  timestamptz,
  add column survey_updated_at  timestamptz,

  add constraint ws_industry_other_length
    check (industry_other is null or char_length(btrim(industry_other)) between 1 and 100),
  add constraint ws_industry_other_only_for_other
    check (industry_other is null or industry = 'other'),
  add constraint ws_goal_other_length
    check (goal_other is null or char_length(btrim(goal_other)) between 1 and 300),
  add constraint ws_goal_other_only_for_other
    check (goal_other is null or primary_goal = 'other'),
  add constraint ws_additional_info_length
    check (additional_info is null or char_length(btrim(additional_info)) between 1 and 1000);

comment on column public.waitlist_signups.feedback_interest is
  'What the visitor SAID about sharing feedback. Not consent to contact, testimonials or marketing.';
comment on column public.waitlist_signups.survey_completed_at is
  'First final submission of the questionnaire with at least one answer. Partial saves set survey_started_at only.';

create index waitlist_signups_industry_idx on public.waitlist_signups (industry) where industry is not null;
create index waitlist_signups_primary_goal_idx on public.waitlist_signups (primary_goal) where primary_goal is not null;
create index waitlist_signups_survey_completed_idx on public.waitlist_signups (survey_completed_at);

-- ----------------------------------------------------------------------------
-- 4. Recruitment dates and feedback (admin-only)
-- ----------------------------------------------------------------------------

alter table public.waitlist_signups
  add column recruitment_contacted_on date,
  add column recruitment_confirmed_on date,
  add column recruitment_tested_on    date,
  add column feedback_summary         text,
  add column feedback_link            text,

  add constraint ws_feedback_summary_length
    check (feedback_summary is null or char_length(feedback_summary) <= 2000),
  add constraint ws_feedback_link_format
    check (feedback_link is null or (char_length(feedback_link) <= 500 and feedback_link ~ '^https://'));

create or replace function app.waitlist_track_recruitment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.recruitment_status is distinct from old.recruitment_status
     or new.recruitment_notes is distinct from old.recruitment_notes
     or new.recruitment_contacted_on is distinct from old.recruitment_contacted_on
     or new.recruitment_confirmed_on is distinct from old.recruitment_confirmed_on
     or new.recruitment_tested_on is distinct from old.recruitment_tested_on
     or new.feedback_summary is distinct from old.feedback_summary
     or new.feedback_link is distinct from old.feedback_link then
    new.recruitment_updated_at := now();
  end if;
  return new;
end;
$$;

grant select (
  business_journey, industry, industry_other, primary_goal, goal_other, feedback_interest,
  additional_info, survey_started_at, survey_updated_at,
  recruitment_contacted_on, recruitment_confirmed_on, recruitment_tested_on,
  feedback_summary, feedback_link
) on public.waitlist_signups to authenticated;

grant update (
  recruitment_contacted_on, recruitment_confirmed_on, recruitment_tested_on,
  feedback_summary, feedback_link
) on public.waitlist_signups to authenticated;


-- ----------------------------------------------------------------------------
-- 3b. Questionnaire write/read by token.
--
-- Partial-save semantics: only keys PRESENT in p_answers are written (a
-- present null clears that answer); absent keys keep their stored value.
-- Unknown keys are ignored. p_final marks the questionnaire as submitted.
-- Returns whether the token matched — nothing else.
-- ----------------------------------------------------------------------------

create or replace function public.save_waitlist_survey(
  p_token   text,
  p_answers jsonb,
  p_final   boolean
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_hash    text;
  v_updated integer;
  a         jsonb := coalesce(p_answers, '{}'::jsonb);
begin
  if p_token is null or char_length(p_token) not between 32 and 128 then
    return false;
  end if;
  if jsonb_typeof(a) <> 'object' or pg_column_size(a) > 8192 then
    raise exception 'invalid answers' using errcode = '22023';
  end if;

  v_hash := encode(sha256(convert_to(p_token, 'UTF8')), 'hex');

  update public.waitlist_signups w
     set survey_country     = case when a ? 'country' then nullif(btrim(a ->> 'country'), '') else w.survey_country end,
         survey_city_island = case when a ? 'cityIsland' then nullif(btrim(a ->> 'cityIsland'), '') else w.survey_city_island end,
         business_name      = case when a ? 'businessName' then nullif(btrim(a ->> 'businessName'), '') else w.business_name end,
         business_journey   = case when a ? 'businessJourney' then (nullif(a ->> 'businessJourney', ''))::public.waitlist_business_journey else w.business_journey end,
         industry           = case when a ? 'industry' then (nullif(a ->> 'industry', ''))::public.waitlist_industry else w.industry end,
         industry_other     = case
                                when a ? 'industry' or a ? 'industryOther' then
                                  case when coalesce(case when a ? 'industry' then a ->> 'industry' else w.industry::text end, '') = 'other'
                                       then case when a ? 'industryOther' then nullif(btrim(a ->> 'industryOther'), '') else w.industry_other end
                                  end
                                else w.industry_other
                              end,
         primary_goal       = case when a ? 'primaryGoal' then (nullif(a ->> 'primaryGoal', ''))::public.waitlist_primary_goal else w.primary_goal end,
         goal_other         = case
                                when a ? 'primaryGoal' or a ? 'goalOther' then
                                  case when coalesce(case when a ? 'primaryGoal' then a ->> 'primaryGoal' else w.primary_goal::text end, '') = 'other'
                                       then case when a ? 'goalOther' then nullif(btrim(a ->> 'goalOther'), '') else w.goal_other end
                                  end
                                else w.goal_other
                              end,
         biggest_challenge  = case when a ? 'biggestChallenge' then (nullif(a ->> 'biggestChallenge', ''))::public.waitlist_challenge else w.biggest_challenge end,
         challenge_other    = case
                                when a ? 'biggestChallenge' or a ? 'challengeOther' then
                                  case when coalesce(case when a ? 'biggestChallenge' then a ->> 'biggestChallenge' else w.biggest_challenge::text end, '') = 'other'
                                       then case when a ? 'challengeOther' then nullif(btrim(a ->> 'challengeOther'), '') else w.challenge_other end
                                  end
                                else w.challenge_other
                              end,
         business_stage     = case when a ? 'businessStage' then (nullif(a ->> 'businessStage', ''))::public.waitlist_business_stage else w.business_stage end,
         testing_interest   = case when a ? 'testingInterest' then (nullif(a ->> 'testingInterest', ''))::public.waitlist_testing_interest else w.testing_interest end,
         feedback_interest  = case when a ? 'feedbackInterest' then (nullif(a ->> 'feedbackInterest', ''))::public.waitlist_testing_interest else w.feedback_interest end,
         additional_info    = case when a ? 'additionalInfo' then nullif(btrim(a ->> 'additionalInfo'), '') else w.additional_info end,
         survey_started_at  = coalesce(w.survey_started_at, now()),
         survey_updated_at  = now(),
         survey_completed_at = case when p_final then coalesce(w.survey_completed_at, now()) else w.survey_completed_at end
   where w.survey_token_hash = v_hash;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

comment on function public.save_waitlist_survey is
  'Public, token-gated partial save of the waitlist questionnaire. Writes only the keys present in p_answers. Never touches contact, status or recruitment columns.';

revoke all on function public.save_waitlist_survey(text, jsonb, boolean) from public;
grant execute on function public.save_waitlist_survey(text, jsonb, boolean) to anon, authenticated;

-- The token holder's own answers, so they can return and update them.
create or replace function public.get_waitlist_survey(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'country', w.survey_country,
    'cityIsland', w.survey_city_island,
    'businessName', w.business_name,
    'businessJourney', w.business_journey,
    'industry', w.industry,
    'industryOther', w.industry_other,
    'primaryGoal', w.primary_goal,
    'goalOther', w.goal_other,
    'biggestChallenge', w.biggest_challenge,
    'challengeOther', w.challenge_other,
    'businessStage', w.business_stage,
    'testingInterest', w.testing_interest,
    'feedbackInterest', w.feedback_interest,
    'additionalInfo', w.additional_info,
    'completed', w.survey_completed_at is not null
  )
  from public.waitlist_signups w
  where p_token is not null
    and char_length(p_token) between 32 and 128
    and w.survey_token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
$$;

revoke all on function public.get_waitlist_survey(text) from public;
grant execute on function public.get_waitlist_survey(text) to anon, authenticated;


-- ----------------------------------------------------------------------------
-- 5. First-party analytics events
-- ----------------------------------------------------------------------------

create table public.analytics_events (
  id             bigint      generated always as identity primary key,
  -- Client- or server-generated; duplicate submissions are ignored on insert.
  event_id       uuid        not null unique,
  occurred_at    timestamptz not null default now(),
  -- 'web' = public website; 'product' = signed-in application.
  kind           text        not null,
  event_name     text        not null,
  -- 'c:<uuid>' — consented first-party identifier (returning visits);
  -- 'd:<hmac>' — daily-rotating keyed hash of IP + user agent, raw values never stored.
  visitor_key    text,
  user_id        uuid        references auth.users (id) on delete set null,
  business_id    uuid        references public.businesses (id) on delete set null,
  path           text,
  referrer_host  text,
  utm_source     text,
  utm_medium     text,
  utm_campaign   text,
  country_code   text,
  device         text,
  browser        text,
  status         text,
  error_category text,
  duration_ms    integer,
  properties     jsonb       not null default '{}'::jsonb,

  constraint ae_kind check (kind in ('web', 'product')),
  constraint ae_event_name_format check (event_name ~ '^[a-z][a-z0-9_.]{2,63}$'),
  constraint ae_visitor_key_format check (visitor_key is null or visitor_key ~ '^[cd]:[0-9a-f-]{32,64}$'),
  constraint ae_path_length check (path is null or char_length(path) <= 300),
  constraint ae_referrer_length check (referrer_host is null or char_length(referrer_host) <= 255),
  constraint ae_utm_length check (
    (utm_source is null or char_length(utm_source) <= 100)
    and (utm_medium is null or char_length(utm_medium) <= 100)
    and (utm_campaign is null or char_length(utm_campaign) <= 100)
  ),
  constraint ae_country_format check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  constraint ae_device check (device is null or device in ('desktop', 'mobile', 'tablet', 'unknown')),
  constraint ae_browser_length check (browser is null or char_length(browser) <= 40),
  constraint ae_status check (status is null or status in ('success', 'failure')),
  constraint ae_error_category_format check (error_category is null or error_category ~ '^[a-z][a-z0-9_]{1,59}$'),
  constraint ae_duration check (duration_ms is null or duration_ms between 0 and 3600000),
  constraint ae_properties check (jsonb_typeof(properties) = 'object' and pg_column_size(properties) <= 2048)
);

comment on table public.analytics_events is
  'First-party, pseudonymous website and product analytics. Inserted only by the server (service role) after validation. Readable only by platform administrators. Never contains form content, prompts, document contents or full IP addresses.';

create index analytics_events_occurred_idx on public.analytics_events (occurred_at);
create index analytics_events_name_occurred_idx on public.analytics_events (event_name, occurred_at);
create index analytics_events_kind_occurred_idx on public.analytics_events (kind, occurred_at);
create index analytics_events_visitor_idx on public.analytics_events (visitor_key, occurred_at) where visitor_key is not null;
create index analytics_events_user_idx on public.analytics_events (user_id, occurred_at) where user_id is not null;

alter table public.analytics_events enable row level security;
alter table public.analytics_events force  row level security;

create policy analytics_events_select_platform_admin
  on public.analytics_events for select to authenticated
  using ((select app.is_platform_admin()));

revoke all on public.analytics_events from anon, authenticated;
grant select on public.analytics_events to authenticated;


-- ----------------------------------------------------------------------------
-- 6. Audit log — readable by platform administrators. Still append-only.
-- ----------------------------------------------------------------------------

create policy audit_log_select_platform_admin
  on public.audit_log for select to authenticated
  using ((select app.is_platform_admin()));

grant select on public.audit_log to authenticated;


-- ----------------------------------------------------------------------------
-- 7. Admin reporting functions
-- ----------------------------------------------------------------------------

create or replace function app.check_range(p_from timestamptz, p_to timestamptz)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_from is null or p_to is null or p_to <= p_from or p_to - p_from > interval '3660 days' then
    raise exception 'invalid range' using errcode = '22023';
  end if;
end;
$$;

-- Maps an audit event or an app path to a product feature.
create or replace function app.feature_of_event(p_event text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_event like 'auth.%' then 'account'
    when p_event like 'intake.%' then 'onboarding'
    when p_event like 'nova.%' then 'nova'
    when p_event in ('business.document_added', 'business.evidence_attached') then 'documents'
    when p_event in ('business.financial_period_created', 'business.metric_recorded') then 'finances'
    when p_event in ('business.goal_created', 'business.goal_updated') then 'goals'
    when p_event like 'business.case_%' then 'business_cases'
    when p_event like 'business.%' then 'business_profile'
    else null
  end;
$$;

create or replace function app.feature_of_path(p_path text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_path like '/dashboard%' then 'dashboard'
    when p_path like '/intake%' or p_path like '/welcome%' then 'onboarding'
    when p_path like '/assistant%' then 'nova'
    when p_path like '/documents%' then 'documents'
    when p_path like '/passport%' or p_path like '/businesses%' then 'business_profile'
    when p_path like '/settings%' then 'settings'
    when p_path like '/timeline%' then 'timeline'
    when p_path like '/compliance%' then 'compliance'
    when p_path like '/funding%' then 'funding'
    else 'other'
  end;
$$;

-- Website traffic and conversion. Sessions are runs of a visitor's events with
-- gaps of at most 30 minutes; a session's landing page and source come from
-- its first event.
create or replace function public.admin_web_analytics(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  perform app.require_platform_admin();
  perform app.check_range(p_from, p_to);

  with ev as (
    select e.*
    from public.analytics_events e
    where e.kind = 'web' and e.occurred_at >= p_from and e.occurred_at < p_to
  ),
  ordered as (
    select ev.*,
      case
        when lag(ev.occurred_at) over w is null
          or ev.occurred_at - lag(ev.occurred_at) over w > interval '30 minutes'
        then 1 else 0
      end as is_start
    from ev
    where ev.visitor_key is not null
    window w as (partition by ev.visitor_key order by ev.occurred_at, ev.id)
  ),
  numbered as (
    select o.*,
      sum(o.is_start) over (partition by o.visitor_key order by o.occurred_at, o.id rows unbounded preceding) as sess_no
    from ordered o
  ),
  sessions as (
    select n.visitor_key, n.sess_no, n.occurred_at as started_at,
      coalesce(n.path, '/') as landing,
      coalesce(nullif(n.utm_source, ''), n.referrer_host, '(direct)') as source,
      n.utm_medium, n.utm_campaign, n.utm_source,
      coalesce(n.device, 'unknown') as device,
      coalesce(n.country_code, '—') as country,
      coalesce(n.browser, 'Other') as browser
    from numbered n
    where n.is_start = 1
  ),
  session_signups as (
    select n.visitor_key, n.sess_no, count(*) filter (where n.event_name = 'waitlist_signup_succeeded') as signups
    from numbered n
    group by 1, 2
  ),
  s as (
    select s.*, coalesce(ss.signups, 0) as signups
    from sessions s
    left join session_signups ss using (visitor_key, sess_no)
  ),
  visitors as (
    select visitor_key, min(occurred_at) as first_seen
    from ev where visitor_key is not null and event_name = 'page_view'
    group by 1
  ),
  vclass as (
    select v.visitor_key,
      case
        when v.visitor_key not like 'c:%' then 'unidentified'
        when exists (
          select 1 from public.analytics_events p
          where p.visitor_key = v.visitor_key and p.occurred_at < date_trunc('day', v.first_seen)
        ) then 'returning'
        else 'new'
      end as cls
    from visitors v
  ),
  signups as (
    select w.*
    from public.waitlist_signups w
    where w.created_at >= p_from and w.created_at < p_to and not app.is_test_email(w.email)
  ),
  days as (
    select d::date as day
    from generate_series(date_trunc('day', p_from), date_trunc('day', p_to - interval '1 microsecond'), interval '1 day') d
  )
  select jsonb_build_object(
    'tracking_started_at', (select min(occurred_at) from public.analytics_events where kind = 'web'),
    'totals', jsonb_build_object(
      'page_views', (select count(*) from ev where event_name = 'page_view'),
      'visitors', (select count(*) from visitors),
      'sessions', (select count(*) from sessions),
      'new_visitors', (select count(*) from vclass where cls = 'new'),
      'returning_visitors', (select count(*) from vclass where cls = 'returning'),
      'unidentified_visitors', (select count(*) from vclass where cls = 'unidentified'),
      'form_started', (select count(distinct visitor_key) from ev where event_name = 'waitlist_form_started'),
      'signup_events', (select count(*) from ev where event_name = 'waitlist_signup_succeeded'),
      'signups', (select count(*) from signups),
      'survey_started', (select count(*) from signups where survey_started_at is not null or survey_completed_at is not null),
      'survey_completed', (select count(*) from signups where survey_completed_at is not null),
      'survey_skipped_events', (select count(*) from ev where event_name = 'waitlist_survey_skipped'),
      'signup_failures', (select count(*) from ev where event_name = 'waitlist_signup_failed'),
      'test_signups_excluded', (
        select count(*) from public.waitlist_signups w
        where w.created_at >= p_from and w.created_at < p_to and app.is_test_email(w.email)
      )
    ),
    'funnel', jsonb_build_array(
      jsonb_build_object('step', 'visitors', 'value', (select count(*) from visitors)),
      jsonb_build_object('step', 'form_started', 'value', (select count(distinct visitor_key) from ev where event_name = 'waitlist_form_started')),
      jsonb_build_object('step', 'signed_up', 'value', (select count(*) from signups)),
      jsonb_build_object('step', 'survey_started', 'value', (select count(*) from signups where survey_started_at is not null or survey_completed_at is not null)),
      jsonb_build_object('step', 'survey_completed', 'value', (select count(*) from signups where survey_completed_at is not null)),
      jsonb_build_object('step', 'early_access_interest', 'value', (select count(*) from signups where testing_interest in ('yes', 'maybe'))),
      jsonb_build_object('step', 'pilot_confirmed', 'value', (select count(*) from signups where recruitment_status in ('confirmed', 'tested'))),
      jsonb_build_object('step', 'tested', 'value', (select count(*) from signups where recruitment_status = 'tested'))
    ),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object(
        'day', d.day,
        'page_views', (select count(*) from ev where event_name = 'page_view' and ev.occurred_at::date = d.day),
        'visitors', (select count(distinct visitor_key) from ev where event_name = 'page_view' and ev.occurred_at::date = d.day),
        'signups', (select count(*) from signups sg where sg.created_at::date = d.day)
      ) order by d.day)
      from days d
    ), '[]'::jsonb),
    'sources', coalesce((
      select jsonb_agg(x order by (x ->> 'sessions')::int desc)
      from (
        select jsonb_build_object('label', source, 'sessions', count(*), 'signups', sum(signups)) as x
        from s group by source order by count(*) desc limit 15
      ) t
    ), '[]'::jsonb),
    'landing_pages', coalesce((
      select jsonb_agg(x order by (x ->> 'sessions')::int desc)
      from (
        select jsonb_build_object('label', landing, 'sessions', count(*), 'signups', sum(signups)) as x
        from s group by landing order by count(*) desc limit 15
      ) t
    ), '[]'::jsonb),
    'top_pages', coalesce((
      select jsonb_agg(x order by (x ->> 'views')::int desc)
      from (
        select jsonb_build_object('label', coalesce(path, '/'), 'views', count(*)) as x
        from ev where event_name = 'page_view' group by coalesce(path, '/') order by count(*) desc limit 15
      ) t
    ), '[]'::jsonb),
    'devices', coalesce((
      select jsonb_agg(jsonb_build_object('label', device, 'sessions', n) order by n desc)
      from (select device, count(*) n from s group by device) t
    ), '[]'::jsonb),
    'browsers', coalesce((
      select jsonb_agg(jsonb_build_object('label', browser, 'sessions', n) order by n desc)
      from (select browser, count(*) n from s group by browser) t
    ), '[]'::jsonb),
    'countries', coalesce((
      select jsonb_agg(jsonb_build_object('label', country, 'sessions', n) order by n desc)
      from (select country, count(*) n from s group by country order by count(*) desc limit 20) t
    ), '[]'::jsonb),
    'campaigns', coalesce((
      select jsonb_agg(jsonb_build_object(
        'source', coalesce(utm_source, '—'), 'medium', coalesce(utm_medium, '—'),
        'campaign', utm_campaign, 'sessions', n, 'signups', sg) order by n desc)
      from (
        select utm_source, utm_medium, utm_campaign, count(*) n, sum(signups) sg
        from s where utm_campaign is not null
        group by 1, 2, 3 order by count(*) desc limit 20
      ) t
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

-- Waitlist and questionnaire breakdowns (test records excluded).
create or replace function public.admin_waitlist_insights(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  perform app.require_platform_admin();
  perform app.check_range(p_from, p_to);

  with w as (
    select * from public.waitlist_signups x
    where x.created_at >= p_from and x.created_at < p_to and not app.is_test_email(x.email)
  ),
  days as (
    select d::date as day
    from generate_series(date_trunc('day', p_from), date_trunc('day', p_to - interval '1 microsecond'), interval '1 day') d
  )
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'signups', (select count(*) from w),
      'all_time_signups', (select count(*) from public.waitlist_signups x where not app.is_test_email(x.email)),
      'survey_started', (select count(*) from w where survey_started_at is not null or survey_completed_at is not null),
      'survey_completed', (select count(*) from w where survey_completed_at is not null),
      'with_phone', (select count(*) from w where phone is not null),
      'test_records_excluded', (
        select count(*) from public.waitlist_signups x
        where x.created_at >= p_from and x.created_at < p_to and app.is_test_email(x.email)
      )
    ),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('day', d.day, 'signups',
        (select count(*) from w where w.created_at::date = d.day)) order by d.day)
      from days d
    ), '[]'::jsonb),
    'countries', coalesce((select jsonb_agg(jsonb_build_object('label', k, 'count', n) order by n desc)
      from (select coalesce(survey_country, '(not answered)') k, count(*) n from w group by 1 order by 2 desc limit 20) t), '[]'::jsonb),
    'cities', coalesce((select jsonb_agg(jsonb_build_object('label', k, 'count', n) order by n desc)
      from (select survey_city_island k, count(*) n from w where survey_city_island is not null group by 1 order by 2 desc limit 20) t), '[]'::jsonb),
    'journey', coalesce((select jsonb_agg(jsonb_build_object('value', k, 'count', n) order by n desc)
      from (select business_journey::text k, count(*) n from w where business_journey is not null group by 1) t), '[]'::jsonb),
    'industry', coalesce((select jsonb_agg(jsonb_build_object('value', k, 'count', n) order by n desc)
      from (select industry::text k, count(*) n from w where industry is not null group by 1) t), '[]'::jsonb),
    'goal', coalesce((select jsonb_agg(jsonb_build_object('value', k, 'count', n) order by n desc)
      from (select primary_goal::text k, count(*) n from w where primary_goal is not null group by 1) t), '[]'::jsonb),
    'challenge', coalesce((select jsonb_agg(jsonb_build_object('value', k, 'count', n) order by n desc)
      from (select biggest_challenge::text k, count(*) n from w where biggest_challenge is not null group by 1) t), '[]'::jsonb),
    'stage', coalesce((select jsonb_agg(jsonb_build_object('value', k, 'count', n) order by n desc)
      from (select business_stage::text k, count(*) n from w where business_stage is not null group by 1) t), '[]'::jsonb),
    'testing_interest', coalesce((select jsonb_agg(jsonb_build_object('value', k, 'count', n) order by n desc)
      from (select testing_interest::text k, count(*) n from w where testing_interest is not null group by 1) t), '[]'::jsonb),
    'feedback_interest', coalesce((select jsonb_agg(jsonb_build_object('value', k, 'count', n) order by n desc)
      from (select feedback_interest::text k, count(*) n from w where feedback_interest is not null group by 1) t), '[]'::jsonb),
    'recruitment', coalesce((select jsonb_agg(jsonb_build_object('value', k, 'count', n) order by n desc)
      from (select recruitment_status::text k, count(*) n from w group by 1) t), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

-- Registered users and businesses (test accounts excluded from aggregates).
create or replace function public.admin_user_overview(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  perform app.require_platform_admin();
  perform app.check_range(p_from, p_to);

  with u as (
    select au.id, au.created_at
    from auth.users au
    where au.deleted_at is null
      and not app.is_test_email(au.email)
      and not exists (select 1 from public.platform_admins p where p.user_id = au.id)
  ),
  activity as (
    select a.actor_id as user_id, a.occurred_at
    from public.audit_log a
    where a.actor_id in (select id from u)
      and a.event not like 'admin.%' and a.event not like 'waitlist.%'
      and a.event <> 'auth.signed_out'
    union all
    select e.user_id, e.occurred_at
    from public.analytics_events e
    where e.kind = 'product' and e.user_id in (select id from u)
  ),
  b as (
    select x.* from public.businesses x where x.owner_id in (select id from u)
  ),
  days as (
    select d::date as day
    from generate_series(date_trunc('day', p_from), date_trunc('day', p_to - interval '1 microsecond'), interval '1 day') d
  )
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'users', (select count(*) from u),
      'new_users', (select count(*) from u where created_at >= p_from and created_at < p_to),
      'active_users', (select count(distinct user_id) from activity where occurred_at >= p_from and occurred_at < p_to),
      'dau', (select count(distinct user_id) from activity where occurred_at >= p_to - interval '1 day' and occurred_at < p_to),
      'wau', (select count(distinct user_id) from activity where occurred_at >= p_to - interval '7 days' and occurred_at < p_to),
      'mau', (select count(distinct user_id) from activity where occurred_at >= p_to - interval '30 days' and occurred_at < p_to),
      'businesses', (select count(*) from b where archived_at is null),
      'businesses_archived', (select count(*) from b where archived_at is not null),
      'businesses_created', (select count(*) from b where created_at >= p_from and created_at < p_to),
      'onboarding_started', (select count(*) from public.business_profiles bp join b on b.id = bp.business_id where b.archived_at is null and (bp.last_completed_step > 0 or bp.completed_at is not null)),
      'onboarding_completed', (select count(*) from public.business_profiles bp join b on b.id = bp.business_id where b.archived_at is null and bp.completed_at is not null),
      'documents', (select count(*) from public.business_documents d join b on b.id = d.business_id),
      'documents_created', (select count(*) from public.business_documents d join b on b.id = d.business_id where d.created_at >= p_from and d.created_at < p_to),
      'goals', (select count(*) from public.business_goals g join b on b.id = g.business_id),
      'test_accounts_excluded', (select count(*) from auth.users au where au.deleted_at is null and app.is_test_email(au.email))
    ),
    'businesses_per_user', coalesce((
      select jsonb_agg(jsonb_build_object('label', k, 'count', n) order by k)
      from (
        select case when c >= 3 then '3+' else c::text end k, count(*) n
        from (select u.id, count(b.id) filter (where b.archived_at is null) c from u left join b on b.owner_id = u.id group by u.id) z
        group by 1
      ) t
    ), '[]'::jsonb),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object(
        'day', d.day,
        'new_users', (select count(*) from u where u.created_at::date = d.day),
        'active_users', (select count(distinct user_id) from activity a where a.occurred_at::date = d.day)
      ) order by d.day)
      from days d
    ), '[]'::jsonb),
    'countries', coalesce((select jsonb_agg(jsonb_build_object('label', k, 'count', n) order by n desc)
      from (select coalesce(country_code::text, '—') k, count(*) n from b where archived_at is null group by 1) t), '[]'::jsonb),
    'industries', coalesce((select jsonb_agg(jsonb_build_object('label', k, 'count', n) order by n desc)
      from (select coalesce(nullif(industry, ''), '(not set)') k, count(*) n from b where archived_at is null group by 1 order by 2 desc limit 20) t), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

-- Paginated user list. Shows test accounts only when asked, labelled.
create or replace function public.admin_list_users(
  p_search       text,
  p_include_test boolean,
  p_offset       integer,
  p_limit        integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  result   jsonb;
begin
  perform app.require_platform_admin();
  if p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset < 0 then
    raise exception 'invalid page' using errcode = '22023';
  end if;
  if v_search is not null and char_length(v_search) > 100 then
    raise exception 'invalid search' using errcode = '22023';
  end if;

  with u as (
    select au.id, au.email, au.created_at, au.last_sign_in_at, au.email_confirmed_at,
      au.banned_until, pr.full_name, app.is_test_email(au.email) as is_test,
      exists (select 1 from public.platform_admins p where p.user_id = au.id) as is_admin
    from auth.users au
    left join public.profiles pr on pr.id = au.id
    where au.deleted_at is null
      and (coalesce(p_include_test, false) or not app.is_test_email(au.email))
      and (
        v_search is null
        or au.email ilike '%' || v_search || '%'
        or pr.full_name ilike '%' || v_search || '%'
        or exists (select 1 from public.businesses b where b.owner_id = au.id and b.name ilike '%' || v_search || '%')
      )
  )
  select jsonb_build_object(
    'total', (select count(*) from u),
    'rows', coalesce((
      select jsonb_agg(r order by (r ->> 'created_at') desc)
      from (
        select jsonb_build_object(
          'id', u.id,
          'email', u.email,
          'full_name', u.full_name,
          'created_at', u.created_at,
          'last_sign_in_at', u.last_sign_in_at,
          'confirmed', u.email_confirmed_at is not null,
          'banned', u.banned_until is not null and u.banned_until > now(),
          'is_test', u.is_test,
          'is_admin', u.is_admin,
          'businesses', (select count(*) from public.businesses b where b.owner_id = u.id and b.archived_at is null),
          'onboarding_completed', (
            select count(*) from public.business_profiles bp join public.businesses b on b.id = bp.business_id
            where b.owner_id = u.id and b.archived_at is null and bp.completed_at is not null
          ),
          'documents', (
            select count(*) from public.business_documents d join public.businesses b on b.id = d.business_id
            where b.owner_id = u.id
          ),
          'last_activity_at', greatest(
            (select max(a.occurred_at) from public.audit_log a where a.actor_id = u.id and a.event not like 'admin.%'),
            (select max(e.occurred_at) from public.analytics_events e where e.user_id = u.id)
          )
        ) as r
        from u
        order by u.created_at desc
        offset p_offset limit p_limit
      ) t
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

-- One user: account facts, businesses (no document contents, no identifiers,
-- no financial values) and a feature-level activity summary.
create or replace function public.admin_user_detail(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  perform app.require_platform_admin();

  select jsonb_build_object(
    'id', au.id,
    'email', au.email,
    'full_name', pr.full_name,
    'created_at', au.created_at,
    'last_sign_in_at', au.last_sign_in_at,
    'confirmed', au.email_confirmed_at is not null,
    'banned', au.banned_until is not null and au.banned_until > now(),
    'is_test', app.is_test_email(au.email),
    'is_admin', exists (select 1 from public.platform_admins p where p.user_id = au.id),
    'mfa_factors', (select count(*) from auth.mfa_factors f where f.user_id = au.id and f.status = 'verified'),
    'businesses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id,
        'name', b.name,
        'industry', b.industry,
        'country_code', b.country_code,
        'status', b.status,
        'mode', b.business_mode,
        'archived', b.archived_at is not null,
        'created_at', b.created_at,
        'onboarding_step', bp.last_completed_step,
        'onboarding_completed_at', bp.completed_at,
        'documents', (select count(*) from public.business_documents d where d.business_id = b.id),
        'goals', (select count(*) from public.business_goals g where g.business_id = b.id)
      ) order by b.created_at desc)
      from public.businesses b
      left join public.business_profiles bp on bp.business_id = b.id
      where b.owner_id = au.id
    ), '[]'::jsonb),
    'features', coalesce((
      select jsonb_agg(jsonb_build_object('feature', f, 'actions', n, 'last_at', last_at) order by n desc)
      from (
        select f, count(*) n, max(at) last_at from (
          select app.feature_of_event(a.event) f, a.occurred_at at
          from public.audit_log a where a.actor_id = au.id and a.event not like 'admin.%'
          union all
          select app.feature_of_path(e.path), e.occurred_at
          from public.analytics_events e where e.user_id = au.id and e.kind = 'product'
        ) z where f is not null group by f
      ) t
    ), '[]'::jsonb),
    'recent_activity', coalesce((
      select jsonb_agg(jsonb_build_object('at', at, 'event', ev, 'feature', f) order by at desc)
      from (
        select a.occurred_at at, a.event ev, app.feature_of_event(a.event) f
        from public.audit_log a where a.actor_id = au.id and a.event not like 'admin.%'
        order by a.occurred_at desc limit 40
      ) t
    ), '[]'::jsonb)
  )
  into result
  from auth.users au
  left join public.profiles pr on pr.id = au.id
  where au.id = p_user_id and au.deleted_at is null;

  return result;
end;
$$;

-- Product usage. Workflow events come from the audit log (recorded by the
-- application services since 2026-08); page views from analytics_events.
create or replace function public.admin_product_usage(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  perform app.require_platform_admin();
  perform app.check_range(p_from, p_to);

  with real_users as (
    select au.id from auth.users au
    where au.deleted_at is null and not app.is_test_email(au.email)
      and not exists (select 1 from public.platform_admins p where p.user_id = au.id)
  ),
  acts as (
    select a.actor_id as user_id, a.occurred_at, a.event, app.feature_of_event(a.event) as feature,
      a.metadata, 'action'::text as source
    from public.audit_log a
    where a.actor_id in (select id from real_users)
      and a.event not like 'admin.%' and a.event not like 'waitlist.%' and a.event <> 'auth.signed_out'
    union all
    select e.user_id, e.occurred_at, e.event_name, app.feature_of_path(e.path), e.properties, 'view'
    from public.analytics_events e
    where e.kind = 'product' and e.event_name = 'page_view' and e.user_id in (select id from real_users)
  ),
  win as (select * from acts where occurred_at >= p_from and occurred_at < p_to),
  days as (
    select d::date as day
    from generate_series(date_trunc('day', p_from), date_trunc('day', p_to - interval '1 microsecond'), interval '1 day') d
  ),
  firsts as (
    select user_id, date_trunc('week', min(occurred_at)) as cohort from acts group by 1
  ),
  cohorts as (
    select f.cohort, count(*) as size,
      count(*) filter (where exists (select 1 from acts a where a.user_id = f.user_id and date_trunc('week', a.occurred_at) = f.cohort + interval '1 week')) as w1,
      count(*) filter (where exists (select 1 from acts a where a.user_id = f.user_id and date_trunc('week', a.occurred_at) = f.cohort + interval '2 weeks')) as w2,
      count(*) filter (where exists (select 1 from acts a where a.user_id = f.user_id and date_trunc('week', a.occurred_at) = f.cohort + interval '3 weeks')) as w3,
      count(*) filter (where exists (select 1 from acts a where a.user_id = f.user_id and date_trunc('week', a.occurred_at) = f.cohort + interval '4 weeks')) as w4
    from firsts f
    where f.cohort >= date_trunc('week', p_from) and f.cohort < p_to
    group by f.cohort
  )
  select jsonb_build_object(
    'page_view_tracking_started_at', (select min(occurred_at) from public.analytics_events where kind = 'product'),
    'action_history_started_at', (select min(occurred_at) from public.audit_log where event not like 'test.%'),
    'totals', jsonb_build_object(
      'active_users', (select count(distinct user_id) from win),
      'actions', (select count(*) from win where source = 'action'),
      'page_views', (select count(*) from win where source = 'view'),
      'dau', (select count(distinct user_id) from acts where occurred_at >= p_to - interval '1 day' and occurred_at < p_to),
      'wau', (select count(distinct user_id) from acts where occurred_at >= p_to - interval '7 days' and occurred_at < p_to),
      'mau', (select count(distinct user_id) from acts where occurred_at >= p_to - interval '30 days' and occurred_at < p_to),
      'new_active_users', (
        select count(*) from (select user_id, min(occurred_at) as first_at from acts group by 1) z
        where z.first_at >= p_from and z.first_at < p_to
      ),
      'returning_active_users', (select count(distinct w.user_id) from win w where exists (select 1 from acts a where a.user_id = w.user_id and a.occurred_at < p_from))
    ),
    'features', coalesce((
      select jsonb_agg(jsonb_build_object('feature', feature, 'actions', actions, 'views', views, 'users', users) order by users desc, actions desc)
      from (
        select feature,
          count(*) filter (where source = 'action') actions,
          count(*) filter (where source = 'view') views,
          count(distinct user_id) users
        from win where feature is not null group by feature
      ) t
    ), '[]'::jsonb),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object(
        'day', d.day,
        'active_users', (select count(distinct user_id) from win where win.occurred_at::date = d.day),
        'actions', (select count(*) from win where win.occurred_at::date = d.day and source = 'action')
      ) order by d.day)
      from days d
    ), '[]'::jsonb),
    'onboarding', jsonb_build_object(
      'started_users', (select count(distinct user_id) from win where event = 'intake.started'),
      'completed_users', (select count(distinct user_id) from win where event = 'intake.completed'),
      'steps_saved', (select count(*) from win where event = 'intake.step_saved')
    ),
    'business', jsonb_build_object(
      'created', (select count(*) from win where event = 'business.created'),
      'built', (select count(*) from win where event = 'business.built'),
      'imported', (select count(*) from win where event = 'business.imported'),
      'updated', (select count(*) from win where event = 'business.updated'),
      'archived', (select count(*) from win where event = 'business.archived')
    ),
    'documents', jsonb_build_object(
      'added', (select count(*) from win where event = 'business.document_added'),
      'evidence_attached', (select count(*) from win where event = 'business.evidence_attached'),
      'users', (select count(distinct user_id) from win where feature = 'documents' and source = 'action')
    ),
    'nova', jsonb_build_object(
      'requests', (select count(*) from win where event in ('nova.answered', 'nova.failed', 'nova.rate_limited')),
      'answered_with_evidence', (select count(*) from win where event = 'nova.answered' and coalesce(metadata ->> 'outcome', metadata ->> 'status') = 'answered'),
      'refused_or_no_evidence', (select count(*) from win where event = 'nova.answered' and coalesce(metadata ->> 'outcome', metadata ->> 'status', '') <> 'answered'),
      'failed', (select count(*) from win where event = 'nova.failed'),
      'rate_limited', (select count(*) from win where event = 'nova.rate_limited'),
      'users', (select count(distinct user_id) from win where event like 'nova.%')
    ),
    'errors', coalesce((
      select jsonb_agg(jsonb_build_object('label', k, 'count', n) order by n desc)
      from (
        select k, count(*) n from (
          select coalesce(e.error_category, 'unknown') || ' · ' || e.event_name as k
          from public.analytics_events e
          where e.status = 'failure' and e.occurred_at >= p_from and e.occurred_at < p_to
            and (e.user_id is null or e.user_id in (select id from real_users))
          union all
          select 'nova_failed · ' || coalesce(metadata ->> 'category', 'unknown')
          from win where event = 'nova.failed'
        ) z group by k order by n desc limit 20
      ) t
    ), '[]'::jsonb),
    'cohorts', coalesce((
      select jsonb_agg(jsonb_build_object('week', cohort::date, 'size', size, 'w1', w1, 'w2', w2, 'w3', w3, 'w4', w4) order by cohort)
      from cohorts
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.admin_web_analytics(timestamptz, timestamptz)',
    'public.admin_waitlist_insights(timestamptz, timestamptz)',
    'public.admin_user_overview(timestamptz, timestamptz)',
    'public.admin_list_users(text, boolean, integer, integer)',
    'public.admin_user_detail(uuid)',
    'public.admin_product_usage(timestamptz, timestamptz)'
  ] loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end;
$$;

revoke all on function app.check_range(timestamptz, timestamptz) from public, anon;
grant execute on function app.check_range(timestamptz, timestamptz) to authenticated;
revoke all on function app.is_test_email(text) from public, anon;
grant execute on function app.is_test_email(text) to authenticated;
revoke all on function app.feature_of_event(text) from public, anon;
grant execute on function app.feature_of_event(text) to authenticated;
revoke all on function app.feature_of_path(text) from public, anon;
grant execute on function app.feature_of_path(text) to authenticated;

commit;
