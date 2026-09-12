import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

/**
 * AI usage repository — the only place `ai_usage` rows are written.
 *
 * `ai_usage` has RLS on with zero policies, so it is unreachable by the
 * authenticated role. Writes go through the service-role client (like
 * `audit_log`), which is why this takes an explicit admin client. Safe metadata
 * only — never prompt/response text, business content or sensitive identifiers.
 */
export interface AiUsageEntry {
  businessId: string | null;
  actorId?: string | null;
  correlationId?: string | null;
  category: string;
  determination: string;
  llmCalled: boolean;
  provider?: string | null;
  model?: string | null;
  modelTier?: string | null;
  modelReason?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  estimatedCostUsd?: number | null;
  validationOk?: boolean | null;
  failed: boolean;
  errorCode?: string | null;
}

export async function insertAiUsage(
  admin: SupabaseClient<Database>,
  entry: AiUsageEntry,
): Promise<{ error: string | null }> {
  const { error } = await admin.from('ai_usage').insert({
    business_id: entry.businessId,
    actor_id: entry.actorId ?? null,
    correlation_id: entry.correlationId ?? null,
    category: entry.category,
    determination: entry.determination,
    llm_called: entry.llmCalled,
    provider: entry.provider ?? null,
    model: entry.model ?? null,
    model_tier: entry.modelTier ?? null,
    model_reason: entry.modelReason ?? null,
    input_tokens: entry.inputTokens ?? null,
    output_tokens: entry.outputTokens ?? null,
    estimated_cost_usd: entry.estimatedCostUsd ?? null,
    validation_ok: entry.validationOk ?? null,
    failed: entry.failed,
    error_code: entry.errorCode ?? null,
  });
  return { error: error?.message ?? null };
}
