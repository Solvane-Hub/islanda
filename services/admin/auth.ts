import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { AppError, newCorrelationId } from '@/lib/errors';
import { clientEnv } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAllowlistedEmail } from '@/lib/admin/allowlist';
import { logger } from '@/lib/logger';
import type { SignInInput } from '@/lib/validation/auth';
import { recordAuditEvent } from '@/services/audit';
import * as authService from '@/services/auth';
import type { RequestContext } from '@/services/auth';
import { getAdminAccess, type AdminAccess } from './access';

/**
 * Administrator sign-in, MFA and password management.
 *
 * Passwords are never stored, logged or compared here: Supabase Auth owns
 * them. MFA is TOTP through Supabase Auth's own MFA API; an administrator
 * session becomes `aal2` only after a correct code, and Postgres refuses all
 * admin data to anything less.
 */

type Db = SupabaseClient<Database>;

const NOT_ADMIN_MESSAGE = 'We could not sign you in with those details.';

function auditCtx(ctx: RequestContext) {
  return {
    correlationId: ctx.correlationId ?? null,
    ipAddress: ctx.ipAddress ?? null,
    userAgent: ctx.userAgent ?? null,
  };
}

/**
 * Normal password sign-in, then an immediate sign-out unless the account is a
 * provisioned administrator. The message is identical for a wrong password, an
 * unknown email and a non-administrator, so this page never reveals whether an
 * email belongs to an administrator. Returns the next access state (MFA, a
 * required password change, or full access) for routing.
 */
export async function signInPlatformAdmin(
  db: Db,
  input: SignInInput,
  ctx: RequestContext = {},
): Promise<AdminAccess> {
  const correlationId = ctx.correlationId ?? newCorrelationId();

  try {
    await authService.signIn(db, input, { ...ctx, correlationId });
  } catch (error) {
    if (error instanceof AppError && error.code === 'AUTH_RATE_LIMITED') throw error;
    throw new AppError({ code: 'FORBIDDEN', humanMessage: NOT_ADMIN_MESSAGE, correlationId });
  }

  const access = await getAdminAccess(db);
  if (access.kind === 'signed_out' || access.kind === 'denied') {
    await recordAuditEvent({
      event: 'admin.sign_in_denied',
      actorId: access.kind === 'denied' ? access.userId : null,
      ...auditCtx({ ...ctx, correlationId }),
    });
    // Local only: this browser's new session ends; the account's other sessions are untouched.
    await db.auth.signOut({ scope: 'local' });
    throw new AppError({ code: 'FORBIDDEN', humanMessage: NOT_ADMIN_MESSAGE, correlationId });
  }

  await recordAuditEvent({
    event: 'admin.signed_in',
    actorId: access.userId,
    ...auditCtx({ ...ctx, correlationId }),
    metadata: { next: access.kind },
  });
  return access;
}

/**
 * `local` ends this browser’s session; `global` ends every session for the
 * account (all devices), e.g. after using a shared computer.
 */
export async function signOutPlatformAdmin(
  db: Db,
  ctx: RequestContext = {},
  scope: 'local' | 'global' = 'local',
): Promise<void> {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (user) {
    await recordAuditEvent({
      event: 'admin.signed_out',
      actorId: user.id,
      ...auditCtx(ctx),
      metadata: { scope },
    });
  }
  await db.auth.signOut({ scope });
}

/** The caller’s verified authenticators (for the settings page). */
export async function verifiedFactors(db: Db): Promise<{ id: string; createdAt: string }[]> {
  const { data } = await db.auth.mfa.listFactors();
  return (data?.totp ?? [])
    .filter((f) => f.status === 'verified')
    .map((f) => ({ id: f.id, createdAt: f.created_at }));
}

/* ── MFA ──────────────────────────────────────────────────────────────── */

export interface MfaEnrollment {
  factorId: string;
  /** SVG data URI from Supabase Auth — rendered as an image, never stored. */
  qrCode: string;
  /** For manual entry into an authenticator app. Shown once, never stored or logged. */
  secret: string;
}

function requireMfaStage(access: AdminAccess, correlationId: string) {
  if (access.kind !== 'mfa_enroll' && access.kind !== 'mfa_verify' && access.kind !== 'admin') {
    throw new AppError({
      code: 'FORBIDDEN',
      humanMessage: 'Sign in again to continue.',
      correlationId,
    });
  }
  return access;
}

