-- Nova platform hardening: rate limiting, reproducibility, jurisdiction-safe RLS.
--
-- Closes three gaps found in the Nova v0.1 review (docs/nova-v0.1-review.md
-- §7.1, §7.2, §7.4):
--
--   • No rate limiting existed anywhere in the codebase.
--   • Knowledge RLS admitted ANY published chunk from ANY country to ANY
--     authenticated user. Jurisdiction isolation — the platform's most important
--     correctness property — lived entirely in application code.
--   • Retrieval computed the K5 §12 reproducibility inputs and then discarded
--     them, so a historical answer could not be identified, let alone replayed.
--
-- Schema-only. No DML (Engineering Standards).

-- ════════════════════════════════════════════════════════════════════════════
-- 1. RATE LIMITING
-- ════════════════════════════════════════════════════════════════════════════
--
-- Postgres-backed fixed window. No external provider: the repository has no
-- approved one, and adding a dependency for a counter would be a larger change
-- than the problem.
--
-- Zero policies, like audit_log — unreachable by the authenticated role. The
-- only path in is the SECURITY DEFINER function below, which is what makes the
-- counter tamper-proof from the client.

create table public.rate_limit_counters (
  scope         text        not null,
  subject_id    text        not null,
  window_start  timestamptz not null,
  count         integer     not null default 0,
  updated_at    timestamptz not null default now(),

  primary key (scope, subject_id, window_start),
  constraint rate_limit_count_non_negative check (count >= 0)
);

comment on table public.rate_limit_counters is
  'Fixed-window rate limit counters. Zero RLS policies by design: reachable only '
  'through public.consume_rate_limit(). Old windows are inert; a periodic sweep is '
  'a later operational concern, not a correctness one.';

alter table public.rate_limit_counters enable row level security;
alter table public.rate_limit_counters force row level security;

create index rate_limit_counters_window_idx
  on public.rate_limit_counters (window_start);

/*
 * Consume one unit against a fixed window.
 *
 * Atomic: the INSERT ... ON CONFLICT DO UPDATE is a single statement, so two
 * concurrent requests cannot both observe a count below the limit. That is the
 * whole reason this is a database function rather than a read-then-write in the
 * application.
 *
 * Increments even when over the limit. Deliberate — it records how far over an
 * abusive caller went, which a "stop counting at the limit" design discards.
 */
