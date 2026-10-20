-- ============================================================================
-- Islanda · Waitlist questionnaire — multiple goals and challenges
-- Migration: 20261019200000_waitlist_multi_select
--
-- Additive and backward compatible with the code deployed before it:
--
--   * New array columns `primary_goals` and `challenges`, backfilled from the
--     single-answer columns. No existing answer is changed or discarded.
--   * The single-answer columns stay, kept in step by the save function as the
--     FIRST selected answer, so code that still reads `primary_goal` /
--     `biggest_challenge` (the release live when this is applied) keeps working.
--   * `save_waitlist_survey` accepts the new array keys (`primaryGoals`,
--     `challenges`) and the old single keys (`primaryGoal`,
--     `biggestChallenge`), so an open questionnaire from the previous release
--     still saves.
--   * "I'm not sure yet" and "I have several challenges…" are exclusive: the
--     database refuses them combined with other answers.
--   * Admin reporting counts selections from the arrays and reports respondents
--     and selections separately.
--   * Test signups are recognised by an explicit `source` marker as well as by
--     reserved test email domains (`app.is_test_signup`).
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Helpers
-- ----------------------------------------------------------------------------

create or replace function app.array_has_no_duplicates(p anyarray)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select count(*) = count(distinct x) from unnest(p) as x;
$$;

