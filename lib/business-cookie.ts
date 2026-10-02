/**
 * Name of the cookie holding the founder's currently selected business.
 *
 * The value is a hint, not an authorization token: it is client-controllable, so
 * every read re-checks it against the RLS-scoped business list
 * (services/business#resolveCurrentBusiness). A foreign or stale ID silently
 * falls back to the most recent business rather than erroring.
 *
 * Renamed from `foundryai_business` during the Islanda rebrand. Safe without a
 * dual-read migration: a returning founder whose browser only holds the old
 * cookie simply reads as "no cookie set," and `resolveCurrentBusiness` already
 * falls back to their most-recently-used business rather than erroring — the
 * next time they switch businesses, the new cookie is written and the old one
 * is never consulted again.
 */
export const CURRENT_BUSINESS_COOKIE = 'islanda_business';
