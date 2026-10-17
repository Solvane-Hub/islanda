import {
  createOpenAiClient,
  isOpenAiConfigured,
  resolveOpenAiModelId,
} from '@/lib/ai/providers/openai';
import { recordAiUsage } from '@/services/intelligence/usage';
import type { GatewayDeps } from '@/services/intelligence/gateway';

/**
 * Intelligence service surface. `runIntelligence` and `assembleIntelligenceContext`
 * are the two entry points a caller (a future Nova action) composes:
 *
 *   const ctx = await assembleIntelligenceContext(db, businessId);
 *   const outcome = await runIntelligence({ question, businessId, context: ctx, ... }, defaultGatewayDeps());
 *
 * Callers: the finance panel (`app/(app)/intelligence/actions.ts`) and Nova's
 * general path (`services/nova/general.ts`). Nova's regulatory path never calls
 * the gateway. This module only establishes the contract and production wiring.
 */
export { runIntelligence, type GatewayDeps } from '@/services/intelligence/gateway';
export { assembleIntelligenceContext } from '@/services/intelligence/context';
export { recordAiUsage } from '@/services/intelligence/usage';

/**
 * Production dependencies: the OpenAI client when configured (else null, so the
 * gateway degrades cleanly), the fail-open usage recorder, and tier→model
 * resolution honouring env overrides (ADR-0019 — mapping is configuration).
 */
export function defaultGatewayDeps(): GatewayDeps {
  return {
    client: isOpenAiConfigured() ? createOpenAiClient() : null,
    recordUsage: recordAiUsage,
    resolveModelId: (spec) => resolveOpenAiModelId(spec.defaultModelId, spec.tier),
  };
}
