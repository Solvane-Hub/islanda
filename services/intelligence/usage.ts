import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';
import { insertAiUsage, type AiUsageEntry } from '@/lib/db/ai-usage';

/**
 * Record AI usage — fails OPEN (like audit, ADR-0012), NOT closed.
 *
 * Usage accounting is profitability telemetry, not answer standing: losing a row
 * must never deny a founder an answer. A write failure is logged loudly and
 * swallowed. (Contrast Nova's execution record, which is part of an answer's
 * standing and fails closed.)
 */
export async function recordAiUsage(entry: AiUsageEntry): Promise<void> {
  const admin = createAdminClient();
  if (!admin) {
    logger.error('ai_usage.not_recorded', {
      reason: 'SUPABASE_SERVICE_ROLE_KEY is not configured',
      category: entry.category,
      determination: entry.determination,
    });
    return;
  }
  const { error } = await insertAiUsage(admin, entry);
  if (error) {
    logger.error('ai_usage.write_failed', {
      category: entry.category,
      determination: entry.determination,
      code: error,
    });
  }
}
