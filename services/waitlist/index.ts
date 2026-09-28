import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { consumeRateLimit, type RateLimitDecision } from '@/lib/db/rate-limit';

/**
 * Public waitlist — the one write path into `waitlist_signups`.
 *
 * The table itself has no SELECT/UPDATE/DELETE policy for any role (public or
 * signed-in): this function's INSERT is the entire public surface. A duplicate
 * email is not an error to the caller — it is the same outcome as a first-time
 * signup, so a visitor who submits twice (or from two devices) is never shown
 * a scary error for something that isn't one.
 */

const WAITLIST_RATE_LIMIT = 5;
const WAITLIST_RATE_WINDOW_SECONDS = 60 * 60;
const WAITLIST_RATE_SCOPE = 'waitlist:join';

/**
 * Reuses the same fail-closed limiter as Nova (`services/nova/rate-limit.ts`),
 * keyed by IP rather than by signed-in user since a visitor here has no
 * session. `consume_rate_limit` was previously grantable only to
 * `authenticated`; the waitlist migration extends the grant to `anon`.
 */
export async function consumeWaitlistRateLimit(
  db: SupabaseClient<Database>,
  ip: string,
): Promise<RateLimitDecision> {
  return consumeRateLimit(db, {
    scope: WAITLIST_RATE_SCOPE,
    subjectId: ip,
    windowSeconds: WAITLIST_RATE_WINDOW_SECONDS,
    limit: WAITLIST_RATE_LIMIT,
  });
}
export interface JoinWaitlistInput {
  email: string;
  firstName?: string | undefined;
  /** Auto-captured context (e.g. 'landing_page'), never asked of the visitor. */
  source?: string | undefined;
}

export interface JoinWaitlistResult {
  status: 'joined' | 'already_on_list';
}

/** Postgres unique_violation. */
const UNIQUE_VIOLATION = '23505';

export async function joinWaitlist(
  db: SupabaseClient<Database>,
  input: JoinWaitlistInput,
): Promise<JoinWaitlistResult> {
  const email = input.email.trim().toLowerCase();

  const { error } = await db.from('waitlist_signups').insert({
    email,
    first_name: input.firstName?.trim() || null,
    source: input.source ?? null,
  });

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { status: 'already_on_list' };
    }
    throw error;
  }

  return { status: 'joined' };
}
