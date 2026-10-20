-- ============================================================================
-- FoundryAI · Post-competition · P8 — Generalized Evidence Linkage
-- Migration: 20260912010000_business_evidence_foundation
--
-- Implements ADR-0022 (docs/decisions/ADR-0022-generalized-evidence-linkage.md).
-- Introduces one canonical evidence entity (`business_evidence`, exclusive-arc
-- over document_id / knowledge_chunk_id) and four typed subject-link tables
-- (metrics, goals, cases, business regulatory requirements). PURELY ADDITIVE.
--
-- Existing narrow relationships are UNCHANGED and NOT deprecated:
--   • business_metrics.source_document_id
--   • regulatory_requirement_evidence
--
-- Prerequisite additive step: business_metrics, business_goals, business_cases
-- and business_regulatory_requirements did not previously carry a UNIQUE
-- (business_id, id) constraint (nothing referenced them via a composite
-- foreign key before now). The subject-link tables below require one,
-- following the exact precedent already established by
-- business_documents.bd_business_id_unique and
-- business_financial_periods.bfp_business_id_unique (ADR-0011). Adding it is
-- a pure, zero-risk additive constraint: `id` is already globally unique via
-- its own primary key, so (business_id, id) is trivially unique for every
-- existing row — no existing data can violate it, no existing column, RLS
-- policy or behaviour changes.
--
-- On-delete behaviour: business_evidence.document_id and .knowledge_chunk_id
-- use ON DELETE CASCADE rather than the SET NULL used by the pre-existing
-- bm_document_same_business — because business_evidence's exclusive-arc CHECK
-- requires exactly one source to remain populated at all times; SET NULL on
-- an exclusive-arc source could leave a row with zero sources, violating that
-- CHECK. CASCADE instead removes the whole (now-meaningless) evidence row,
-- consistent with how every table in this schema already cascades from its
-- "hard" parent (businesses). The four subject-link tables cascade on both
-- their evidence and subject sides for the same reason: a link with a missing
-- subject or a missing evidence item has no independent meaning.
--
-- actor_id on-delete behaviour: RESTRICT, not CASCADE. actor_id here records
-- the historical CREATOR of an evidence/link row, the same role auth.users
-- plays for the pre-existing ai_usage.actor_id and agent_executions.actor_id
-- columns — both of which use ON DELETE SET NULL specifically so deleting a
-- user account never deletes the historical record it authored. This
-- migration's actor_id is NOT NULL (ADR-0022: no legacy-row problem to
-- accommodate on brand-new tables), so SET NULL is not available without
-- reopening that decision. RESTRICT achieves the same non-destructive intent
-- within a NOT NULL column: deleting an auth.users row that authored any
-- evidence/link row is blocked outright rather than silently cascading that
-- historical evidence away. business_cases.owner_id's CASCADE is not a
-- comparable precedent — it represents CURRENT ownership of a case (an
-- account-erasure chain, matching businesses.owner_id), not a historical
-- audit-trail attribution, so it does not apply here.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. ENUMERATED TYPE
-- ----------------------------------------------------------------------------

create type public.evidence_relationship_type as enum ('supports', 'derived_from');

-- ----------------------------------------------------------------------------
-- 2. PREREQUISITE — composite-FK targets on existing subject tables
--    Purely additive: `id` is already a primary key, so (business_id, id) is
--    trivially unique for every existing row. No existing column, data, RLS
--    policy or behaviour changes.
-- ----------------------------------------------------------------------------

alter table public.business_metrics
  add constraint bm_business_id_unique unique (business_id, id);

alter table public.business_goals
  add constraint bg_business_id_unique unique (business_id, id);

alter table public.business_cases
  add constraint bc_business_id_unique unique (business_id, id);

alter table public.business_regulatory_requirements
  add constraint business_regulatory_requirements_business_id_unique unique (business_id, id);

-- ----------------------------------------------------------------------------
-- 3. BUSINESS_EVIDENCE — the canonical evidence entity (ADR-0022)
-- ----------------------------------------------------------------------------

create table public.business_evidence (
  id                  uuid                       primary key default gen_random_uuid(),
  business_id         uuid                       not null references public.businesses (id) on delete cascade,
  document_id         uuid,
  knowledge_chunk_id  uuid                       references public.knowledge_chunks (chunk_id) on delete cascade,
  provenance          public.fact_provenance     not null,
  verification_state  public.verification_state  not null default 'unverified',
  retracted_at        timestamptz,
  actor_id            uuid                       not null references auth.users (id) on delete restrict,
  created_at          timestamptz                not null default now(),

  -- Exclusive arc: exactly one source, never zero, never both.
  constraint be_exactly_one_source check (
    (document_id is not null)::int + (knowledge_chunk_id is not null)::int = 1
  ),
  -- Same-business integrity: a business can only cite its own documents.
  -- (No equivalent constraint for knowledge_chunk_id — knowledge is global;
  -- access to a chunk is governed by the existing jurisdiction-scoped
  -- knowledge RLS, not by business ownership.)
  constraint be_document_same_business
    foreign key (business_id, document_id)
    references public.business_documents (business_id, id) on delete cascade,
  -- Target for the subject-link tables' composite foreign keys below.
  constraint be_business_id_unique unique (business_id, id)
);

