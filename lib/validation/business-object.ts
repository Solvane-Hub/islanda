import { z } from 'zod';
import { businessNameSchema, countryCodeSchema, industrySchema } from './business';
import { BUSINESS_STAGES } from './intake';

/**
 * Business Object onboarding contracts — the two front doors (ADR-0005).
 *
 * Both paths create the SAME Business Object; these schemas differ only in what
 * each experience asks for. Nothing here fabricates or infers: every field is a
 * value the founder actually supplies. Sensitive identifiers are validated for
 * shape only and are stored `founder_provided · unverified` — no schema here
 * claims a value is verified (product direction §2, §6).
 */

/** A short optional free-text field (activities, products, customers, etc.). */
const optionalProse = (max: number) =>
  z
    .string()
    .trim()
    .max(max, 'That is longer than we can store. Please shorten it.')
    .optional()
    .transform((v) => (v === undefined || v === '' ? undefined : v));

/** A sensitive identifier value: shape-checked only, never verified here. */
const optionalIdentifier = z
  .string()
  .trim()
  .max(120, 'That identifier is too long.')
  .optional()
  .transform((v) => (v === undefined || v === '' ? undefined : v));

const optionalStage = z
  .enum(BUSINESS_STAGES)
  .optional()
  .or(z.literal('').transform(() => undefined));

/* ── Build my business (new founder) ──────────────────────────────────────
 *
 * One natural prompt. The concept is the founder's own words; industry and
 * stage are optional here because the point is to start from the idea, not a
 * form. Everything else is added later, with the founder, through the profile.
 */
export const buildBusinessSchema = z.object({
  name: businessNameSchema,
  countryCode: countryCodeSchema,
  concept: z
    .string()
    .trim()
    .min(20, 'Tell us a little more — a sentence or two about what you want to build.')
    .max(5000, 'That is longer than we can store. Please shorten it.'),
  industry: industrySchema,
  businessStage: optionalStage,
});

export type BuildBusinessInput = z.infer<typeof buildBusinessSchema>;

/* ── Manage my business (existing business) ───────────────────────────────
 *
 * Bring an existing company in. Legal name is required; the business's display
 * name derives from the trading name if given, else the legal name (resolved in
 * the service). Sensitive identifiers are optional and stored unverified.
 */
export const manageBusinessSchema = z.object({
  legalName: businessNameSchema,
  tradingName: z
    .string()
    .trim()
    .max(200, 'That name is too long.')
    .optional()
    .transform((v) => (v === undefined || v === '' ? undefined : v)),
  businessType: optionalProse(120),
  countryCode: countryCodeSchema,
  industry: industrySchema,
  location: z
    .string()
    .trim()
    .max(200, 'That location is too long.')
    .optional()
    .transform((v) => (v === undefined || v === '' ? undefined : v)),
  businessStage: optionalStage,
  operatingStatus: optionalProse(60),
  activities: optionalProse(5000),
  productsServices: optionalProse(5000),
  targetCustomers: optionalProse(5000),
  // Sensitive identifiers — optional, shape-only, stored founder_provided.
  registrationNumber: optionalIdentifier,
  taxId: optionalIdentifier,
  vatNumber: optionalIdentifier,
});

export type ManageBusinessInput = z.infer<typeof manageBusinessSchema>;
