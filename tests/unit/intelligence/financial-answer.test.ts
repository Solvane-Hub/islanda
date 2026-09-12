import { describe, expect, it } from 'vitest';
import { buildIntelligenceContext } from '@/lib/intelligence/context';
import { answerFinancialDeterministically } from '@/lib/intelligence/financial-answer';
import type { NovaPerformanceContext } from '@/lib/business-intelligence/performance';
import type { FactProvenance } from '@/types/business';

function metric(
  key: NovaPerformanceContext['metrics'][number]['key'],
  display: string,
  basis: 'recorded' | 'derived',
  provenance: FactProvenance | null,
  supportingDocumentId: string | null = null,
) {
  return { key, label: key.replace(/_/g, ' '), display, basis, provenance, supportingDocumentId };
}

function ctx(perf: NovaPerformanceContext | null) {
  return buildIntelligenceContext({
    businessId: 'biz-1',
    identity: {
      legalName: null,
      tradingName: null,
      businessType: null,
      industry: 'Skincare',
      jurisdiction: 'The Bahamas',
      stage: 'operating',
      operatingStatus: null,
    },
    definition: { activities: null, productsServices: null, targetCustomers: null, location: null },
    goals: [],
    performance: perf,
  });
}

const revenueOnly: NovaPerformanceContext = {
  periodLabel: 'Q2 2026',
  metrics: [metric('revenue', 'BSD 63,200', 'recorded', 'founder_provided')],
  revenueChange: null,
};

const withGrowth: NovaPerformanceContext = {
  periodLabel: 'Q2 2026',
  metrics: [
    metric('revenue', 'BSD 63,200', 'recorded', 'founder_provided'),
    metric('net_profit', 'BSD 29,100', 'derived', null),
  ],
  revenueChange: {
    currentPeriodLabel: 'Q2 2026',
    previousPeriodLabel: 'Q1 2026',
    currentDisplay: 'BSD 63,200',
    previousDisplay: 'BSD 52,400',
    changePercent: 20.6,
  },
};

describe('answerFinancialDeterministically', () => {
  it('answers a revenue level question from the recorded figure', () => {
    const a = answerFinancialDeterministically('How much revenue did I make?', ctx(revenueOnly));
    expect(a?.answer).toContain('BSD 63,200');
    expect(a?.evidence.some((e) => e.id === 'metric:revenue:recorded')).toBe(true);
    expect(a?.unknowns).toEqual([]);
  });

  it('answers a comparison with the deterministic growth calculation', () => {
    const a = answerFinancialDeterministically(
      'How much did revenue grow from Q1 to Q2?',
      ctx(withGrowth),
    );
    expect(a?.answer).toContain('+20.6%');
    expect(a?.answer).toContain('BSD 52,400');
    expect(a?.evidence.some((e) => e.id === 'calc:revenue_growth')).toBe(true);
    // It states the change — never a cause. That is the LLM's (guarded) job.
    expect(a?.answer.toLowerCase()).not.toContain('because');
  });

  it('says it cannot compare with only one period', () => {
    const a = answerFinancialDeterministically('How did revenue change?', ctx(revenueOnly));
    expect(a?.answer.toLowerCase()).toContain('one period');
    expect(a?.unknowns.length).toBeGreaterThan(0);
  });

  it('marks a derived metric as derived', () => {
    const a = answerFinancialDeterministically('what is my net profit?', ctx(withGrowth));
    expect(a?.answer.toLowerCase()).toContain('derived');
    expect(a?.evidence.some((e) => e.id === 'metric:net_profit:derived')).toBe(true);
  });

  it('reports a missing metric as missing, never guessed', () => {
    const a = answerFinancialDeterministically('what were my expenses?', ctx(revenueOnly));
    expect(a?.answer.toLowerCase()).toContain('don’t have your expenses');
    expect(a?.unknowns.length).toBeGreaterThan(0);
    expect(a?.evidence).toEqual([]);
  });

  it('handles a business with no figures at all', () => {
    const a = answerFinancialDeterministically('how much revenue?', ctx(null));
    expect(a?.answer.toLowerCase()).toContain('don’t have any financial figures');
    expect(a?.unknowns.length).toBeGreaterThan(0);
  });

  it('carries document provenance into evidence', () => {
    const perf: NovaPerformanceContext = {
      periodLabel: 'Q2 2026',
      metrics: [metric('revenue', 'BSD 63,200', 'recorded', 'user_document', 'doc-1')],
      revenueChange: null,
    };
    const a = answerFinancialDeterministically('revenue?', ctx(perf));
    const ev = a?.evidence.find((e) => e.id === 'metric:revenue:recorded');
    expect(ev?.provenance).toBe('DOCUMENT_DERIVED');
  });

  it('returns null for a question that is not a financial fact lookup', () => {
    expect(
      answerFinancialDeterministically('what is the weather today?', ctx(revenueOnly)),
    ).toBeNull();
  });
});
