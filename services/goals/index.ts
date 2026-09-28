import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type {
  BusinessGoal,
  BusinessGoalStatus,
  BusinessGoalType,
  BusinessMetric,
  BusinessMetricKey,
  GoalProgress,
} from '@/types/business-intelligence';
import type { FactProvenance } from '@/types/business';
import { AppError, newCorrelationId } from '@/lib/errors';
import { recordAuditEvent } from '@/services/audit';
import {
  insertBusinessGoal,
  listBusinessGoals,
  findBusinessGoalById,
  updateBusinessGoal,
} from '@/lib/db/business-goals';
import { listMetricsForBusiness } from '@/lib/db/financials';
import { computeGoalProgress } from '@/lib/business-intelligence/goal-progress';
import type { RequestContext } from '@/services/auth';

/**
 * Business Goal Application Service (ADR-0001).
 *
 * Ownership enforced by RLS. Progress is DERIVED from recorded metrics, not
 * stored — `getGoalProgress` computes it on read so it can never drift from the
 * metrics behind it.
 */

export interface CreateBusinessGoalInput {
  businessId: string;
  goalType: BusinessGoalType;
  title: string;
  description?: string | null;
  targetMetricKey?: BusinessMetricKey | null;
  targetValue?: number | null;
  targetCurrency?: string | null;
  targetDate?: string | null;
  provenance?: FactProvenance;
}

export async function createBusinessGoal(
  db: SupabaseClient<Database>,
  ownerId: string,
  input: CreateBusinessGoalInput,
  ctx: RequestContext = {},
): Promise<BusinessGoal> {
  const correlationId = ctx.correlationId ?? newCorrelationId();

  const { data, error } = await insertBusinessGoal(db, {
    business_id: input.businessId,
    actor_id: ownerId,
    goal_type: input.goalType,
    title: input.title,
    description: input.description ?? null,
    target_metric_key: input.targetMetricKey ?? null,
    target_value: input.targetValue ?? null,
    target_currency: input.targetCurrency ?? null,
    target_date: input.targetDate ?? null,
    provenance: input.provenance ?? 'founder_provided',
  });

  if (error || !data) {
    throw new AppError({
      code: 'UNEXPECTED',
      humanMessage: 'We could not save that goal. Please try again.',
      developerMessage: error ?? 'insert returned no row',
      correlationId,
    });
  }

  await recordAuditEvent({
    event: 'business.goal_created',
    actorId: ownerId,
    businessId: input.businessId,
    correlationId,
    ipAddress: ctx.ipAddress ?? null,
    userAgent: ctx.userAgent ?? null,
    metadata: { goal_type: input.goalType },
  });

  return data;
}

export async function setGoalStatus(
  db: SupabaseClient<Database>,
  ownerId: string,
  goalId: string,
  status: BusinessGoalStatus,
  ctx: RequestContext = {},
): Promise<BusinessGoal> {
  const correlationId = ctx.correlationId ?? newCorrelationId();

  const existing = await findBusinessGoalById(db, goalId);
  if (!existing) {
    // RLS already filtered a foreign goal out, so "not found" and "not yours"
    // are the same response — no existence oracle.
    throw new AppError({
      code: 'NOT_FOUND',
      humanMessage: 'We could not find that goal.',
      correlationId,
    });
  }

  const { data, error } = await updateBusinessGoal(db, goalId, { status });
  if (error || !data) {
    throw new AppError({
      code: 'UNEXPECTED',
      humanMessage: 'We could not update that goal. Please try again.',
      developerMessage: error ?? 'update returned no row',
      correlationId,
    });
  }

  await recordAuditEvent({
    event: 'business.goal_updated',
    actorId: ownerId,
    businessId: existing.business_id,
    correlationId,
    ipAddress: ctx.ipAddress ?? null,
    userAgent: ctx.userAgent ?? null,
    metadata: { status },
  });

  return data;
}

/** Read accessors (ADR-0001). */
export async function getBusinessGoals(
  db: SupabaseClient<Database>,
  businessId: string,
): Promise<BusinessGoal[]> {
  return listBusinessGoals(db, businessId);
}

/**
 * Goals with derived progress.
 *
 * One metrics read powers every goal's progress; the computation is pure
 * (`computeGoalProgress`) and returns nulls, not zeros, where progress cannot be
 * established — so nothing is invented.
 *
 * `prefetchedMetrics` is optional: a caller that already holds this business's
 * metrics (Business Passport composes financials and goals from the same
 * data) can pass them in to avoid fetching `business_metrics` a second time.
 * Every existing caller omits it and gets the exact same fetch-then-compute
 * behavior as before.
 */
export async function getGoalProgress(
  db: SupabaseClient<Database>,
  businessId: string,
  prefetchedMetrics?: readonly BusinessMetric[],
): Promise<{ goal: BusinessGoal; progress: GoalProgress }[]> {
  const [goals, metrics] = await Promise.all([
    listBusinessGoals(db, businessId),
    prefetchedMetrics ? Promise.resolve(prefetchedMetrics) : listMetricsForBusiness(db, businessId),
  ]);
  return goals.map((goal) => ({ goal, progress: computeGoalProgress(goal, metrics) }));
}
