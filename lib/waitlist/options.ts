import { Constants, type Database } from '@/types/database';

/**
 * The waitlist survey and recruitment vocabulary — one place for the stored
 * value and the words a person sees, so the public questionnaire, the
 * validation schema and the team's admin table can never drift apart.
 *
 * The labels are the exact wording agreed for the questionnaire. Change them
 * here, and only together with the product owner: the admin filters and any
 * reporting read the same labels.
 */

type Enums = Database['public']['Enums'];

export type BusinessStage = Enums['waitlist_business_stage'];
export type BiggestChallenge = Enums['waitlist_challenge'];
export type TestingInterest = Enums['waitlist_testing_interest'];
export type RecruitmentStatus = Enums['waitlist_recruitment_status'];

interface Option<T extends string> {
  value: T;
  label: string;
}

export const BUSINESS_STAGE_OPTIONS = [
  { value: 'just_exploring', label: 'Just exploring' },
  { value: 'planning_to_start', label: 'Planning to start' },
  { value: 'trying_to_register', label: 'Trying to register' },
  { value: 'already_operating', label: 'Already operating' },
] as const satisfies readonly Option<BusinessStage>[];

export const CHALLENGE_OPTIONS = [
  { value: 'finding_information', label: 'Finding reliable information' },
  { value: 'understanding_registration', label: 'Understanding registration' },
  { value: 'knowing_next_steps', label: 'Knowing the next steps' },
  { value: 'finding_customers', label: 'Finding customers' },
  { value: 'managing_business', label: 'Managing my business' },
  { value: 'other', label: 'Other' },
] as const satisfies readonly Option<BiggestChallenge>[];

export const TESTING_INTEREST_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'not_right_now', label: 'Not right now' },
] as const satisfies readonly Option<TestingInterest>[];

export const RECRUITMENT_STATUS_OPTIONS = [
  { value: 'not_contacted', label: 'Not Contacted' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'tested', label: 'Tested' },
] as const satisfies readonly Option<RecruitmentStatus>[];

/** Value tuples straight from the database enums, for `z.enum`. */
export const BUSINESS_STAGES = Constants.public.Enums.waitlist_business_stage;
export const CHALLENGES = Constants.public.Enums.waitlist_challenge;
export const TESTING_INTERESTS = Constants.public.Enums.waitlist_testing_interest;
export const RECRUITMENT_STATUSES = Constants.public.Enums.waitlist_recruitment_status;

function labelFrom<T extends string>(options: readonly Option<T>[], value: T | null): string {
  if (value === null) return '';
  return options.find((o) => o.value === value)?.label ?? value;
}

export const businessStageLabel = (v: BusinessStage | null) => labelFrom(BUSINESS_STAGE_OPTIONS, v);
export const challengeLabel = (v: BiggestChallenge | null) => labelFrom(CHALLENGE_OPTIONS, v);
export const testingInterestLabel = (v: TestingInterest | null) =>
  labelFrom(TESTING_INTEREST_OPTIONS, v);
export const recruitmentStatusLabel = (v: RecruitmentStatus | null) =>
  labelFrom(RECRUITMENT_STATUS_OPTIONS, v);

/** Limits shared by the form (maxLength), the schema and the database checks. */
export const SURVEY_LIMITS = {
  country: 100,
  cityIsland: 100,
  challengeOther: 300,
  recruitmentNotes: 2000,
} as const;
