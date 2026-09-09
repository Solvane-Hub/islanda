-- ============================================================================
-- FoundryAI · Post-competition · Business Intelligence Core (P2)
-- Migration: 20260908000000_business_intelligence_core
--
-- Scope:   The durable spine for FoundryAI understanding a business over its
--          lifecycle — records, financial performance, and goals. PURELY
--          ADDITIVE: new enums + four new tables. Nothing existing is altered,
--          so the frozen competition deployment is unaffected.
--
-- What this establishes (and, deliberately, what it does not):
--   • business_financial_periods — arbitrary reporting periods (month/quarter/
--     year/custom), NOT quarterly-only.
--   • business_documents        — the secure vault foundation. A row references
--     a stored object; this migration does NOT provision storage or claim any
--     document has been read (extraction_status starts not_started).
--   • business_metrics          — structured performance values, each with
--     provenance and an optional link to the document it was extracted from.
--   • business_goals            — what the business is trying to achieve.
--
--   Plans, insights, milestones, actions, services and website assets are
--   intentionally NOT persisted here — they are the next layers up and are
--   documented as future work. Goals carry a stable id so a plan can attach
--   later with an additive migration and no rewrite.
--
-- Provenance & honesty (reuses P0 enums `fact_provenance`, `verification_state`):
--   Every fact records where it came from — founder_provided, user_document
--   (extracted from an uploaded record), external_public_data, evidence_verified
--   or ai_inferred. A value can only be `verified` when its provenance is an
--   external/evidence source; a CHECK makes founder- or AI-sourced "verified"
--   impossible until a real verification mechanism exists (product §2, §11).
--
-- Security (ADR-0009): every table ENABLE + FORCE RLS, one policy per operation,
--   TO authenticated, ownership via app.business_access(), NO DELETE policy.
--   Cross-business integrity is enforced by composite foreign keys, so a metric
--   or document can only reference a period/document of the SAME business.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. ENUMERATED TYPES
-- ----------------------------------------------------------------------------

create type public.financial_period_type as enum ('month', 'quarter', 'year', 'custom');

create type public.business_document_type as enum (
  'financial_statement',
  'profit_loss',
  'sales_report',
  'tax_document',
  'invoice',
  'expense_report',
  'bank_statement',
  'payroll_report',
  'inventory_report',
  'registration',
  'licence',
  'certificate',
  'other'
);

-- The lifecycle of the stored file itself.
create type public.document_processing_status as enum (
  'pending',    -- row created, no object stored yet
  'stored',     -- object is in secure storage
  'processing', -- being processed (e.g. queued for extraction)
  'processed',  -- processing complete
  'failed'
);

-- Whether structured facts have been extracted from the document. Starts
-- `not_started` — a document is NEVER presented as understood until this says so.
create type public.document_extraction_status as enum (
  'not_started',
  'pending',
  'extracted',
  'failed',
  'unavailable'
);

-- Core performance metrics. `other` + a label keeps it extensible without a
-- migration per bespoke metric; the enum keeps the common keys stable for
-- trend/aggregation. New shared keys are added with ALTER TYPE ADD VALUE.
create type public.business_metric_key as enum (
  'revenue',
  'expenses',
  'net_profit',
  'gross_margin',
  'cash_flow',
  'sales_count',
  'customer_count',
  'other'
);

create type public.business_goal_type as enum (
  'revenue_target',
  'launch_product',
  'open_location',
  'hire',
  'expand_market',
  'improve_profitability',
  'increase_sales',
  'obtain_licence',
  'other'
);

create type public.business_goal_status as enum (
  'proposed',
  'active',
  'achieved',
  'on_hold',
  'abandoned'
);


-- ----------------------------------------------------------------------------
-- 2. BUSINESS FINANCIAL PERIODS — arbitrary reporting periods
-- ----------------------------------------------------------------------------

create table public.business_financial_periods (
  id           uuid                          primary key default gen_random_uuid(),
  business_id  uuid                          not null references public.businesses (id) on delete cascade,
  period_type  public.financial_period_type not null,
  period_start date                          not null,
  period_end   date                          not null,
  label        text,
  created_at   timestamptz                   not null default now(),
  updated_at   timestamptz                   not null default now(),

  constraint bfp_period_order check (period_end >= period_start),
  constraint bfp_label_length check (label is null or char_length(btrim(label)) between 1 and 60),
  -- One canonical definition of a given period per business.
  constraint bfp_unique_period unique (business_id, period_type, period_start, period_end),
  -- Target for the composite foreign keys below (same-business integrity).
  constraint bfp_business_id_unique unique (business_id, id)
);

comment on table public.business_financial_periods is
  'A reporting period for a business (month/quarter/year/custom), defined by start+end dates. Not quarterly-only. Metrics and documents attach to it.';

create trigger business_financial_periods_set_updated_at
  before update on public.business_financial_periods
  for each row execute function app.set_updated_at();

