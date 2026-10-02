import { classifyIntelligence } from '@/lib/intelligence/router';
import { modelSpecForTier, type ModelSpec } from '@/lib/intelligence/models';
import { estimateCostUsd } from '@/lib/intelligence/cost';
import { buildMessages } from '@/lib/intelligence/prompt';
import { validateIntelligenceResponse } from '@/lib/intelligence/validator';
import type {
  IntelligenceOutcome,
  IntelligenceRequest,
  IntelligenceUsage,
} from '@/lib/intelligence/types';
import {
  ModelProviderNotConfiguredError,
  type ModelClient,
  type ModelCompletionResult,
} from '@/lib/ai/providers/model-client';
import type { AiUsageEntry } from '@/lib/db/ai-usage';

/**
 * The Intelligence Gateway — the single controlled entry point for LLM-powered
 * capabilities.
 *
 * Flow: classify → (deterministic ⇒ bypass) → build controlled context messages
 * → provider → validate → record usage → structured outcome. It never becomes
 * the source of truth and never fabricates: on any failure it returns a
 * controlled `unavailable` outcome, and the caller keeps working.
 *
 * Dependencies are injected so the gateway is pure of I/O and fully testable:
 * a `ModelClient` (or null when unconfigured) and a `recordUsage` sink.
 */

export interface GatewayDeps {
  /** Null when no provider is configured — the gateway then degrades cleanly. */
  client: ModelClient | null;
  recordUsage: (entry: AiUsageEntry) => Promise<void>;
  /** Resolve a tier's concrete model id (env override at the wiring seam). */
  resolveModelId?: (spec: ModelSpec) => string;
  maxOutputTokens?: number;
}

interface BaseMeta {
  businessId: string;
  actorId: string | null;
  correlationId: string | null;
  category: string;
}

function usageToEntry(base: BaseMeta, usage: IntelligenceUsage): AiUsageEntry {
  return {
    businessId: base.businessId,
    actorId: base.actorId,
    correlationId: base.correlationId,
    category: base.category,
    determination: usage.determination,
    llmCalled: usage.llmCalled,
    provider: usage.provider,
    model: usage.model,
    modelTier: usage.modelTier,
    modelReason: usage.modelReason,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    estimatedCostUsd: usage.estimatedCostUsd,
    validationOk: usage.validationOk,
    failed: usage.failed,
    errorCode: usage.errorCode,
  };
}

export async function runIntelligence(
  request: IntelligenceRequest,
  deps: GatewayDeps,
): Promise<IntelligenceOutcome> {
  // Business isolation: the context must belong to the request's business. A
  // mismatch is a programming error and is refused outright — one business's
  // context can never be used in another's request.
  if (request.context.businessId !== request.businessId) {
    throw new Error(
      'Intelligence request/context business mismatch — refusing to proceed (business isolation).',
    );
  }

  const decision = classifyIntelligence(request.question, request.category);
  const base: BaseMeta = {
    businessId: request.businessId,
    actorId: request.actorId ?? null,
    correlationId: request.correlationId ?? null,
    category: decision.category,
  };

  // ── Deterministic bypass — no LLM, no cost. ───────────────────────────────
  if (decision.determination === 'deterministic' || decision.tier === null) {
    const usage: IntelligenceUsage = {
      determination: decision.determination,
      llmCalled: false,
      provider: null,
      model: null,
      modelTier: null,
      modelReason: decision.modelReason,
      inputTokens: null,
      outputTokens: null,
      estimatedCostUsd: null,
      validationOk: null,
      failed: false,
      errorCode: null,
    };
    await deps.recordUsage(usageToEntry(base, usage));
    return { status: 'deterministic', category: decision.category, usage };
  }

  const spec = modelSpecForTier(decision.tier);
  const modelId = deps.resolveModelId ? deps.resolveModelId(spec) : spec.defaultModelId;

  // ── No provider configured — controlled unavailable. ──────────────────────
  if (!deps.client) {
    const usage: IntelligenceUsage = {
      determination: decision.determination,
      llmCalled: false,
      provider: spec.provider,
      model: modelId,
      modelTier: decision.tier,
      modelReason: decision.modelReason,
      inputTokens: null,
      outputTokens: null,
      estimatedCostUsd: null,
      validationOk: null,
      failed: true,
      errorCode: 'provider_not_configured',
    };
    await deps.recordUsage(usageToEntry(base, usage));
    return {
      status: 'unavailable',
      category: decision.category,
      reason: 'provider_not_configured',
      usage,
    };
  }

  const { system, user } = buildMessages(request.question, request.context, decision);

  // ── Provider call — never fabricate on failure. ───────────────────────────
  let result: ModelCompletionResult;
  try {
    result = await deps.client.complete({
      modelId,
      system,
      user,
      ...(deps.maxOutputTokens !== undefined ? { maxOutputTokens: deps.maxOutputTokens } : {}),
      ...(request.correlationId ? { correlationId: request.correlationId } : {}),
    });
  } catch (error) {
    const notConfigured = error instanceof ModelProviderNotConfiguredError;
    const usage: IntelligenceUsage = {
      determination: decision.determination,
      llmCalled: false,
      provider: spec.provider,
      model: modelId,
      modelTier: decision.tier,
      modelReason: decision.modelReason,
      inputTokens: null,
      outputTokens: null,
      estimatedCostUsd: null,
      validationOk: null,
      failed: true,
      errorCode: notConfigured ? 'provider_not_configured' : 'provider_error',
    };
    await deps.recordUsage(usageToEntry(base, usage));
    return {
      status: 'unavailable',
      category: decision.category,
      reason: notConfigured ? 'provider_not_configured' : 'provider_error',
      usage,
    };
  }

  // The call cost money whether or not it validates — record it accurately.
  const estimatedCostUsd = estimateCostUsd(spec.pricing, result.inputTokens, result.outputTokens);
  const allowedEvidenceIds = request.context.evidence.map((e) => e.id);
  const validation = validateIntelligenceResponse(result.text, allowedEvidenceIds);

  if (!validation.ok) {
    const usage: IntelligenceUsage = {
      determination: decision.determination,
      llmCalled: true,
      provider: spec.provider,
      model: result.modelId,
      modelTier: decision.tier,
      modelReason: decision.modelReason,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      estimatedCostUsd,
      validationOk: false,
      failed: true,
      errorCode: `validation_${validation.reason}`,
    };
    await deps.recordUsage(usageToEntry(base, usage));
    return {
      status: 'unavailable',
      category: decision.category,
      reason: 'validation_failed',
      usage,
    };
  }

  const usage: IntelligenceUsage = {
    determination: decision.determination,
    llmCalled: true,
    provider: spec.provider,
    model: result.modelId,
    modelTier: decision.tier,
    modelReason: decision.modelReason,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    estimatedCostUsd,
    validationOk: true,
    failed: false,
    errorCode: null,
  };
  await deps.recordUsage(usageToEntry(base, usage));
  return { status: 'answered', category: decision.category, response: validation.response, usage };
}
