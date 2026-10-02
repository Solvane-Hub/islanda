import type { Enums, Tables } from '@/types/database';

/**
 * Business Case — the thin, generic correlation primitive (P7.1).
 *
 * Deliberately minimal: an objective, an owner, an optional future advisor, and
 * a review-lifecycle status. It does NOT model questions, requirements,
 * documents, evidence, recommendations or actions as columns or child tables —
 * those either already have a home (`BusinessGoal`, `BusinessDocument`) or are
 * an explicit future product decision this primitive does not make. See
 * `docs/decisions/ADR-0021-institutional-access-extension-point.md` and
 * `docs/architecture/business-intelligence-core.md`.
 *
 * `advisor_id` grants no access by itself. Ownership/visibility is resolved
 * entirely through `business_id` via `app.business_access()`, unchanged by
 * this table — a case is a correlation object attached to a business, not a
 * new permission boundary.
 */
export type BusinessCase = Tables<'business_cases'>;
export type BusinessCaseStatus = Enums<'business_case_status'>;
