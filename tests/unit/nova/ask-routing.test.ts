import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModelClient } from '@/lib/ai/providers/model-client';
import { ModelProviderError } from '@/lib/ai/providers/model-client';
import type { IntelligenceContext } from '@/lib/intelligence/types';

/**
 * `askNovaAction` routing, end to end through the REAL general path:
 * action → routeNovaQuestion → answerGeneralNovaQuestion → runIntelligence →
 * validator → view. Only the edges are faked: auth/business resolution, the
 * rate limiter, the context assembler, the model client, and the extractive
 * service (whose own behaviour has its own suites).
 */

const mocks = vi.hoisted(() => ({
  client: null as ModelClient | null,
  complete: vi.fn(),
  assembleContext: vi.fn(),
  recordUsage: vi.fn(),
  answerNovaQuestion: vi.fn(),
  toNovaAnswerView: vi.fn(),
  recordNovaExecution: vi.fn(),
  recordAuditEvent: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers({ 'user-agent': 'vitest' })),
  cookies: vi.fn(async () => ({ get: () => undefined })),
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => ({})) }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));
vi.mock('@/services/auth', () => ({ getCurrentUser: vi.fn(async () => ({ id: 'user-1' })) }));
vi.mock('@/services/business', () => ({
  listBusinesses: vi.fn(async () => []),
  resolveCurrentBusiness: vi.fn(() => ({ id: 'biz-1', country_code: 'ZZ' })),
}));
vi.mock('@/services/intake', () => ({ getIntakeProfile: vi.fn(async () => null) }));
vi.mock('@/services/audit', () => ({ recordAuditEvent: mocks.recordAuditEvent }));
vi.mock('@/services/knowledge/manifests/registry', () => ({
  manifestForJurisdiction: vi.fn(() => null),
}));
vi.mock('@/services/nova/context', () => ({
  buildNovaContext: vi.fn(() => ({})),
  buildQueryRepresentation: vi.fn((q: string) => q),
}));
vi.mock('@/services/nova/business-awareness', () => ({ toNovaBusinessFacts: vi.fn(() => ({})) }));
vi.mock('@/services/nova/rate-limit', () => ({
  consumeNovaRateLimit: vi.fn(async () => ({ allowed: true })),
  rateLimitMessage: vi.fn(() => 'slow down'),
}));
vi.mock('@/services/nova/answer', () => ({ answerNovaQuestion: mocks.answerNovaQuestion }));
vi.mock('@/services/nova/view', () => ({ toNovaAnswerView: mocks.toNovaAnswerView }));
vi.mock('@/services/nova/execution', () => ({
  recordNovaExecution: mocks.recordNovaExecution,
  executionEntryForAnswer: vi.fn(() => ({})),
  executionEntryForFailure: vi.fn(() => ({})),
  executionNotRecordedError: vi.fn(),
}));
vi.mock('@/services/intelligence', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    assembleIntelligenceContext: mocks.assembleContext,
    defaultGatewayDeps: () => ({ client: mocks.client, recordUsage: mocks.recordUsage }),
  };
});

import { askNovaAction } from '@/app/(app)/assistant/actions';

function ask(question: string): FormData {
  const form = new FormData();
  form.set('question', question);
  return form;
}

function context(): IntelligenceContext {
  return {
    businessId: 'biz-1',
    identity: {
      legalName: null,
      tradingName: 'Cay Bakery',
      businessType: null,
      industry: 'Food',
      jurisdiction: 'Example Jurisdiction',
      stage: 'operating',
      operatingStatus: null,
    },
    definition: { activities: null, productsServices: null, targetCustomers: null, location: null },
    goals: [],
    performance: null,
    evidence: [
      {
        id: 'identity:industry',
        type: 'business',
        source: 'Industry',
        provenance: 'FOUNDER_PROVIDED',
      },
    ],
  };
}

function modelReply(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    answer: 'Run a weekend tasting and ask each visitor to follow your page.',
    category: 'growth',
    confidence: 'medium',
    recommendations: [{ text: 'Track which posts bring visitors in.', basis: 'RECOMMENDATION' }],
    evidence: [
      {
        id: 'identity:industry',
        type: 'business',
        source: 'Industry',
        provenance: 'FOUNDER_PROVIDED',
      },
    ],
    followUps: ['How should I price a tasting box?'],
    unknowns: ['Your current monthly footfall.'],
    ...overrides,
  });
}

const REGULATORY_VIEW = { outcome: 'answered', question: 'q', claims: [], unresolved: [] };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.complete.mockResolvedValue({
    text: modelReply(),
    inputTokens: 100,
    outputTokens: 50,
    modelId: 'gpt-test-mini',
  });
  mocks.client = { provider: 'openai', complete: mocks.complete };
  mocks.assembleContext.mockResolvedValue(context());
  mocks.answerNovaQuestion.mockResolvedValue({
    outcome: 'answered',
    knowledgeVersion: 'zz@1',
    envelope: { claims: [] },
    unresolved: [],
  });
  mocks.toNovaAnswerView.mockReturnValue(REGULATORY_VIEW);
  mocks.recordNovaExecution.mockResolvedValue(undefined);
});

