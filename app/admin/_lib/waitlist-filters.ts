import { waitlistFiltersSchema, type WaitlistFilters } from '@/lib/validation/waitlist';

/** URL ⇄ filter helpers shared by the waitlist, recruitment and export routes. */

type SearchParams = Record<string, string | string[] | undefined>;

export const FILTER_KEYS = [
  'q',
  'country',
  'cityIsland',
  'businessStage',
  'businessJourney',
  'industry',
  'primaryGoal',
  'biggestChallenge',
  'testingInterest',
  'feedbackInterest',
  'recruitmentStatus',
  'completed',
  'pool',
  'tests',
  'from',
  'to',
  'sort',
] as const;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseWaitlistFilters(raw: SearchParams): WaitlistFilters {
  return waitlistFiltersSchema.parse(
    Object.fromEntries([...FILTER_KEYS, 'page'].map((key) => [key, first(raw[key])])),
  );
}

export function filterQuery(
  filters: WaitlistFilters,
  overrides: Partial<Record<string, string>> = {},
): string {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = filters[key];
    if (value) params.set(key, String(value));
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  return params.toString();
}

export function hrefWith(
  base: string,
  filters: WaitlistFilters,
  overrides: Partial<Record<string, string>>,
): string {
  const query = filterQuery(filters, overrides);
  return query ? `${base}?${query}` : base;
}
