-- ============================================================================
-- FoundryAI · Post-competition · AI usage accounting (P5)
-- Migration: 20260909000000_ai_usage
--
-- The profitability foundation for the Intelligence Gateway: one append-only row
-- per intelligence request, recording category, whether an LLM was called, the
-- provider/model/tier, token counts, estimated cost, validation outcome and
-- failure — so "Business → AI usage → estimated cost" can be answered later.
--
-- ⚠ It stores NO prompt text, NO response text, NO business content and NO
--   sensitive identifiers — only safe, minimal metadata (Security/Privacy by
--   Default, ADR-0014). Like `audit_log`, it is invisible and unwritable through
--   the API: RLS is on with ZERO policies, and it is written only by the
--   service-role client from the server. It is append-only (mutation blocked by
--   trigger), reusing app.prevent_mutation.
-- ============================================================================

begin;

create table public.ai_usage (
  id                 uuid        primary key default gen_random_uuid(),
  occurred_at        timestamptz not null default now(),
  -- SET NULL, not CASCADE: the usage record outlives the business it describes.
  business_id        uuid        references public.businesses (id) on delete set null,
  actor_id           uuid        references auth.users (id)        on delete set null,
  correlation_id     uuid,
  category           text        not null,
  determination      text        not null,
  llm_called         boolean     not null default false,
  provider           text,
  model              text,
  model_tier         text,
  model_reason       text,
  input_tokens       integer,
  output_tokens      integer,
  estimated_cost_usd numeric(12, 6),
  validation_ok      boolean,
  failed             boolean     not null default false,
  error_code         text,

  constraint ai_usage_determination_valid
    check (determination in ('deterministic', 'llm', 'premium')),
  constraint ai_usage_model_tier_valid
    check (model_tier is null or model_tier in ('nano', 'mini', 'premium')),
  constraint ai_usage_input_tokens_non_negative
    check (input_tokens is null or input_tokens >= 0),
  constraint ai_usage_output_tokens_non_negative
    check (output_tokens is null or output_tokens >= 0),
  constraint ai_usage_cost_non_negative
    check (estimated_cost_usd is null or estimated_cost_usd >= 0),
  constraint ai_usage_category_length
    check (char_length(btrim(category)) between 1 and 40)
);

comment on table public.ai_usage is
  'Append-only AI usage accounting for the Intelligence Gateway. Safe metadata only — never prompt/response text, business content or sensitive identifiers. Written by the service-role client; invisible to the API (RLS on, no policies).';

create index ai_usage_business_id_idx on public.ai_usage (business_id, occurred_at desc);
create index ai_usage_occurred_at_idx on public.ai_usage (occurred_at desc);
create index ai_usage_category_idx    on public.ai_usage (category, occurred_at desc);

-- Append-only. Holds even against service_role (BYPASSRLS), like audit_log.
create trigger ai_usage_no_update
  before update on public.ai_usage
  for each row execute function app.prevent_mutation();

create trigger ai_usage_no_delete
  before delete on public.ai_usage
  for each row execute function app.prevent_mutation();

-- RLS on, zero policies: unreachable by anon/authenticated. Written by the
-- service-role client only (like audit_log).
alter table public.ai_usage enable row level security;

revoke all on public.ai_usage from anon, authenticated;

commit;
