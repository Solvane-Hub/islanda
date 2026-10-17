import { z } from 'zod';
import {
  BUSINESS_STAGES,
  CHALLENGES,
  RECRUITMENT_STATUSES,
  SURVEY_LIMITS,
  TESTING_INTERESTS,
} from '@/lib/waitlist/options';

/** A blank or missing form value means "not answered", never an empty string. */
function blankToUndefined(value: unknown): unknown {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return value;
}

function optionalText(max: number, tooLong: string) {
  return z.preprocess(blankToUndefined, z.string().trim().max(max, tooLong).optional());
}

function optionalChoice<const T extends readonly [string, ...string[]]>(values: T) {
  return z.preprocess(
    blankToUndefined,
    z.enum(values, { message: 'Choose one of the options, or leave it blank.' }).optional(),
  );
}

const PHONE_MESSAGE = 'Enter a valid phone number, or leave it blank.';

export const joinWaitlistSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required.')
    .max(255, 'Email is too long.')
    .email('Enter a valid email address.'),

  firstName: z
    .string()
    .trim()
    .min(1, 'First name is required.')
    .max(100, 'First name is too long.'),

  lastName: z.string().trim().min(1, 'Last name is required.').max(100, 'Last name is too long.'),

  // Optional. Mirrors ws_phone_format: 7–30 characters of digits and the usual
  // separators, with at least 7 digits, so "(242) 555-0123" and "+1 242 555 0123"
  // both pass.
  phone: z.preprocess(
    blankToUndefined,
    z
      .string()
      .trim()
      .max(30, PHONE_MESSAGE)
      .regex(/^[0-9+(). -]+$/, PHONE_MESSAGE)
      .refine((v) => (v.match(/\d/g) ?? []).length >= 7, PHONE_MESSAGE)
      .optional(),
  ),
});

export type JoinWaitlistInput = z.infer<typeof joinWaitlistSchema>;

/**
 * The optional post-signup questionnaire. Every answer may be omitted; the
 * token is the only required value, and it is never shown to the visitor.
 */
export const waitlistSurveySchema = z
  .object({
    token: z.string().min(32).max(128),
    country: optionalText(SURVEY_LIMITS.country, 'Please keep this under 100 characters.'),
    cityIsland: optionalText(SURVEY_LIMITS.cityIsland, 'Please keep this under 100 characters.'),
    businessStage: optionalChoice(BUSINESS_STAGES),
    biggestChallenge: optionalChoice(CHALLENGES),
    challengeOther: optionalText(
      SURVEY_LIMITS.challengeOther,
      'Please keep this under 300 characters.',
    ),
    testingInterest: optionalChoice(TESTING_INTERESTS),
  })
  // An explanation only belongs to "Other". Dropped silently rather than
  // rejected: the visitor may have typed it, then picked a different answer.
  .transform((survey) =>
    survey.biggestChallenge === 'other' ? survey : { ...survey, challengeOther: undefined },
  );

export type WaitlistSurveyInput = z.infer<typeof waitlistSurveySchema>;

/**
 * Admin table filters, read from the URL. Each filter is lenient: a malformed
 * value is ignored (`catch`) rather than failing the whole page, because the
 * URL is user-editable and an unknown filter should mean "no filter".
 */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function lenient<T extends z.ZodType>(schema: T) {
  return z.preprocess(blankToUndefined, schema.optional()).catch(undefined);
}

export const waitlistFiltersSchema = z.object({
  q: lenient(z.string().trim().max(255)),
  country: lenient(z.string().trim().max(SURVEY_LIMITS.country)),
  cityIsland: lenient(z.string().trim().max(SURVEY_LIMITS.cityIsland)),
  businessStage: lenient(z.enum(BUSINESS_STAGES)),
  biggestChallenge: lenient(z.enum(CHALLENGES)),
  testingInterest: lenient(z.enum(TESTING_INTERESTS)),
  recruitmentStatus: lenient(z.enum(RECRUITMENT_STATUSES)),
  completed: lenient(z.enum(['yes', 'no'])),
  from: lenient(z.string().regex(ISO_DATE)),
  to: lenient(z.string().regex(ISO_DATE)),
  page: z.coerce.number().int().min(1).max(10_000).catch(1).default(1),
});

export type WaitlistFilters = z.infer<typeof waitlistFiltersSchema>;

export const recruitmentUpdateSchema = z.object({
  signupId: z.uuid(),
  recruitmentStatus: z.enum(RECRUITMENT_STATUSES, { message: 'Choose a recruitment status.' }),
  recruitmentNotes: z.preprocess(
    blankToUndefined,
    z
      .string()
      .max(SURVEY_LIMITS.recruitmentNotes, 'Notes must be 2,000 characters or fewer.')
      .optional(),
  ),
});

export type RecruitmentUpdateInput = z.infer<typeof recruitmentUpdateSchema>;
