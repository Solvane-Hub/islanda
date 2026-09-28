import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/database';
import type { BusinessProfile } from '@/types/business';
import { AppError, newCorrelationId } from '@/lib/errors';
import { recordAuditEvent } from '@/services/audit';
import { findProfileByBusinessId, insertProfile, updateProfile } from '@/lib/db/business-profiles';
import { findBusinessById, updateBusiness } from '@/lib/db/businesses';
import type { IntakePatch } from '@/types/business';
import { assertTransition } from '@/services/business';
import { evaluateBusinessRequirements } from '@/services/regulatory';
import { INTAKE_SLOTS, knowledgeCompleteness, type IntakeSlotId } from './knowledge';
import type { RequestContext } from '@/services/auth';
import type { KnowledgeProvenance } from '@/lib/validation/intake';

/** `responses` is jsonb; anything non-object in there is not worth preserving. */
function isPlainObject(value: unknown): value is Record<string, Json> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mergeKnowledgeResponses(
  responses: Json,
  provenance: Partial<Record<IntakeSlotId, KnowledgeProvenance>>,
  fundingDeclined?: boolean,
): Record<string, Json> {
  const existingResponses = isPlainObject(responses) ? responses : {};
  const existingKnowledge = isPlainObject(existingResponses.knowledge)
    ? existingResponses.knowledge
    : {};
  const mergedKnowledge: Record<string, Json> = { ...existingKnowledge };

  for (const [slotId, record] of Object.entries(provenance) as [
    IntakeSlotId,
    KnowledgeProvenance,
  ][]) {
    const existing = isPlainObject(existingKnowledge[slotId]) ? existingKnowledge[slotId] : {};
    // A founder correction establishes the value directly. Do not keep a Nova
    // confidence or run id attached to that replacement fact.
    const retained =
      record.source === 'founder'
        ? Object.fromEntries(
            Object.entries(existing).filter(([key]) => key !== 'confidence' && key !== 'run_id'),
          )
        : existing;
    mergedKnowledge[slotId] = { ...retained, ...record };
  }

  if (fundingDeclined !== undefined) {
    const existingFunding = isPlainObject(existingKnowledge.funding)
      ? existingKnowledge.funding
      : {};
    const pendingFunding = isPlainObject(mergedKnowledge.funding)
      ? mergedKnowledge.funding
      : existingFunding;
    mergedKnowledge.funding = {
      ...pendingFunding,
      declined: fundingDeclined,
    };
  }

  return { ...existingResponses, knowledge: mergedKnowledge };
}

async function resolveFundingCurrency(
  db: SupabaseClient<Database>,
  businessId: string,
  patch: IntakePatch,
): Promise<IntakePatch> {
  const resolved: IntakePatch = { ...patch };
  if (!('funding_requirement_amount' in resolved)) return resolved;

  if (
    resolved.funding_requirement_amount === null ||
    resolved.funding_requirement_amount === undefined
  ) {
    resolved.funding_requirement_currency = null;
    return resolved;
  }

  const business = await findBusinessById(db, businessId);
  const { data: country } = await db
    .from('countries')
    .select('currency_code')
    .eq('code', business?.country_code ?? '')
    .maybeSingle();
  resolved.funding_requirement_currency = country?.currency_code ?? null;
  return resolved;
}

/**
 * The knowledge model is part of this service's public surface — callers ask
 * the Intake service what Islanda knows, never the database directly.
 */
export {
  INTAKE_SLOTS,
  hasDeclinedFunding,
  isSlotKnownForStep,
  knowledgeCompleteness,
  readKnowledge,
  readKnowledgeRecord,
  isKnowledgeEstablished,
  type IntakeSlot,
  type IntakeSlotId,
  type KnowledgeSource,
  type KnowledgeState,
  type SlotKnowledge,
} from './knowledge';

export type { KnowledgeProvenance } from '@/lib/validation/intake';

export interface KnowledgeApplication {
  patch: IntakePatch;
  provenance: Partial<Record<IntakeSlotId, KnowledgeProvenance>>;
  /** Funding only: records an explicit "I don't know yet" answer. */
  fundingDeclined?: boolean;
}

