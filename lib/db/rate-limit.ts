import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type Db = SupabaseClient<Database>;

/**
 * Rate limit repository — the only place the counter is touched.
 *
 * The counter table has zero RLS policies. The single way in is the
 * `consume_rate_limit` SECURITY DEFINER function, which is what makes the
 * counter tamper-proof from a client that holds a user's session.
 */

export interface RateLimitDecision {
  allowed: boolean;
  /** Count after this attempt, including attempts over the limit. */
  currentCount: number;
  windowStartedAt: string;
  retryAfterSeconds: number;
}

export class RateLimitUnavailableError extends Error {
  readonly databaseCode?: string;

  constructor(message: string, options?: { databaseCode?: string; cause?: unknown }) {
    super(message);
    this.name = 'RateLimitUnavailableError';
    this.databaseCode = options?.databaseCode;
    if (options && 'cause' in options) this.cause = options.cause;
  }
}

/**
 * Consume one unit against a fixed window.
 *
 * ⚠ **Fails closed.** If the counter cannot be reached, this throws rather than
 *   returning `allowed: true`. A rate limiter that cannot be consulted must not
 *   be assumed permissive — that assumption is precisely what an attacker
 *   causing database pressure would rely on.
 */
export async function consumeRateLimit(
  db: Db,
  params: { scope: string; subjectId: string; windowSeconds: number; limit: number },
): Promise<RateLimitDecision> {
  const { data, error } = await db.rpc('consume_rate_limit', {
    p_scope: params.scope,
    p_subject_id: params.subjectId,
    p_window_seconds: params.windowSeconds,
    p_limit: params.limit,
  });

  if (error) {
    throw new RateLimitUnavailableError(
      `consume_rate_limit failed for ${params.scope}: ${error.message}`,
      { databaseCode: error.code, cause: error },
    );
  }

  const row = data?.[0];
  if (!row) {
    // A successful call that returned nothing is not a permissive answer; it is
    // an answer we do not have.
    throw new RateLimitUnavailableError(
      `consume_rate_limit returned no row for ${params.scope}. Treating as unavailable.`,
    );
  }

  return {
    allowed: row.allowed,
    currentCount: row.current_count,
    windowStartedAt: row.window_started_at,
    retryAfterSeconds: row.retry_after_seconds,
  };
}
