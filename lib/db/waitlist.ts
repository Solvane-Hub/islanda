import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type {
  BiggestChallenge,
  BusinessStage,
  RecruitmentStatus,
  TestingInterest,
} from '@/lib/waitlist/options';

type Db = SupabaseClient<Database>;

/**
 * Waitlist repository — survey submission and the team's recruitment view.
 *
 * Every query here runs on the caller's own session, so RLS decides what it
 * can see: the admin reads and updates succeed only for a `waitlist_admin`
 * (see `app.is_waitlist_admin()`); for anyone else they return no rows. The
 * service-role client is deliberately not used — RLS stays the boundary.
 *
 * `survey_token_hash` is never selected: no API role holds a grant on it.
 */

export interface SurveyAnswers {
  country: string | null;
  cityIsland: string | null;
  businessStage: BusinessStage | null;
  biggestChallenge: BiggestChallenge | null;
  challengeOther: string | null;
  testingInterest: TestingInterest | null;
}

/** True when the token matched a signup and its answers were written. */
export async function submitSurveyAnswers(
  db: Db,
  token: string,
  answers: SurveyAnswers,
): Promise<boolean> {
  const { data, error } = await db.rpc('submit_waitlist_survey', {
    p_token: token,
    p_country: answers.country,
    p_city_island: answers.cityIsland,
    p_business_stage: answers.businessStage,
    p_biggest_challenge: answers.biggestChallenge,
    p_challenge_other: answers.challengeOther,
    p_testing_interest: answers.testingInterest,
  });
  if (error) throw error;
  return data === true;
}

export async function hasWaitlistAdminRole(db: Db, userId: string): Promise<boolean> {
  const { data, error } = await db
    .from('staff_members')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'waitlist_admin')
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

const ENTRY_COLUMNS =
  'id, first_name, last_name, email, phone, created_at, survey_country, survey_city_island, business_stage, biggest_challenge, challenge_other, testing_interest, survey_completed_at, recruitment_status, recruitment_notes, recruitment_updated_at' as const;

export interface WaitlistEntryRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  created_at: string;
  survey_country: string | null;
  survey_city_island: string | null;
  business_stage: BusinessStage | null;
  biggest_challenge: BiggestChallenge | null;
  challenge_other: string | null;
  testing_interest: TestingInterest | null;
  survey_completed_at: string | null;
  recruitment_status: RecruitmentStatus;
  recruitment_notes: string | null;
  recruitment_updated_at: string | null;
}

export interface WaitlistQuery {
  /** Each term must match first name, last name or email (AND across terms). */
  searchTerms: string[];
  country?: string;
  cityIsland?: string;
  businessStage?: BusinessStage;
  biggestChallenge?: BiggestChallenge;
  testingInterest?: TestingInterest;
  recruitmentStatus?: RecruitmentStatus;
  completed?: boolean;
  /** Inclusive lower bound, ISO timestamp. */
  createdFrom?: string;
  /** Exclusive upper bound, ISO timestamp. */
  createdBefore?: string;
  offset: number;
  limit: number;
}

/**
 * Filtered, paginated read. Filtering and paging happen in Postgres, never in
 * the browser. Free-text terms must already be sanitised by the caller (no
 * PostgREST filter syntax characters); see `services/waitlist/recruitment.ts`.
 */
export async function listWaitlistEntries(
  db: Db,
  query: WaitlistQuery,
): Promise<{ rows: WaitlistEntryRow[]; total: number }> {
  let q = db.from('waitlist_signups').select(ENTRY_COLUMNS, { count: 'exact' });

  for (const term of query.searchTerms) {
    q = q.or(`first_name.ilike.*${term}*,last_name.ilike.*${term}*,email.ilike.*${term}*`);
  }
  if (query.country) q = q.ilike('survey_country', `%${query.country}%`);
  if (query.cityIsland) q = q.ilike('survey_city_island', `%${query.cityIsland}%`);
  if (query.businessStage) q = q.eq('business_stage', query.businessStage);
  if (query.biggestChallenge) q = q.eq('biggest_challenge', query.biggestChallenge);
  if (query.testingInterest) q = q.eq('testing_interest', query.testingInterest);
  if (query.recruitmentStatus) q = q.eq('recruitment_status', query.recruitmentStatus);
  if (query.completed === true) q = q.not('survey_completed_at', 'is', null);
  if (query.completed === false) q = q.is('survey_completed_at', null);
  if (query.createdFrom) q = q.gte('created_at', query.createdFrom);
  if (query.createdBefore) q = q.lt('created_at', query.createdBefore);

  const { data, error, count } = await q
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(query.offset, query.offset + query.limit - 1);

  if (error) throw error;
  return { rows: (data ?? []) as WaitlistEntryRow[], total: count ?? 0 };
}

/**
 * Writes only the two columns the admin grant covers. The timestamp is set by
 * the `waitlist_signups_track_recruitment` trigger, not by the caller.
 * Returns null when no row was visible to update (unknown id or not an admin).
 */
export async function updateRecruitmentFields(
  db: Db,
  signupId: string,
  fields: { recruitmentStatus: RecruitmentStatus; recruitmentNotes: string | null },
): Promise<{
  recruitment_status: RecruitmentStatus;
  recruitment_updated_at: string | null;
} | null> {
  const { data, error } = await db
    .from('waitlist_signups')
    .update({
      recruitment_status: fields.recruitmentStatus,
      recruitment_notes: fields.recruitmentNotes,
    })
    .eq('id', signupId)
    .select('recruitment_status, recruitment_updated_at')
    .maybeSingle();
  if (error) throw error;
  return data;
}
