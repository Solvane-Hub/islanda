import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type {
  Business,
  BusinessIdentifier,
  BusinessIdentifierType,
  BusinessMode,
  BusinessObject,
  BusinessStatus,
} from '@/types/business';
import { AppError, newCorrelationId } from '@/lib/errors';
import { recordAuditEvent } from '@/services/audit';
import {
  findBusinessById,
  insertBusiness,
  listActiveBusinesses,
  listActiveCountries,
  updateBusiness,
} from '@/lib/db/businesses';
import { findProfileByBusinessId } from '@/lib/db/business-profiles';
import {
  insertBusinessIdentifier,
  listIdentifiersForBusiness,
} from '@/lib/db/business-identifiers';
import type { CreateBusinessInput, UpdateBusinessInput } from '@/lib/validation/business';
import type { RequestContext } from '@/services/auth';

/**
 * Business Application Service — all business rules and all writes (ADR-0001).
 */

type Status = BusinessStatus;

/**
 * Lifecycle state machine (ADR-0007).
 *
 * The database enum constrains the *vocabulary*; this map constrains the
 * *sequence*. Postgres will happily accept any enum value, so without this a
 * business could jump straight from `draft` to `active`, skipping intake, and
 * the dashboard would have nothing to render.
 */
const ALLOWED_TRANSITIONS: Record<Status, readonly Status[]> = {
  draft: ['intake_started', 'archived'],
  intake_started: ['intake_complete', 'archived'],
  intake_complete: ['launch_plan_generated', 'intake_started', 'archived'],
  launch_plan_generated: ['active', 'intake_complete', 'archived'],
  active: ['launch_plan_generated', 'archived'],
  // Terminal. Un-archiving is a deliberate future decision, not an oversight.
  archived: [],
};

export function canTransition(from: Status, to: Status): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: Status, to: Status, correlationId?: string): void {
  if (!canTransition(from, to)) {
    throw new AppError({
      code: 'FORBIDDEN',
      humanMessage: 'That change is not available for this business right now.',
      developerMessage: `Illegal business status transition: ${from} -> ${to}`,
      ...(correlationId ? { correlationId } : {}),
    });
  }
}

export async function getActiveCountries(db: SupabaseClient<Database>) {
  return listActiveCountries(db);
}

export async function listBusinesses(db: SupabaseClient<Database>): Promise<Business[]> {
  return listActiveBusinesses(db);
}

export async function getBusiness(
  db: SupabaseClient<Database>,
  businessId: string,
): Promise<Business | null> {
  return findBusinessById(db, businessId);
}

/** The sensitive identifiers held for a business (RLS-scoped to the owner). */
export async function getBusinessIdentifiers(
  db: SupabaseClient<Database>,
  businessId: string,
): Promise<BusinessIdentifier[]> {
  return listIdentifiersForBusiness(db, businessId);
}

/**
 * The whole Business Object, assembled for the founder's own command centre.
 *
 * `null` when the business is not visible to the caller (RLS filtered it), which
 * is the same response as "does not exist" — no existence oracle.
 */
export async function getBusinessObject(
  db: SupabaseClient<Database>,
  businessId: string,
): Promise<BusinessObject | null> {
  const business = await findBusinessById(db, businessId);
  if (!business) return null;
  const [profile, identifiers] = await Promise.all([
    findProfileByBusinessId(db, businessId),
    listIdentifiersForBusiness(db, businessId),
  ]);
  return { business, profile, identifiers };
}

/**
 * Records a sensitive business identifier.
 *
 * ⚠ Stored `founder_provided` and `unverified` — a database CHECK
 *   (`bi_no_unfounded_verification`) makes any "verified" state impossible until
 *   an evidence/registry mechanism exists (product §2, §6). The audit event
 *   carries the identifier TYPE only; the value is never logged.
 */
export async function addBusinessIdentifier(
  db: SupabaseClient<Database>,
  ownerId: string,
  input: {
    businessId: string;
    identifierType: BusinessIdentifierType;
    value: string;
    label?: string | null;
  },
  ctx: RequestContext = {},
): Promise<BusinessIdentifier> {
  const correlationId = ctx.correlationId ?? newCorrelationId();

  const { data, error } = await insertBusinessIdentifier(db, {
    business_id: input.businessId,
    identifier_type: input.identifierType,
    value: input.value,
    label: input.label ?? null,
  });

  if (error || !data) {
    throw new AppError({
      code: 'UNEXPECTED',
      humanMessage: 'We could not save that business identifier. Please try again.',
      // developerMessage must never echo the identifier value.
      developerMessage: error ?? 'insert returned no row',
      correlationId,
    });
  }

  await recordAuditEvent({
    event: 'business.identifier_added',
    actorId: ownerId,
    businessId: input.businessId,
    correlationId,
    ipAddress: ctx.ipAddress ?? null,
    userAgent: ctx.userAgent ?? null,
    // Shape only — the identifier TYPE, never its value.
    metadata: { identifier_type: input.identifierType },
  });

  return data;
}

/**
 * Extra Business Object attributes set at creation.
 *
 * `mode` records which front door created the business (Build vs Manage); the
 * three identity fields are the non-sensitive parts of an existing business's
 * identity (Manage). Sensitive identifiers never travel here — they go to
 * `addBusinessIdentifier`, which writes the isolated, RLS-scoped table.
 */
export interface CreateBusinessOptions {
  mode?: BusinessMode;
  legalName?: string;
  tradingName?: string;
  businessType?: string;
}