/**
 * Founder Intake Application Service.
 *
 * Draft persistence is the point of this phase: every step is written the moment
 * it is submitted, so closing the browser mid-flow loses nothing (Sprint 1
 * acceptance criteria C3/C4). Resumability is a data property, not UI polish.
 */

/** Returns the profile, creating it and moving the business to `intake_started`. */
export async function startOrResumeIntake(
  db: SupabaseClient<Database>,
  businessId: string,
  ownerId: string,
  ctx: RequestContext = {},
): Promise<BusinessProfile> {
  const correlationId = ctx.correlationId ?? newCorrelationId();

  const business = await findBusinessById(db, businessId);
  if (!business) {
    throw new AppError({
      code: 'NOT_FOUND',
      humanMessage: 'We could not find that business.',
      correlationId,
    });
  }
  if (business.status === 'archived') {
    throw new AppError({
      code: 'FORBIDDEN',
      humanMessage: 'Archived businesses cannot be edited.',
      correlationId,
    });
  }

  const existing = await findProfileByBusinessId(db, businessId);
  if (existing) return existing;

  const { data, error } = await insertProfile(db, businessId);
  if (error || !data) {
    throw new AppError({
      code: 'UNEXPECTED',
      humanMessage: 'We could not start your intake. Please try again.',
      developerMessage: error ?? 'insert returned no row',
      correlationId,
    });
  }

  if (business.status === 'draft') {
    assertTransition(business.status, 'intake_started', correlationId);
    await updateBusiness(db, businessId, { status: 'intake_started' });
  }

  await recordAuditEvent({
    event: 'intake.started',
    actorId: ownerId,
    businessId,
    correlationId,
    ipAddress: ctx.ipAddress ?? null,
    userAgent: ctx.userAgent ?? null,
  });

  return data;
}

/**
 * Persists one step.
 *
 * `last_completed_step` only ever moves forward: revisiting step 2 to correct an
 * answer must not discard steps 3–5 the founder already completed.
 */
export async function saveStep(
  db: SupabaseClient<Database>,
  businessId: string,
  ownerId: string,
  step: number,
  patch: IntakePatch,
  ctx: RequestContext = {},
  /**
   * Step 4 only. `true` records that the founder was asked for a figure and
   * said they do not know one yet; `false` clears any previous decline.
   * `undefined` leaves the record alone.
   *
   * A separate argument rather than a field on `patch` because `patch` is a
   * map of columns, and this is answer metadata living in `responses` — the
   * caller must not have to know that layout (ADR-0020).
   */
  fundingDeclined?: boolean,
): Promise<BusinessProfile> {
  const correlationId = ctx.correlationId ?? newCorrelationId();

  const profile = await findProfileByBusinessId(db, businessId);
  if (!profile) {
    throw new AppError({
      code: 'NOT_FOUND',
      humanMessage: 'We could not find your intake. Please start again.',
      correlationId,
    });
  }

  // A funding amount requires a currency (DB constraint
  // bp_funding_currency_required_with_amount). It is derived from the business's
  // country rather than typed by the founder, so it cannot disagree.
  const resolved = await resolveFundingCurrency(db, businessId, patch);

  // Answer metadata, merged rather than replaced: `responses` will accumulate
  // provenance for every slot once Nova writes to it, and a step save must
  // never clear what another writer recorded (ADR-0020).
  const slotId = INTAKE_SLOTS.find((slot) => slot.step === step)?.id;
  if (slotId) {
    resolved.responses = mergeKnowledgeResponses(
      profile.responses,
      { [slotId]: { source: 'founder', confirmed_at: new Date().toISOString() } },
      fundingDeclined,
    );
  }

  const { data, error } = await updateProfile(db, businessId, {
    ...resolved,
    last_completed_step: Math.max(profile.last_completed_step, step),
  });

  if (error || !data) {
    throw new AppError({
      code: 'UNEXPECTED',
      humanMessage: 'We could not save that. Please try again.',
      developerMessage: error ?? 'update returned no row',
      correlationId,
    });
  }

  await recordAuditEvent({
    event: 'intake.step_saved',
    actorId: ownerId,
    businessId,
    correlationId,
    metadata: { step },
  });

  return data;
}

