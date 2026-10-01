'use server';

import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { AppError, fail, newCorrelationId, ok, type Result } from '@/lib/errors';
import { toFieldErrors } from '@/lib/validation/field-errors';
import { joinWaitlistSchema } from '@/lib/validation/waitlist';
import { logger } from '@/lib/logger';
import { sendWaitlistConfirmation, sendWaitlistNotification } from '@/lib/email/resend';
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

function logErrorContext(
  error: unknown,
  correlationId: string,
  operation: string,
  sensitiveValues: string[],
) {
  const cause = error instanceof Error && 'cause' in error ? error.cause : undefined;
  const databaseError =
    cause && typeof cause === 'object'
      ? (cause as { code?: unknown; message?: unknown })
      : undefined;
  const errorObject =
    error && typeof error === 'object'
      ? (error as { code?: unknown; databaseCode?: unknown; message?: unknown })
      : undefined;
  const context = {
    correlationId,
    operation,
    code: error instanceof Error ? error.name : 'unknown',
  };

  if (process.env.NODE_ENV === 'production') return context;

  const rawMessage =
    typeof (databaseError?.message ?? errorObject?.message) === 'string'
      ? String(databaseError?.message ?? errorObject?.message)
      : error instanceof Error
        ? error.message
        : undefined;
  const errorMessage = sensitiveValues.reduce(
    (message, value) => (value ? message.replaceAll(value, '[redacted]') : message),
    rawMessage ?? '',
  );

  return {
    ...context,
    databaseCode:
      typeof errorObject?.databaseCode === 'string'
        ? errorObject.databaseCode
        : typeof (databaseError?.code ?? errorObject?.code) === 'string'
          ? String(databaseError?.code ?? errorObject?.code)
          : undefined,
    errorMessage: rawMessage ? errorMessage : undefined,
  };
}

export async function joinWaitlistAction(
  _previous: Result<JoinWaitlistResult> | null,
  formData: FormData,
): Promise<Result<JoinWaitlistResult>> {
  const correlationId = newCorrelationId();

  const parsed = joinWaitlistSchema.safeParse({
    email: formData.get('email'),
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
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
      ...logErrorContext(error, correlationId, 'consume_rate_limit', Object.values(parsed.data)),
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
    const source = 'landing_page';
    const result = await joinWaitlist(db, {
      email: parsed.data.email,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      source,
    });

    if (result.status === 'joined') {
      const deliveries = await Promise.allSettled([
        sendWaitlistConfirmation({
          email: parsed.data.email,
          firstName: parsed.data.firstName,
          lastName: parsed.data.lastName,
          status: result.status,
        }),
        sendWaitlistNotification({
          email: parsed.data.email,
          firstName: parsed.data.firstName,
          lastName: parsed.data.lastName,
          status: result.status,
          source,
        }),
      ]);

      for (const [index, delivery] of deliveries.entries()) {
        if (delivery.status === 'rejected') {
          logger.error('waitlist.email_failed', {
            ...logErrorContext(
              delivery.reason,
              correlationId,
              index === 0 ? 'waitlist_confirmation_email' : 'waitlist_notification_email',
              Object.values(parsed.data),
            ),
          });
        }
      }
    }

    return ok(result);
  } catch (error) {
    logger.error('waitlist.join_failed', {
      ...logErrorContext(
        error,
        correlationId,
        'waitlist_signups.insert',
        Object.values(parsed.data),
      ),
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