/**
 * Starts TOTP enrolment for an allowlisted administrator who has no verified
 * factor yet. Any abandoned, unverified factor is removed first so retries
 * never pile up.
 */
export async function startMfaEnrollment(db: Db, ctx: RequestContext = {}): Promise<MfaEnrollment> {
  const correlationId = ctx.correlationId ?? newCorrelationId();
  const access = requireMfaStage(await getAdminAccess(db), correlationId);
  if (access.kind !== 'mfa_enroll') {
    throw new AppError({
      code: 'FORBIDDEN',
      humanMessage: 'An authenticator is already set up for this account.',
      correlationId,
    });
  }

  const { data: factors } = await db.auth.mfa.listFactors();
  for (const factor of factors?.all ?? []) {
    if (factor.factor_type === 'totp' && factor.status !== 'verified') {
      await db.auth.mfa.unenroll({ factorId: factor.id });
    }
  }

  const { data, error } = await db.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: `Islanda admin ${new Date().toISOString().slice(0, 10)}`,
  });
  if (error || !data) {
    logger.error('admin.mfa_enroll_failed', { correlationId, code: error?.code ?? 'unknown' });
    throw new AppError({
      code: 'UNEXPECTED',
      humanMessage:
        'Two-step verification could not be started. Multi-factor authentication may be turned off for this project — see the admin setup guide.',
      correlationId,
    });
  }
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

/** Verifies a 6-digit code; on success the session is upgraded to aal2. */
export async function verifyMfaCode(
  db: Db,
  input: { factorId: string; code: string },
  ctx: RequestContext = {},
): Promise<void> {
  const correlationId = ctx.correlationId ?? newCorrelationId();
  const access = requireMfaStage(await getAdminAccess(db), correlationId);

  // The factor must belong to this user; listFactors only returns the caller's own.
  const { data: factors } = await db.auth.mfa.listFactors();
  const owned = (factors?.all ?? []).some(
    (f) => f.id === input.factorId && f.factor_type === 'totp',
  );
  if (!owned) {
    throw new AppError({
      code: 'FORBIDDEN',
      humanMessage: 'That authenticator could not be found. Start again.',
      correlationId,
    });
  }

  const enrolling = access.kind === 'mfa_enroll';
  const { error } = await db.auth.mfa.challengeAndVerify({
    factorId: input.factorId,
    code: input.code,
  });
  if (error) {
    await recordAuditEvent({ event: 'admin.mfa_failed', actorId: access.userId, ...auditCtx(ctx) });
    throw new AppError({
      code: 'VALIDATION_FAILED',
      humanMessage: 'That code did not work. Check the time on your phone and try the newest code.',
      correlationId,
    });
  }

  await recordAuditEvent({
    event: enrolling ? 'admin.mfa_enrolled' : 'admin.mfa_verified',
    actorId: access.userId,
    ...auditCtx({ ...ctx, correlationId }),
  });
}

/* ── Passwords ────────────────────────────────────────────────────────── */

/**
 * Confirms the current password without touching the caller's session: a
 * throwaway, non-persisting client signs in and immediately out. Signing in
 * on the caller's own client would replace their MFA session with a fresh
 * single-factor one.
 */
async function currentPasswordIsCorrect(email: string, password: string): Promise<boolean> {
  const probe = createSupabaseClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );
  const { error } = await probe.auth.signInWithPassword({ email, password });
  if (error) return false;
  await probe.auth.signOut({ scope: 'local' });
  return true;
}

/** Clears the "change your temporary password" flag. Service role: app_metadata is not user-writable. */
async function clearPasswordChangeFlag(userId: string): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;
  const { error } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { password_change_required: false },
  });
  if (error) logger.error('admin.password_flag_clear_failed', { code: error.code ?? 'unknown' });
}

/**
 * Password change for a signed-in administrator. Requires the current
 * password (a stolen, unlocked session alone cannot set a new one), and is
 * also the forced first-sign-in change for a temporary password.
 */