/**
 * Applies externally established business knowledge through the same profile
 * service as founder intake. Nova is not implemented; this is its constrained
 * future entry point, so it cannot create a parallel profile or bypass
 * provenance/normalisation rules.
 */
export async function applyKnowledge(
  db: SupabaseClient<Database>,
  businessId: string,
  ownerId: string,
  application: KnowledgeApplication,
  ctx: RequestContext = {},
): Promise<BusinessProfile> {
  const correlationId = ctx.correlationId ?? newCorrelationId();
  const profile = await startOrResumeIntake(db, businessId, ownerId, ctx);
  const resolved = await resolveFundingCurrency(db, businessId, application.patch);
  resolved.responses = mergeKnowledgeResponses(
    profile.responses,
    application.provenance,
    application.fundingDeclined,
  );

  const { data, error } = await updateProfile(db, businessId, resolved);
  if (error || !data) {
    throw new AppError({
      code: 'UNEXPECTED',
      humanMessage: 'We could not save that. Please try again.',
      developerMessage: error ?? 'update returned no row',
      correlationId,
    });
  }

  await recordAuditEvent({
    event: 'intake.knowledge_applied',
    actorId: ownerId,
    businessId,
    correlationId,
    metadata: { slots: Object.keys(application.provenance) },
  });

  return data;
}

/** Finalises intake once every step is answered. */
export async function completeIntake(
  db: SupabaseClient<Database>,
  businessId: string,
  ownerId: string,
  ctx: RequestContext = {},
): Promise<void> {
  const correlationId = ctx.correlationId ?? newCorrelationId();

  const [profile, business] = await Promise.all([
    findProfileByBusinessId(db, businessId),
    findBusinessById(db, businessId),
  ]);

  if (!profile || !business) {
    throw new AppError({
      code: 'NOT_FOUND',
      humanMessage: 'We could not find your intake. Please start again.',
      correlationId,
    });
  }

  const completeness = knowledgeCompleteness(profile);

  if (!completeness.isComplete) {
    throw new AppError({
      code: 'VALIDATION_FAILED',
      humanMessage: 'Please finish the remaining questions first.',
      developerMessage: `knowledge ${completeness.known} of ${completeness.total}`,
      correlationId,
    });
  }

  if (business.status !== 'intake_complete') {
    assertTransition(business.status, 'intake_complete', correlationId);

    const { error } = await updateBusiness(db, businessId, {
      status: 'intake_complete',
    });

    if (error) {
      throw new AppError({
        code: 'UNEXPECTED',
        humanMessage: 'We could not complete your intake. Please try again.',
        developerMessage: error,
        correlationId,
      });
    }
  }

  await updateProfile(db, businessId, {
    completed_at: profile.completed_at ?? new Date().toISOString(),
  });

  await recordAuditEvent({
    event: 'intake.completed',
    actorId: ownerId,
    businessId,
    correlationId,
    ipAddress: ctx.ipAddress ?? null,
    userAgent: ctx.userAgent ?? null,
  });

  await evaluateBusinessRequirements(db, businessId);
}
/** Read-only accessor so `app/` never imports the data-access layer (ADR-0001). */
export async function getIntakeProfile(
  db: SupabaseClient<Database>,
  businessId: string,
): Promise<BusinessProfile | null> {
  return findProfileByBusinessId(db, businessId);
}

/**
 * Intake progress, measured as knowledge rather than as page visitation.
 *
 * `completed` counts the slots the profile actually holds — see
 * `./knowledge`. It used to count `last_completed_step`, which is a cursor
 * through the five screens; that number is identical today, because those
 * screens are the only writer, and stops being identical the moment Nova can
 * establish a fact without the founder opening the page.
 *
 * `isComplete` still means "the founder finished intake" (`completed_at`), not
 * "every slot is known" — those are different questions and callers depend on
 * the first. `knowledgeCompleteness().isComplete` answers the second.
 */
export function intakeProgress(profile: BusinessProfile | null): {
  completed: number;
  total: number;
  percent: number;
  isComplete: boolean;
} {
  const { known, total } = knowledgeCompleteness(profile);
  return {
    completed: known,
    total,
    percent: Math.round((known / total) * 100),
    isComplete: Boolean(profile?.completed_at),
  };
}
