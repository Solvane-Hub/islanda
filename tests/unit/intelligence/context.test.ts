import { describe, expect, it } from 'vitest';
import { buildIntelligenceContext } from '@/lib/intelligence/context';
import type { NovaPerformanceContext } from '@/lib/business-intelligence/performance';

const perf: NovaPerformanceContext = {
  periodLabel: 'Q2 2026',
  metrics: [
    {
      key: 'revenue',
      label: 'Revenue',
      display: 'BSD 63,200',
      basis: 'recorded',
      provenance: 'founder_provided',
      supportingDocumentId: 'doc-1',
    },
    {
      key: 'net_profit',
      label: 'Net profit',
      display: 'BSD 29,100',
      basis: 'derived',
      provenance: null,
      supportingDocumentId: null,
    },
  ],
  revenueChange: null,
};

function build() {
  return buildIntelligenceContext({
    businessId: 'biz-1',
    identity: {
      legalName: 'Cay Naturals Ltd',
      tradingName: 'Cay Naturals',
      businessType: 'company',
      industry: 'Skincare',
      jurisdiction: 'The Bahamas',
      stage: 'operating',
      operatingStatus: 'operating',
    },
    definition: {
      activities: 'making soap',
      productsServices: 'soaps',
      targetCustomers: 'tourists',
      location: 'Nassau',
    },
    goals: [{ title: 'Reach $250k revenue', targetLabel: 'BSD 250,000', progressPercent: 25 }],
    performance: perf,
  });
}

describe('buildIntelligenceContext', () => {
  it('turns recorded and derived metrics into evidence with correct epistemic types', () => {
    const ctx = build();
    const revenue = ctx.evidence.find((e) => e.id === 'metric:revenue:recorded');
    expect(revenue?.provenance).toBe('FOUNDER_PROVIDED');
    const netProfit = ctx.evidence.find((e) => e.id === 'metric:net_profit:derived');
    expect(netProfit?.provenance).toBe('CALCULATION'); // derived is a calculation, not a fact
    expect(ctx.evidence.find((e) => e.id === 'goal:0')?.type).toBe('goal');
  });

  it('has NO field or value for a sensitive identifier — exclusion is structural', () => {
    const ctx = build();
    // The identity object is a fixed, safe key set — there is no identifier field.
    expect(Object.keys(ctx.identity).sort()).toEqual(
      [
        'businessType',
        'industry',
        'jurisdiction',
        'legalName',
        'operatingStatus',
        'stage',
        'tradingName',
      ].sort(),
    );
    // And no identifier value could have entered — the builder never receives one.
    const dumped = JSON.stringify(ctx).toLowerCase();
    expect(dumped).not.toContain('tin-');
    expect(dumped).not.toContain('tax id');
  });
});
