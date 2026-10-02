-- ============================================================================
-- FoundryAI · Post-competition · P7.0 — ai_usage RLS hardening
-- Migration: 20260911000000_ai_usage_force_rls
--
-- P7 audit finding: `ai_usage` (P5, migration 20260909000000_ai_usage.sql) was
-- created with RLS ENABLED but not FORCED, unlike its sibling append-only,
-- zero-policy table `audit_log`, which forces it. With zero policies, the
-- `authenticated` and `anon` roles are already fully denied regardless of
-- FORCE — that behaviour does not change. FORCE additionally closes the one
-- remaining gap: an ordinary (non-BYPASSRLS) table-owner connection would
-- otherwise still see rows. This brings `ai_usage` into line with the
-- established pattern (ADR-0009) for defense-in-depth, at zero behavioural
-- cost to the application.
-- ============================================================================

alter table public.ai_usage force row level security;
