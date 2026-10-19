import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/database';
import type {
  BiggestChallenge,
  BusinessJourney,
  BusinessStage,
  Industry,
  PrimaryGoal,
  RecruitmentStatus,
  TestingInterest,
} from '@/lib/waitlist/options';

type Db = SupabaseClient<Database>;

/**
 * Waitlist repository — questionnaire saves and the administrators' views.
 *
 * Every query here runs on the caller's own session, so RLS decides what it
 * can see: the admin reads and updates succeed only for a platform
 * administrator on an MFA session (`app.is_waitlist_admin()` delegates to
 * `app.is_platform_admin()`); for anyone else they return no rows. The
 * service-role client is deliberately not used — RLS stays the boundary.
 *
 * `survey_token_hash` is never selected: no API role holds a grant on it.
 */

/** Keys the `save_waitlist_survey` function reads. Only present keys are written. */
export type SurveyAnswerPatch = Partial<{
  country: string | null;
  cityIsland: string | null;
  businessName: string | null;
  businessJourney: BusinessJourney | null;
  industry: Industry | null;
  industryOther: string | null;
  primaryGoal: PrimaryGoal | null;
  goalOther: string | null;
  biggestChallenge: BiggestChallenge | null;
  challengeOther: string | null;
  businessStage: BusinessStage | null;
  testingInterest: TestingInterest | null;
  feedbackInterest: TestingInterest | null;
  additionalInfo: string | null;
}>;

/** True when the token matched a signup and the answers were written. */
export async function saveSurveyAnswers(
  db: Db,
  token: string,
  answers: SurveyAnswerPatch,
  final: boolean,
): Promise<boolean> {
  const { data, error } = await db.rpc('save_waitlist_survey', {
    p_token: token,
    p_answers: answers as Json,
    p_final: final,
  });
  if (error) throw error;
  return data === true;
}

export type StoredSurveyAnswers = Required<SurveyAnswerPatch> & { completed: boolean };

/** The token holder's own answers, or null when the token matches nothing. */
export async function readSurveyAnswers(
  db: Db,
  token: string,
): Promise<StoredSurveyAnswers | null> {
  const { data, error } = await db.rpc('get_waitlist_survey', { p_token: token });
  if (error) throw error;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  return data as unknown as StoredSurveyAnswers;
}

const ENTRY_COLUMNS =
  'id, first_name, last_name, email, phone, business_name, created_at, survey_country, survey_city_island, business_journey, industry, industry_other, primary_goal, goal_other, business_stage, biggest_challenge, challenge_other, testing_interest, feedback_interest, additional_info, survey_started_at, survey_completed_at, survey_updated_at, recruitment_status, recruitment_notes, recruitment_updated_at, recruitment_contacted_on, recruitment_confirmed_on, recruitment_tested_on, feedback_summary, feedback_link' as const;

export interface WaitlistEntryRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  business_name: string | null;
  created_at: string;
  survey_country: string | null;
  survey_city_island: string | null;
  business_journey: BusinessJourney | null;
  industry: Industry | null;
  industry_other: string | null;
  primary_goal: PrimaryGoal | null;
  goal_other: string | null;
  business_stage: BusinessStage | null;
  biggest_challenge: BiggestChallenge | null;
  challenge_other: string | null;
  testing_interest: TestingInterest | null;
  feedback_interest: TestingInterest | null;
  additional_info: string | null;
  survey_started_at: string | null;
  survey_completed_at: string | null;
  survey_updated_at: string | null;
  recruitment_status: RecruitmentStatus;
  recruitment_notes: string | null;
  recruitment_updated_at: string | null;
  recruitment_contacted_on: string | null;
  recruitment_confirmed_on: string | null;
  recruitment_tested_on: string | null;
  feedback_summary: string | null;
  feedback_link: string | null;
}

/** Reserved/internal test domains — mirrors `app.is_test_email()` in SQL. */
export const TEST_EMAIL_DOMAINS = [
  'example.dev',
  'example.com',
  'example.org',
  'example.net',
  'resend.dev',
  'foundryai-test.dev',
  'foundryai-judge.dev',
] as const;

export function isTestEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  return (TEST_EMAIL_DOMAINS as readonly string[]).includes(domain) || domain.endsWith('.test');
}

export type WaitlistSort = 'newest' | 'oldest' | 'name' | 'survey' | 'recruitment';

export interface WaitlistQuery {
  /** Each term must match first name, last name, email, phone or business name (AND across terms). */
  searchTerms: string[];
  country?: string;
  cityIsland?: string;
  businessStage?: BusinessStage;
  businessJourney?: BusinessJourney;
  industry?: Industry;
  primaryGoal?: PrimaryGoal;
  biggestChallenge?: BiggestChallenge;
  testingInterest?: TestingInterest;
  feedbackInterest?: TestingInterest;
  recruitmentStatus?: RecruitmentStatus;
  completed?: boolean;
  pool?: 'early_access' | 'feedback';
  includeTests: boolean;
  /** Inclusive lower bound, ISO timestamp. */
  createdFrom?: string;
  /** Exclusive upper bound, ISO timestamp. */
  createdBefore?: string;
  sort: WaitlistSort;
  offset: number;
  limit: number;
}

