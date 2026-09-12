import type { ModelPricing } from '@/lib/intelligence/models';

/**
 * Estimated AI cost in USD from token counts and a model's pricing. Pure.
 * Rounded to 6 decimal places (matches the `ai_usage.estimated_cost_usd`
 * column). This is an estimate for profitability accounting, not billing.
 */
export function estimateCostUsd(
  pricing: ModelPricing,
  inputTokens: number,
  outputTokens: number,
): number {
  const cost =
    (inputTokens / 1_000_000) * pricing.inputPerMTokUsd +
    (outputTokens / 1_000_000) * pricing.outputPerMTokUsd;
  return Math.round(cost * 1_000_000) / 1_000_000;
}
