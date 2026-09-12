import { describe, expect, it } from 'vitest';
import {
  buildPerformanceView,
  resolveMetricEntry,
  toNovaPerformanceContext,
} from '@/lib/business-intelligence/performance';
import type { BusinessFinancialPeriod, BusinessMetric } from '@/types/business-intelligence';

/**
 * Financial performance derivation — deterministic, honest, provenance-aware.
 */

function period(id: string, label: string, start: string, end: string): BusinessFinancialPeriod {
  return {
    id,
    business_id: 'biz-1',
    period_type: 'quarter',
    period_start: start,
    period_end: end,
    label,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

function metric(overrides: Partial<BusinessMetric>): BusinessMetric {
  return {
    id: 'm-' + Math.random().toString(36).slice(2, 8),
    business_id: 'biz-1',
    financial_period_id: null,
    source_document_id: null,
    metric_key: 'revenue',
    label: null,
    value: 0,
    currency: 'BSD',
    unit: null,
    as_of_date: null,
    provenance: 'founder_provided',
    verification_state: 'unverified',
    created_at: '2026-05-01T00:00:00Z',
    updated_at: '2026-05-01T00:00:00Z',
    ...overrides,
  };
}

const Q1 = period('p1', 'Q1 2026', '2026-01-01', '2026-03-31');
const Q2 = period('p2', 'Q2 2026', '2026-04-01', '2026-06-30');

describe('buildPerformanceView', () => {
  it('reports nothing (not $0) when there are no metrics', () => {
    const v = buildPerformanceView([], []);
    expect(v.hasData).toBe(false);
    expect(v.recorded).toEqual([]);
  });

  it('shows recorded figures for the most recent period with data', () => {
    const v = buildPerformanceView(
      [Q1, Q2],
      [
        metric({ financial_period_id: 'p2', metric_key: 'revenue', value: 63200 }),
        metric({ financial_period_id: 'p2', metric_key: 'expenses', value: 34100 }),
        metric({ financial_period_id: 'p1', metric_key: 'revenue', value: 52400 }),
      ],
    );
    expect(v.currentPeriodLabel).toBe('Q2 2026');
    const revenue = v.recorded.find((m) => m.key === 'revenue');
    expect(revenue?.display).toBe('BSD 63,200');
    expect(revenue?.provenance).toBe('founder_provided');
  });

  it('derives net profit and margin from revenue and expenses', () => {
    const v = buildPerformanceView(
      [Q2],
      [
        metric({ financial_period_id: 'p2', metric_key: 'revenue', value: 63200 }),
        metric({ financial_period_id: 'p2', metric_key: 'expenses', value: 34100 }),
      ],
    );
    const netProfit = v.derived.find((d) => d.key === 'net_profit');
    expect(netProfit?.value).toBe(29100);
    expect(netProfit?.note).toMatch(/derived/i);
    const margin = v.derived.find((d) => d.key === 'gross_margin');
    expect(margin?.value).toBe(46); // 29100 / 63200 = 46.0%
    expect(margin?.display).toBe('46%');
  });

  it('does not re-derive a net profit that was recorded', () => {
    const v = buildPerformanceView(
      [Q2],
      [
        metric({ financial_period_id: 'p2', metric_key: 'revenue', value: 63200 }),
        metric({ financial_period_id: 'p2', metric_key: 'expenses', value: 34100 }),
        metric({ financial_period_id: 'p2', metric_key: 'net_profit', value: 30000 }),
      ],
    );
    expect(v.derived.find((d) => d.key === 'net_profit')).toBeUndefined();
    expect(v.recorded.find((m) => m.key === 'net_profit')?.value).toBe(30000);
  });

  it('compares revenue across periods only when both exist', () => {
    const v = buildPerformanceView(
      [Q1, Q2],
      [
        metric({ financial_period_id: 'p2', metric_key: 'revenue', value: 63200 }),
        metric({ financial_period_id: 'p1', metric_key: 'revenue', value: 52400 }),
      ],
    );
    const cmp = v.comparisons.find((c) => c.metricKey === 'revenue');
    expect(cmp?.previousPeriodLabel).toBe('Q1 2026');
    expect(cmp?.changePercent).toBe(20.6); // (63200-52400)/52400
  });

  it('never divides by zero in a comparison', () => {
    const v = buildPerformanceView(
      [Q1, Q2],
      [
        metric({ financial_period_id: 'p2', metric_key: 'revenue', value: 100 }),
        metric({ financial_period_id: 'p1', metric_key: 'revenue', value: 0 }),
      ],
    );
    expect(v.comparisons[0]?.changePercent).toBeNull();
  });
});

describe('resolveMetricEntry', () => {
  it('gives monetary metrics the business currency and founder provenance', () => {
    expect(resolveMetricEntry('revenue', 'BSD', false)).toEqual({
      currency: 'BSD',
      unit: null,
      provenance: 'founder_provided',
    });
  });

  it('marks a document-linked figure as user_document', () => {
    expect(resolveMetricEntry('revenue', 'BSD', true).provenance).toBe('user_document');
  });

  it('treats margin as a percent and counts as unitless, both currency-free', () => {
    expect(resolveMetricEntry('gross_margin', 'BSD', false)).toMatchObject({
      currency: null,
      unit: 'percent',
    });
    expect(resolveMetricEntry('sales_count', 'BSD', false)).toMatchObject({
      currency: null,
      unit: 'count',
    });
  });
});

describe('toNovaPerformanceContext', () => {
  it('is provenance-aware and distinguishes recorded from derived', () => {
    const v = buildPerformanceView(
      [Q2],
      [
        metric({ financial_period_id: 'p2', metric_key: 'revenue', value: 63200 }),
        metric({ financial_period_id: 'p2', metric_key: 'expenses', value: 34100 }),
      ],
    );
    const ctx = toNovaPerformanceContext(v);
    const revenue = ctx.metrics.find((m) => m.key === 'revenue');
    expect(revenue?.basis).toBe('recorded');
    expect(revenue?.provenance).toBe('founder_provided');
    const netProfit = ctx.metrics.find((m) => m.key === 'net_profit');
    expect(netProfit?.basis).toBe('derived');
    expect(netProfit?.provenance).toBeNull(); // derived values assert no provenance
  });
});
