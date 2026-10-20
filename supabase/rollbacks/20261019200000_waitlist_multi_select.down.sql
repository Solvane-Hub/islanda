-- ROLLBACK for 20261019200000_waitlist_multi_select — NOT a migration; run only if approved.
-- Restores the four functions to the definitions production ran before the migration
-- (md5 of each pg_get_functiondef verified identical to production on 2026-10-20),
-- removes the multi-select constraints and helpers, and KEEPS the primary_goals /
-- challenges columns and every answer in them. The single-answer columns were kept
-- in step throughout, so the previous release reads correct data immediately.
-- Function privileges are unchanged by CREATE OR REPLACE.
begin;

CREATE OR REPLACE FUNCTION public.admin_waitlist_insights(p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.admin_web_analytics(p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.get_waitlist_survey(p_token text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.save_waitlist_survey(p_token text, p_answers jsonb, p_final boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

comment on function public.save_waitlist_survey(text, jsonb, boolean) is 'Public, token-gated partial save of the waitlist questionnaire. Writes only the keys present in p_answers. Never touches contact, status or recruitment columns.';

alter table public.waitlist_signups
  drop constraint if exists ws_primary_goals_shape,
  drop constraint if exists ws_primary_goals_exclusive,
  drop constraint if exists ws_challenges_shape,
  drop constraint if exists ws_challenges_exclusive;
-- ws_goal_other_only_for_other / ws_challenge_other_only_for_other stay in their
-- relaxed form: it accepts every row the previous code can write, and also rows
-- written while multi-select was live (an "Other" that is not the first choice).

drop function if exists app.array_has_no_duplicates(anyarray);
-- app.is_test_signup is no longer referenced once the functions above are restored.
drop function if exists app.is_test_signup(text, text);

commit;