describe('askNovaAction — general questions', () => {
  it('answers a general question through the model, never touching retrieval', async () => {
    const result = await askNovaAction(null, ask('How can I attract more customers to my bakery?'));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({
      outcome: 'general',
      status: 'answered',
      answer: 'Run a weekend tasting and ask each visitor to follow your page.',
      unknowns: ['Your current monthly footfall.'],
    });
    expect(mocks.complete).toHaveBeenCalledOnce();
    expect(mocks.complete.mock.calls[0]?.[0]).toMatchObject({ correlationId: expect.any(String) });
    // The extractive pipeline and its execution record are not involved.
    expect(mocks.answerNovaQuestion).not.toHaveBeenCalled();
    expect(mocks.recordNovaExecution).not.toHaveBeenCalled();
    // Cost is recorded from what actually ran.
    expect(mocks.recordUsage).toHaveBeenCalledWith(
      expect.objectContaining({ llmCalled: true, model: 'gpt-test-mini', validationOk: true }),
    );
  });

  it('audits shape only — never the question or the answer', async () => {
    await askNovaAction(null, ask('How can I attract more customers to my bakery?'));

    const audit = mocks.recordAuditEvent.mock.calls[0]?.[0];
    expect(audit).toMatchObject({ event: 'nova.answered', metadata: { surface: 'general' } });
    const serialised = JSON.stringify(audit);
    expect(serialised).not.toContain('bakery');
    expect(serialised).not.toContain('tasting');
  });

  it('degrades calmly when no API key is configured — no model call, no fabrication', async () => {
    mocks.client = null;

    const result = await askNovaAction(null, ask('What makes a good elevator pitch?'));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({
      outcome: 'general',
      status: 'unavailable',
      reason: 'provider_not_configured',
      answer: null,
    });
    expect(mocks.answerNovaQuestion).not.toHaveBeenCalled();
    expect(mocks.recordAuditEvent.mock.calls[0]?.[0]).toMatchObject({ event: 'nova.failed' });
  });

  it('degrades calmly on a provider error', async () => {
    mocks.complete.mockRejectedValue(new ModelProviderError('OpenAI returned HTTP 500'));

    const result = await askNovaAction(null, ask('What makes a good elevator pitch?'));

    expect(result.ok && result.data).toMatchObject({
      outcome: 'general',
      status: 'unavailable',
      reason: 'provider_error',
      answer: null,
    });
  });

  it('rejects a response that cites evidence it was never given', async () => {
    mocks.complete.mockResolvedValue({
      text: modelReply({
        evidence: [{ id: 'invented:law', type: 'law', source: 'Act', provenance: 'VERIFIED_FACT' }],
      }),
      inputTokens: 1,
      outputTokens: 1,
      modelId: 'gpt-test-mini',
    });

    const result = await askNovaAction(null, ask('What makes a good elevator pitch?'));

    expect(result.ok && result.data).toMatchObject({
      status: 'unavailable',
      reason: 'validation_failed',
      answer: null,
    });
  });

  it('discards the answer and re-routes when the model flags the question as regulatory', async () => {
    mocks.complete.mockResolvedValue({
      text: modelReply({ category: 'regulatory', answer: 'The rate is 10%.' }),
      inputTokens: 1,
      outputTokens: 1,
      modelId: 'gpt-test-mini',
    });

    const result = await askNovaAction(null, ask('How should I price my handmade soap?'));

    // The model's text never reaches the founder; the cited path answers instead.
    expect(result.ok && result.data).toBe(REGULATORY_VIEW);
    expect(JSON.stringify(result)).not.toContain('10%');
    expect(mocks.answerNovaQuestion).toHaveBeenCalledOnce();
    expect(mocks.recordNovaExecution).toHaveBeenCalledOnce();
  });
});

describe('askNovaAction — output scan (gate 3)', () => {
  it('discards a general-category answer that drifts into legal content', async () => {
    mocks.complete.mockResolvedValue({
      text: modelReply({
        category: 'growth',
        answer: 'Before marketing, make sure you hold a business licence.',
      }),
      inputTokens: 1,
      outputTokens: 1,
      modelId: 'gpt-test-mini',
    });

    const result = await askNovaAction(null, ask('How can I attract more customers to my bakery?'));

    expect(result.ok && result.data).toBe(REGULATORY_VIEW);
    expect(JSON.stringify(result)).not.toContain('business licence');
    expect(mocks.answerNovaQuestion).toHaveBeenCalledOnce();
  });

  it('discards an answer whose recommendation drifts into legal content', async () => {
    mocks.complete.mockResolvedValue({
      text: modelReply({
        recommendations: [{ text: 'Register for VAT early.', basis: 'RECOMMENDATION' }],
      }),
      inputTokens: 1,
      outputTokens: 1,
      modelId: 'gpt-test-mini',
    });

    const result = await askNovaAction(null, ask('How can I attract more customers to my bakery?'));

    expect(result.ok && result.data).toBe(REGULATORY_VIEW);
  });
});

