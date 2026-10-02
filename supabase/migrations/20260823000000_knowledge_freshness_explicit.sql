-- Knowledge source freshness must be stated, never defaulted.
--
-- `knowledge_sources.freshness_state` was declared `not null default 'current'`
-- in 20260808120000_knowledge_foundation.sql, and no application code has ever
-- written it. Every source ingested to date would therefore assert that it is
-- current regardless of the truth.
--
-- The Bahamas discovery pass (docs/knowledge/bahamas-vat-source-manifest.md)
-- proved that assertion false for the first real corpus:
--
--   * the Value Added Tax Act reprint is consolidated as at 2024-07-01 and is
--     amended by three later Acts — it is `changed_pending_assessment`, not
--     `current`;
--   * the Data Protection Act, 2025 (No. 74 of 2025) is enacted but has an
--     appointed-day commencement that has not been appointed — it is
--     `changed_pending_assessment`, not `current`.
--
-- A source whose status has not been established must not silently claim to be
-- current. Dropping the default makes the database refuse an insert that does
-- not state a freshness state, so the guarantee holds even if an application
-- path forgets. The application layer enforces the same rule (K2), and this is
-- the second line — consistent with the platform's fail-closed posture for trust
-- (Trust Layer §4.5), which is deliberately the opposite of audit logging
-- (ADR-0012).
--
-- Schema-only. No DML, no data cleanup (Engineering Standards).
-- The column remains `not null`; existing rows are untouched.

alter table public.knowledge_sources
  alter column freshness_state drop default;

comment on column public.knowledge_sources.freshness_state is
  'K6 §2A.4 freshness. MANDATORY and explicit — there is deliberately no default. '
  'A source whose current legal status has not been established must never assert '
  '`current`. Freshness is NOT a fifth trust dimension (ADR-0015).';
