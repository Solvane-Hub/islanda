import type { Business, BusinessProfile } from '@/types/business';
import type { RetrievalContext } from '@/lib/ai/retrieval/contract';

/**
 * Nova retrieval context — K5 §5.
 *
 * "Retrieval never runs without an established context." This module is where a
 * business record becomes that context, and it is deliberately a pure function:
 * the rules about what may and may not be inferred are the whole point, and they
 * should be testable without a database.
 *
 * ⚠ **Jurisdiction is mandatory and never inferred (K5 §3.2).** It comes from
 *   `businesses.country_code`, which the founder set explicitly when the
 *   business was created. Nothing here guesses a country from free text.
 */

export class NovaContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NovaContextError';
  }
}

export interface NovaContext {
  businessId: string;
  retrieval: RetrievalContext;
}

/**
 * Build the retrieval context for a business.
 *
 * ⚠ `region` and `municipality` are deliberately left null even though
 * `business_profiles.location` often holds something like "Nassau".
 *
 * That field is free text a founder typed. Promoting it to a jurisdiction
 * component would be exactly the inference K5 §3.2 forbids, and it is the
 * mechanism by which "Nassau" becomes Nassau County, New York. A sub-national
 * jurisdiction may only be set from a resolved, canonical value — which the
 * platform does not yet collect. Until it does, retrieval stays scoped to the
 * country, which is over-broad but never wrong.
 *
 * `location` is still used, as a **query term**, where free text is harmless.
 */
export function buildNovaContext(
  business: Pick<Business, 'id' | 'country_code' | 'industry'>,
  /**
   * Accepted and deliberately unused — see the note above. The parameter stays
   * in the signature so that a future contributor reaching for `location` finds
   * the reason it is not read, rather than adding it.
   */
  _profile: Pick<BusinessProfile, 'location'> | null,
  options: { regulatoryDomains?: readonly string[] } = {},
): NovaContext {
  if (!business.country_code) {
    throw new NovaContextError(
      'K5 §3.2: a business has no country_code. Jurisdiction is mandatory and must never be ' +
        'inferred, so retrieval cannot run.',
    );
  }

  return {
    businessId: business.id,
    retrieval: {
      countryCode: business.country_code,
      region: null,
      municipality: null,
      industry: business.industry,
      ...(options.regulatoryDomains ? { regulatoryDomains: options.regulatoryDomains } : {}),
    },
  };
}

/**
 * The structured query representation handed to retrieval.
 *
 * ADR-0017: "Structured, from the Business Profile. Never raw conversation."
 * The founder's question is combined with the business facts that scope it,
 * rather than passed through as an opaque utterance.
 *
 * The Business Object enriches this: the trading/legal name, business type, and
 * the descriptive definition fields (activities, products/services, target
 * customers) join `industry`, `location` and `description` as RANKING TERMS.
 * More context makes Nova's retrieval more relevant to the specific business —
 * without touching a single retrieval guarantee. This function feeds the
 * *scorer*, never a filter: jurisdiction, authority, legal status, effective
 * dates and amendment handling are all decided in `retrieval.ts` from the
 * business's `country_code`, exactly as before.
 *
 * The free-text `location` enters HERE and only here — as a ranking term, where
 * being wrong costs relevance, never as a jurisdiction filter, where being wrong
 * costs correctness.
 *
 * ⚠ **Sensitive identifiers are deliberately absent.** A tax id or registration
 *   number is not a retrieval term, and this string is hashed into
 *   `agent_executions.query_representation_hash` — so a value that entered here
 *   would leave the isolated `business_identifiers` table. It never does: this
 *   signature cannot even name an identifier.
 */
export function buildQueryRepresentation(
  question: string,
  business: Pick<Business, 'industry'> &
    Partial<Pick<Business, 'legal_name' | 'trading_name' | 'business_type'>>,
  profile:
    | (Pick<BusinessProfile, 'location' | 'description'> &
        Partial<
          Pick<BusinessProfile, 'business_activities' | 'products_services' | 'target_customers'>
        >)
    | null,
): string {
  return [
    question,
    business.industry,
    business.business_type,
    business.trading_name,
    business.legal_name,
    profile?.location,
    profile?.business_activities,
    profile?.products_services,
    profile?.target_customers,
    profile?.description,
  ]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join(' ')
    .trim();
}
