/**
 * Date ranges for the admin dashboards. Pure and unit-tested.
 *
 * All ranges are half-open [from, to) in UTC, so a day is never counted twice
 * and "Last 7 days" means the 7 UTC days ending today (inclusive).
 */

export const RANGE_PRESETS = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'all', label: 'All available time' },
  { value: 'custom', label: 'Custom range' },
] as const;

export type RangePreset = (typeof RANGE_PRESETS)[number]['value'];

/** Nothing in Islanda's data predates this (the repository was created 2026-08-05). */
export const EARLIEST_DATA = new Date('2026-08-01T00:00:00.000Z');

export interface DateRange {
  preset: RangePreset;
  from: Date;
  to: Date;
  label: string;
  /** The equal-length period immediately before, when comparison is meaningful. */
  previous: { from: Date; to: Date } | null;
  compare: boolean;
  /** Inclusive end day, for display and form defaults. */
  fromDay: string;
  toDay: string;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function day(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseDay(value: string | undefined): Date | null {
  if (!value || !ISO_DAY.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseDateRange(
  params: Record<string, string | string[] | undefined>,
  now: Date = new Date(),
): DateRange {
  const get = (k: string) => {
    const v = params[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const requested = get('range');
  const preset: RangePreset = RANGE_PRESETS.some((p) => p.value === requested)
    ? (requested as RangePreset)
    : '30d';
  const compare = get('compare') === '1';

  const tomorrow = new Date(startOfUtcDay(now).getTime() + DAY_MS);
  let from: Date;
  let to: Date = tomorrow;

  switch (preset) {
    case 'today':
      from = startOfUtcDay(now);
      break;
    case '7d':
      from = new Date(tomorrow.getTime() - 7 * DAY_MS);
      break;
    case '90d':
      from = new Date(tomorrow.getTime() - 90 * DAY_MS);
      break;
    case 'all':
      from = EARLIEST_DATA;
      break;
    case 'custom': {
      const f = parseDay(get('from'));
      const t = parseDay(get('to'));
      from = f ?? new Date(tomorrow.getTime() - 30 * DAY_MS);
      to = t ? new Date(t.getTime() + DAY_MS) : tomorrow;
      if (to <= from) to = new Date(from.getTime() + DAY_MS);
      if (from < EARLIEST_DATA) from = EARLIEST_DATA;
      if (to > tomorrow) to = tomorrow;
      if (to <= from) to = new Date(from.getTime() + DAY_MS);
      break;
    }
    default:
      from = new Date(tomorrow.getTime() - 30 * DAY_MS);
  }

  const length = to.getTime() - from.getTime();
  const previousFrom = new Date(from.getTime() - length);
  const previous =
    preset !== 'all' && previousFrom >= EARLIEST_DATA ? { from: previousFrom, to: from } : null;

  const toDay = day(new Date(to.getTime() - DAY_MS));
  const presetLabel = RANGE_PRESETS.find((p) => p.value === preset)!.label;
  const label =
    preset === 'custom' || preset === 'all'
      ? `${day(from)} – ${toDay} (UTC)`
      : `${presetLabel} (${day(from)} – ${toDay}, UTC)`;

  return { preset, from, to, label, previous, compare, fromDay: day(from), toDay };
}

/** Query string that preserves the range on links between admin pages. */
export function rangeQuery(range: DateRange): string {
  const params = new URLSearchParams({ range: range.preset });
  if (range.preset === 'custom') {
    params.set('from', range.fromDay);
    params.set('to', range.toDay);
  }
  if (range.compare) params.set('compare', '1');
  return params.toString();
}

/** Percentage change, or null when there is no meaningful baseline. */
export function percentChange(current: number, previous: number | null | undefined): number | null {
  if (previous === null || previous === undefined || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

/** A rate as a percentage, or null when the denominator is zero. */
export function rate(numerator: number, denominator: number): number | null {
  return denominator > 0 ? (numerator / denominator) * 100 : null;
}