-- A signup that is not a genuine contact: a reserved test email domain, or a
-- `source` written by automated tests or by a non-production deployment.
create or replace function app.is_test_signup(p_email text, p_source text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select app.is_test_email(p_email)
      or coalesce(p_source in ('rls_test', 'e2e_test', 'development', 'preview'), false);
$$;

comment on function app.is_test_signup is
  'True for automated-test and non-production signups (reserved domains or an explicit source marker). Excluded from admin aggregates.';

-- array_has_no_duplicates runs inside the CHECK constraints below, and Postgres
-- checks EXECUTE for whichever role writes the row. The public waitlist INSERT
-- runs as `anon`, so anon must be able to execute it or every signup fails.
-- It is pure and immutable, and the app schema is not exposed by the API, so
-- this grant makes nothing callable from outside.
revoke all on function app.array_has_no_duplicates(anyarray) from public;
grant execute on function app.array_has_no_duplicates(anyarray) to anon, authenticated, service_role;
revoke all on function app.is_test_signup(text, text) from public, anon;
grant execute on function app.is_test_signup(text, text) to authenticated;


-- ----------------------------------------------------------------------------
-- 2. Columns, backfill, constraints
-- ----------------------------------------------------------------------------

alter table public.waitlist_signups
  add column primary_goals public.waitlist_primary_goal[],
  add column challenges    public.waitlist_challenge[];

comment on column public.waitlist_signups.primary_goals is
  'Everything the visitor wants Islanda to help with (multi-select, in the order chosen). primary_goal mirrors the first entry for older readers.';
comment on column public.waitlist_signups.challenges is
  'Every challenge the visitor selected (multi-select). biggest_challenge mirrors the first entry for older readers.';

-- Backfill without touching updated_at: this is a storage change, not an edit.
alter table public.waitlist_signups disable trigger waitlist_signups_set_updated_at;
update public.waitlist_signups set primary_goals = array[primary_goal] where primary_goal is not null;
update public.waitlist_signups set challenges = array[biggest_challenge] where biggest_challenge is not null;
alter table public.waitlist_signups enable trigger waitlist_signups_set_updated_at;

alter table public.waitlist_signups
  add constraint ws_primary_goals_shape check (
    primary_goals is null
    or (cardinality(primary_goals) between 1 and 20
        and array_position(primary_goals, null) is null
        and app.array_has_no_duplicates(primary_goals))
  ),
  add constraint ws_primary_goals_exclusive check (
    primary_goals is null
    or not ('not_sure_yet' = any (primary_goals) and cardinality(primary_goals) > 1)
  ),
  add constraint ws_challenges_shape check (
    challenges is null
    or (cardinality(challenges) between 1 and 16
        and array_position(challenges, null) is null
        and app.array_has_no_duplicates(challenges))
  ),
  add constraint ws_challenges_exclusive check (
    challenges is null
    or not ('several_challenges' = any (challenges) and cardinality(challenges) > 1)
  );

-- "Other" explanations now belong to an "Other" anywhere in the selection.
alter table public.waitlist_signups
  drop constraint ws_goal_other_only_for_other,
  add constraint ws_goal_other_only_for_other check (
    goal_other is null or primary_goal = 'other' or 'other' = any (coalesce(primary_goals, '{}'))
  ),
  drop constraint ws_challenge_other_only_for_other,
  add constraint ws_challenge_other_only_for_other check (
    challenge_other is null or biggest_challenge = 'other' or 'other' = any (coalesce(challenges, '{}'))
  );

grant select (primary_goals, challenges) on public.waitlist_signups to authenticated;


-- ----------------------------------------------------------------------------
-- 3. Questionnaire save (token-gated) — arrays, with the old single keys still
--    accepted. Only keys present in p_answers are written.
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
  a            jsonb := coalesce(p_answers, '{}'::jsonb);
  cur          public.waitlist_signups%rowtype;
  v_industry   public.waitlist_industry;
  v_goals      public.waitlist_primary_goal[];
  v_challenges public.waitlist_challenge[];
begin
  if p_token is null or char_length(p_token) not between 32 and 128 then
    return false;
  end if;
  if jsonb_typeof(a) <> 'object' or pg_column_size(a) > 8192 then
    raise exception 'invalid answers' using errcode = '22023';
  end if;

  select * into cur
  from public.waitlist_signups s
  where s.survey_token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
  for update;
  if not found then
    return false;
  end if;

  v_industry := case when a ? 'industry'
                     then (nullif(a ->> 'industry', ''))::public.waitlist_industry
                     else cur.industry end;

  if a ? 'primaryGoals' then
    if jsonb_typeof(a -> 'primaryGoals') = 'array' then
      select array_agg(x::public.waitlist_primary_goal order by ord)
        into v_goals
        from jsonb_array_elements_text(a -> 'primaryGoals') with ordinality as t(x, ord);
    else
      v_goals := null;
    end if;
  elsif a ? 'primaryGoal' then
    v_goals := case when nullif(a ->> 'primaryGoal', '') is null then null
                    else array[(a ->> 'primaryGoal')::public.waitlist_primary_goal] end;
  else
    v_goals := cur.primary_goals;
  end if;

  if a ? 'challenges' then
    if jsonb_typeof(a -> 'challenges') = 'array' then
      select array_agg(x::public.waitlist_challenge order by ord)
        into v_challenges
        from jsonb_array_elements_text(a -> 'challenges') with ordinality as t(x, ord);
    else
      v_challenges := null;
    end if;
  elsif a ? 'biggestChallenge' then
    v_challenges := case when nullif(a ->> 'biggestChallenge', '') is null then null
                         else array[(a ->> 'biggestChallenge')::public.waitlist_challenge] end;
  else
    v_challenges := cur.challenges;
  end if;

  update public.waitlist_signups s
     set survey_country     = case when a ? 'country' then nullif(btrim(a ->> 'country'), '') else s.survey_country end,
         survey_city_island = case when a ? 'cityIsland' then nullif(btrim(a ->> 'cityIsland'), '') else s.survey_city_island end,
         business_name      = case when a ? 'businessName' then nullif(btrim(a ->> 'businessName'), '') else s.business_name end,
         business_journey   = case when a ? 'businessJourney' then (nullif(a ->> 'businessJourney', ''))::public.waitlist_business_journey else s.business_journey end,
         industry           = v_industry,
         industry_other     = case when v_industry = 'other'
                                   then case when a ? 'industryOther' then nullif(btrim(a ->> 'industryOther'), '') else s.industry_other end
                              end,
         primary_goals      = v_goals,
         primary_goal       = v_goals[1],
         goal_other         = case when 'other' = any (coalesce(v_goals, '{}'))
                                   then case when a ? 'goalOther' then nullif(btrim(a ->> 'goalOther'), '') else s.goal_other end
                              end,
         challenges         = v_challenges,
         biggest_challenge  = v_challenges[1],
         challenge_other    = case when 'other' = any (coalesce(v_challenges, '{}'))
                                   then case when a ? 'challengeOther' then nullif(btrim(a ->> 'challengeOther'), '') else s.challenge_other end
                              end,
         business_stage     = case when a ? 'businessStage' then (nullif(a ->> 'businessStage', ''))::public.waitlist_business_stage else s.business_stage end,
         testing_interest   = case when a ? 'testingInterest' then (nullif(a ->> 'testingInterest', ''))::public.waitlist_testing_interest else s.testing_interest end,
         feedback_interest  = case when a ? 'feedbackInterest' then (nullif(a ->> 'feedbackInterest', ''))::public.waitlist_testing_interest else s.feedback_interest end,
         additional_info    = case when a ? 'additionalInfo' then nullif(btrim(a ->> 'additionalInfo'), '') else s.additional_info end,
         survey_started_at  = coalesce(s.survey_started_at, now()),
         survey_updated_at  = now(),
         survey_completed_at = case when p_final then coalesce(s.survey_completed_at, now()) else s.survey_completed_at end
   where s.id = cur.id;

  return true;
end;
$$;

comment on function public.save_waitlist_survey is
  'Public, token-gated partial save of the waitlist questionnaire. Writes only the keys present in p_answers; accepts multi-select arrays (primaryGoals, challenges) and the earlier single keys. Never touches contact, status or recruitment columns.';

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
    'primaryGoals', coalesce(to_jsonb(w.primary_goals),
                             case when w.primary_goal is not null then jsonb_build_array(w.primary_goal) end,
                             '[]'::jsonb),
    'primaryGoal', w.primary_goal,
    'goalOther', w.goal_other,
    'challenges', coalesce(to_jsonb(w.challenges),
                           case when w.biggest_challenge is not null then jsonb_build_array(w.biggest_challenge) end,
                           '[]'::jsonb),
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


-- ----------------------------------------------------------------------------
-- 4. Admin reporting — selections from the arrays; respondents vs selections;
--    explicit test-signup markers.
-- ----------------------------------------------------------------------------

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
    select x.*,
      coalesce(x.primary_goals, case when x.primary_goal is not null then array[x.primary_goal] end) as goals_all,
      coalesce(x.challenges, case when x.biggest_challenge is not null then array[x.biggest_challenge] end) as challenges_all
    from public.waitlist_signups x
    where x.created_at >= p_from and x.created_at < p_to and not app.is_test_signup(x.email, x.source)
  ),
  days as (
    select d::date as day
    from generate_series(date_trunc('day', p_from), date_trunc('day', p_to - interval '1 microsecond'), interval '1 day') d
  )
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'signups', (select count(*) from w),
      'all_time_signups', (select count(*) from public.waitlist_signups x where not app.is_test_signup(x.email, x.source)),
      'survey_started', (select count(*) from w where survey_started_at is not null or survey_completed_at is not null),
      'survey_completed', (select count(*) from w where survey_completed_at is not null),
      'with_phone', (select count(*) from w where phone is not null),
      'goal_respondents', (select count(*) from w where goals_all is not null),
      'goal_selections', (select coalesce(sum(cardinality(goals_all)), 0) from w),
      'challenge_respondents', (select count(*) from w where challenges_all is not null),
      'challenge_selections', (select coalesce(sum(cardinality(challenges_all)), 0) from w),
      'test_records_excluded', (
        select count(*) from public.waitlist_signups x
        where x.created_at >= p_from and x.created_at < p_to and app.is_test_signup(x.email, x.source)
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
      from (select g::text k, count(*) n from w, unnest(w.goals_all) as g group by 1) t), '[]'::jsonb),
    'challenge', coalesce((select jsonb_agg(jsonb_build_object('value', k, 'count', n) order by n desc)
      from (select c::text k, count(*) n from w, unnest(w.challenges_all) as c group by 1) t), '[]'::jsonb),
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
    where w.created_at >= p_from and w.created_at < p_to and not app.is_test_signup(w.email, w.source)
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
        where w.created_at >= p_from and w.created_at < p_to and app.is_test_signup(w.email, w.source)
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


commit;