/**
 * Filtered, sorted, paginated read. Filtering and paging happen in Postgres,
 * never in the browser. Free-text terms must already be sanitised by the
 * caller (no PostgREST filter syntax characters); see
 * `services/waitlist/recruitment.ts`.
 */
export async function listWaitlistEntries(
  db: Db,
  query: WaitlistQuery,
): Promise<{ rows: WaitlistEntryRow[]; total: number }> {
  let q = db.from('waitlist_signups').select(ENTRY_COLUMNS, { count: 'exact' });

  for (const term of query.searchTerms) {
    q = q.or(
      `first_name.ilike.*${term}*,last_name.ilike.*${term}*,email.ilike.*${term}*,phone.ilike.*${term}*,business_name.ilike.*${term}*`,
    );
  }
  if (!query.includeTests) {
    for (const domain of TEST_EMAIL_DOMAINS) q = q.not('email', 'ilike', `*@${domain}`);
  }
  if (query.country) q = q.ilike('survey_country', `%${query.country}%`);
  if (query.cityIsland) q = q.ilike('survey_city_island', `%${query.cityIsland}%`);
  if (query.businessStage) q = q.eq('business_stage', query.businessStage);
  if (query.businessJourney) q = q.eq('business_journey', query.businessJourney);
  if (query.industry) q = q.eq('industry', query.industry);
  if (query.primaryGoal) q = q.eq('primary_goal', query.primaryGoal);
  if (query.biggestChallenge) q = q.eq('biggest_challenge', query.biggestChallenge);
  if (query.testingInterest) q = q.eq('testing_interest', query.testingInterest);
  if (query.feedbackInterest) q = q.eq('feedback_interest', query.feedbackInterest);
  if (query.pool === 'early_access') q = q.in('testing_interest', ['yes', 'maybe']);
  if (query.pool === 'feedback') q = q.in('feedback_interest', ['yes', 'maybe']);
  if (query.recruitmentStatus) q = q.eq('recruitment_status', query.recruitmentStatus);
  if (query.completed === true) q = q.not('survey_completed_at', 'is', null);
  if (query.completed === false) q = q.is('survey_completed_at', null);
  if (query.createdFrom) q = q.gte('created_at', query.createdFrom);
  if (query.createdBefore) q = q.lt('created_at', query.createdBefore);

  switch (query.sort) {
    case 'oldest':
      q = q.order('created_at', { ascending: true });
      break;
    case 'name':
      q = q.order('first_name', { ascending: true, nullsFirst: false }).order('last_name');
      break;
    case 'survey':
      q = q.order('survey_completed_at', { ascending: false, nullsFirst: false });
      break;
    case 'recruitment':
      q = q.order('recruitment_updated_at', { ascending: false, nullsFirst: false });
      break;
    default:
      q = q.order('created_at', { ascending: false });
  }

  const { data, error, count } = await q
    .order('id', { ascending: false })
    .range(query.offset, query.offset + query.limit - 1);

  if (error) throw error;
  return { rows: (data ?? []) as WaitlistEntryRow[], total: count ?? 0 };
}

export async function getWaitlistEntry(db: Db, id: string): Promise<WaitlistEntryRow | null> {
  const { data, error } = await db
    .from('waitlist_signups')
    .select(ENTRY_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as WaitlistEntryRow | null) ?? null;
}

export interface RecruitmentFieldUpdate {
  recruitmentStatus: RecruitmentStatus;
  recruitmentNotes: string | null;
  contactedOn?: string | null;
  confirmedOn?: string | null;
  testedOn?: string | null;
  feedbackSummary?: string | null;
  feedbackLink?: string | null;
}

/**
 * Writes only the columns the admin grant covers. The timestamp is set by the
 * `waitlist_signups_track_recruitment` trigger, not by the caller. Optional
 * fields are written only when supplied. Returns null when no row was visible
 * to update (unknown id or not an administrator).
 */
export async function updateRecruitmentFields(
  db: Db,
  signupId: string,
  fields: RecruitmentFieldUpdate,
): Promise<{
  recruitment_status: RecruitmentStatus;
  recruitment_updated_at: string | null;
} | null> {
  const { data, error } = await db
    .from('waitlist_signups')
    .update({
      recruitment_status: fields.recruitmentStatus,
      recruitment_notes: fields.recruitmentNotes,
      ...(fields.contactedOn !== undefined ? { recruitment_contacted_on: fields.contactedOn } : {}),
      ...(fields.confirmedOn !== undefined ? { recruitment_confirmed_on: fields.confirmedOn } : {}),
      ...(fields.testedOn !== undefined ? { recruitment_tested_on: fields.testedOn } : {}),
      ...(fields.feedbackSummary !== undefined ? { feedback_summary: fields.feedbackSummary } : {}),
      ...(fields.feedbackLink !== undefined ? { feedback_link: fields.feedbackLink } : {}),
    })
    .eq('id', signupId)
    .select('recruitment_status, recruitment_updated_at')
    .maybeSingle();
  if (error) throw error;
  return data;
}
