import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { BusinessCase, BusinessCaseStatus } from '@/types/business-case';
import { AppError, newCorrelationId } from '@/lib/errors';
import { recordAuditEvent } from '@/services/audit';
import {
  insertBusinessCase,
  listBusinessCases,
  findBusinessCaseById,
  updateBusinessCase,
} from '@/lib/db/business-cases';
import type { RequestContext } from '@/services/auth';

/**
 * Business Case Application Service (ADR-0001) — P7.1.
 *
 * A thin, generic correlation object: an objective, an owner, an optional
 * future advisor, and a review-lifecycle status. Ownership is enforced by RLS
 * via `app.business_access(business_id)`, unchanged by this service —
 * `advisor_id` is stored but grants no access on its own (that wiring is an
 * explicit, deferred future decision; see ADR-0021).
 *
 * No UI consumes this yet. No linkage to documents/goals/evidence exists yet.
 * This is the primitive itself, nothing more.
 */

export interface CreateBusinessCaseInput {
  businessId: string;
  title: string;
  objective: string;
  /** Reserved for future advisor workflows. Not wired to any access grant. */
  advisorId?: string | null;
}

export async function createBusinessCase(
  db: SupabaseClient<Database>,
  ownerId: string,
  input: CreateBusinessCaseInput,
  ctx: RequestContext = {},
): Promise<BusinessCase> {
  const correlationId = ctx.correlationId ?? newCorrelationId();

  const { data, error } = await insertBusinessCase(db, {
    business_id: input.businessId,
    title: input.title,
    objective: input.objective,
    owner_id: ownerId,
    advisor_id: input.advisorId ?? null,
  });

  if (error || !data) {
    throw new AppError({
      code: 'UNEXPECTED',
      humanMessage: 'We could not save that case. Please try again.',
      // developerMessage must never echo the title/objective text.
      developerMessage: error ?? 'insert returned no row',
      correlationId,
    });
  }

  await recordAuditEvent({
    event: 'business.case_created',
    actorId: ownerId,
    businessId: input.businessId,
    correlationId,
    ipAddress: ctx.ipAddress ?? null,
    userAgent: ctx.userAgent ?? null,
    // Shape only — no title, no objective text.
    metadata: { has_advisor: Boolean(input.advisorId) },
  });

  return data;
}

export async function setCaseStatus(
  db: SupabaseClient<Database>,
  ownerId: string,
  caseId: string,
  status: BusinessCaseStatus,
  ctx: RequestContext = {},
): Promise<BusinessCase> {
  const correlationId = ctx.correlationId ?? newCorrelationId();

  const existing = await findBusinessCaseById(db, caseId);
  if (!existing) {
    // RLS already filtered a foreign case out, so "not found" and "not yours"
    // are the same response — no existence oracle.
    throw new AppError({
      code: 'NOT_FOUND',
      humanMessage: 'We could not find that case.',
      correlationId,
    });
  }

  const { data, error } = await updateBusinessCase(db, caseId, { status });
  if (error || !data) {
    throw new AppError({
      code: 'UNEXPECTED',
      humanMessage: 'We could not update that case. Please try again.',
      developerMessage: error ?? 'update returned no row',
      correlationId,
    });
  }

  await recordAuditEvent({
    event: 'business.case_status_changed',
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
export async function getBusinessCases(
  db: SupabaseClient<Database>,
  businessId: string,
): Promise<BusinessCase[]> {
  return listBusinessCases(db, businessId);
}

export async function getBusinessCase(
  db: SupabaseClient<Database>,
  caseId: string,
): Promise<BusinessCase | null> {
  return findBusinessCaseById(db, caseId);
}