create index business_financial_periods_business_id_idx
  on public.business_financial_periods (business_id, period_start desc);


-- ----------------------------------------------------------------------------
-- 3. BUSINESS DOCUMENTS — the secure vault foundation
-- ----------------------------------------------------------------------------

create table public.business_documents (
  id                  uuid                              primary key default gen_random_uuid(),
  business_id         uuid                              not null references public.businesses (id) on delete cascade,
  document_type       public.business_document_type     not null,
  title               text                              not null,
  financial_period_id uuid,
  document_date       date,
  expiration_date     date,
  -- Reference to the object in secure storage. Null until a file is attached —
  -- this migration establishes the record, not the storage bucket.
  storage_path        text,
  content_type        text,
  byte_size           bigint,
  provenance          public.fact_provenance            not null default 'founder_provided',
  processing_status   public.document_processing_status not null default 'pending',
  extraction_status   public.document_extraction_status not null default 'not_started',
  verification_state  public.verification_state         not null default 'unverified',
  metadata            jsonb                             not null default '{}'::jsonb,
  created_at          timestamptz                       not null default now(),
  updated_at          timestamptz                       not null default now(),

  constraint bd_title_length check (char_length(btrim(title)) between 1 and 200),
  constraint bd_storage_path_length check (storage_path is null or char_length(storage_path) <= 1024),
  constraint bd_content_type_length check (content_type is null or char_length(content_type) <= 255),
  constraint bd_byte_size_non_negative check (byte_size is null or byte_size >= 0),
  constraint bd_metadata_is_object check (jsonb_typeof(metadata) = 'object'),
  -- Honesty: a founder- or AI-sourced document record is never "verified".
  constraint bd_no_unfounded_verification
    check (verification_state <> 'verified'
           or provenance in ('evidence_verified', 'external_public_data')),
  -- Same-business integrity: a document can only sit in this business's period.
  constraint bd_period_same_business
    foreign key (business_id, financial_period_id)
    references public.business_financial_periods (business_id, id) on delete set null,
  -- Target for metrics.source_document_id composite FK.
  constraint bd_business_id_unique unique (business_id, id)
);

comment on table public.business_documents is
  'Secure business document vault (financial statements, tax docs, licences, etc.). A row references a stored object; extraction_status starts not_started — a document is never treated as understood until extraction actually runs. Ownership is per-business (RLS); documents never cross business boundaries.';
comment on column public.business_documents.storage_path is
  'Reference to the object in secure storage. Never the file contents, never a public URL.';

create trigger business_documents_set_updated_at
  before update on public.business_documents
  for each row execute function app.set_updated_at();

create index business_documents_business_id_idx
  on public.business_documents (business_id, created_at desc);
create index business_documents_type_idx
  on public.business_documents (business_id, document_type);
create index business_documents_period_idx
  on public.business_documents (financial_period_id)
  where financial_period_id is not null;


-- ----------------------------------------------------------------------------
-- 4. BUSINESS METRICS — structured performance values with provenance
-- ----------------------------------------------------------------------------

create table public.business_metrics (
  id                  uuid                       primary key default gen_random_uuid(),
  business_id         uuid                       not null references public.businesses (id) on delete cascade,
  financial_period_id uuid,
  -- The document this value was extracted from, when document-derived.
  source_document_id  uuid,
  metric_key          public.business_metric_key not null,
  label               text,
  value               numeric(18, 2)             not null,
  currency            char(3),
  unit                text,
  as_of_date          date,
  provenance          public.fact_provenance     not null default 'founder_provided',
  verification_state  public.verification_state  not null default 'unverified',
  created_at          timestamptz                not null default now(),
  updated_at          timestamptz                not null default now(),

  constraint bm_currency_format check (currency is null or currency ~ '^[A-Z]{3}$'),
  constraint bm_label_length check (label is null or char_length(btrim(label)) between 1 and 80),
  constraint bm_unit_length check (unit is null or char_length(btrim(unit)) between 1 and 40),
  -- A custom metric must name itself.
  constraint bm_other_requires_label check (metric_key <> 'other' or label is not null),
  constraint bm_no_unfounded_verification
    check (verification_state <> 'verified'
           or provenance in ('evidence_verified', 'external_public_data')),
  constraint bm_period_same_business
    foreign key (business_id, financial_period_id)
    references public.business_financial_periods (business_id, id) on delete set null,
  constraint bm_document_same_business
    foreign key (business_id, source_document_id)
    references public.business_documents (business_id, id) on delete set null
);

comment on table public.business_metrics is
  'A structured business performance value (revenue, expenses, profit, counts, etc.) with mandatory provenance and an optional link to the period it covers and the document it was extracted from. Prefer durable structured metrics over re-parsing prose.';

create trigger business_metrics_set_updated_at
  before update on public.business_metrics
  for each row execute function app.set_updated_at();

