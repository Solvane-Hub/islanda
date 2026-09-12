'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { AppError, fail, newCorrelationId, ok, type Result } from '@/lib/errors';
import { toFieldErrors } from '@/lib/validation/field-errors';
import { logger } from '@/lib/logger';
import {
  archiveBusinessSchema,
  createBusinessSchema,
  updateBusinessSchema,
} from '@/lib/validation/business';
import * as businessService from '@/services/business';
import * as profileService from '@/services/profile';
import * as onboardingService from '@/services/onboarding';
import * as goalsService from '@/services/goals';
import * as financialsService from '@/services/financials';
import { updateProfileSchema } from '@/lib/validation/profile';
import { buildBusinessSchema, manageBusinessSchema } from '@/lib/validation/business-object';
import { createGoalSchema, recordFigureSchema } from '@/lib/validation/business-intelligence';
import { resolveMetricEntry } from '@/lib/business-intelligence/performance';
import { getCurrentUser, type RequestContext } from '@/services/auth';
import { CURRENT_BUSINESS_COOKIE } from '@/lib/business-cookie';

const CURRENT_BUSINESS_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60 * 24 * 365,
} as const;

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
  logger.error('business.unexpected', {
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

export async function createBusinessAction(
  _prev: Result<{ id: string }> | null,
  formData: FormData,
): Promise<Result<{ id: string }>> {
  const ctx = await requestContext();

  const parsed = createBusinessSchema.safeParse({
    name: formData.get('name'),
    countryCode: formData.get('countryCode'),
    industry: formData.get('industry') ?? undefined,
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

  let businessId: string;
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
    const business = await businessService.createBusiness(db, user.id, parsed.data, ctx);
    businessId = business.id;
  } catch (error) {
    return flatten(error, ctx);
  }

  const store = await cookies();
  store.set(CURRENT_BUSINESS_COOKIE, businessId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

/**
 * Build my business — the new-founder front door.
 *
 * Captures the idea in the founder's own words and creates the Business Object
 * in `build` mode, then lands on the first-value welcome screen.
 */
export async function buildBusinessAction(
  _prev: Result<{ id: string }> | null,
  formData: FormData,
): Promise<Result<{ id: string }>> {
  const ctx = await requestContext();

  const parsed = buildBusinessSchema.safeParse({
    name: formData.get('name'),
    countryCode: formData.get('countryCode'),
    concept: formData.get('concept'),
    industry: formData.get('industry') ?? undefined,
    businessStage: formData.get('businessStage') ?? undefined,
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

  let businessId: string;
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
    const result = await onboardingService.buildMyBusiness(db, user.id, parsed.data, ctx);
    businessId = result.businessId;
  } catch (error) {
    return flatten(error, ctx);
  }

  const store = await cookies();
  store.set(CURRENT_BUSINESS_COOKIE, businessId, CURRENT_BUSINESS_COOKIE_OPTIONS);
  revalidatePath('/', 'layout');
  redirect('/welcome');
}

/**
 * Manage my business — the existing-business front door.
 *
 * Imports the company's identity, definition and any sensitive identifiers as
 * the same Business Object in `manage` mode, then lands on the command centre.
 */
export async function manageBusinessAction(
  _prev: Result<{ id: string }> | null,
  formData: FormData,
): Promise<Result<{ id: string }>> {
  const ctx = await requestContext();

  const parsed = manageBusinessSchema.safeParse({
    legalName: formData.get('legalName'),
    tradingName: formData.get('tradingName') ?? undefined,
    businessType: formData.get('businessType') ?? undefined,
    countryCode: formData.get('countryCode'),
    industry: formData.get('industry') ?? undefined,
    location: formData.get('location') ?? undefined,
    businessStage: formData.get('businessStage') ?? undefined,
    operatingStatus: formData.get('operatingStatus') ?? undefined,
    activities: formData.get('activities') ?? undefined,
    productsServices: formData.get('productsServices') ?? undefined,
    targetCustomers: formData.get('targetCustomers') ?? undefined,
    registrationNumber: formData.get('registrationNumber') ?? undefined,
    taxId: formData.get('taxId') ?? undefined,
    vatNumber: formData.get('vatNumber') ?? undefined,
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

  let businessId: string;
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
    const result = await onboardingService.bringInMyBusiness(db, user.id, parsed.data, ctx);
    businessId = result.businessId;
  } catch (error) {
    return flatten(error, ctx);
  }

  const store = await cookies();
  store.set(CURRENT_BUSINESS_COOKIE, businessId, CURRENT_BUSINESS_COOKIE_OPTIONS);
  revalidatePath('/', 'layout');
  redirect('/welcome');
}

export async function renameBusinessAction(
  _prev: Result<{ id: string }> | null,
  formData: FormData,
): Promise<Result<{ id: string }>> {
  const ctx = await requestContext();

  const parsed = updateBusinessSchema.safeParse({
    businessId: formData.get('businessId'),
    name: formData.get('name'),
    industry: formData.get('industry') ?? undefined,
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
    const user = await getCurrentUser(db);
    if (!user)
      throw new AppError({
        code: 'AUTH_SESSION_EXPIRED',
        humanMessage: 'Your session expired. Please sign in again.',
      });
    const updated = await businessService.renameBusiness(db, user.id, parsed.data, ctx);
    revalidatePath('/', 'layout');
    return ok({ id: updated.id });
  } catch (error) {
    return flatten(error, ctx);
  }
}

export async function archiveBusinessAction(
  _prev: Result<{ archived: true }> | null,
  formData: FormData,
): Promise<Result<{ archived: true }>> {
  const ctx = await requestContext();
  const parsed = archiveBusinessSchema.safeParse({ businessId: formData.get('businessId') });

  if (!parsed.success) {
    return fail(
      new AppError({
        code: 'VALIDATION_FAILED',
        humanMessage: 'Unknown business.',
        correlationId: ctx.correlationId,
      }),
    );
  }

  try {
    const db = await createClient();
    const user = await getCurrentUser(db);
    if (!user)
      throw new AppError({
        code: 'AUTH_SESSION_EXPIRED',
        humanMessage: 'Your session expired. Please sign in again.',
      });
    await businessService.archiveBusiness(db, user.id, parsed.data.businessId, ctx);
    const store = await cookies();
    if (store.get(CURRENT_BUSINESS_COOKIE)?.value === parsed.data.businessId) {
      store.delete(CURRENT_BUSINESS_COOKIE);
    }
    revalidatePath('/', 'layout');
    return ok({ archived: true });
  } catch (error) {
    return flatten(error, ctx);
  }
}

/** Switches the active business. Ownership is enforced by RLS on the next read. */
export async function selectBusinessAction(formData: FormData): Promise<void> {
  const businessId = String(formData.get('businessId') ?? '');
  if (businessId) {
    const store = await cookies();
    store.set(CURRENT_BUSINESS_COOKIE, businessId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

export async function updateProfileAction(
  _prev: Result<{ saved: true }> | null,
  formData: FormData,
): Promise<Result<{ saved: true }>> {
  const ctx = await requestContext();
  const parsed = updateProfileSchema.safeParse({ fullName: formData.get('fullName') });

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
      throw new AppError({
        code: 'AUTH_SESSION_EXPIRED',
        humanMessage: 'Your session expired. Please sign in again.',
      });
    }
    await profileService.updateAccountProfile(db, user.id, parsed.data, ctx.correlationId);
    revalidatePath('/', 'layout');
    return ok({ saved: true });
  } catch (error) {
    return flatten(error, ctx);
  }
}

/**
 * Sets a goal on the current business.
 *
 * A monetary target's currency is derived from the business's country (never
 * typed by the founder), the same way funding is — so a value and its currency
 * cannot disagree. Goal progress is derived from metrics, never entered here.
 */
export async function createGoalAction(
  _prev: Result<{ id: string }> | null,
  formData: FormData,
): Promise<Result<{ id: string }>> {
  const ctx = await requestContext();
  const parsed = createGoalSchema.safeParse({
    goalType: formData.get('goalType'),
    title: formData.get('title'),
    description: formData.get('description') ?? undefined,
    targetMetricKey: formData.get('targetMetricKey') ?? undefined,
    targetValue: formData.get('targetValue') ?? undefined,
    targetDate: formData.get('targetDate') ?? undefined,
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

    const [businesses, store, countries] = await Promise.all([
      businessService.listBusinesses(db),
      cookies(),
      businessService.getActiveCountries(db),
    ]);
    const business = businessService.resolveCurrentBusiness(
      businesses,
      store.get(CURRENT_BUSINESS_COOKIE)?.value,
    );
    if (!business) {
      return fail(
        new AppError({
          code: 'NOT_FOUND',
          humanMessage: 'Create a business before setting a goal.',
          correlationId: ctx.correlationId,
        }),
      );
    }

    const targetCurrency =
      parsed.data.targetValue !== undefined
        ? (countries.find((c) => c.code === business.country_code)?.currency_code ?? null)
        : null;

    const goal = await goalsService.createBusinessGoal(
      db,
      user.id,
      {
        businessId: business.id,
        goalType: parsed.data.goalType,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        targetMetricKey: parsed.data.targetMetricKey ?? null,
        targetValue: parsed.data.targetValue ?? null,
        targetCurrency,
        targetDate: parsed.data.targetDate ?? null,
      },
      ctx,
    );

    revalidatePath('/dashboard');
    return ok({ id: goal.id });
  } catch (error) {
    return flatten(error, ctx);
  }
}

/**
 * Records a financial figure on the current business.
 *
 * Finds-or-creates the period, then stores the metric. Currency, unit and
 * provenance are decided HERE, never typed by the founder: monetary keys take
 * the business's currency, margin is a percent, counts are unitless, and a
 * figure linked to a supporting document is `user_document` — otherwise
 * `founder_provided`. A figure is never stored verified.
 */
export async function recordFigureAction(input: {
  financialPeriodId?: string;
  periodType?: string;
  periodStart?: string;
  periodEnd?: string;
  metricKey: string;
  value: number | string;
  label?: string;
  sourceDocumentId?: string;
}): Promise<Result<{ id: string }>> {
  const ctx = await requestContext();
  const parsed = recordFigureSchema.safeParse(input);
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

    const [businesses, store, countries] = await Promise.all([
      businessService.listBusinesses(db),
      cookies(),
      businessService.getActiveCountries(db),
    ]);
    const business = businessService.resolveCurrentBusiness(
      businesses,
      store.get(CURRENT_BUSINESS_COOKIE)?.value,
    );
    if (!business) {
      return fail(
        new AppError({
          code: 'NOT_FOUND',
          humanMessage: 'Create a business before recording a figure.',
          correlationId: ctx.correlationId,
        }),
      );
    }

    const businessCurrency =
      countries.find((c) => c.code === business.country_code)?.currency_code ?? null;

    // Resolve the period: an existing id, or find-or-create from the new fields.
    let periodId = parsed.data.financialPeriodId ?? null;
    if (!periodId) {
      const period = await financialsService.findOrCreateFinancialPeriod(
        db,
        user.id,
        {
          businessId: business.id,
          periodType: parsed.data.periodType!,
          periodStart: parsed.data.periodStart!,
          periodEnd: parsed.data.periodEnd!,
        },
        ctx,
      );
      periodId = period.id;
    }

    const shape = resolveMetricEntry(
      parsed.data.metricKey,
      businessCurrency,
      Boolean(parsed.data.sourceDocumentId),
    );

    const metric = await financialsService.recordMetric(
      db,
      user.id,
      {
        businessId: business.id,
        metricKey: parsed.data.metricKey,
        value: parsed.data.value,
        label: parsed.data.label ?? null,
        currency: shape.currency,
        unit: shape.unit,
        financialPeriodId: periodId,
        sourceDocumentId: parsed.data.sourceDocumentId ?? null,
        provenance: shape.provenance,
      },
      ctx,
    );

    revalidatePath('/dashboard');
    revalidatePath('/documents');
    return ok({ id: metric.id });
  } catch (error) {
    return flatten(error, ctx);
  }
}
