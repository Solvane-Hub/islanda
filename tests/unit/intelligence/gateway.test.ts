import { beforeEach, describe, expect, it } from 'vitest';
import { runIntelligence, type GatewayDeps } from '@/services/intelligence/gateway';
import { ModelProviderError, type ModelClient } from '@/lib/ai/providers/model-client';
import type { AiUsageEntry } from '@/lib/db/ai-usage';
import type { IntelligenceContext, IntelligenceRequest } from '@/lib/intelligence/types';

function context(businessId = 'biz-1'): IntelligenceContext {
  return {
    businessId,
    identity: {
      legalName: null,
      tradingName: 'Cay Naturals',
      businessType: null,
      industry: 'Skincare',
      jurisdiction: 'The Bahamas',
      stage: 'operating',
      operatingStatus: null,
    },
    definition: {
      activities: null,
      productsServices: null,
      targetCustomers: null,
      location: 'Nassau',
    },
    goals: [],
    performance: null,
    evidence: [
      {
        id: 'metric:revenue:recorded',
        type: 'financial_metric',
        source: 'Q2 2026',
        provenance: 'FOUNDER_PROVIDED',
      },
    ],
  };
}

function request(
  question: string,
  overrides: Partial<IntelligenceRequest> = {},
): IntelligenceRequest {
  return {
    question,
    businessId: 'biz-1',
    context: context(),
    correlationId: 'corr-1',
    ...overrides,
  };
}

const VALID_JSON = JSON.stringify({
  answer: 'Revenue grew between the two recorded periods.',
  category: 'financial',
  confidence: 'medium',
  recommendations: [{ text: 'Keep recording each period.', basis: 'RECOMMENDATION' }],
  evidence: [
    {
      id: 'metric:revenue:recorded',
      type: 'financial_metric',
      source: 'Q2 2026',
      provenance: 'FOUNDER_PROVIDED',
    },
  ],
  followUps: [],
  unknowns: [],
});

function fakeClient(impl: ModelClient['complete']): ModelClient {
  return { provider: 'openai', complete: impl };
}

let recorded: AiUsageEntry[];
function deps(client: ModelClient | null): GatewayDeps {
  return {
    client,
    recordUsage: async (e) => {
      recorded.push(e);
    },
  };
}

beforeEach(() => {
  recorded = [];
});

describe('runIntelligence', () => {
  it('bypasses the LLM for a deterministic question and records zero-cost usage', async () => {
    const out = await runIntelligence(request('How much did revenue grow?'), deps(null));
    expect(out.status).toBe('deterministic');
    expect(out.usage.llmCalled).toBe(false);
    expect(out.usage.estimatedCostUsd).toBeNull();
    expect(recorded[0]).toMatchObject({
      determination: 'deterministic',
      llmCalled: false,
      failed: false,
    });
  });

  it('answers a reasoning question with a validated structured response', async () => {
    const client = fakeClient(async () => ({
      text: VALID_JSON,
      inputTokens: 100,
      outputTokens: 50,
      modelId: 'gpt-5.4-mini',
    }));
    const out = await runIntelligence(request('Why did revenue grow?'), deps(client));
    expect(out.status).toBe('answered');
    if (out.status === 'answered') {
      expect(out.response.answer).toContain('Revenue grew');
      expect(out.usage.llmCalled).toBe(true);
      expect(out.usage.modelTier).toBe('mini');
      expect(out.usage.inputTokens).toBe(100);
      expect(out.usage.estimatedCostUsd).toBeGreaterThan(0);
      expect(out.usage.validationOk).toBe(true);
    }
    expect(recorded[0]?.llmCalled).toBe(true);
    expect(recorded[0]?.validationOk).toBe(true);
  });

  it('returns a controlled unavailable state (never fabricates) on provider failure', async () => {
    const client = fakeClient(async () => {
      throw new ModelProviderError('boom');
    });
    const out = await runIntelligence(request('Why did revenue grow?'), deps(client));
    expect(out.status).toBe('unavailable');
    if (out.status === 'unavailable') expect(out.reason).toBe('provider_error');
    expect(recorded[0]).toMatchObject({ failed: true, errorCode: 'provider_error' });
  });

  it('fails safe when the provider is not configured', async () => {
    const out = await runIntelligence(request('Why did revenue grow?'), deps(null));
    expect(out.status).toBe('unavailable');
    if (out.status === 'unavailable') expect(out.reason).toBe('provider_not_configured');
    expect(recorded[0]).toMatchObject({ errorCode: 'provider_not_configured', failed: true });
  });

  it('rejects an invalid LLM response but still records the cost incurred', async () => {
    const client = fakeClient(async () => ({
      text: '{ this is not valid json',
      inputTokens: 100,
      outputTokens: 50,
      modelId: 'gpt-5.4-mini',
    }));
    const out = await runIntelligence(request('Why did revenue grow?'), deps(client));
    expect(out.status).toBe('unavailable');
    if (out.status === 'unavailable') expect(out.reason).toBe('validation_failed');
    expect(recorded[0]?.validationOk).toBe(false);
    expect(recorded[0]?.failed).toBe(true);
    expect(recorded[0]?.estimatedCostUsd).toBeGreaterThan(0); // the call still cost money
  });

  it('routes a strategy request to the premium tier', async () => {
    const client = fakeClient(async () => ({
      text: VALID_JSON,
      inputTokens: 200,
      outputTokens: 100,
      modelId: 'gpt-5.4',
    }));
    const out = await runIntelligence(
      request('Create a 12-month growth strategy from my financials and goals.'),
      deps(client),
    );
    expect(out.usage.modelTier).toBe('premium');
  });

  it('refuses a request whose context belongs to another business (isolation)', async () => {
    const req = request('Why did revenue grow?', { context: context('OTHER-biz') });
    await expect(runIntelligence(req, deps(null))).rejects.toThrow(/business isolation/i);
  });
});