create or replace function public.consume_rate_limit(
  p_scope           text,
  p_subject_id      text,
  p_window_seconds  integer,
  p_limit           integer
)
returns table (
  allowed              boolean,
  current_count        integer,
  window_started_at    timestamptz,
  retry_after_seconds  integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz;
  v_count  integer;
begin
  if p_window_seconds is null or p_window_seconds <= 0 then
    raise exception 'rate limit window must be positive' using errcode = '22023';
  end if;
  if p_limit is null or p_limit <= 0 then
    raise exception 'rate limit must be positive' using errcode = '22023';
  end if;
  if p_scope is null or p_subject_id is null then
    raise exception 'rate limit scope and subject are required' using errcode = '22023';
  end if;

  v_window := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limit_counters as r (scope, subject_id, window_start, count, updated_at)
  values (p_scope, p_subject_id, v_window, 1, now())
  on conflict (scope, subject_id, window_start)
  do update set count = r.count + 1, updated_at = now()
  returning r.count into v_count;

  return query
    select
      (v_count <= p_limit),
      v_count,
      v_window,
      greatest(
        0,
        ceil(
          extract(epoch from (v_window + make_interval(secs => p_window_seconds)) - clock_timestamp())
        )::integer
      );
end;
$$;

comment on function public.consume_rate_limit is
  'Atomically consume one unit against a fixed window. Returns whether the caller is '
  'within the limit. The application FAILS CLOSED if this errors — a rate limiter that '
  'cannot be consulted must not be assumed permissive.';

revoke all on function public.consume_rate_limit(text, text, integer, integer) from public, anon;
grant execute on function public.consume_rate_limit(text, text, integer, integer) to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. AGENT EXECUTIONS — reproducibility (ADR-0016, K5 §12, document 15)
-- ════════════════════════════════════════════════════════════════════════════
--
-- ⚠ WHAT IS DELIBERATELY ABSENT: the founder's question, the retrieved legal
--   text, and the generated answer. None of them is here.
--
--   `query_representation_hash` records the IDENTITY of the query without its
--   content — enough to prove two runs used the same query, and to detect that
--   a replay diverged. It is NOT enough to re-execute a historical run, which
--   would require the text itself. Storing that text is a privacy decision that
--   has not been taken, so the column for it does not exist yet.
--
-- `retrieved_chunk_ids` holds identifiers, never text. K5 §3.8 makes the ORDERED
-- result set part of the reproducibility contract, so the order here is
-- significant.

create table public.agent_executions (
  id                        uuid        primary key default gen_random_uuid(),
  occurred_at               timestamptz not null default now(),

  business_id               uuid        not null references public.businesses (id) on delete cascade,
  -- SET NULL, not CASCADE: the execution record must survive the user it describes.
  actor_id                  uuid        references auth.users (id) on delete set null,
  correlation_id            uuid        not null,

  agent                     text        not null,
  agent_version             text        not null,
  prompt_version            text        not null,
  model_version             text        not null,

  outcome                   text        not null,
  claim_count               integer     not null default 0,
  unresolved_count          integer     not null default 0,

  -- K5 §12 replay inputs. Null together when no retrieval ran.
  knowledge_pack_id         uuid        references public.knowledge_packs (id) on delete restrict,
  knowledge_version         text,
  retrieval_config_version  text,
  ranking_config_version    text,
  query_representation_hash text,
  retrieval_filters         jsonb       not null default '{}'::jsonb,
  embedding_identity        jsonb,
  retrieved_chunk_ids       text[]      not null default '{}',

  constraint agent_executions_outcome_valid check (
    outcome in (
      'answered',
      'no_published_knowledge',
      'no_matching_evidence',
      'needs_clarification',
      'error'
    )
  ),
  constraint agent_executions_counts_non_negative check (
    claim_count >= 0 and unresolved_count >= 0
  ),
  constraint agent_executions_filters_is_object check (
    jsonb_typeof(retrieval_filters) = 'object'
  )
);

comment on table public.agent_executions is
  'One row per agent run (ADR-0016). Append-only. Holds the K5 §12 reproducibility '
  'inputs and NO founder question, retrieved text, or generated content.';

comment on column public.agent_executions.query_representation_hash is
  'SHA-256 of the query representation. Identifies a query without storing it. '
  'Sufficient to prove two runs used the same query; NOT sufficient to re-execute one.';

create index agent_executions_business_idx
  on public.agent_executions (business_id, occurred_at desc);
create index agent_executions_correlation_idx
  on public.agent_executions (correlation_id);
create index agent_executions_pack_idx
  on public.agent_executions (knowledge_pack_id)
  where knowledge_pack_id is not null;

-- Append-only, enforced by trigger so it holds against service_role too (D12).
create trigger agent_executions_no_update
  before update on public.agent_executions
  for each row execute function app.prevent_mutation();

create trigger agent_executions_no_delete
  before delete on public.agent_executions
  for each row execute function app.prevent_mutation();

alter table public.agent_executions enable row level security;
alter table public.agent_executions force row level security;

-- Readable by the owner of the business the run belongs to. Writes are
-- service-role only, matching audit_log: the founder must not be able to forge
-- or suppress a record of what the platform told them.
create policy agent_executions_read_own on public.agent_executions
  for select to authenticated
  using (app.business_access(business_id));

-- ════════════════════════════════════════════════════════════════════════════
-- 3. JURISDICTION-SAFE KNOWLEDGE RLS
-- ════════════════════════════════════════════════════════════════════════════
--
-- The previous policies admitted any published row to any authenticated user:
--
--   using (exists (select 1 from knowledge_packs p
--                  where p.id = ... and p.status = 'published'))
--
-- So jurisdiction isolation rested entirely on services/nova/retrieval.ts. That
-- is the one place in the platform where an application bug produces
-- confidently wrong regulatory guidance rather than a data leak, and it was one
-- layer deep. Everywhere else — businesses, profiles, intake — RLS is the
-- authoritative boundary precisely because it survives application bugs.
--
-- ── Access model ──────────────────────────────────────────────────────────
--
--   authenticated  → published knowledge for a country where they own a
--                    non-archived business
--   service_role   → everything (BYPASSRLS). This is the corpus-browser and
--                    reviewer path, and it already exists: admin tooling uses
--                    createAdminClient(), exactly as audit writes do. No new
--                    role table is introduced, so nothing is accidentally
--                    blocked.
--
-- ⚠ NOT enabled, and named so it is a decision rather than an oversight: a
--   founder researching EXPANSION into another jurisdiction cannot read that
--   jurisdiction's corpus. That is the correct default — cross-jurisdiction
--   reading is exactly the failure mode being defended against — and it will
--   need an explicit, reviewed grant when expansion ships.

create or replace function app.knowledge_jurisdiction_access(p_country_code char(2))
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.businesses b
    where b.owner_id = (select auth.uid())
      and b.country_code = p_country_code
      and b.status <> 'archived'
  );
$$;

comment on function app.knowledge_jurisdiction_access is
  'Does the caller own a live business in this jurisdiction? The database half of '
  'K5 §3.2 jurisdiction isolation. Mirrors app.business_access: one predicate, one '
  'body to change.';

revoke all on function app.knowledge_jurisdiction_access(char) from public, anon;
grant execute on function app.knowledge_jurisdiction_access(char) to authenticated;

drop policy if exists knowledge_packs_read_published on public.knowledge_packs;
drop policy if exists knowledge_sources_read_published on public.knowledge_sources;
drop policy if exists knowledge_chunks_read_published on public.knowledge_chunks;
drop policy if exists knowledge_chunk_relations_read_published on public.knowledge_chunk_relations;

create policy knowledge_packs_read_published_in_jurisdiction on public.knowledge_packs
  for select to authenticated
  using (
    status = 'published'
    and app.knowledge_jurisdiction_access(country_code)
  );

create policy knowledge_sources_read_published_in_jurisdiction on public.knowledge_sources
  for select to authenticated
  using (
    app.knowledge_jurisdiction_access(country_code)
    and exists (
      select 1 from public.knowledge_packs p
       where p.id = knowledge_sources.knowledge_pack_id
         and p.status = 'published'
    )
  );

create policy knowledge_chunks_read_published_in_jurisdiction on public.knowledge_chunks
  for select to authenticated
  using (
    app.knowledge_jurisdiction_access(country_code)
    and exists (
      select 1 from public.knowledge_packs p
       where p.id = knowledge_chunks.knowledge_pack_id
         and p.status = 'published'
    )
  );

-- Relations inherit the chunk's reachability: a relation to a chunk the caller
-- cannot read must not be readable either, or the graph leaks the corpus shape.
create policy knowledge_chunk_relations_read_published_in_jurisdiction
  on public.knowledge_chunk_relations
  for select to authenticated
  using (
    exists (
      select 1
        from public.knowledge_chunks c
        join public.knowledge_packs p on p.id = c.knowledge_pack_id
       where c.chunk_id = knowledge_chunk_relations.from_chunk_id
         and p.status = 'published'
         and app.knowledge_jurisdiction_access(c.country_code)
    )
  );
