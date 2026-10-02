'use server';

import { cookies, headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { AppError, fail, newCorrelationId, ok, type Result } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { CURRENT_BUSINESS_COOKIE } from '@/lib/business-cookie';
import { getCurrentUser, type RequestContext } from '@/services/auth';
import {
  BUSINESS_LOGOS_BUCKET,
  listBusinesses,
  removeBusinessLogo,
  resolveCurrentBusiness,
  setBusinessLogo,
} from '@/services/business';

/**
 * Business logo upload — the Passport's own Server Actions (P7 Business
 * Passport, Phase E). Mirrors `app/(app)/documents/actions.ts`'s two-phase
 * signed-upload-URL flow exactly, simplified for a logo's one-file-per-
 * business shape: there is no separate metadata row to create first, so the
 * object's path is always the deterministic `<businessId>/logo.png` — never
 * a client-supplied path or business id. Every action re-resolves "the
 * current business" itself from the request-scoped cookie, the same way
 * `/dashboard`, `/passport`, and every other business-scoped action does; a
 * client cannot point these actions at a business it does not own.
 */

async function requestContext(): Promise<RequestContext> {
  const h = await headers();
  return {
    correlationId: newCorrelationId(),
    ipAddress: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: h.get('user-agent'),
  };
}

function flatten(error: unknown, ctx: RequestContext): Result<never> {
  if (error instanceof AppError) return fail(error);
  logger.error('passport.logo.unexpected', {
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

async function currentBusinessId(
  db: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const [businesses, store] = await Promise.all([listBusinesses(db), cookies()]);
  return resolveCurrentBusiness(businesses, store.get(CURRENT_BUSINESS_COOKIE)?.value)?.id ?? null;
}

export interface LogoUploadTicket {
  bucket: string;
  path: string;
  token: string;
}

/** Mint a signed upload URL for the current business's logo path. */
export async function requestLogoUploadAction(): Promise<Result<LogoUploadTicket>> {
  const ctx = await requestContext();
  try {
    const db = await createClient();
    const user = await getCurrentUser(db);
    if (!user) {
      return fail(
        new AppError({
          code: 'AUTH_SESSION_EXPIRED',
          humanMessage: 'Your session expired. Please sign in again.',
          correlationId: ctx.correlationId,
        }),
      );
    }

    const businessId = await currentBusinessId(db);
    if (!businessId) {
      return fail(
        new AppError({
          code: 'NOT_FOUND',
          humanMessage: 'Create a business before adding a logo.',
          correlationId: ctx.correlationId,
        }),
      );
    }

    const path = `${businessId}/logo.png`;
    // `upsert: true` — a logo has no history, replacing it overwrites the
    // same object rather than accumulating orphaned files.
    const signed = await db.storage
      .from(BUSINESS_LOGOS_BUCKET)
      .createSignedUploadUrl(path, { upsert: true });
    if (signed.error || !signed.data) {
      return fail(
        new AppError({
          code: 'UNEXPECTED',
          humanMessage: 'We could not prepare secure storage for that logo. Please try again.',
          developerMessage: signed.error?.message,
          correlationId: ctx.correlationId,
        }),
      );
    }

    return ok({ bucket: BUSINESS_LOGOS_BUCKET, path, token: signed.data.token });
  } catch (error) {
    return flatten(error, ctx);
  }
}

/**
 * Confirm the logo's bytes landed and point the business row at them.
 * `path` must be exactly the current business's own logo path — never a
 * client-chosen location.
 */
export async function finalizeLogoUploadAction(path: string): Promise<Result<{ saved: true }>> {
  const ctx = await requestContext();
  try {
    const db = await createClient();
    const user = await getCurrentUser(db);
    if (!user) {
      return fail(
        new AppError({
          code: 'AUTH_SESSION_EXPIRED',
          humanMessage: 'Your session expired. Please sign in again.',
          correlationId: ctx.correlationId,
        }),
      );
    }

    const businessId = await currentBusinessId(db);
    if (!businessId || path !== `${businessId}/logo.png`) {
      return fail(
        new AppError({
          code: 'FORBIDDEN',
          humanMessage: 'That upload could not be confirmed.',
          correlationId: ctx.correlationId,
        }),
      );
    }

    await setBusinessLogo(db, user.id, businessId, path, ctx);
    revalidatePath('/passport');
    revalidatePath('/dashboard');
    revalidatePath('/welcome');
    return ok({ saved: true });
  } catch (error) {
    return flatten(error, ctx);
  }
}

/** Remove the current business's logo: delete the object, then clear the column. */
export async function removeLogoAction(): Promise<Result<{ removed: true }>> {
  const ctx = await requestContext();
  try {
    const db = await createClient();
    const user = await getCurrentUser(db);
    if (!user) {
      return fail(
        new AppError({
          code: 'AUTH_SESSION_EXPIRED',
          humanMessage: 'Your session expired. Please sign in again.',
          correlationId: ctx.correlationId,
        }),
      );
    }

    const businessId = await currentBusinessId(db);
    if (!businessId) {
      return fail(
        new AppError({
          code: 'NOT_FOUND',
          humanMessage: 'We could not find that business.',
          correlationId: ctx.correlationId,
        }),
      );
    }

    const path = `${businessId}/logo.png`;
    await db.storage.from(BUSINESS_LOGOS_BUCKET).remove([path]);
    await removeBusinessLogo(db, user.id, businessId, ctx);
    revalidatePath('/passport');
    revalidatePath('/dashboard');
    revalidatePath('/welcome');
    return ok({ removed: true });
  } catch (error) {
    return flatten(error, ctx);
  }
}
