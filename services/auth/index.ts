import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { AppError, newCorrelationId } from '@/lib/errors';
import { recordAuditEvent } from '@/services/audit';
import { logger } from '@/lib/logger';
import { serverEnv } from '@/lib/env';
import type {
  RequestPasswordResetInput,
  ResetPasswordInput,
  SignInInput,
  SignUpInput,
} from '@/lib/validation/auth';

/**
 * Authentication Application Service.
 *
 * Platform Architecture — all business rules live here. Server Actions validate
 * input and delegate; they contain no logic of their own.
 */

export interface RequestContext {
  correlationId?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Translates Supabase auth errors into our typed vocabulary.
 *
 * Supabase messages are provider implementation detail and must not reach a
 * user (Frontend Architecture: errors are human-readable and non-technical).
 */
function translateAuthError(message: string, correlationId: string): AppError {
  const m = message.toLowerCase();

  if (m.includes('invalid login credentials')) {
    return new AppError({
      code: 'AUTH_INVALID_CREDENTIALS',
      // Deliberately does not reveal whether the account exists.
      humanMessage: 'That email or password is incorrect.',
      developerMessage: message,
      correlationId,
    });
  }
  if (m.includes('already registered') || m.includes('already been registered')) {
    return new AppError({
      code: 'AUTH_EMAIL_IN_USE',
      humanMessage: 'An account with that email already exists. Try signing in instead.',
      developerMessage: message,
      correlationId,
    });
  }
  if (m.includes('email not confirmed')) {
    return new AppError({
      code: 'AUTH_EMAIL_NOT_CONFIRMED',
      humanMessage: 'Please confirm your email address first. Check your inbox for the link.',
      developerMessage: message,
      correlationId,
    });
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return new AppError({
      code: 'AUTH_RATE_LIMITED',
      humanMessage: 'Too many attempts. Please wait a few minutes and try again.',
      developerMessage: message,
      correlationId,
    });
  }
  if (m.includes('password') && (m.includes('short') || m.includes('weak'))) {
    return new AppError({
      code: 'AUTH_WEAK_PASSWORD',
      humanMessage: 'Please choose a stronger password.',
      developerMessage: message,
      correlationId,
    });
  }

  return new AppError({
    code: 'UNEXPECTED',
    humanMessage: 'Something went wrong. Please try again.',
    developerMessage: message,
    correlationId,
  });
}

export interface SignUpResult {
  /** True when Supabase requires email confirmation before a session is issued. */
  requiresEmailConfirmation: boolean;
}

export async function signUp(
  db: SupabaseClient<Database>,
  input: SignUpInput,
  ctx: RequestContext = {},
): Promise<SignUpResult> {
  const correlationId = ctx.correlationId ?? newCorrelationId();

  const { data, error } = await db.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      // Consumed by app.handle_new_user() to populate profiles.full_name (ADR-0010).
      data: { full_name: input.fullName },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/auth/callback`,
    },
  });

  if (error) throw translateAuthError(error.message, correlationId);

  await recordAuditEvent({
    event: 'auth.registered',
    actorId: data.user?.id ?? null,
    correlationId,
    ipAddress: ctx.ipAddress ?? null,
    userAgent: ctx.userAgent ?? null,
    // No email, name, or any personal data in audit metadata — Privacy by Default.
    metadata: { confirmed: Boolean(data.session) },
  });

  return { requiresEmailConfirmation: !data.session };
}

export async function signIn(
  db: SupabaseClient<Database>,
  input: SignInInput,
  ctx: RequestContext = {},
): Promise<void> {
  const correlationId = ctx.correlationId ?? newCorrelationId();

  const { data, error } = await db.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });

  if (error) throw translateAuthError(error.message, correlationId);

  await recordAuditEvent({
    event: 'auth.signed_in',
    actorId: data.user?.id ?? null,
    correlationId,
    ipAddress: ctx.ipAddress ?? null,
    userAgent: ctx.userAgent ?? null,
  });
}

export async function signOut(
  db: SupabaseClient<Database>,
  ctx: RequestContext = {},
): Promise<void> {
  const correlationId = ctx.correlationId ?? newCorrelationId();
  const {
    data: { user },
  } = await db.auth.getUser();

  await db.auth.signOut();

  await recordAuditEvent({
    event: 'auth.signed_out',
    actorId: user?.id ?? null,
    correlationId,
    ipAddress: ctx.ipAddress ?? null,
    userAgent: ctx.userAgent ?? null,
  });
}

export async function requestPasswordReset(
  db: SupabaseClient<Database>,
  input: RequestPasswordResetInput,
  ctx: RequestContext = {},
): Promise<void> {
  const correlationId = ctx.correlationId ?? newCorrelationId();

  const { error } = await db.auth.resetPasswordForEmail(input.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/auth/callback?next=/reset-password`,
  });

  // Rate limiting is surfaced; everything else is swallowed so this endpoint
  // cannot be used to enumerate which email addresses have accounts.
  if (error) {
    const translated = translateAuthError(error.message, correlationId);
    if (translated.code === 'AUTH_RATE_LIMITED') throw translated;
    logger.error('auth.password_reset_failed', { correlationId, code: translated.code });
  }

  await recordAuditEvent({
    event: 'auth.password_reset_requested',
    correlationId,
    ipAddress: ctx.ipAddress ?? null,
    userAgent: ctx.userAgent ?? null,
  });
}

export async function resetPassword(
  db: SupabaseClient<Database>,
  input: ResetPasswordInput,
  ctx: RequestContext = {},
): Promise<void> {
  const correlationId = ctx.correlationId ?? newCorrelationId();

  const { data, error } = await db.auth.updateUser({ password: input.password });
  if (error) throw translateAuthError(error.message, correlationId);

  await recordAuditEvent({
    event: 'auth.password_reset_completed',
    actorId: data.user?.id ?? null,
    correlationId,
    ipAddress: ctx.ipAddress ?? null,
    userAgent: ctx.userAgent ?? null,
  });
}

/** Returns the authenticated user, or null. Uses getUser(), never getSession(). */
export async function getCurrentUser(db: SupabaseClient<Database>) {
  if (serverEnv.WAITLIST_ONLY_MODE) return null;
  const {
    data: { user },
  } = await db.auth.getUser();
  return user;
}
