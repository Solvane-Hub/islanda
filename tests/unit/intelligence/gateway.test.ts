import { beforeEach, describe, expect, it } from 'vitest';
import { runIntelligence, type GatewayDeps } from '@/services/intelligence/gateway';
import { ModelProviderError, type ModelClient } from '@/lib/ai/providers/model-client';
import type { AiUsageEntry } from '@/lib/db/ai-usage';
import type { IntelligenceContext, IntelligenceRequest } from '@/lib/intelligence/types';
import {
  INTELLIGENCE_PROMPT_VERSION,
  REGULATORY_BOUNDARY_RULE,
  buildSystemPrompt,
} from '@/lib/intelligence/prompt';

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

  it('serves a "deterministic" question on the mini tier when the caller requires reasoning', async () => {
    const client = fakeClient(async () => ({
      text: VALID_JSON,
      inputTokens: 10,
      outputTokens: 10,
      modelId: 'gpt-5.4-mini',
    }));
    const out = await runIntelligence(
      request('What is a value proposition?', { requiresReasoning: true }),
      deps(client),
    );
    expect(out.status).toBe('answered');
    expect(out.usage).toMatchObject({ llmCalled: true, modelTier: 'mini' });
    expect(recorded[0]?.modelReason).toMatch(/no deterministic answerer/);
  });

  it('never upgrades a premium request when reasoning is required', async () => {
    const client = fakeClient(async () => ({
      text: VALID_JSON,
      inputTokens: 10,
      outputTokens: 10,
      modelId: 'gpt-5.4',
    }));
    const out = await runIntelligence(
      request('Create a 12-month growth strategy.', { requiresReasoning: true }),
      deps(client),
    );
    expect(out.usage.modelTier).toBe('premium');
  });

  it('still bypasses the LLM for a deterministic question when reasoning is not required', async () => {
    const out = await runIntelligence(request('What is a value proposition?'), deps(null));
    expect(out.status).toBe('deterministic');
  });
});

describe('gateway prompt — regulatory boundary (rule 9)', () => {
  it('forbids stating law, rates, fees or deadlines, and asks for a regulatory category instead', () => {
    const system = buildSystemPrompt();
    expect(system).toContain(REGULATORY_BOUNDARY_RULE);
    expect(REGULATORY_BOUNDARY_RULE).toMatch(/NEVER state laws/);
    expect(REGULATORY_BOUNDARY_RULE).toMatch(/tax or VAT rates, fees/);
    expect(REGULATORY_BOUNDARY_RULE).toMatch(/filing deadlines/);
    expect(REGULATORY_BOUNDARY_RULE).toMatch(/NEVER cite or name a law/);
    expect(REGULATORY_BOUNDARY_RULE).toMatch(/"regulatory" or "compliance"/);
  });

  it("keeps the founder's own context figures reportable (finance-panel carve-out)", () => {
    expect(REGULATORY_BOUNDARY_RULE).toMatch(
      /does not restrict figures, labels or goals supplied in CONTEXT/,
    );
  });

  it('is versioned', () => {
    expect(INTELLIGENCE_PROMPT_VERSION).toBe('intelligence-gateway@1.1.0');
  });
});

/**
 * D6 — rule 9 is shared with the finance panel provisionally, subject to these
 * regressions. The finance panel calls `runIntelligence` WITHOUT
 * `requiresReasoning` and does NOT apply Nova's general-path gates (router,
 * category discard, output scan); those live in `services/nova/general.ts`.
 */
describe('finance-panel regressions under prompt 1.1.0 (D6)', () => {
  it('keeps the deterministic bypass for finance fact questions — no model call', async () => {
    let called = false;
    const client = fakeClient(async () => {
      called = true;
      throw new Error('must not be called');
    });
    for (const q of ['How much revenue did I make?', 'What is my margin?']) {
      const out = await runIntelligence(request(q), deps(client));
      expect(out.status).toBe('deterministic');
    }
    expect(called).toBe(false);
  });

  it('still routes finance reasoning questions to mini, not premium', async () => {
    const client = fakeClient(async () => ({
      text: VALID_JSON,
      inputTokens: 10,
      outputTokens: 10,
      modelId: 'gpt-5.4-mini',
    }));
    for (const q of ['Why did revenue change?', 'How is my business doing?']) {
      const out = await runIntelligence(request(q), deps(client));
      expect(out.status).toBe('answered');
      expect(out.usage.modelTier).toBe('mini');
    }
  });

  it('returns a finance answer that reports a founder-recorded label containing "licence fees"', async () => {
    // The carve-out case: the founder's own goal title mentions licence fees. The
    // gateway must still return it — Nova's output scan is not applied here.
    const withGoal = {
      ...context(),
      goals: [{ title: 'Pay licence fees on time', targetLabel: null, progressPercent: 50 }],
    };
    const reply = JSON.stringify({
      ...JSON.parse(VALID_JSON),
      answer: 'You are halfway to your goal "Pay licence fees on time".',
    });
    const client = fakeClient(async () => ({
      text: reply,
      inputTokens: 10,
      outputTokens: 10,
      modelId: 'gpt-5.4-mini',
    }));
    const out = await runIntelligence(
      request('How is my business doing against my goals?', { context: withGoal }),
      deps(client),
    );
    expect(out.status).toBe('answered');
    expect(out.status === 'answered' && out.response.answer).toContain('licence fees');
  });

  it('keeps rules 1–8 of the system prompt intact', () => {
    const system = buildSystemPrompt();
    for (const rule of [
      '1. Respond with a SINGLE JSON object',
      '4. NEVER invent numbers, dates, names or figures',
      '5. Preserve provenance.',
      '6. Cite evidence ONLY by an id that appears in CONTEXT.evidence',
      '7. Recommendations are suggestions, not facts',
      '8. Be calm, precise and honest.',
    ]) {
      expect(system).toContain(rule);
    }
  });
});