export async function createBusiness(
  db: SupabaseClient<Database>,
  ownerId: string,
  input: CreateBusinessInput,
  ctx: RequestContext = {},
  options: CreateBusinessOptions = {},
): Promise<Business> {
  const correlationId = ctx.correlationId ?? newCorrelationId();

  // The jurisdiction must be one we can actually support. A business created
  // against an inactive country would have no Knowledge Pack behind it, and the
  // platform would have nothing truthful to say about it.
  const countries = await listActiveCountries(db);
  if (!countries.some((c) => c.code === input.countryCode)) {
    throw new AppError({
      code: 'VALIDATION_FAILED',
      humanMessage: 'FoundryAI does not support that country yet.',
      developerMessage: `Inactive or unknown country_code: ${input.countryCode}`,
      correlationId,
    });
  }

  const { data, error } = await insertBusiness(db, {
    owner_id: ownerId,
    name: input.name,
    country_code: input.countryCode,
    industry: input.industry,
    ...(options.mode ? { business_mode: options.mode } : {}),
    ...(options.legalName ? { legal_name: options.legalName } : {}),
    ...(options.tradingName ? { trading_name: options.tradingName } : {}),
    ...(options.businessType ? { business_type: options.businessType } : {}),
  });

  if (error || !data) {
    // Surfaced by the partial unique index on (owner_id, lower(name)) for
    // non-archived rows.
    if (error?.includes('businesses_owner_active_name_key')) {
      throw new AppError({
        code: 'VALIDATION_FAILED',
        humanMessage: 'You already have a business with that name.',
        developerMessage: error,
        correlationId,
      });
    }
    throw new AppError({
      code: 'UNEXPECTED',
      humanMessage: 'We could not create that business. Please try again.',
      developerMessage: error ?? 'insert returned no row',
      correlationId,
    });
  }

  await recordAuditEvent({
    event: 'business.created',
    actorId: ownerId,
    businessId: data.id,
    correlationId,
    ipAddress: ctx.ipAddress ?? null,
    userAgent: ctx.userAgent ?? null,
    metadata: { country_code: data.country_code },
  });

  return data;
}

export async function renameBusiness(
  db: SupabaseClient<Database>,
  ownerId: string,
  input: UpdateBusinessInput,
  ctx: RequestContext = {},
): Promise<Business> {
  const correlationId = ctx.correlationId ?? newCorrelationId();

  const existing = await findBusinessById(db, input.businessId);
  if (!existing) {
    // RLS already filtered this out, so "not found" and "not yours" are the same
    // response — which is what we want: no existence oracle.
    throw new AppError({
      code: 'NOT_FOUND',
      humanMessage: 'We could not find that business.',
      correlationId,
    });
  }
  if (existing.status === 'archived') {
    throw new AppError({
      code: 'FORBIDDEN',
      humanMessage: 'Archived businesses cannot be edited.',
      correlationId,
    });
  }

  const { data, error } = await updateBusiness(db, input.businessId, {
    name: input.name,
    industry: input.industry ?? null,
  });

  if (error || !data) {
    if (error?.includes('businesses_owner_active_name_key')) {
      throw new AppError({
        code: 'VALIDATION_FAILED',
        humanMessage: 'You already have a business with that name.',
        developerMessage: error,
        correlationId,
      });
    }
    throw new AppError({
      code: 'UNEXPECTED',
      humanMessage: 'We could not save those changes. Please try again.',
      developerMessage: error ?? 'update returned no row',
      correlationId,
    });
  }

  await recordAuditEvent({
    event: 'business.updated',
    actorId: ownerId,
    businessId: data.id,
    correlationId,
    ipAddress: ctx.ipAddress ?? null,
    userAgent: ctx.userAgent ?? null,
  });

  return data;
}

export async function archiveBusiness(
  db: SupabaseClient<Database>,
  ownerId: string,
  businessId: string,
  ctx: RequestContext = {},
): Promise<void> {
  const correlationId = ctx.correlationId ?? newCorrelationId();

  const existing = await findBusinessById(db, businessId);
  if (!existing) {
    throw new AppError({
      code: 'NOT_FOUND',
      humanMessage: 'We could not find that business.',
      correlationId,
    });
  }

  assertTransition(existing.status, 'archived', correlationId);

  // status and archived_at are written together; the CHECK constraint
  // businesses_archived_consistency rejects them disagreeing.
  const { error } = await updateBusiness(db, businessId, {
    status: 'archived',
    archived_at: new Date().toISOString(),
  });

  if (error) {
    throw new AppError({
      code: 'UNEXPECTED',
      humanMessage: 'We could not archive that business. Please try again.',
      developerMessage: error,
      correlationId,
    });
  }

  await recordAuditEvent({
    event: 'business.archived',
    actorId: ownerId,
    businessId,
    correlationId,
    ipAddress: ctx.ipAddress ?? null,
    userAgent: ctx.userAgent ?? null,
  });
}

/**
 * Resolves which business the founder is working in.
 *
 * The preferred ID comes from a cookie, which is client-controllable — so it is
 * always re-checked against the RLS-scoped list rather than trusted. An unknown
 * or foreign ID silently falls back to the most recent business.
 */
export function resolveCurrentBusiness(
  businesses: Business[],
  preferredId: string | undefined,
): Business | null {
  if (businesses.length === 0) return null;
  if (preferredId) {
    const match = businesses.find((b) => b.id === preferredId);
    if (match) return match;
  }
  return businesses[0] ?? null;
}

export type {
  Business,
  BusinessStatus,
  BusinessMode,
  BusinessIdentifier,
  BusinessIdentifierType,
  BusinessObject,
} from '@/types/business';
