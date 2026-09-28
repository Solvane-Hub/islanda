import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { BusinessMode } from '@/types/business';
import { getBusinessObject } from '@/services/business';
import { toNovaBusinessFacts, type NovaBusinessFacts } from '@/services/nova/business-awareness';

/**
 * The shared business context contract (P7 Milestone 1).
 *
 * `toNovaBusinessFacts` is the existing pure derivation both Regulatory Nova
 * (P1) and Financial Nova (P6) already relied on before this file existed —
 * that shared vocabulary is not new here. What was missing was one canonical
 * *fetch*: P1 and P6 each combined a different set of service calls to reach
 * the same underlying `business`/`profile` rows before calling it.
 *
 * `BusinessFacts` extends `NovaBusinessFacts` with nothing beyond
 * `countryCode` — a raw column already on `businesses`, added because
 * "jurisdiction" is a foundational fact. Resolving that code into a
 * human-readable jurisdiction *name* stays a P6-specific enrichment step
 * (it requires a join against `countries` that P1 has never needed), exactly
 * as it does today.
 *
 * This file intentionally carries no financial, goal, evidence or document
 * data — see ADR-0022 and the P8 evidence tables for that. Adding a field
 * here is a decision about what EVERY Nova pathway sees, not a place to
 * dump whatever one caller happens to want next.
 */
export interface BusinessFacts extends NovaBusinessFacts {
  /** Raw `businesses.country_code`. Not a display name — see file doc comment. */
  countryCode: string | null;
  /** Raw `businesses.business_mode` — which front door created the business. */
  businessMode: BusinessMode;
}

/**
 * Fetches and derives the shared business facts for one business.
 *
 * Built on `getBusinessObject`, the same RLS-scoped read both pathways can
 * already reach: `null` means "not found or not accessible to the caller",
 * matching that function's existing not-found/not-owned semantics exactly.
 * `identifiers` are fetched by `getBusinessObject` (other callers need them)
 * but never touch `BusinessFacts` — the exclusion is structural, not filtered.
 */
export async function assembleBusinessFacts(
  db: SupabaseClient<Database>,
  businessId: string,
): Promise<BusinessFacts | null> {
  const object = await getBusinessObject(db, businessId);
  if (!object) return null;

  return {
    ...toNovaBusinessFacts(object.business, object.profile),
    countryCode: object.business.country_code,
    businessMode: object.business.business_mode,
  };
}
