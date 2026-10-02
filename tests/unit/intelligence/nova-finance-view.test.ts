import { describe, expect, it } from 'vitest';
import { toNovaFinanceView } from '@/lib/intelligence/nova-finance';
import type { IntelligenceOutcome, IntelligenceUsage } from '@/lib/intelligence/types';
import type { DeterministicFinancialAnswer } from '@/lib/intelligence/financial-answer';

function usage(over: Partial<IntelligenceUsage> = {}): IntelligenceUsage {
  return {
    determination: 'deterministic',
    llmCalled: false,
    provider: null,
    model: null,
    modelTier: null,
    modelReason: 'test',
    inputTokens: null,
    outputTokens: null,
    estimatedCostUsd: null,
    validationOk: null,
    failed: false,
    errorCode: null,
    ...over,
  };
}

const deterministic: DeterministicFinancialAnswer = {
  answer: 'Your revenue for Q2 2026 is BSD 63,200.',
  evidence: [
    {
      id: 'metric:revenue:recorded',
      type: 'financial_metric',
      source: 'Q2 2026',
      provenance: 'FOUNDER_PROVIDED',
    },
  ],
  unknowns: [],
};

describe('toNovaFinanceView', () => {
  it('maps a deterministic outcome without any LLM call', () => {
    const outcome: IntelligenceOutcome = {
      status: 'deterministic',
      category: 'financial',
      usage: usage(),
    };
    const view = toNovaFinanceView('revenue?', outcome, deterministic);
    expect(view.status).toBe('deterministic');
    expect(view.llmCalled).toBe(false);
    expect(view.confidence).toBe('high');
    expect(view.answer).toContain('BSD 63,200');
    expect(view.recommendations).toEqual([]);
  });

  it('degrades to unrecognized when deterministic routing has no financial match', () => {
    const outcome: IntelligenceOutcome = {
      status: 'deterministic',
      category: 'general',
      usage: usage(),
    };
    const view = toNovaFinanceView('what is the weather?', outcome, null);
    expect(view.status).toBe('unavailable');
    expect(view.reason).toBe('unrecognized');
  });

  it('maps a validated LLM answer, preserving recommendations and unknowns', () => {
    const outcome: IntelligenceOutcome = {
      status: 'answered',
      category: 'performance',
      usage: usage({ determination: 'llm', llmCalled: true, modelTier: 'mini' }),
      response: {
        answer: 'Revenue rose; the cause is not yet determinable.',
        category: 'performance',
        confidence: 'medium',
        recommendations: [{ text: 'Record customer counts.', basis: 'RECOMMENDATION' }],
        evidence: [],
        followUps: ['What changed between Q1 and Q2?'],
        unknowns: ['Cause of the increase is unknown.'],
      },
    };
    const view = toNovaFinanceView('why did revenue increase?', outcome, null);
    expect(view.status).toBe('answered');
    expect(view.llmCalled).toBe(true);
    expect(view.recommendations[0]?.basis).toBe('RECOMMENDATION');
    expect(view.unknowns).toContain('Cause of the increase is unknown.');
  });

  it('maps an unavailable outcome to a calm degraded state (no fabricated answer)', () => {
    const outcome: IntelligenceOutcome = {
      status: 'unavailable',
      category: 'performance',
      reason: 'provider_error',
      usage: usage({ determination: 'llm', failed: true, errorCode: 'provider_error' }),
    };
    const view = toNovaFinanceView('how is my business doing?', outcome, null);
    expect(view.status).toBe('unavailable');
    expect(view.reason).toBe('provider_error');
    expect(view.answer).toBeNull();
  });
});
