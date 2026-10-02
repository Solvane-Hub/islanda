import type { Enums, Tables } from '@/types/database';

/**
 * Domain types shared across layers (Engineering Standards §5 — shared
 * interfaces are centralized).
 *
 * These live in `types/` rather than in `lib/db/` so that `app/` and
 * `components/` can name a business without importing the data-access layer,
 * which the layer-boundary lint rule correctly forbids.
 */
export type Business = Tables<'businesses'>;
export type BusinessStatus = Enums<'business_status'>;
export type Country = Tables<'countries'>;
export type BusinessProfile = Tables<'business_profiles'>;

/**
 * The Business Object's non-core parts.
 *
 * `business_mode` is which front door created the business (Build vs Manage);
 * both produce the same object. Provenance and verification are typed enums so
 * the origin of a fact — and whether it has been verified — can never blur into
 * free text (product direction §2, §6).
 */
export type BusinessMode = Enums<'business_mode'>;
export type FactProvenance = Enums<'fact_provenance'>;
export type VerificationState = Enums<'verification_state'>;
export type BusinessIdentifierType = Enums<'business_identifier_type'>;
export type BusinessIdentifier = Tables<'business_identifiers'>;

/** The minimum a UI needs to render a business in a picker or list. */
export type BusinessSummary = Pick<Business, 'id' | 'name'>;

/**
 * The whole Business Object, assembled.
 *
 * One aggregate the command centre and Nova wiring can consume without each
 * caller re-joining the parts. The sensitive `identifiers` are included because
 * the founder's own command centre must show them (behind their own RLS); they
 * are stripped everywhere they must not travel (Nova, audit, analytics).
 */
export interface BusinessObject {
  business: Business;
  profile: BusinessProfile | null;
  identifiers: readonly BusinessIdentifier[];
}

/**
 * Partial intake answers written by a single step.
 *
 * Declared here rather than in `lib/db/` so Server Actions can name the shape
 * without importing the data-access layer.
 */
export type IntakePatch = Partial<
  Pick<
    BusinessProfile,
    | 'description'
    | 'founder_goals'
    | 'location'
    | 'business_stage'
    | 'employee_count'
    | 'funding_requirement_amount'
    | 'funding_requirement_currency'
    | 'last_completed_step'
    | 'completed_at'
    | 'responses'
    // Business-definition fields established at onboarding (Build/Manage). Still
    // written only through the profile service, never directly from app/.
    | 'products_services'
    | 'target_customers'
    | 'business_activities'
    | 'operating_status'
  >
>;
