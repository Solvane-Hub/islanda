'use server';

import { reportProductFailure } from '../_lib/report-failure';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { AppError, fail, newCorrelationId, ok, type Result } from '@/lib/errors';
import { toFieldErrors } from '@/lib/validation/field-errors';
import { logger } from '@/lib/logger';
import {
  stepDescriptionSchema,
  stepFundingSchema,
  stepGoalsSchema,
  stepStageSchema,
  stepTeamSchema,
  TOTAL_INTAKE_STEPS,
} from '@/lib/validation/intake';
import type { IntakePatch } from '@/types/business';
import * as intakeService from '@/services/intake';
import { listBusinesses, resolveCurrentBusiness } from '@/services/business';
import { getCurrentUser, type RequestContext } from '@/services/auth';
import { CURRENT_BUSINESS_COOKIE } from '@/lib/business-cookie';

async function ctxOf(): Promise<RequestContext> {
  const h = await headers();
  return {
    correlationId: newCorrelationId(),
    ipAddress: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: h.get('user-agent'),
  };
}

function flatten(error: unknown, ctx: RequestContext): Result<never> {
  reportProductFailure('intake', error instanceof AppError ? error.code : undefined);
  if (error instanceof AppError) return fail(error);
  logger.error('intake.unexpected', {
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

/** Resolves the founder's current business, re-checked against the RLS-scoped list. */
async function currentBusinessId(
  db: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const [businesses, store] = await Promise.all([listBusinesses(db), cookies()]);
  return resolveCurrentBusiness(businesses, store.get(CURRENT_BUSINESS_COOKIE)?.value)?.id ?? null;
}

export async function saveIntakeStepAction(
  _prev: Result<{ nextStep: number }> | null,
  formData: FormData,
): Promise<Result<{ nextStep: number }>> {
  const ctx = await ctxOf();
  const step = Number(formData.get('step'));

  if (!Number.isInteger(step) || step < 1 || step > TOTAL_INTAKE_STEPS) {
    return fail(
      new AppError({
        code: 'VALIDATION_FAILED',
        humanMessage: 'That step does not exist.',
        correlationId: ctx.correlationId,
      }),
    );
  }

  let patch: IntakePatch;
  let fieldErrors: Record<string, string[]> | undefined;
  // Step 4 only. Answer metadata, not a column — the service owns the layout.
  let fundingDeclined: boolean | undefined;

  switch (step) {
    case 1: {
      const r = stepDescriptionSchema.safeParse({ description: formData.get('description') });
      if (!r.success) fieldErrors = toFieldErrors(r.error.issues);
      else patch = { description: r.data.description };
      break;
    }
    case 2: {
      const r = stepStageSchema.safeParse({
        businessStage: formData.get('businessStage'),
        location: formData.get('location'),
      });
      if (!r.success) fieldErrors = toFieldErrors(r.error.issues);
      else patch = { business_stage: r.data.businessStage, location: r.data.location };
      break;
    }
    case 3: {
      const r = stepTeamSchema.safeParse({ employeeCount: formData.get('employeeCount') });
      if (!r.success) fieldErrors = toFieldErrors(r.error.issues);
      else patch = { employee_count: r.data.employeeCount };
      break;
    }
    case 4: {
      const r = stepFundingSchema.safeParse({
        fundingAmount: formData.get('fundingAmount'),
        fundingUnknown: formData.get('fundingUnknown'),
      });
      if (!r.success) fieldErrors = toFieldErrors(r.error.issues);
      else {
        patch = { funding_requirement_amount: r.data.fundingAmount ?? null };
        fundingDeclined = r.data.fundingUnknown;
      }
      break;
    }
    default: {
      const r = stepGoalsSchema.safeParse({ founderGoals: formData.get('founderGoals') });
      if (!r.success) fieldErrors = toFieldErrors(r.error.issues);
      else patch = { founder_goals: r.data.founderGoals };
      break;
    }
  }

  if (fieldErrors) {
    return fail(
      new AppError({
        code: 'VALIDATION_FAILED',
        humanMessage: 'Please correct the highlighted fields.',
        correlationId: ctx.correlationId,
      }),
      fieldErrors,
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

    const businessId = await currentBusinessId(db);
    if (!businessId)
      throw new AppError({
        code: 'NOT_FOUND',
        humanMessage: 'Create a business before starting intake.',
      });

    await intakeService.saveStep(db, businessId, user.id, step, patch!, ctx, fundingDeclined);
    revalidatePath('/intake');
    return ok({ nextStep: Math.min(step + 1, TOTAL_INTAKE_STEPS) });
  } catch (error) {
    return flatten(error, ctx);
  }
}

export async function completeIntakeAction(
  _prev: Result<{ done: true }> | null,
): Promise<Result<{ done: true }>> {
  const ctx = await ctxOf();
  try {
    const db = await createClient();
    const user = await getCurrentUser(db);
    if (!user)
      throw new AppError({
        code: 'AUTH_SESSION_EXPIRED',
        humanMessage: 'Your session expired. Please sign in again.',
      });
    const businessId = await currentBusinessId(db);
    if (!businessId)
      throw new AppError({
        code: 'NOT_FOUND',
        humanMessage: 'Create a business before starting intake.',
      });
    await intakeService.completeIntake(db, businessId, user.id, ctx);
  } catch (error) {
    return flatten(error, ctx);
  }
  revalidatePath('/', 'layout');
  redirect('/dashboard');
}
