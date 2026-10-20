'use server';

import { cookies, headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { AppError, fail, newCorrelationId, ok, type Result } from '@/lib/errors';
import { toFieldErrors } from '@/lib/validation/field-errors';
import {
  joinWaitlistSchema,
  surveyAnswersFromForm,
  waitlistSurveySchema,
} from '@/lib/validation/waitlist';
import { logger } from '@/lib/logger';
import { deploymentEnvironment } from '@/lib/env';
import { sendWaitlistConfirmation, sendWaitlistNotification } from '@/lib/email/resend';
import {
  consumeWaitlistRateLimit,
  consumeWaitlistSurveyRateLimit,
  getWaitlistSurvey,
  isTestSignup,
  joinWaitlist,
  submitWaitlistSurvey,
  type JoinWaitlistResult,
  type SubmitWaitlistSurveyResult,
} from '@/services/waitlist';
import { errorCategoryFor, recordServerEvent } from '@/services/analytics';
import { analyticsContext } from '@/services/analytics/context';
import type { ServerEventName } from '@/lib/analytics/events';
import type { StoredSurveyAnswers } from '@/services/waitlist';

export type { JoinWaitlistResult, SubmitWaitlistSurveyResult } from '@/services/waitlist';

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

/** Personal values to scrub from development-only error messages. */
function sensitive(values: Record<string, unknown>): string[] {
  return Object.values(values).filter((v): v is string => typeof v === 'string' && v.length > 0);
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

async function joinWaitlistOnce(
  _previous: Result<JoinWaitlistResult> | null,
  formData: FormData,
): Promise<Result<JoinWaitlistResult>> {
  const correlationId = newCorrelationId();

  const parsed = joinWaitlistSchema.safeParse({
    email: formData.get('email'),
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    phone: formData.get('phone'),
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
      ...logErrorContext(error, correlationId, 'consume_rate_limit', sensitive(parsed.data)),
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
    // Preview and local signups land in the same database as real ones; the
    // source marks them so reports and the admin list can leave them out.
    const deployment = deploymentEnvironment();
    const source = deployment === 'production' ? 'landing_page' : deployment;
    const result = await joinWaitlist(db, {
      email: parsed.data.email,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      phone: parsed.data.phone,
      source,
    });

    if (result.status === 'joined') {
      // The person who signed up always gets their confirmation; the team is
      // only told about real signups — never a test address or a preview/local run.
      const notifyTeam = !isTestSignup(parsed.data.email, source);
      const deliveries = await Promise.allSettled([
        sendWaitlistConfirmation({
          email: parsed.data.email,
          firstName: parsed.data.firstName,
          lastName: parsed.data.lastName,
          status: result.status,
        }),
        notifyTeam
          ? sendWaitlistNotification({
              email: parsed.data.email,
              firstName: parsed.data.firstName,
              lastName: parsed.data.lastName,
              status: result.status,
              source,
            })
          : Promise.resolve(),
      ]);

      for (const [index, delivery] of deliveries.entries()) {
        if (delivery.status === 'rejected') {
          logger.error('waitlist.email_failed', {
            ...logErrorContext(
              delivery.reason,
              correlationId,
              index === 0 ? 'waitlist_confirmation_email' : 'waitlist_notification_email',
              sensitive(parsed.data),
            ),
          });
        }
      }
    }

    return ok(result);
  } catch (error) {
    logger.error('waitlist.join_failed', {
      ...logErrorContext(error, correlationId, 'waitlist_signups.insert', sensitive(parsed.data)),
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

/**
 * Optional follow-up questions, asked only after a signup has succeeded.
 *
 * Identified by the one-time survey token returned from `joinWaitlistAction`
 * — never by email, so this cannot be used to reach someone else's signup.
 * Every answer is optional. Submitting nothing is the same as skipping, and
 * submitting again overwrites the same row; no path here creates a signup.
 */
async function submitWaitlistSurveyOnce(
  _previous: Result<SubmitWaitlistSurveyResult> | null,
  formData: FormData,
): Promise<Result<SubmitWaitlistSurveyResult>> {
  const correlationId = newCorrelationId();

  const parsed = waitlistSurveySchema.safeParse({
    token: formData.get('token'),
    final: formData.get('final') === 'true',
    answers: surveyAnswersFromForm(formData),
  });
  if (!parsed.success) {
    // Answer errors are reported against the answer's own field name.
    const fieldErrors = toFieldErrors(
      parsed.error.issues.map((issue) =>
        issue.path[0] === 'answers' ? { ...issue, path: issue.path.slice(1) } : issue,
      ),
    );
    // A bad token is not something the visitor can fix by editing a field.
    if (fieldErrors.token) {
      return fail(
        new AppError({
          code: 'NOT_FOUND',
          humanMessage:
            'We could not save your answers to your signup. You are still on the waitlist.',
          correlationId,
        }),
      );
    }
    return fail(
      new AppError({
        code: 'VALIDATION_FAILED',
        humanMessage: 'Please check the highlighted answers.',
        correlationId,
      }),
      fieldErrors,
    );
  }

  const db = await createClient();
  const ip = await requestIp();

  try {
    const limit = await consumeWaitlistSurveyRateLimit(db, ip);
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
    logger.error('waitlist.survey_rate_limit_unavailable', {
      ...logErrorContext(error, correlationId, 'consume_rate_limit', []),
    });
    return fail(
      new AppError({
        code: 'UNEXPECTED',
        humanMessage: 'We could not save your answers just now. Please try again.',
        correlationId,
        cause: error,
      }),
    );
  }

  try {
    const result = await submitWaitlistSurvey(db, parsed.data);
    if (result.status === 'not_found') {
      return fail(
        new AppError({
          code: 'NOT_FOUND',
          humanMessage:
            'We could not save your answers to your signup. You are still on the waitlist.',
          correlationId,
        }),
      );
    }
    return ok(result);
  } catch (error) {
    logger.error('waitlist.survey_failed', {
      ...logErrorContext(error, correlationId, 'save_waitlist_survey', [
        parsed.data.token,
        ...sensitive(parsed.data.answers),
      ]),
    });
    return fail(
      new AppError({
        code: 'UNEXPECTED',
        humanMessage: 'We could not save your answers just now. Please try again.',
        correlationId,
        cause: error,
      }),
    );
  }
}

/* ── Analytics around the public actions ──────────────────────────────── */

/**
 * Records what the server verified happened. Runs after the action has
 * decided its result, never changes it, and never fails it: analytics is
 * fail-open (services/analytics). No name, email, phone or answer is sent —
 * only the outcome and, for failures, a safe error category.
 */
async function recordOutcome(
  name: ServerEventName,
  extra: { errorCategory?: string; properties?: Record<string, string | number | boolean> } = {},
): Promise<void> {
  try {
    const [h, c] = await Promise.all([headers(), cookies()]);
    await recordServerEvent(
      {
        name,
        path: '/',
        status: name.endsWith('_failed') ? 'failure' : 'success',
        ...(extra.errorCategory ? { errorCategory: errorCategoryFor(extra.errorCategory) } : {}),
        ...(extra.properties ? { properties: extra.properties } : {}),
      },
      analyticsContext(h, (cookieName) => c.get(cookieName)?.value),
    );
  } catch {
    // Never let analytics affect a signup or a save.
  }
}

export async function joinWaitlistAction(
  previous: Result<JoinWaitlistResult> | null,
  formData: FormData,
): Promise<Result<JoinWaitlistResult>> {
  const result = await joinWaitlistOnce(previous, formData);
  if (result.ok) {
    await recordOutcome(
      result.data.status === 'joined' ? 'waitlist_signup_succeeded' : 'waitlist_signup_duplicate',
    );
  } else {
    await recordOutcome('waitlist_signup_failed', { errorCategory: result.code });
  }
  return result;
}

export async function submitWaitlistSurveyAction(
  previous: Result<SubmitWaitlistSurveyResult> | null,
  formData: FormData,
): Promise<Result<SubmitWaitlistSurveyResult>> {
  const result = await submitWaitlistSurveyOnce(previous, formData);
  const section = Number(formData.get('section') ?? 0) || 0;
  if (result.ok && result.data.status === 'saved') {
    await recordOutcome(
      formData.get('final') === 'true' ? 'waitlist_survey_completed' : 'waitlist_survey_saved',
      { properties: { section } },
    );
  } else if (!result.ok) {
    await recordOutcome('waitlist_survey_failed', {
      errorCategory: result.code,
      properties: { section },
    });
  }
  return result;
}

/**
 * The visitor's own saved answers, so they can come back (same browser, same
 * token) and update them. The token is the only key; an unknown token returns
 * null and reveals nothing.
 */
export async function getWaitlistSurveyAction(token: string): Promise<StoredSurveyAnswers | null> {
  if (typeof token !== 'string' || token.length < 32 || token.length > 128) return null;
  try {
    const db = await createClient();
    return await getWaitlistSurvey(db, token);
  } catch (error) {
    logger.error('waitlist.survey_read_failed', {
      code: error instanceof Error ? error.name : 'unknown',
    });
    return null;
  }
}
