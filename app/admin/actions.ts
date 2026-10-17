'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { AppError, fail, newCorrelationId, ok, type Result } from '@/lib/errors';
import { signInSchema } from '@/lib/validation/auth';
import { recruitmentUpdateSchema } from '@/lib/validation/waitlist';
import { toFieldErrors } from '@/lib/validation/field-errors';
import { isSafeInternalPath } from '@/lib/utils/safe-path';
import { logger } from '@/lib/logger';
import * as authService from '@/services/auth';
import type { RequestContext } from '@/services/auth';
import {
  signInWaitlistAdmin,
  updateRecruitment,
  type RecruitmentUpdateResult,
} from '@/services/waitlist/recruitment';

/**
 * Team-only Server Actions for Waitlist & Pilot Recruitment.
 *
 * These validate input and delegate. Authorization lives in
 * services/waitlist/recruitment and, underneath it, in RLS — none of it here.
 * Unlike `app/(auth)/actions.ts`, sign-in is NOT refused in WAITLIST_ONLY_MODE:
 * the service admits only `waitlist_admin` staff and signs anyone else
 * straight back out.
 */

async function requestContext(): Promise<RequestContext> {
  const h = await headers();
  return {
    correlationId: newCorrelationId(),
    // Client-controllable; audit context only, never authorization.
    ipAddress: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: h.get('user-agent'),
  };
}

function flatten(error: unknown, ctx: RequestContext, event: string): Result<never> {
  if (error instanceof AppError) return fail(error);
  logger.error(event, {
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

export async function staffSignInAction(
  _prev: Result<never> | null,
  formData: FormData,
): Promise<Result<never>> {
  const ctx = await requestContext();

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
    await signInWaitlistAdmin(db, parsed.data, ctx);
  } catch (error) {
    return flatten(error, ctx, 'admin.sign_in_unexpected');
  }

  // Same-origin, team-area paths only — never an open redirect.
  const requested = String(formData.get('next') ?? '');
  const next =
    isSafeInternalPath(requested) && requested.startsWith('/admin/')
      ? requested
      : '/admin/waitlist';
  redirect(next);
}

export async function staffSignOutAction(): Promise<void> {
  const ctx = await requestContext();
  const db = await createClient();
  await authService.signOut(db, ctx);
  redirect('/admin/login');
}

export async function updateRecruitmentAction(
  _prev: Result<RecruitmentUpdateResult> | null,
  formData: FormData,
): Promise<Result<RecruitmentUpdateResult>> {
  const ctx = await requestContext();

  const parsed = recruitmentUpdateSchema.safeParse({
    signupId: formData.get('signupId'),
    recruitmentStatus: formData.get('recruitmentStatus'),
    recruitmentNotes: formData.get('recruitmentNotes'),
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
    const result = await updateRecruitment(db, parsed.data, ctx);
    revalidatePath('/admin/waitlist');
    return ok(result);
  } catch (error) {
    return flatten(error, ctx, 'admin.recruitment_update_unexpected');
  }
}
