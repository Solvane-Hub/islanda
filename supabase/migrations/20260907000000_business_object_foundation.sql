-- ============================================================================
-- FoundryAI · Post-competition · The Business Object — Foundation
-- Migration: 20260907000000_business_object_foundation
--
-- Scope:   Establishes the canonical FoundryAI Business Object that every future
--          capability attaches to. PURELY ADDITIVE — new enums, new nullable
--          columns (with safe defaults), and one new table. Nothing existing is
--          altered or dropped, so the frozen competition deployment (which reads
--          only the pre-existing columns) is unaffected.
--
-- Governing decisions:
--   ADR-0006 (tenancy) · ADR-0009 (RLS policy pattern) · schema-design.md D3–D14
--   Product direction: "Bring your business into FoundryAI" (Build + Manage),
--   provenance is first-class, sensitive identifiers are isolated.
--
-- Design notes:
--   • business_mode gives one Business Object two front doors (Build vs Manage)
--     without forking the data model.
--   • Non-sensitive identity (legal/trading name, business type) sits on
--     `businesses`. SENSITIVE identifiers (tax id, registration numbers) get
--     their OWN table so access, provenance and verification are per-fact.
--   • Provenance is a typed enum, never a free-text string, so the four/five
--     origin categories can never silently blend (product §2).
--   • Nothing here can mark a founder-supplied identifier "verified": a CHECK
--     constraint forbids it until an evidence/registry mechanism actually exists
--     (product §2, §6). We do not pretend to verify what we cannot.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. ENUMERATED TYPES
-- ----------------------------------------------------------------------------

-- Which front door created (and frames) this business. Both converge on the
-- same Business Object; this only shapes onboarding and the command centre.
create type public.business_mode as enum ('build', 'manage');

-- The origin of a business fact. These categories MUST NOT silently blend
-- (product §2). `evidence_verified` and `external_public_data` are the only
-- origins that could ever justify a "verified" state — and neither has a
-- mechanism yet, so today everything a founder enters is `founder_provided`.
create type public.fact_provenance as enum (
  'founder_provided',      -- entered by the business owner
  'evidence_verified',     -- established from authoritative evidence (future)
  'ai_inferred',           -- produced by the intelligence layer (future)
  'external_public_data',  -- retrieved from a public registry/source (future)
  'user_document'          -- extracted from a document the business uploaded (future)
);

-- The verification lifecycle of a fact. `verification_unavailable` is an honest
-- first-class state: it says "no mechanism exists to check this", which is the
-- truth for every identifier today and must never be shown as "verified".
create type public.verification_state as enum (
  'unverified',
  'verified',
  'verification_unavailable'
);

-- Government/business identifiers we may hold for an existing business. Text
-- rather than a rigid list would lose the ability to say WHICH identifier is
-- sensitive; an enum keeps the vocabulary reviewable and jurisdiction-neutral.
create type public.business_identifier_type as enum (
  'company_registration_number',
  'business_licence_number',
  'tax_identification_number',
  'vat_registration_number',
  'nib_employer_number',
  'other'
);


-- ----------------------------------------------------------------------------
-- 2. BUSINESSES — mode + non-sensitive identity
--    All nullable / defaulted, so the 199 existing rows remain valid and the
--    frozen deployment's `select *` simply ignores the new columns.
-- ----------------------------------------------------------------------------

alter table public.businesses
  add column business_mode public.business_mode not null default 'build',
  add column legal_name    text,
  add column trading_name  text,
  add column business_type text;

alter table public.businesses
  add constraint businesses_legal_name_length
    check (legal_name is null or char_length(btrim(legal_name)) between 1 and 200),
  add constraint businesses_trading_name_length
    check (trading_name is null or char_length(btrim(trading_name)) between 1 and 200),
  add constraint businesses_business_type_length
    check (business_type is null or char_length(btrim(business_type)) between 1 and 120);

comment on column public.businesses.business_mode is
  'Which front door created the business (Build vs Manage). Both produce the same Business Object; this only frames onboarding and the command centre.';
comment on column public.businesses.legal_name is
  'Registered legal name of an existing business (Manage mode). Non-sensitive identity — sensitive identifiers live in business_identifiers.';
comment on column public.businesses.trading_name is
  'Trading/DBA name if different from the legal name.';
comment on column public.businesses.business_type is
  'Legal form in the founder''s words (e.g. sole proprietorship, company). Free text — the canonical taxonomy belongs to the Knowledge Pack.';


-- ----------------------------------------------------------------------------
-- 3. BUSINESS PROFILES — business definition & intent extensions
--    Descriptive, non-sensitive context that enriches Nova ranking and the
--    dashboard. Provenance for these founder-entered fields is founder_provided
--    by construction; the sensitive, verification-bearing facts are identifiers.
-- ----------------------------------------------------------------------------

alter table public.business_profiles
  add column products_services   text,
  add column target_customers    text,
  add column business_activities text,
  add column operating_status    text;

