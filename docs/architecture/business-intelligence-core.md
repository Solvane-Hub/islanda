# Business Intelligence Core

**Version:** 1.0 · **Status:** Canonical · **Impl:** Built · **Last updated:** 2026-09-11

**Retroactive registration.** This document was written during P7.0 to satisfy
`DOCUMENT_MANIFEST.md`'s own rule — "a document not in this manifest is not
canonical" — for architecture that shipped privately, post-competition, as P2,
P3 and P4, without a standalone architecture document at the time. It is
intentionally concise: a registration record of what was built and where, not a
full specification. See the migrations and source files cited for ground truth.

## Scope

The durable spine for FoundryAI understanding a business over its lifecycle:
records, financial performance, and goals — the foundation the P5 Intelligence
Gateway and P6 Nova Financial Intelligence are built on.

## Schema (additive across three migrations)

| Migration                                       | Adds                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `20260907000000_business_object_foundation.sql` | `business_mode`, `legal_name`/`trading_name`/`business_type` on `businesses`; `business_activities`/`products_services`/`target_customers`/`operating_status` on `business_profiles`; `business_identifiers` (sensitive, isolated); enums `fact_provenance`, `verification_state`                       |
| `20260908000000_business_intelligence_core.sql` | `business_financial_periods` (arbitrary month/quarter/year/custom via start+end dates), `business_documents` (vault record; storage is separate, see below), `business_metrics` (structured, provenanced values), `business_goals` (objective + optional target metric; progress derived, never stored) |
| `20260908010000_business_documents_storage.sql` | Private Supabase Storage bucket `business-documents` + per-business RLS on `storage.objects`, keyed by the first path segment (`<business_id>/<document_id>/...`) through `app.business_access()`                                                                                                       |

Every table follows ADR-0009 exactly: enable+force RLS, one policy per
operation via `app.business_access(business_id)`, no DELETE policy. Cross-table
integrity between metrics/documents and their period/document is enforced by
composite foreign keys on `(business_id, id)`, so a metric can never reference
another business's period or document.

## Provenance

`fact_provenance` (`founder_provided` · `evidence_verified` · `ai_inferred` ·
`external_public_data` · `user_document`) and `verification_state`
(`unverified` · `verified` · `verification_unavailable`) are DB-enforced: a
CHECK constraint on `business_identifiers`, `business_documents` and
`business_metrics` makes it impossible to store a founder- or AI-sourced value
as `verified`. This is the foundation the P5 gateway's `EpistemicType` maps onto
(`lib/intelligence/context.ts::epistemicForMetric`) — one translation point, not
a parallel model.

## Services

`services/financials` (periods, metrics, `findOrCreateFinancialPeriod`),
`services/documents` (signed-upload flow, never a public URL, extraction status
starts `not_started` and is never implied otherwise), `services/goals`
(objectives + `getGoalProgress`, which derives progress from the most
authoritative recorded metric — never stored, never invented when data is
missing).

## Derivation

`lib/business-intelligence/performance.ts::buildPerformanceView` is the single
pure derivation point: net profit (revenue − expenses) and margin are computed
only when their inputs exist and a recorded value always wins over a derived
one; period-over-period revenue comparison appears only when both periods hold
data. `toNovaPerformanceContext` is the one bridge these figures cross into the
P5/P6 intelligence layer (`docs/architecture/intelligence-gateway.md`).

## What this document does not cover

Command-centre UI composition, the Nova financial-answering flow, and the
Intelligence Gateway itself are covered in
`docs/architecture/intelligence-gateway.md`. Institutional/advisor access and
the `business_cases` primitive are covered in
`docs/decisions/ADR-0021-institutional-access-extension-point.md`.