export async function changeAdminPassword(
  db: Db,
  input: { currentPassword: string; newPassword: string },
  ctx: RequestContext = {},
): Promise<void> {
  const correlationId = ctx.correlationId ?? newCorrelationId();
  const access = await getAdminAccess(db);
  if (access.kind !== 'admin' && access.kind !== 'password_change') {
    throw new AppError({
      code: 'FORBIDDEN',
      humanMessage: 'Sign in again to change your password.',
      correlationId,
    });
  }

  if (input.currentPassword === input.newPassword) {
    throw new AppError({
      code: 'VALIDATION_FAILED',
      humanMessage: 'Choose a new password that is different from the current one.',
      correlationId,
    });
  }

  if (!(await currentPasswordIsCorrect(access.email, input.currentPassword))) {
    throw new AppError({
      code: 'VALIDATION_FAILED',
      humanMessage: 'Your current password is not correct.',
      correlationId,
    });
  }

  const { error } = await db.auth.updateUser({ password: input.newPassword });
  if (error) {
    logger.error('admin.password_change_failed', { correlationId, code: error.code ?? 'unknown' });
    throw new AppError({
      code: 'VALIDATION_FAILED',
      humanMessage:
        error.code === 'insufficient_aal'
          ? 'Verify your authenticator code first, then change your password.'
          : 'That password could not be set. Choose a different, longer password.',
      correlationId,
    });
  }

  await clearPasswordChangeFlag(access.userId);
  await recordAuditEvent({
    event: 'admin.password_changed',
    actorId: access.userId,
    ...auditCtx({ ...ctx, correlationId }),
    metadata: { forced: access.kind === 'password_change' },
  });
}

/**
 * Sends a recovery email for an administrator address. Indistinguishable from
 * the response for any other address: non-administrator emails are simply not
 * sent, so this page cannot be used to discover who the administrators are.
 */
export async function requestAdminPasswordReset(
  db: Db,
  email: string,
  ctx: RequestContext = {},
): Promise<void> {
  if (!isAllowlistedEmail(email)) return;
  await authService.requestPasswordReset(db, { email }, ctx, '/admin/reset-password');
  await recordAuditEvent({ event: 'admin.password_reset_requested', ...auditCtx(ctx) });
}

/**
 * Completes a reset from the emailed recovery link. Only an allowlisted
 * identity may use this page; administrators with an authenticator must
 * verify it first (Supabase refuses a password update below aal2 when MFA is
 * enrolled).
 */
export async function completeAdminPasswordReset(
  db: Db,
  newPassword: string,
  ctx: RequestContext = {},
): Promise<void> {
  const correlationId = ctx.correlationId ?? newCorrelationId();
  const access = await getAdminAccess(db);
  if (access.kind === 'signed_out' || access.kind === 'denied' || access.kind === 'mfa_verify') {
    throw new AppError({
      code: 'FORBIDDEN',
      humanMessage:
        access.kind === 'mfa_verify'
          ? 'Verify your authenticator code first, then set your new password.'
          : 'This reset link is no longer valid. Request a new one.',
      correlationId,
    });
  }

  // Only a session that came from the emailed recovery link, recently, may set
  // a password without knowing the current one.
  const { data: verified } = await db.auth.getClaims();
  const amr = (verified?.claims?.amr ?? []) as { method: string; timestamp: number }[];
  const now = Math.floor(Date.now() / 1000);
  const fromRecoveryLink = amr.some(
    (entry) =>
      ['recovery', 'otp', 'invite', 'magiclink'].includes(entry.method) &&
      now - entry.timestamp < 30 * 60,
  );
  if (!fromRecoveryLink) {
    throw new AppError({
      code: 'FORBIDDEN',
      humanMessage: 'Open the reset link from your email again (links expire after 30 minutes).',
      correlationId,
    });
  }

  const { error } = await db.auth.updateUser({ password: newPassword });
  if (error) {
    throw new AppError({
      code: 'VALIDATION_FAILED',
      humanMessage:
        error.code === 'insufficient_aal'
          ? 'Verify your authenticator code first, then set your new password.'
          : 'That password could not be set. Choose a different, longer password.',
      correlationId,
    });
  }
  await clearPasswordChangeFlag(access.userId);
  await recordAuditEvent({
    event: 'admin.password_changed',
    actorId: access.userId,
    ...auditCtx({ ...ctx, correlationId }),
    metadata: { via: 'reset' },
  });
}
