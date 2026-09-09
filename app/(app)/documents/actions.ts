'use server';

import { cookies, headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { AppError, fail, newCorrelationId, ok, type Result } from '@/lib/errors';
import { toFieldErrors } from '@/lib/validation/field-errors';
import { logger } from '@/lib/logger';
import { CURRENT_BUSINESS_COOKIE } from '@/lib/business-cookie';
import { getCurrentUser, type RequestContext } from '@/services/auth';
import { listBusinesses, resolveCurrentBusiness } from '@/services/business';
import { documentUploadSchema, finalizeUploadSchema } from '@/lib/validation/business-intelligence';
import * as documentsService from '@/services/documents';
import type { DocumentUploadTicket } from '@/services/documents';

/**
 * Document intake server actions.
 *
 * Thin (ADR-0003): validate, resolve the current business, delegate. The service
 * enforces ownership through RLS-scoped storage and table access. The bucket is
 * private; only short-lived signed URLs ever reach the browser.
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
  logger.error('documents.unexpected', {
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

export async function requestDocumentUploadAction(input: {
  documentType: string;
  title: string;
  filename: string;
  financialPeriodId?: string;
  documentDate?: string;
  expirationDate?: string;
}): Promise<Result<DocumentUploadTicket>> {
  const ctx = await requestContext();
  const parsed = documentUploadSchema.safeParse(input);
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
          humanMessage: 'Create a business before adding documents.',
          correlationId: ctx.correlationId,
        }),
      );
    }
    const ticket = await documentsService.beginDocumentUpload(
      db,
      user.id,
      { businessId, ...parsed.data },
      ctx,
    );
    return ok(ticket);
  } catch (error) {
    return flatten(error, ctx);
  }
}

export async function finalizeDocumentUploadAction(input: {
  documentId: string;
  contentType?: string;
  byteSize?: number;
}): Promise<Result<{ saved: true }>> {
  const ctx = await requestContext();
  const parsed = finalizeUploadSchema.safeParse(input);
  if (!parsed.success) {
    return fail(
      new AppError({
        code: 'VALIDATION_FAILED',
        humanMessage: 'That upload could not be confirmed.',
        correlationId: ctx.correlationId,
      }),
    );
  }

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
    await documentsService.markDocumentStored(
      db,
      user.id,
      parsed.data.documentId,
      { contentType: parsed.data.contentType ?? null, byteSize: parsed.data.byteSize ?? null },
      ctx,
    );
    revalidatePath('/documents');
    revalidatePath('/dashboard');
    return ok({ saved: true });
  } catch (error) {
    return flatten(error, ctx);
  }
}

export async function documentViewUrlAction(documentId: string): Promise<Result<{ url: string }>> {
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
    const url = await documentsService.getDocumentDownloadUrl(db, documentId);
    if (!url) {
      return fail(
        new AppError({
          code: 'NOT_FOUND',
          humanMessage: 'That document is not available to view.',
          correlationId: ctx.correlationId,
        }),
      );
    }
    return ok({ url });
  } catch (error) {
    return flatten(error, ctx);
  }
}
