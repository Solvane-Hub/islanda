'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppError, fail, newCorrelationId, ok, type Result } from '@/lib/errors';
import {
  requestPasswordResetSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from '@/lib/validation/auth';
import * as authService from '@/services/auth';
import type { RequestContext } from '@/services/auth';
import { isSafeInternalPath } from '@/lib/utils/safe-path';
import { toFieldErrors } from '@/lib/validation/field-errors';
import { logger } from '@/lib/logger';
import { serverEnv } from '@/lib/env';

/**
 * Auth Server Actions.
 *
 * ADR-0003 — Server Actions are the default interaction pattern.
 * These validate input and delegate. They contain NO business logic: everything
 * substantive lives in services/auth (Platform Architecture).
 */

async function requestContext(): Promise<RequestContext> {
  const h = await headers();
  return {
    correlationId: newCorrelationId(),
    // x-forwarded-for is client-controllable; used for audit context only,
    // never for authorization.
    ipAddress: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: h.get('user-agent'),
  };
}

function waitlistOnlyAuthFailure(ctx: RequestContext): Result<never> {
  return fail(
    new AppError({
      code: 'FORBIDDEN',
      humanMessage:
        'Islanda is currently available by waitlist invitation. Join the waitlist to be notified when access opens.',
      correlationId: ctx.correlationId,
    }),
  );
}

function flatten(error: unknown, ctx: RequestContext): Result<never> {
  if (error instanceof AppError) return fail(error);
  logger.error('auth.unexpected', {
    correlationId: ctx.correlationId,
    code: error instanceof Error ? error.name : 'unknown',
  });
  return fail(
    new AppError({
      code: 'UNEXPECTED',
      humanMessage: 'Something went wrong. Please try again.',
      correlationId: ctx.correlationId,
      cause: error,
    }),
  );
}

export async function signUpAction(
  _prev: Result<{ requiresEmailConfirmation: boolean }> | null,
  formData: FormData,
): Promise<Result<{ requiresEmailConfirmation: boolean }>> {
  const ctx = await requestContext();
  if (serverEnv.WAITLIST_ONLY_MODE) return waitlistOnlyAuthFailure(ctx);

  const parsed = signUpSchema.safeParse({
    fullName: formData.get('fullName'),
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return fail(
      new AppError({
        code: 'VALIDATION_FAILED',
        humanMessage: 'Please correct the highlighted fields.',
        correlationId: ctx.correlationId,
      }),
      toFieldErrors(parsed.error.issues),
    );
  }

  try {
    const db = await createClient();
    const result = await authService.signUp(db, parsed.data, ctx);
    return ok(result);
  } catch (error) {
    return flatten(error, ctx);
  }
}

export async function signInAction(
  _prev: Result<{ next: string }> | null,
  formData: FormData,
): Promise<Result<{ next: string }>> {
  const ctx = await requestContext();
  if (serverEnv.WAITLIST_ONLY_MODE) return waitlistOnlyAuthFailure(ctx);

  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return fail(
      new AppError({
        code: 'VALIDATION_FAILED',
        humanMessage: 'Please correct the highlighted fields.',
        correlationId: ctx.correlationId,
      }),
      toFieldErrors(parsed.error.issues),
    );
  }

  try {
    const db = await createClient();
    await authService.signIn(db, parsed.data, ctx);
  } catch (error) {
    return flatten(error, ctx);
  }

  // Only follow same-origin relative paths — an open redirect here would be a
  // credential-phishing vector immediately after sign-in.
  const requested = String(formData.get('next') ?? '');
  const next = isSafeInternalPath(requested) ? requested : '/dashboard';
  redirect(next);
}

export async function signOutAction(): Promise<void> {
  const ctx = await requestContext();
  const db = await createClient();
  await authService.signOut(db, ctx);
  redirect('/login');
}

export async function requestPasswordResetAction(
  _prev: Result<{ sent: true }> | null,
  formData: FormData,
): Promise<Result<{ sent: true }>> {
  const ctx = await requestContext();
  const parsed = requestPasswordResetSchema.safeParse({ email: formData.get('email') });

  if (!parsed.success) {
    return fail(
      new AppError({
        code: 'VALIDATION_FAILED',
        humanMessage: 'Please correct the highlighted fields.',
        correlationId: ctx.correlationId,
      }),
      toFieldErrors(parsed.error.issues),
    );
  }

  try {
    const db = await createClient();
    await authService.requestPasswordReset(db, parsed.data, ctx);
    return ok({ sent: true });
  } catch (error) {
    return flatten(error, ctx);
  }
}

export async function resetPasswordAction(
  _prev: Result<{ reset: true }> | null,
  formData: FormData,
): Promise<Result<{ reset: true }>> {
  const ctx = await requestContext();
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  });

  if (!parsed.success) {
    return fail(
      new AppError({
        code: 'VALIDATION_FAILED',
        humanMessage: 'Please correct the highlighted fields.',
        correlationId: ctx.correlationId,
      }),
      toFieldErrors(parsed.error.issues),
    );
  }

  try {
    const db = await createClient();
    await authService.resetPassword(db, parsed.data, ctx);
    return ok({ reset: true });
  } catch (error) {
    return flatten(error, ctx);
  }
}
