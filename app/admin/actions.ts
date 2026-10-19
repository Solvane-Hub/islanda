'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { AppError, fail, ok, type Result } from '@/lib/errors';
import { passwordSchema, requestPasswordResetSchema, signInSchema } from '@/lib/validation/auth';
import { recruitmentUpdateSchema } from '@/lib/validation/waitlist';
import { toFieldErrors } from '@/lib/validation/field-errors';
import { logger } from '@/lib/logger';
import type { RequestContext } from '@/services/auth';
import {
  changeAdminPassword,
  completeAdminPasswordReset,
  requestAdminPasswordReset,
  signInPlatformAdmin,
  signOutPlatformAdmin,
  startMfaEnrollment,
  verifyMfaCode,
  type MfaEnrollment,
} from '@/services/admin/auth';
import { updateRecruitment, type RecruitmentUpdateResult } from '@/services/waitlist/recruitment';
import { adminRequestContext, safeAdminNext } from './_lib/guard';

/**
 * Admin portal Server Actions. They validate input and delegate; every
 * authorization decision lives in services/admin and, underneath it, in
 * Postgres (`app.is_platform_admin()`). Sign-in is NOT refused in
 * WAITLIST_ONLY_MODE: the service admits only provisioned administrators and
 * signs anyone else straight back out.
 */

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

function invalid(
  ctx: RequestContext,
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
): Result<never> {
  return fail(
    new AppError({
      code: 'VALIDATION_FAILED',
      humanMessage: 'Please correct the highlighted fields.',
      correlationId: ctx.correlationId,
    }),
    toFieldErrors(issues),
  );
}

/* ── Sign in / out ────────────────────────────────────────────────────── */

export async function staffSignInAction(
  _prev: Result<never> | null,
  formData: FormData,
): Promise<Result<never>> {
  const ctx = await adminRequestContext();
  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return invalid(ctx, parsed.error.issues);

  let destination: string;
  try {
    const db = await createClient();
    const access = await signInPlatformAdmin(db, parsed.data, ctx);
    const next = safeAdminNext(String(formData.get('next') ?? ''));
    destination =
      access.kind === 'password_change'
        ? '/admin/account/password'
        : access.kind === 'admin'
          ? next
          : `/admin/mfa?next=${encodeURIComponent(next)}`;
  } catch (error) {
    return flatten(error, ctx, 'admin.sign_in_unexpected');
  }
  redirect(destination);
}

export async function staffSignOutAction(): Promise<void> {
  const ctx = await adminRequestContext();
  const db = await createClient();
  await signOutPlatformAdmin(db, ctx);
  redirect('/admin/login');
}

export async function signOutEverywhereAction(): Promise<void> {
  const ctx = await adminRequestContext();
  const db = await createClient();
  await signOutPlatformAdmin(db, ctx, 'global');
  redirect('/admin/login');
}

/* ── MFA ──────────────────────────────────────────────────────────────── */

export async function startMfaEnrollmentAction(): Promise<Result<MfaEnrollment>> {
  const ctx = await adminRequestContext();
  try {
    const db = await createClient();
    return ok(await startMfaEnrollment(db, ctx));
  } catch (error) {
    return flatten(error, ctx, 'admin.mfa_enroll_unexpected');
  }
}

const mfaCodeSchema = z.object({
  factorId: z.uuid(),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the 6-digit code from your authenticator app.'),
});

export async function verifyMfaAction(
  _prev: Result<never> | null,
  formData: FormData,
): Promise<Result<never>> {
  const ctx = await adminRequestContext();
  const parsed = mfaCodeSchema.safeParse({
    factorId: formData.get('factorId'),
    code: formData.get('code'),
  });
  if (!parsed.success) return invalid(ctx, parsed.error.issues);

  try {
    const db = await createClient();
    await verifyMfaCode(db, parsed.data, ctx);
  } catch (error) {
    return flatten(error, ctx, 'admin.mfa_verify_unexpected');
  }
  redirect(safeAdminNext(String(formData.get('next') ?? '')));
}

/* ── Passwords ────────────────────────────────────────────────────────── */

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirm your new password.'),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'Those passwords do not match.',
    path: ['confirmPassword'],
  });

export async function changePasswordAction(
  _prev: Result<{ changed: true }> | null,
  formData: FormData,
): Promise<Result<{ changed: true }>> {
  const ctx = await adminRequestContext();
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get('currentPassword'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  });
  if (!parsed.success) return invalid(ctx, parsed.error.issues);

  try {
    const db = await createClient();
    await changeAdminPassword(
      db,
      { currentPassword: parsed.data.currentPassword, newPassword: parsed.data.password },
      ctx,
    );
    return ok({ changed: true });
  } catch (error) {
    return flatten(error, ctx, 'admin.password_change_unexpected');
  }
}

export async function requestAdminResetAction(
  _prev: Result<{ sent: true }> | null,
  formData: FormData,
): Promise<Result<{ sent: true }>> {
  const ctx = await adminRequestContext();
  const parsed = requestPasswordResetSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) return invalid(ctx, parsed.error.issues);
  try {
    const db = await createClient();
    await requestAdminPasswordReset(db, parsed.data.email, ctx);
  } catch (error) {
    // Rate limiting is surfaced; anything else looks identical to success so
    // this page cannot reveal which addresses are administrators.
    if (error instanceof AppError && error.code === 'AUTH_RATE_LIMITED') return fail(error);
    logger.error('admin.reset_request_failed', { correlationId: ctx.correlationId });
  }
  return ok({ sent: true });
}

const resetSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirm your password.'),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'Those passwords do not match.',
    path: ['confirmPassword'],
  });

export async function completeAdminResetAction(
  _prev: Result<{ reset: true }> | null,
  formData: FormData,
): Promise<Result<{ reset: true }>> {
  const ctx = await adminRequestContext();
  const parsed = resetSchema.safeParse({
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  });
  if (!parsed.success) return invalid(ctx, parsed.error.issues);
  try {
    const db = await createClient();
    await completeAdminPasswordReset(db, parsed.data.password, ctx);
    return ok({ reset: true });
  } catch (error) {
    return flatten(error, ctx, 'admin.reset_unexpected');
  }
}

/* ── Recruitment ──────────────────────────────────────────────────────── */

export async function updateRecruitmentAction(
  _prev: Result<RecruitmentUpdateResult> | null,
  formData: FormData,
): Promise<Result<RecruitmentUpdateResult>> {
  const ctx = await adminRequestContext();
  const full = formData.get('editor') === 'full';
  const parsed = recruitmentUpdateSchema.safeParse({
    signupId: formData.get('signupId'),
    recruitmentStatus: formData.get('recruitmentStatus'),
    recruitmentNotes: formData.get('recruitmentNotes'),
    ...(full
      ? {
          contactedOn: formData.get('contactedOn'),
          confirmedOn: formData.get('confirmedOn'),
          testedOn: formData.get('testedOn'),
          feedbackSummary: formData.get('feedbackSummary'),
          feedbackLink: formData.get('feedbackLink'),
        }
      : {}),
  });
  if (!parsed.success) return invalid(ctx, parsed.error.issues);

  try {
    const db = await createClient();
    const result = await updateRecruitment(db, parsed.data, ctx);
    revalidatePath('/admin/waitlist');
    revalidatePath('/admin/recruitment');
    revalidatePath(`/admin/waitlist/${parsed.data.signupId}`);
    return ok(result);
  } catch (error) {
    return flatten(error, ctx, 'admin.recruitment_update_unexpected');
  }
}
