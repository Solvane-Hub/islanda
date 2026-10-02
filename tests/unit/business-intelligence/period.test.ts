import { describe, expect, it } from 'vitest';
import { derivePeriodLabel } from '@/lib/business-intelligence/period';

/**
 * Period labels are derived from type + dates, so a period is never spelled two
 * ways. The architecture is not quarterly-only — month/year/custom all label.
 */
describe('derivePeriodLabel', () => {
  it('labels a quarter from its start month', () => {
    expect(derivePeriodLabel('quarter', '2026-04-01', '2026-06-30')).toBe('Q2 2026');
    expect(derivePeriodLabel('quarter', '2026-01-01', '2026-03-31')).toBe('Q1 2026');
    expect(derivePeriodLabel('quarter', '2026-10-01', '2026-12-31')).toBe('Q4 2026');
  });

  it('labels a year', () => {
    expect(derivePeriodLabel('year', '2026-01-01', '2026-12-31')).toBe('2026');
  });

  it('labels a month', () => {
    expect(derivePeriodLabel('month', '2026-03-01', '2026-03-31')).toBe('Mar 2026');
  });

  it('labels a custom period as a date range', () => {
    expect(derivePeriodLabel('custom', '2026-02-15', '2026-05-10')).toBe('2026-02-15 – 2026-05-10');
  });
});