comment on table public.business_evidence is
  'Generalized evidence primitive (ADR-0022). Exactly one source per row: a business-owned document, or a global knowledge chunk. Provenance/verification reuse the existing fact_provenance/verification_state vocabulary. Never deleted (no DELETE policy); removed by retracted_at. Existing narrow relationships (business_metrics.source_document_id, regulatory_requirement_evidence) are unaffected and not deprecated.';
comment on column public.business_evidence.business_id is
  'Whose evidence-usage this is — not necessarily who owns the underlying source (a knowledge_chunk is global, not business-owned).';
comment on column public.business_evidence.retracted_at is
  'Soft removal. Evidence rows are never deleted (ADR-0009); a retracted item is marked, not erased.';

create index business_evidence_document_idx
  on public.business_evidence (document_id)
  where document_id is not null;

create index business_evidence_knowledge_chunk_idx
  on public.business_evidence (knowledge_chunk_id)
  where knowledge_chunk_id is not null;

-- ----------------------------------------------------------------------------
-- 4. TYPED SUBJECT-LINK TABLES (ADR-0022)
--    One per subject domain in P8's scope. Immutable at the RLS layer: insert
--    and select only, no update, no delete — a changed relationship is a new
--    row, not a mutation, which incidentally leaves a free ordered history.
-- ----------------------------------------------------------------------------

create table public.business_evidence_for_metrics (
  id           uuid                              primary key default gen_random_uuid(),
  business_id  uuid                              not null references public.businesses (id) on delete cascade,
  evidence_id  uuid                              not null,
  metric_id    uuid                              not null,
  relationship public.evidence_relationship_type not null,
  actor_id     uuid                              not null references auth.users (id) on delete restrict,
  created_at   timestamptz                       not null default now(),

  constraint befm_evidence_same_business
    foreign key (business_id, evidence_id)
    references public.business_evidence (business_id, id) on delete cascade,
  constraint befm_metric_same_business
    foreign key (business_id, metric_id)
    references public.business_metrics (business_id, id) on delete cascade
);

comment on table public.business_evidence_for_metrics is
  'Links a business_evidence row to a business_metrics row it supports or was derived from (ADR-0022). Both composite foreign keys share this row''s single business_id column, making cross-business linkage unrepresentable. Immutable: no UPDATE, no DELETE.';

create index business_evidence_for_metrics_evidence_idx
  on public.business_evidence_for_metrics (business_id, evidence_id);
create index business_evidence_for_metrics_metric_idx
  on public.business_evidence_for_metrics (business_id, metric_id);


create table public.business_evidence_for_goals (
  id           uuid                              primary key default gen_random_uuid(),
  business_id  uuid                              not null references public.businesses (id) on delete cascade,
  evidence_id  uuid                              not null,
  goal_id      uuid                              not null,
  relationship public.evidence_relationship_type not null,
  actor_id     uuid                              not null references auth.users (id) on delete restrict,
  created_at   timestamptz                       not null default now(),

  constraint befg_evidence_same_business
    foreign key (business_id, evidence_id)
    references public.business_evidence (business_id, id) on delete cascade,
  constraint befg_goal_same_business
    foreign key (business_id, goal_id)
    references public.business_goals (business_id, id) on delete cascade
);

comment on table public.business_evidence_for_goals is
  'Links a business_evidence row to a business_goals row it supports or was derived from (ADR-0022). Immutable: no UPDATE, no DELETE.';

create index business_evidence_for_goals_evidence_idx
  on public.business_evidence_for_goals (business_id, evidence_id);
create index business_evidence_for_goals_goal_idx
  on public.business_evidence_for_goals (business_id, goal_id);


create table public.business_evidence_for_cases (
  id           uuid                              primary key default gen_random_uuid(),
  business_id  uuid                              not null references public.businesses (id) on delete cascade,
  evidence_id  uuid                              not null,
  case_id      uuid                              not null,
  relationship public.evidence_relationship_type not null,
  actor_id     uuid                              not null references auth.users (id) on delete restrict,
  created_at   timestamptz                       not null default now(),

  constraint befc_evidence_same_business
    foreign key (business_id, evidence_id)
    references public.business_evidence (business_id, id) on delete cascade,
  constraint befc_case_same_business
    foreign key (business_id, case_id)
    references public.business_cases (business_id, id) on delete cascade
);

comment on table public.business_evidence_for_cases is
  'Links a business_evidence row to a business_cases row it supports or was derived from (ADR-0022). Immutable: no UPDATE, no DELETE.';

create index business_evidence_for_cases_evidence_idx
  on public.business_evidence_for_cases (business_id, evidence_id);