-- At most one value per (period, metric, provenance): a founder figure and an
-- AI estimate for the same period can coexist and be distinguished; exact
-- duplicates cannot. Only where a period is set.
create unique index business_metrics_period_key_provenance_idx
  on public.business_metrics (business_id, financial_period_id, metric_key, provenance)
  where financial_period_id is not null;

create index business_metrics_business_id_idx
  on public.business_metrics (business_id, metric_key);
create index business_metrics_period_idx
  on public.business_metrics (financial_period_id)
  where financial_period_id is not null;
create index business_metrics_source_document_idx
  on public.business_metrics (source_document_id)
  where source_document_id is not null;


-- ----------------------------------------------------------------------------
-- 5. BUSINESS GOALS — what the business is trying to achieve
-- ----------------------------------------------------------------------------

create table public.business_goals (
  id                uuid                        primary key default gen_random_uuid(),
  business_id       uuid                        not null references public.businesses (id) on delete cascade,
  goal_type         public.business_goal_type   not null,
  title             text                        not null,
  description       text,
  -- Optional link to the metric that measures this goal (e.g. revenue_target →
  -- revenue). Goal progress is DERIVED from metrics, never stored here.
  target_metric_key public.business_metric_key,
  target_value      numeric(18, 2),
  target_currency   char(3),
  target_date       date,
  status            public.business_goal_status not null default 'proposed',
  provenance        public.fact_provenance      not null default 'founder_provided',
  created_at        timestamptz                 not null default now(),
  updated_at        timestamptz                 not null default now(),

  constraint bg_title_length check (char_length(btrim(title)) between 1 and 200),
  constraint bg_description_length check (description is null or char_length(description) <= 5000),
  constraint bg_currency_format check (target_currency is null or target_currency ~ '^[A-Z]{3}$'),
  -- A currency without a value is meaningless.
  constraint bg_currency_requires_value check (target_currency is null or target_value is not null)
);

comment on table public.business_goals is
  'A business objective (revenue target, launch, hire, expand, etc.), optionally tied to a metric and target value. Progress is derived by comparing the target to recorded metrics — never stored. Goals carry a stable id so a future plan can attach without a rewrite.';

create trigger business_goals_set_updated_at
  before update on public.business_goals
  for each row execute function app.set_updated_at();

create index business_goals_business_id_idx
  on public.business_goals (business_id, status);


-- ============================================================================
-- 6. ROW LEVEL SECURITY (ADR-0009) — the fixed pattern on every table
-- ============================================================================

alter table public.business_financial_periods enable row level security;
alter table public.business_financial_periods force  row level security;
alter table public.business_documents          enable row level security;
alter table public.business_documents          force  row level security;
alter table public.business_metrics            enable row level security;
alter table public.business_metrics            force  row level security;
alter table public.business_goals              enable row level security;
alter table public.business_goals              force  row level security;

-- financial periods
create policy business_financial_periods_select_own
  on public.business_financial_periods for select to authenticated
  using (app.business_access(business_id));
create policy business_financial_periods_insert_own
  on public.business_financial_periods for insert to authenticated
  with check (app.business_access(business_id));
create policy business_financial_periods_update_own
  on public.business_financial_periods for update to authenticated
  using (app.business_access(business_id)) with check (app.business_access(business_id));

-- documents
create policy business_documents_select_own
  on public.business_documents for select to authenticated
  using (app.business_access(business_id));
create policy business_documents_insert_own
  on public.business_documents for insert to authenticated
  with check (app.business_access(business_id));
create policy business_documents_update_own
  on public.business_documents for update to authenticated
  using (app.business_access(business_id)) with check (app.business_access(business_id));

-- metrics
create policy business_metrics_select_own
  on public.business_metrics for select to authenticated
  using (app.business_access(business_id));
create policy business_metrics_insert_own
  on public.business_metrics for insert to authenticated
  with check (app.business_access(business_id));
create policy business_metrics_update_own
  on public.business_metrics for update to authenticated
  using (app.business_access(business_id)) with check (app.business_access(business_id));

-- goals
create policy business_goals_select_own
  on public.business_goals for select to authenticated
  using (app.business_access(business_id));
create policy business_goals_insert_own
  on public.business_goals for insert to authenticated
  with check (app.business_access(business_id));
create policy business_goals_update_own
  on public.business_goals for update to authenticated
  using (app.business_access(business_id)) with check (app.business_access(business_id));

-- No DELETE policy on any of the four (ADR-0009 D7): rows cascade from the
-- parent business only.


-- ============================================================================
-- 7. PRIVILEGES — grants AND policies (Security Architecture)
-- ============================================================================

revoke all on public.business_financial_periods from anon, authenticated;
revoke all on public.business_documents          from anon, authenticated;
revoke all on public.business_metrics            from anon, authenticated;
revoke all on public.business_goals              from anon, authenticated;

grant select, insert, update on public.business_financial_periods to authenticated;
grant select, insert, update on public.business_documents          to authenticated;
grant select, insert, update on public.business_metrics            to authenticated;
grant select, insert, update on public.business_goals              to authenticated;

commit;
