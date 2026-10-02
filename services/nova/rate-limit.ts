import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { consumeRateLimit, type RateLimitDecision } from '@/lib/db/rate-limit';

type Db = SupabaseClient<Database>;

/**
 * Nova rate limiting.
 *
 * Two independent windows, both of which must pass:
 *
 *   • **per user** — abuse and automation. The subject is the authenticated
 *     user, so opening a second business does not reset it.
 *   • **per business** — cost attribution and blast radius. A shared business
 *     account cannot be used to multiply one user's allowance.
 *
 * Checking both is what stops each from being trivially side-stepped by the
 * other. A user with five businesses still hits the user window; a business with
 * five collaborators still hits the business window.
 *
 * ⚠ Today a Nova answer costs a database read and some in-process work. The
 *   moment a generative or voice layer lands, the same endpoint costs money per
 *   call — which is why this exists now rather than then.
 */

/** Requests per user per hour. */
export const NOVA_USER_LIMIT = 30;
export const NOVA_USER_WINDOW_SECONDS = 60 * 60;

/** Requests per business per day. */
export const NOVA_BUSINESS_LIMIT = 120;
export const NOVA_BUSINESS_WINDOW_SECONDS = 60 * 60 * 24;

export const NOVA_USER_SCOPE = 'nova:ask:user';
export const NOVA_BUSINESS_SCOPE = 'nova:ask:business';

export type NovaRateLimitScope = typeof NOVA_USER_SCOPE | typeof NOVA_BUSINESS_SCOPE;

export interface NovaRateLimitResult {
  allowed: boolean;
  /** Which window denied the request. Null when allowed. */
  deniedScope: NovaRateLimitScope | null;
  retryAfterSeconds: number;
}

/**
 * Consume one Nova request against both windows.
 *
 * The user window is consumed first and is consumed **even when the business
 * window then denies**. That is deliberate: an attempt was made, and a design
 * where a denied request costs nothing is a design where the cheaper limit can
 * be probed for free.
 *
 * Throws `RateLimitUnavailableError` if either counter cannot be reached. The
 * caller must treat that as a denial (fail closed), never as permission.
 */
export async function consumeNovaRateLimit(
  db: Db,
  params: { userId: string; businessId: string },
): Promise<NovaRateLimitResult> {
  const user: RateLimitDecision = await consumeRateLimit(db, {
    scope: NOVA_USER_SCOPE,
    subjectId: params.userId,
    windowSeconds: NOVA_USER_WINDOW_SECONDS,
    limit: NOVA_USER_LIMIT,
  });

  const business: RateLimitDecision = await consumeRateLimit(db, {
    scope: NOVA_BUSINESS_SCOPE,
    subjectId: params.businessId,
    windowSeconds: NOVA_BUSINESS_WINDOW_SECONDS,
    limit: NOVA_BUSINESS_LIMIT,
  });

  if (!user.allowed) {
    return {
      allowed: false,
      deniedScope: NOVA_USER_SCOPE,
      retryAfterSeconds: user.retryAfterSeconds,
    };
  }

  if (!business.allowed) {
    return {
      allowed: false,
      deniedScope: NOVA_BUSINESS_SCOPE,
      retryAfterSeconds: business.retryAfterSeconds,
    };
  }

  return { allowed: true, deniedScope: null, retryAfterSeconds: 0 };
}

/** Founder-facing wording. Names the window without exposing the counter. */
export function rateLimitMessage(result: NovaRateLimitResult): string {
  const minutes = Math.max(1, Math.ceil(result.retryAfterSeconds / 60));

  if (result.deniedScope === NOVA_BUSINESS_SCOPE) {
    return `This business has reached its daily limit for Nova questions. Try again in about ${minutes} minute${minutes === 1 ? '' : 's'}.`;
  }
  return `You have reached the hourly limit for Nova questions. Try again in about ${minutes} minute${minutes === 1 ? '' : 's'}.`;
}
