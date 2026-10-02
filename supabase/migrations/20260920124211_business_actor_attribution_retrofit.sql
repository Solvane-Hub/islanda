-- ============================================================================
-- FoundryAI · Post-competition · Actor attribution retrofit
-- Migration: 20260920000000_business_actor_attribution_retrofit
--
-- Adds historical-attribution actor_id columns to three pre-existing tables
-- that predate any actor-tracking concept: business_metrics, business_goals,
-- business_documents. PURELY ADDITIVE — no existing column, index, RLS policy
-- or row is changed. Existing rows remain valid with actor_id = NULL.
--
-- This is the retrofit ADR-0022 explicitly anticipated and deferred:
-- "Adding actor_id to the pre-existing business_metrics, business_goals, and
-- business_documents tables is explicitly out of scope for this ADR's schema
-- and, if pursued, must be nullable — historical rows predate any
-- actor-tracking concept and cannot be honestly backfilled to a real user."
-- (docs/decisions/ADR-0022-generalized-evidence-linkage.md)
--
-- actor_id here identifies the founder/session whose authenticated request
-- created the row — the same role auth.users plays for the pre-existing
-- ai_usage.actor_id, agent_executions.actor_id and audit_log.actor_id
-- columns. It follows their exact convention, NOT business_evidence's:
--
--   ai_usage / agent_executions / audit_log   nullable, ON DELETE SET NULL
--     — legacy/ongoing tables where a row can predate actor tracking, or
--       must simply be allowed to outlive the user who created it.
--   business_evidence (+ its subject-link tables)   NOT NULL, ON DELETE RESTRICT
--     — brand-new tables with zero pre-existing rows, so NOT NULL cost
--       nothing; RESTRICT gives the same non-destructive guarantee within a
--       NOT NULL column.
--
-- These three tables already have rows with no actor to record, so the
-- NOT NULL/RESTRICT shape is not available without inventing a fictional
-- historical actor — which this migration deliberately does not do. Nullable
-- + SET NULL is therefore not a compromise; it is the only honest choice for
-- a retrofit onto tables with real history, and it is the exact convention
-- three other tables in this schema already use for that identical reason:
-- deleting a user's account must never delete or block deletion of the
-- business record it once helped create — the record must simply survive,
-- with its actor reference cleared.
--
-- No historical backfill is attempted. business_cases is deliberately NOT
-- part of this migration: it already carries owner_id (NOT NULL, CASCADE),
-- which is CURRENT ownership, not historical attribution (ADR-0022's own
-- migration already distinguishes the two), and it has no reachable write
-- path in the running application today. business_financial_periods has the
-- identical attribution gap but is out of scope for this milestone.
-- ============================================================================

begin;

alter table public.business_metrics
  add column actor_id uuid references auth.users (id) on delete set null;

comment on column public.business_metrics.actor_id is
  'The founder/session whose authenticated request recorded this figure. '
  'Nullable: rows predating this column, and any future row an authenticated '
  'context could not attribute, are left NULL rather than backfilled with a '
  'guessed identity. ON DELETE SET NULL, not CASCADE or RESTRICT: deleting the '
  'auth user must never delete or block deletion of the business record it '
  'once helped create — the metric survives, with its actor reference cleared. '
  'Follows ADR-0022 and the pre-existing ai_usage.actor_id / '
  'agent_executions.actor_id / audit_log.actor_id convention. Not part of '
  'tenant isolation — business_id / app.business_access() remains the sole '
  'RLS boundary for this table.';

alter table public.business_goals
  add column actor_id uuid references auth.users (id) on delete set null;

comment on column public.business_goals.actor_id is
  'The founder/session whose authenticated request created this goal. '
  'Nullable: rows predating this column, and any future row an authenticated '
  'context could not attribute, are left NULL rather than backfilled with a '
  'guessed identity. ON DELETE SET NULL, not CASCADE or RESTRICT: deleting the '
  'auth user must never delete or block deletion of the business record it '
  'once helped create — the goal survives, with its actor reference cleared. '
  'Follows ADR-0022 and the pre-existing ai_usage.actor_id / '
  'agent_executions.actor_id / audit_log.actor_id convention. Not part of '
  'tenant isolation — business_id / app.business_access() remains the sole '
  'RLS boundary for this table.';

alter table public.business_documents
  add column actor_id uuid references auth.users (id) on delete set null;

comment on column public.business_documents.actor_id is
  'The founder/session whose authenticated request created this document row. '
  'Nullable: rows predating this column, and any future row an authenticated '
  'context could not attribute, are left NULL rather than backfilled with a '
  'guessed identity. ON DELETE SET NULL, not CASCADE or RESTRICT: deleting the '
  'auth user must never delete or block deletion of the business record it '
  'once helped create — the document survives, with its actor reference '
  'cleared. Set only at creation (beginDocumentUpload / addBusinessDocument); '
  'the later finalize/update step never touches it, since actor_id records '
  'the creator, not the last modifier. Follows ADR-0022 and the pre-existing '
  'ai_usage.actor_id / agent_executions.actor_id / audit_log.actor_id '
  'convention. Not part of tenant isolation — business_id / '
  'app.business_access() remains the sole RLS boundary for this table.';

commit;
