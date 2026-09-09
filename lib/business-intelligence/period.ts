import type { FinancialPeriodType } from '@/types/business-intelligence';

/**
 * Financial-period helpers — pure, no I/O.
 *
 * The period is stored as `type + start + end` (arbitrary ranges, not
 * quarterly-only). A human label is derived from those, so the same period is
 * never spelled two different ways.
 */

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** Parse the year/month out of a `YYYY-MM-DD` date string. Month is 1–12. */
function parts(dateIso: string): { year: number; month: number } {
  return { year: Number(dateIso.slice(0, 4)), month: Number(dateIso.slice(5, 7)) };
}

/**
 * A canonical label for a period, e.g. "Q2 2026", "2026", "Mar 2026", or a date
 * range for a custom period. Used when the founder does not supply one.
 */
export function derivePeriodLabel(
  type: FinancialPeriodType,
  periodStart: string,
  periodEnd: string,
): string {
  const { year, month } = parts(periodStart);
  switch (type) {
    case 'year':
      return `${year}`;
    case 'quarter':
      return `Q${Math.floor((month - 1) / 3) + 1} ${year}`;
    case 'month':
      return `${MONTHS[month - 1] ?? ''} ${year}`.trim();
    case 'custom':
    default:
      return `${periodStart} – ${periodEnd}`;
  }
}
