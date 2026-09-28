'use server';

import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { AppError, fail, newCorrelationId, ok, type Result } from '@/lib/errors';
import { toFieldErrors } from '@/lib/validation/field-errors';
import { joinWaitlistSchema } from '@/lib/validation/waitlist';
import { logger } from '@/lib/logger';
import {
  consumeWaitlistRateLimit,
  joinWaitlist,
  type JoinWaitlistResult,
} from '@/services/waitlist';

export type { JoinWaitlistResult } from '@/services/waitlist';

/**
 * Public waitlist signup — the only write path a visitor to the marketing
 * landing page can reach. No session is required or assumed.
 *
 * Rate-limited by IP through the existing fail-closed limiter
 * (`consume_rate_limit`), the same mechanism Nova's own rate limiting uses.
 * That RPC was previously grantable only to `authenticated`; this is the
 * first anonymous caller, so the waitlist migration extends the grant to
 * `anon` — the function's behaviour is otherwise unchanged.
 */

async function requestIp(): Promise<string> {
  const h = await headers();
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

export async function joinWaitlistAction(
  _previous: Result<JoinWaitlistResult> | null,
  formData: FormData,
): Promise<Result<JoinWaitlistResult>> {
  const correlationId = newCorrelationId();

  const parsed = joinWaitlistSchema.safeParse({
    email: formData.get('email'),
    firstName: formData.get('firstName'),
  });
  if (!parsed.success) {
    return fail(
      new AppError({
        code: 'VALIDATION_FAILED',
        humanMessage: 'Enter a valid email address.',
        correlationId,
      }),
      toFieldErrors(parsed.error.issues),
    );
  }

  const db = await createClient();
  const ip = await requestIp();

  try {
    const limit = await consumeWaitlistRateLimit(db, ip);
    if (!limit.allowed) {
      return fail(
        new AppError({
          code: 'RATE_LIMITED',
          humanMessage: 'Too many attempts. Please try again in a little while.',
          correlationId,
        }),
      );
    }
  } catch (error) {
    // Fails closed: an unreachable limiter is a denial, never a silent pass.
    logger.error('waitlist.rate_limit_unavailable', {
      correlationId,
      code: error instanceof Error ? error.name : 'unknown',
    });
    return fail(
      new AppError({
        code: 'UNEXPECTED',
        humanMessage: 'We could not process that just now. Please try again shortly.',
        correlationId,
        cause: error,
      }),
    );
  }

  try {
    const result = await joinWaitlist(db, {
      email: parsed.data.email,
      firstName: parsed.data.firstName,
      source: 'landing_page',
    });
    return ok(result);
  } catch (error) {
    logger.error('waitlist.join_failed', {
      correlationId,
      code: error instanceof Error ? error.name : 'unknown',
    });
    return fail(
      new AppError({
        code: 'UNEXPECTED',
        humanMessage: 'We could not add you to the waitlist. Please try again.',
        correlationId,
        cause: error,
      }),
    );
  }
}