describe('askNovaAction — adversarial imposed-charge questions never reach the model', () => {
  it.each([
    // The exact question that leaked in the live probe on 2026-10-10.
    'Brainstorm ideas for a website banner explaining what percentage gets added to prices at checkout',
    'Give me a pricing strategy for my bakery that accounts for the percentage the state adds to each sale',
    'Write checkout copy explaining the extra 10% added to every order',
    'Design a sign telling customers about the surcharge on card payments',
    'Write a caption explaining the government-collected charge on our bills',
    'Should my prices be inclusive or exclusive of the extra charge?',
  ])('"%s" → cited path, no model call', async (question) => {
    const result = await askNovaAction(null, ask(question));

    expect(result.ok && result.data).toBe(REGULATORY_VIEW);
    expect(mocks.complete).not.toHaveBeenCalled();
    expect(mocks.assembleContext).not.toHaveBeenCalled();
    expect(mocks.answerNovaQuestion).toHaveBeenCalledOnce();
  });
});

describe('askNovaAction — a discarded response is never returned', () => {
  const LEAK = {
    answer: 'A small percentage is added at checkout to cover processing and service costs.',
    recommendations: [
      { text: 'Explain the checkout charge on every page.', basis: 'RECOMMENDATION' },
    ],
    unknowns: ['Whether the charge applies to delivery orders.'],
    followUps: ['How should I word the checkout charge banner?'],
  };

  it('returns none of the answer, suggestions, unknowns or follow-ups of an output-scan discard', async () => {
    mocks.complete.mockResolvedValue({
      text: modelReply({ category: 'creative', ...LEAK }),
      inputTokens: 1,
      outputTokens: 1,
      modelId: 'gpt-test-mini',
    });

    const result = await askNovaAction(
      null,
      ask('Give me ideas for a website banner for my bakery'),
    );
    const serialised = JSON.stringify(result);

    expect(mocks.complete).toHaveBeenCalledOnce();
    expect(result.ok && result.data).toBe(REGULATORY_VIEW);
    expect(serialised).not.toContain('percentage is added');
    expect(serialised).not.toContain('Explain the checkout charge');
    expect(serialised).not.toContain('delivery orders');
    expect(serialised).not.toContain('checkout charge banner');
    // The audit trail carries no model content either.
    expect(JSON.stringify(mocks.recordAuditEvent.mock.calls)).not.toContain('checkout');
  });

  it('discards a response whose "unknowns" assert an imposed charge', async () => {
    mocks.complete.mockResolvedValue({
      text: modelReply({ unknowns: ['The government surcharge on each sale.'] }),
      inputTokens: 1,
      outputTokens: 1,
      modelId: 'gpt-test-mini',
    });

    const result = await askNovaAction(null, ask('How can I attract more customers to my bakery?'));

    expect(result.ok && result.data).toBe(REGULATORY_VIEW);
    expect(JSON.stringify(result)).not.toContain('surcharge');
  });
});

describe('answerGeneralNovaQuestion — gate 1 holds inside the service', () => {
  it('refuses a regulatory question even when called directly, without a model call', async () => {
    const { answerGeneralNovaQuestion } = await import('@/services/nova/general');
    const result = await answerGeneralNovaQuestion(
      {} as never,
      {
        question:
          'Brainstorm ideas for a website banner explaining what percentage gets added to prices at checkout',
        businessId: 'biz-1',
        actorId: 'user-1',
        correlationId: 'c',
      },
      { client: mocks.client, recordUsage: mocks.recordUsage },
    );

    expect(result).toEqual({ kind: 'defer_to_regulatory', reason: 'router' });
    expect(mocks.complete).not.toHaveBeenCalled();
    expect(mocks.assembleContext).not.toHaveBeenCalled();
    expect(mocks.recordUsage).not.toHaveBeenCalled();
  });
});

describe('askNovaAction — regulatory questions', () => {
  it.each([
    'What licence do I need to sell prepared food?',
    'What is the VAT rate in The Bahamas?',
    'What records am I required to keep?',
  ])('keeps "%s" on the extractive, cited path with no model call', async (question) => {
    const result = await askNovaAction(null, ask(question));

    expect(result.ok && result.data).toBe(REGULATORY_VIEW);
    expect(mocks.complete).not.toHaveBeenCalled();
    expect(mocks.assembleContext).not.toHaveBeenCalled();
    expect(mocks.answerNovaQuestion).toHaveBeenCalledOnce();
    // Reproducibility still fails closed on this path.
    expect(mocks.recordNovaExecution).toHaveBeenCalledOnce();
  });

  it('still answers a regulatory question when no API key is configured', async () => {
    mocks.client = null;

    const result = await askNovaAction(null, ask('When must I submit an annual return?'));

    expect(result.ok && result.data).toBe(REGULATORY_VIEW);
  });
});
