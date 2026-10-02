import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { IntakePatch } from '@/types/business';
import { newCorrelationId } from '@/lib/errors';
import { recordAuditEvent } from '@/services/audit';
import { addBusinessIdentifier, createBusiness } from '@/services/business';
import { applyKnowledge, type KnowledgeProvenance, type IntakeSlotId } from '@/services/intake';
import type { RequestContext } from '@/services/auth';
import type { BuildBusinessInput, ManageBusinessInput } from '@/lib/validation/business-object';
import type { BusinessIdentifierType } from '@/types/business';

/**
 * Onboarding Application Service — "Bring your business into Islanda".
 *
 * The two front doors, one Business Object. `buildMyBusiness` starts from an
 * idea; `bringInMyBusiness` imports an existing company. Both compose the
 * existing write paths — they never reach past the service layer or invent a
 * parallel business model:
 *
 *   createBusiness (mode + non-sensitive identity)
 *     → applyKnowledge (business-definition profile fields, founder provenance)
 *       → addBusinessIdentifier (Manage only; sensitive, isolated, unverified)
 *
 * Nothing here fabricates or infers. Every value stored is one the founder
 * supplied; there is no model call on this path (the platform has none), so
 * "understand what you're building" is honest reflection, not generation.
 */

function foundedNow(): KnowledgeProvenance {
  return { source: 'founder', confirmed_at: new Date().toISOString() };
}

/** Build my business — a new founder starting from an idea. */
export async function buildMyBusiness(
  db: SupabaseClient<Database>,
  ownerId: string,
  input: BuildBusinessInput,
  ctx: RequestContext = {},
): Promise<{ businessId: string }> {
  const correlationId = ctx.correlationId ?? newCorrelationId();
  const ctxWithId = { ...ctx, correlationId };

  const business = await createBusiness(
    db,
    ownerId,
    { name: input.name, countryCode: input.countryCode, industry: input.industry },
    ctxWithId,
    { mode: 'build' },
  );

  const patch: IntakePatch = { description: input.concept };
  if (input.businessStage) patch.business_stage = input.businessStage;

  const provenance: Partial<Record<IntakeSlotId, KnowledgeProvenance>> = {
    business: foundedNow(),
  };

  await applyKnowledge(db, business.id, ownerId, { patch, provenance }, ctxWithId);

  await recordAuditEvent({
    event: 'business.built',
    actorId: ownerId,
    businessId: business.id,
    correlationId,
    ipAddress: ctx.ipAddress ?? null,
    userAgent: ctx.userAgent ?? null,
    metadata: { mode: 'build' },
  });

  return { businessId: business.id };
}

/** The optional sensitive identifiers a Manage founder may supply, mapped to type. */
const IDENTIFIER_FIELDS: readonly {
  key: keyof Pick<ManageBusinessInput, 'registrationNumber' | 'taxId' | 'vatNumber'>;
  type: BusinessIdentifierType;
}[] = [
  { key: 'registrationNumber', type: 'company_registration_number' },
  { key: 'taxId', type: 'tax_identification_number' },
  { key: 'vatNumber', type: 'vat_registration_number' },
];

/** Manage my business — bring an existing company into Islanda. */
export async function bringInMyBusiness(
  db: SupabaseClient<Database>,
  ownerId: string,
  input: ManageBusinessInput,
  ctx: RequestContext = {},
): Promise<{ businessId: string; identifierCount: number }> {
  const correlationId = ctx.correlationId ?? newCorrelationId();
  const ctxWithId = { ...ctx, correlationId };

  // The display name derives from the trading name if given, else the legal
  // name. The legal and trading names are also stored explicitly.
  const displayName = input.tradingName ?? input.legalName;

  const business = await createBusiness(
    db,
    ownerId,
    { name: displayName, countryCode: input.countryCode, industry: input.industry },
    ctxWithId,
    {
      mode: 'manage',
      legalName: input.legalName,
      ...(input.tradingName ? { tradingName: input.tradingName } : {}),
      ...(input.businessType ? { businessType: input.businessType } : {}),
    },
  );

  // Business-definition fields → typed profile columns, founder provenance.
  const patch: IntakePatch = {};
  if (input.location) patch.location = input.location;
  if (input.businessStage) patch.business_stage = input.businessStage;
  if (input.operatingStatus) patch.operating_status = input.operatingStatus;
  if (input.activities) patch.business_activities = input.activities;
  if (input.productsServices) patch.products_services = input.productsServices;
  if (input.targetCustomers) patch.target_customers = input.targetCustomers;

  const provenance: Partial<Record<IntakeSlotId, KnowledgeProvenance>> = {};
  // The 'stage' slot is only established when BOTH halves are present.
  if (input.businessStage && input.location) provenance.stage = foundedNow();

  await applyKnowledge(db, business.id, ownerId, { patch, provenance }, ctxWithId);

  // Sensitive identifiers — each isolated, founder_provided, unverified.
  let identifierCount = 0;
  for (const field of IDENTIFIER_FIELDS) {
    const value = input[field.key];
    if (!value) continue;
    await addBusinessIdentifier(
      db,
      ownerId,
      { businessId: business.id, identifierType: field.type, value },
      ctxWithId,
    );
    identifierCount += 1;
  }

  await recordAuditEvent({
    event: 'business.imported',
    actorId: ownerId,
    businessId: business.id,
    correlationId,
    ipAddress: ctx.ipAddress ?? null,
    userAgent: ctx.userAgent ?? null,
    // Shape only — a count, never the identifiers themselves.
    metadata: { mode: 'manage', identifier_count: identifierCount },
  });

  return { businessId: business.id, identifierCount };
}
