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
  primaryGoals: PrimaryGoal[] | null;
  goalOther: string | null;
  challenges: BiggestChallenge[] | null;
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

export type StoredSurveyAnswers = Required<
  Omit<SurveyAnswerPatch, 'primaryGoals' | 'challenges'>
> & {
  primaryGoals: PrimaryGoal[];
  challenges: BiggestChallenge[];
  completed: boolean;
};

/**
 * The token holder's own answers, or null when the token matches nothing.
 * Reads both shapes the database function has returned: the multi-select
 * arrays and, from before they existed, a single `primaryGoal` /
 * `biggestChallenge`.
 */
export async function readSurveyAnswers(
  db: Db,
  token: string,
): Promise<StoredSurveyAnswers | null> {
  const { data, error } = await db.rpc('get_waitlist_survey', { p_token: token });
  if (error) throw error;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const row = data as Record<string, unknown>;
  const list = <T>(many: unknown, one: unknown): T[] =>
    Array.isArray(many) && many.length > 0
      ? (many as T[])
      : typeof one === 'string' && one
        ? [one as T]
        : [];
  const { primaryGoal, biggestChallenge, ...rest } = row;
  return {
    ...(rest as unknown as Omit<StoredSurveyAnswers, 'primaryGoals' | 'challenges'>),
    primaryGoals: list<PrimaryGoal>(row.primaryGoals, primaryGoal),
    challenges: list<BiggestChallenge>(row.challenges, biggestChallenge),
  };
}

const ENTRY_COLUMNS =
  'id, first_name, last_name, email, phone, business_name, created_at, survey_country, survey_city_island, business_journey, industry, industry_other, primary_goal, primary_goals, goal_other, business_stage, biggest_challenge, challenges, challenge_other, source, testing_interest, feedback_interest, additional_info, survey_started_at, survey_completed_at, survey_updated_at, recruitment_status, recruitment_notes, recruitment_updated_at, recruitment_contacted_on, recruitment_confirmed_on, recruitment_tested_on, feedback_summary, feedback_link' as const;

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
  /** First selected goal — kept in step for older readers. Prefer `primary_goals`. */
  primary_goal: PrimaryGoal | null;
  /** Null for rows saved before multi-select existed; read through `goalsOf`. */
  primary_goals: PrimaryGoal[] | null;
  goal_other: string | null;
  business_stage: BusinessStage | null;
  biggest_challenge: BiggestChallenge | null;
  challenges: BiggestChallenge[] | null;
  challenge_other: string | null;
  source: string | null;
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

/**
 * `source` markers for signups that are not genuine contacts — mirrors
 * `app.is_test_signup()` in SQL. Written by the RLS suite and by every
 * non-production deployment.
 */
export const TEST_SOURCES = ['rls_test', 'e2e_test', 'development', 'preview'] as const;

export function isTestSignup(email: string, source: string | null): boolean {
  return (
    isTestEmail(email) || (source !== null && (TEST_SOURCES as readonly string[]).includes(source))
  );
}

/** Every selected goal, including a single answer stored before multi-select existed. */
export function goalsOf(
  row: Pick<WaitlistEntryRow, 'primary_goals' | 'primary_goal'>,
): PrimaryGoal[] {
  return row.primary_goals ?? (row.primary_goal ? [row.primary_goal] : []);
}

/** Every selected challenge, including a single answer stored before multi-select existed. */
export function challengesOf(
  row: Pick<WaitlistEntryRow, 'challenges' | 'biggest_challenge'>,
): BiggestChallenge[] {
  return row.challenges ?? (row.biggest_challenge ? [row.biggest_challenge] : []);
}

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
  /** Matches a person who selected this goal (among any others). */
  primaryGoal?: PrimaryGoal;
  /** Matches a person who selected this challenge (among any others). */
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
    q = q.or(`source.is.null,source.not.in.(${TEST_SOURCES.join(',')})`);
  }
  if (query.country) q = q.ilike('survey_country', `%${query.country}%`);
  if (query.cityIsland) q = q.ilike('survey_city_island', `%${query.cityIsland}%`);
  if (query.businessStage) q = q.eq('business_stage', query.businessStage);
  if (query.businessJourney) q = q.eq('business_journey', query.businessJourney);
  if (query.industry) q = q.eq('industry', query.industry);
  // Rows from before multi-select were backfilled into the arrays by the
  // 20261019200000 migration, so "contains" also finds historical answers.
  if (query.primaryGoal) q = q.contains('primary_goals', [query.primaryGoal]);
  if (query.biggestChallenge) q = q.contains('challenges', [query.biggestChallenge]);
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
