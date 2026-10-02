import type { ModelTier } from '@/lib/intelligence/types';

/**
 * Tier → model mapping and pricing (ADR-0019: configuration, not code in
 * callers). Callers request a tier; this file is the only place a concrete model
 * id or price lives. Pure — no env, no provider SDK — so it is trivially
 * testable; env overrides for the id are applied at the wiring seam.
 *
 * ⚠ Prices are ESTIMATES for cost accounting only, expressed in USD per 1M
 *   tokens, and must be reconciled against real provider pricing before any
 *   profitability figure is trusted. They are here so usage can be costed at
 *   all, not to be authoritative billing.
 */
export interface ModelPricing {
  inputPerMTokUsd: number;
  outputPerMTokUsd: number;
}

export interface ModelSpec {
  tier: ModelTier;
  provider: 'openai';
  /** Overridable via env at the wiring seam (OPENAI_MODEL_*). */
  defaultModelId: string;
  pricing: ModelPricing;
}

export const MODELS: Record<ModelTier, ModelSpec> = {
  // Low-cost routing/classification tier. Available for future cheap LLM calls;
  // classification itself is done deterministically (free) by the router.
  nano: {
    tier: 'nano',
    provider: 'openai',
    defaultModelId: 'gpt-5.4-nano',
    pricing: { inputPerMTokUsd: 0.05, outputPerMTokUsd: 0.4 },
  },
  // The workhorse for ordinary LLM reasoning.
  mini: {
    tier: 'mini',
    provider: 'openai',
    defaultModelId: 'gpt-5.4-mini',
    pricing: { inputPerMTokUsd: 0.25, outputPerMTokUsd: 2.0 },
  },
  // Premium reasoning — only when a task's complexity explicitly justifies it.
  premium: {
    tier: 'premium',
    provider: 'openai',
    defaultModelId: 'gpt-5.4',
    pricing: { inputPerMTokUsd: 2.5, outputPerMTokUsd: 10.0 },
  },
};

export function modelSpecForTier(tier: ModelTier): ModelSpec {
  return MODELS[tier];
}