alter table public.business_profiles
  add constraint bp_products_services_length
    check (products_services is null or char_length(products_services) <= 5000),
  add constraint bp_target_customers_length
    check (target_customers is null or char_length(target_customers) <= 5000),
  add constraint bp_business_activities_length
    check (business_activities is null or char_length(business_activities) <= 5000),
  add constraint bp_operating_status_length
    check (operating_status is null or char_length(btrim(operating_status)) between 1 and 60);

comment on column public.business_profiles.business_activities is
  'What the business actually does, in the founder''s words. Fed to Nova as ranking terms only (never a jurisdiction filter). A structured business_activities table is a later evolution when the regulatory applicability layer needs it.';
comment on column public.business_profiles.operating_status is
  'Current operating status of an existing business (e.g. operating, dormant, pre-launch). Founder-provided.';


-- ----------------------------------------------------------------------------
-- 4. BUSINESS IDENTIFIERS — sensitive, 1:many (product §3)
--
--    Isolated in its own table so sensitive government identifiers (tax id,
--    registration numbers) carry their own provenance and verification state,
--    and can be handled/audited without ever traveling in the general business
--    row, in URLs, in Nova query representations, or in agent_executions.
-- ----------------------------------------------------------------------------

create table public.business_identifiers (
  id                 uuid                            primary key default gen_random_uuid(),
  business_id        uuid                            not null references public.businesses (id) on delete cascade,
  identifier_type    public.business_identifier_type not null,
  label              text,
  value              text                            not null,
  provenance         public.fact_provenance          not null default 'founder_provided',
  verification_state public.verification_state        not null default 'unverified',
  verified_at        timestamptz,
  created_at         timestamptz                     not null default now(),
  updated_at         timestamptz                     not null default now(),

  constraint bi_value_length
    check (char_length(btrim(value)) between 1 and 120),
  constraint bi_label_length
    check (label is null or char_length(btrim(label)) between 1 and 80),
  -- verified_at present exactly when the state is verified.
  constraint bi_verified_consistency
    check ((verification_state = 'verified') = (verified_at is not null)),
  -- The load-bearing honesty constraint: a founder-entered identifier can NEVER
  -- be stored as verified. Only evidence/external-registry provenance could
  -- justify it — and until such a mechanism exists, no row can reach 'verified'.
  constraint bi_no_unfounded_verification
    check (
      verification_state <> 'verified'
      or provenance in ('evidence_verified', 'external_public_data')
    )
);

comment on table public.business_identifiers is
  'Sensitive government/business identifiers for a business (tax id, registration numbers), 1:many. Isolated from the businesses row so provenance and verification are per-fact. Founder-entered values are never "verified" — see bi_no_unfounded_verification.';
comment on column public.business_identifiers.value is
  'The identifier as provided. Sensitive: never place in logs, URLs, Nova query representations, agent_executions or analytics.';
comment on column public.business_identifiers.verification_state is
  'unverified | verified | verification_unavailable. Defaults to unverified; today no verification mechanism exists, so the UI reports "verification unavailable" rather than implying a check occurred.';

create trigger business_identifiers_set_updated_at
  before update on public.business_identifiers
  for each row execute function app.set_updated_at();

-- A business holds at most one identifier of each specific type; 'other' is
-- deliberately excluded so a business may record several miscellaneous ones.
create unique index business_identifiers_business_type_key
  on public.business_identifiers (business_id, identifier_type)
  where identifier_type <> 'other';

create index business_identifiers_business_id_idx
  on public.business_identifiers (business_id);


-- ============================================================================
-- 5. ROW LEVEL SECURITY (ADR-0009) — the fixed pattern
--    ENABLE + FORCE · one policy per operation · TO authenticated ·
--    ownership via the single app.business_access() helper · NO DELETE policy.
-- ============================================================================

alter table public.business_identifiers enable row level security;
alter table public.business_identifiers force  row level security;

create policy business_identifiers_select_own
  on public.business_identifiers for select to authenticated
  using (app.business_access(business_id));

create policy business_identifiers_insert_own
  on public.business_identifiers for insert to authenticated
  with check (app.business_access(business_id));

create policy business_identifiers_update_own
  on public.business_identifiers for update to authenticated
  using (app.business_access(business_id))
  with check (app.business_access(business_id));
-- No DELETE policy: identifiers cascade from the parent business only (ADR-0009 D7).


-- ============================================================================
-- 6. PRIVILEGES — grants AND policies (Security Architecture)
-- ============================================================================

revoke all on public.business_identifiers from anon, authenticated;
grant select, insert, update on public.business_identifiers to authenticated;

commit;

-- ============================================================================
-- POST-MIGRATION VERIFICATION (run manually; automated in tests/rls/)
--
--   select relname, relrowsecurity, relforcerowsecurity
--     from pg_class where relname = 'business_identifiers';
--
--   select policyname, cmd, roles from pg_policies
--    where tablename = 'business_identifiers' order by cmd;
--
--   -- must fail (founder-provided cannot be verified):
--   insert into public.business_identifiers (business_id, identifier_type, value, verification_state)
--   values ('<some-business>', 'tax_identification_number', '123', 'verified');
-- ============================================================================