create index business_evidence_for_cases_case_idx
  on public.business_evidence_for_cases (business_id, case_id);


create table public.business_evidence_for_requirements (
  id                                 uuid                              primary key default gen_random_uuid(),
  business_id                        uuid                              not null references public.businesses (id) on delete cascade,
  evidence_id                        uuid                              not null,
  business_regulatory_requirement_id uuid                              not null,
  relationship                       public.evidence_relationship_type not null,
  actor_id                           uuid                              not null references auth.users (id) on delete restrict,
  created_at                         timestamptz                       not null default now(),

  constraint befr_evidence_same_business
    foreign key (business_id, evidence_id)
    references public.business_evidence (business_id, id) on delete cascade,
  constraint befr_requirement_same_business
    foreign key (business_id, business_regulatory_requirement_id)
    references public.business_regulatory_requirements (business_id, id) on delete cascade
);

comment on table public.business_evidence_for_requirements is
  'Links a business_evidence row to a business_regulatory_requirements row (the business''s own per-business compliance state) it supports or was derived from (ADR-0022). Distinct from regulatory_requirement_evidence, which substantiates a GLOBAL requirement''s existence in law against the knowledge corpus at authoring time — this table records a business''s OWN evidence toward ITS OWN obligation. Immutable: no UPDATE, no DELETE.';

create index business_evidence_for_requirements_evidence_idx
  on public.business_evidence_for_requirements (business_id, evidence_id);
create index business_evidence_for_requirements_requirement_idx
  on public.business_evidence_for_requirements (business_id, business_regulatory_requirement_id);


-- ============================================================================
-- 5. ROW LEVEL SECURITY (ADR-0009) — the fixed pattern on every new table
-- ============================================================================

alter table public.business_evidence                  enable row level security;
alter table public.business_evidence                  force  row level security;
alter table public.business_evidence_for_metrics       enable row level security;
alter table public.business_evidence_for_metrics       force  row level security;
alter table public.business_evidence_for_goals         enable row level security;
alter table public.business_evidence_for_goals         force  row level security;
alter table public.business_evidence_for_cases         enable row level security;
alter table public.business_evidence_for_cases         force  row level security;
alter table public.business_evidence_for_requirements  enable row level security;
alter table public.business_evidence_for_requirements  force  row level security;

-- business_evidence: select/insert/update (verification_state, retracted_at
-- may evolve); no delete.
create policy business_evidence_select_own
  on public.business_evidence for select to authenticated
  using (app.business_access(business_id));
create policy business_evidence_insert_own
  on public.business_evidence for insert to authenticated
  with check (app.business_access(business_id));
create policy business_evidence_update_own
  on public.business_evidence for update to authenticated
  using (app.business_access(business_id)) with check (app.business_access(business_id));

-- subject-link tables: select/insert only; immutable at the RLS layer.
create policy business_evidence_for_metrics_select_own
  on public.business_evidence_for_metrics for select to authenticated
  using (app.business_access(business_id));
create policy business_evidence_for_metrics_insert_own
  on public.business_evidence_for_metrics for insert to authenticated
  with check (app.business_access(business_id));

create policy business_evidence_for_goals_select_own
  on public.business_evidence_for_goals for select to authenticated
  using (app.business_access(business_id));
create policy business_evidence_for_goals_insert_own
  on public.business_evidence_for_goals for insert to authenticated
  with check (app.business_access(business_id));

create policy business_evidence_for_cases_select_own
  on public.business_evidence_for_cases for select to authenticated
  using (app.business_access(business_id));
create policy business_evidence_for_cases_insert_own
  on public.business_evidence_for_cases for insert to authenticated
  with check (app.business_access(business_id));

create policy business_evidence_for_requirements_select_own
  on public.business_evidence_for_requirements for select to authenticated
  using (app.business_access(business_id));
create policy business_evidence_for_requirements_insert_own
  on public.business_evidence_for_requirements for insert to authenticated
  with check (app.business_access(business_id));

-- No DELETE policy anywhere above (ADR-0009 D7). No UPDATE policy on any
-- subject-link table (ADR-0022 immutability).


-- ============================================================================
-- 6. PRIVILEGES — grants AND policies (Security Architecture)
-- ============================================================================

revoke all on public.business_evidence                 from anon, authenticated;
revoke all on public.business_evidence_for_metrics      from anon, authenticated;
revoke all on public.business_evidence_for_goals        from anon, authenticated;
revoke all on public.business_evidence_for_cases        from anon, authenticated;
revoke all on public.business_evidence_for_requirements from anon, authenticated;

grant select, insert, update on public.business_evidence                 to authenticated;
grant select, insert         on public.business_evidence_for_metrics      to authenticated;
grant select, insert         on public.business_evidence_for_goals        to authenticated;
grant select, insert         on public.business_evidence_for_cases        to authenticated;
grant select, insert         on public.business_evidence_for_requirements to authenticated;

commit;
