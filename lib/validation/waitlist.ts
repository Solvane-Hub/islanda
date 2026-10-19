import { z } from 'zod';
import {
  BUSINESS_JOURNEYS,
  BUSINESS_STAGES,
  CHALLENGES,
  INDUSTRIES,
  OFFERED_CHALLENGES,
  PRIMARY_GOALS,
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

/** For questionnaire answers: blank means "cleared" (null), so a later save can remove an answer. */
function blankToNull(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  return value;
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

/* ── Questionnaire ────────────────────────────────────────────────────── */

function answerText(max: number) {
  return z.preprocess(
    blankToNull,
    z
      .string()
      .trim()
      .max(max, `Please keep this under ${max.toLocaleString('en-US')} characters.`)
      .nullable()
      .optional(),
  );
}

function answerChoice<const T extends readonly [string, ...string[]]>(values: T) {
  return z.preprocess(
    blankToNull,
    z
      .enum(values, { message: 'Choose one of the options, or leave it blank.' })
      .nullable()
      .optional(),
  );
}

/**
 * Every questionnaire answer. Each key is optional: an ABSENT key leaves the
 * stored answer alone (partial save), a PRESENT null clears it.
 */
export const surveyAnswersSchema = z.object({
  country: answerText(SURVEY_LIMITS.country),
  cityIsland: answerText(SURVEY_LIMITS.cityIsland),
  businessName: answerText(SURVEY_LIMITS.businessName),
  businessJourney: answerChoice(BUSINESS_JOURNEYS),
  industry: answerChoice(INDUSTRIES),
  industryOther: answerText(SURVEY_LIMITS.industryOther),
  primaryGoal: answerChoice(PRIMARY_GOALS),
  goalOther: answerText(SURVEY_LIMITS.goalOther),
  biggestChallenge: answerChoice(OFFERED_CHALLENGES),
  challengeOther: answerText(SURVEY_LIMITS.challengeOther),
  businessStage: answerChoice(BUSINESS_STAGES),
  testingInterest: answerChoice(TESTING_INTERESTS),
  feedbackInterest: answerChoice(TESTING_INTERESTS),
  additionalInfo: answerText(SURVEY_LIMITS.additionalInfo),
});

export type SurveyAnswersInput = z.infer<typeof surveyAnswersSchema>;
export type SurveyField = keyof SurveyAnswersInput;
export const SURVEY_FIELDS = Object.keys(surveyAnswersSchema.shape) as SurveyField[];

/** "Other" explanations belong only to "Other"; dropped (cleared) when another answer is chosen. */
function dropOrphanedExplanations(a: SurveyAnswersInput): SurveyAnswersInput {
  const out = { ...a };
  if ('industry' in a && a.industry !== undefined && a.industry !== 'other')
    out.industryOther = null;
  if ('primaryGoal' in a && a.primaryGoal !== undefined && a.primaryGoal !== 'other') {
    out.goalOther = null;
  }
  if (
    'biggestChallenge' in a &&
    a.biggestChallenge !== undefined &&
    a.biggestChallenge !== 'other'
  ) {
    out.challengeOther = null;
  }
  return Object.fromEntries(
    Object.entries(out).filter(([, v]) => v !== undefined),
  ) as SurveyAnswersInput;
}

/**
 * One questionnaire save. `final` marks the questionnaire as submitted; a
 * non-final save is a section the visitor has moved past. The token is the
 * only identifier and is never shown to the visitor.
 */
export const waitlistSurveySchema = z.object({
  token: z.string().min(32).max(128),
  final: z.boolean(),
  answers: surveyAnswersSchema.transform(dropOrphanedExplanations),
});

export type WaitlistSurveyInput = z.infer<typeof waitlistSurveySchema>;

/** Reads only the fields a section declared, so absent radios become "cleared", not "untouched". */
export function surveyAnswersFromForm(
  formData: FormData,
): Record<string, FormDataEntryValue | null> {
  const declared = String(formData.get('fields') ?? '')
    .split(',')
    .map((f) => f.trim())
    .filter((f): f is SurveyField => (SURVEY_FIELDS as string[]).includes(f));
  return Object.fromEntries(declared.map((field) => [field, formData.get(field)]));
}

/* ── Admin filters ────────────────────────────────────────────────────── */

/**
 * Admin table filters, read from the URL. Each filter is lenient: a malformed
 * value is ignored (`catch`) rather than failing the whole page, because the
 * URL is user-editable and an unknown filter should mean "no filter".
 */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function lenient<T extends z.ZodType>(schema: T) {
  return z.preprocess(blankToUndefined, schema.optional()).catch(undefined);
}

export const WAITLIST_SORTS = ['newest', 'oldest', 'name', 'survey', 'recruitment'] as const;

export const waitlistFiltersSchema = z.object({
  q: lenient(z.string().trim().max(255)),
  country: lenient(z.string().trim().max(SURVEY_LIMITS.country)),
  cityIsland: lenient(z.string().trim().max(SURVEY_LIMITS.cityIsland)),
  businessStage: lenient(z.enum(BUSINESS_STAGES)),
  businessJourney: lenient(z.enum(BUSINESS_JOURNEYS)),
  industry: lenient(z.enum(INDUSTRIES)),
  primaryGoal: lenient(z.enum(PRIMARY_GOALS)),
  biggestChallenge: lenient(z.enum(CHALLENGES)),
  testingInterest: lenient(z.enum(TESTING_INTERESTS)),
  feedbackInterest: lenient(z.enum(TESTING_INTERESTS)),
  recruitmentStatus: lenient(z.enum(RECRUITMENT_STATUSES)),
  completed: lenient(z.enum(['yes', 'no'])),
  /** Early-access or feedback answer of yes OR maybe — the pilot recruitment pool. */
  pool: lenient(z.enum(['early_access', 'feedback'])),
  /** Automated test records are hidden unless explicitly shown. */
  tests: lenient(z.enum(['show'])),
  from: lenient(z.string().regex(ISO_DATE)),
  to: lenient(z.string().regex(ISO_DATE)),
  sort: lenient(z.enum(WAITLIST_SORTS)),
  page: z.coerce.number().int().min(1).max(10_000).catch(1).default(1),
});

export type WaitlistFilters = z.infer<typeof waitlistFiltersSchema>;

/* ── Recruitment ──────────────────────────────────────────────────────── */

const optionalDate = z.preprocess(
  blankToNull,
  z.string().regex(ISO_DATE, 'Use a date in the format YYYY-MM-DD.').nullable().optional(),
);

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
  // Present only on the detail page's full editor; the table's quick editor omits them.
  contactedOn: optionalDate,
  confirmedOn: optionalDate,
  testedOn: optionalDate,
  feedbackSummary: z.preprocess(
    blankToNull,
    z
      .string()
      .max(SURVEY_LIMITS.feedbackSummary, 'The summary must be 2,000 characters or fewer.')
      .nullable()
      .optional(),
  ),
  feedbackLink: z.preprocess(
    blankToNull,
    z
      .url({ protocol: /^https$/, message: 'Use a full https:// link, or leave it blank.' })
      .max(SURVEY_LIMITS.feedbackLink)
      .nullable()
      .optional(),
  ),
});

export type RecruitmentUpdateInput = z.infer<typeof recruitmentUpdateSchema>;
