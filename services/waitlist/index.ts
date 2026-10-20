import { createHash, randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { consumeRateLimit, type RateLimitDecision } from '@/lib/db/rate-limit';
import {
  readSurveyAnswers,
  saveSurveyAnswers,
  type StoredSurveyAnswers,
  type SurveyAnswerPatch,
} from '@/lib/db/waitlist';
import type { WaitlistSurveyInput } from '@/lib/validation/waitlist';

/**
 * Public waitlist — the one write path into `waitlist_signups`.
 *
 * The public surface is this function's INSERT plus the token-gated survey
 * write below; a visitor can never SELECT, UPDATE or DELETE a row. Reading and
 * recruitment updates belong to platform administrators only — see
 * `services/waitlist/recruitment.ts`. A duplicate
 * email is not an error to the caller — it is the same outcome as a first-time
 * signup, so a visitor who submits twice (or from two devices) is never shown
 * a scary error for something that isn't one.
 */

const WAITLIST_RATE_LIMIT = 5;
const WAITLIST_RATE_WINDOW_SECONDS = 60 * 60;
const WAITLIST_RATE_SCOPE = 'waitlist:join';

/**
 * Reuses the same fail-closed limiter as Nova (`services/nova/rate-limit.ts`),
 * keyed by IP rather than by signed-in user since a visitor here has no
 * session. `consume_rate_limit` was previously grantable only to
 * `authenticated`; the waitlist migration extends the grant to `anon`.
 */
export async function consumeWaitlistRateLimit(
  db: SupabaseClient<Database>,
  ip: string,
): Promise<RateLimitDecision> {
  return consumeRateLimit(db, {
    scope: WAITLIST_RATE_SCOPE,
    subjectId: ip,
    windowSeconds: WAITLIST_RATE_WINDOW_SECONDS,
    limit: WAITLIST_RATE_LIMIT,
  });
}
export interface JoinWaitlistInput {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | undefined;
  source: string;
}

/**
 * `surveyToken` is issued only to a NEW signup. It is a random capability for
 * the optional follow-up questions on that one row — not an id, and never
 * stored (only its SHA-256 is). A duplicate signup gets no token: handing one
 * out to anyone who types a known email would let them overwrite a stranger's
 * answers.
 */
export type JoinWaitlistResult =
  { status: 'joined'; surveyToken: string } | { status: 'already_on_list' };

export function hashSurveyToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Postgres unique_violation. */
const UNIQUE_VIOLATION = '23505';

export async function joinWaitlist(
  db: SupabaseClient<Database>,
  input: JoinWaitlistInput,
): Promise<JoinWaitlistResult> {
  const email = input.email.trim().toLowerCase();
  const surveyToken = randomBytes(32).toString('base64url');
  const phone = input.phone?.trim();

  const { error } = await db.from('waitlist_signups').insert({
    email,
    first_name: input.firstName.trim(),
    last_name: input.lastName.trim(),
    ...(phone ? { phone } : {}),
    source: input.source,
    survey_token_hash: hashSurveyToken(surveyToken),
  });

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { status: 'already_on_list' };
    }
    throw error;
  }

  return { status: 'joined', surveyToken };
}

/* ── Optional survey ──────────────────────────────────────────────────── */

const SURVEY_RATE_LIMIT = 20;
const SURVEY_RATE_SCOPE = 'waitlist:survey';

/** Same fail-closed limiter, separate scope, so answering never eats signup budget. */
export async function consumeWaitlistSurveyRateLimit(
  db: SupabaseClient<Database>,
  ip: string,
): Promise<RateLimitDecision> {
  return consumeRateLimit(db, {
    scope: SURVEY_RATE_SCOPE,
    subjectId: ip,
    windowSeconds: WAITLIST_RATE_WINDOW_SECONDS,
    limit: SURVEY_RATE_LIMIT,
  });
}

export interface SubmitWaitlistSurveyResult {
  /**
   * `saved`      — answers written to the visitor’s existing signup.
   * `empty`      — nothing was answered; treated exactly like skipping.
   * `not_found`  — the token matched no signup (expired page, tampering).
   */
  status: 'saved' | 'empty' | 'not_found';
}

/**
 * Writes the visitor’s answers onto their EXISTING waitlist row via the
 * token-gated `save_waitlist_survey` function. Only the answers present in
 * the input are written, so each questionnaire section can be saved on its
 * own and a later section never erases an earlier one. There is no insert
 * path here, so no answer can ever create a second signup. Recruitment status
 * and contact details are never touched.
 */
export async function submitWaitlistSurvey(
  db: SupabaseClient<Database>,
  input: WaitlistSurveyInput,
): Promise<SubmitWaitlistSurveyResult> {
  const answers: SurveyAnswerPatch = Object.fromEntries(
    Object.entries(input.answers).filter(([, value]) => value !== undefined),
  );
  const hasAnswer = Object.values(answers).some(
    (value) => value !== null && !(Array.isArray(value) && value.length === 0),
  );

  // Nothing answered in this save. It still matters when earlier sections
  // stored answers (a cleared answer, or the final submit that completes the
  // questionnaire); otherwise it is exactly the same as skipping and nothing
  // is written.
  if (!hasAnswer && !(await hasAnyStoredAnswer(db, input.token))) {
    return { status: 'empty' };
  }

  const matched = await saveSurveyAnswers(db, input.token, answers, input.final);
  return { status: matched ? 'saved' : 'not_found' };
}

async function hasAnyStoredAnswer(db: SupabaseClient<Database>, token: string): Promise<boolean> {
  const stored = await readSurveyAnswers(db, token);
  if (!stored) return false;
  return Object.entries(stored).some(
    ([key, value]) =>
      key !== 'completed' && value !== null && !(Array.isArray(value) && value.length === 0),
  );
}

/** The visitor’s own stored answers (by token), so they can return and update them. */
export async function getWaitlistSurvey(
  db: SupabaseClient<Database>,
  token: string,
): Promise<StoredSurveyAnswers | null> {
  return readSurveyAnswers(db, token);
}

export type { StoredSurveyAnswers } from '@/lib/db/waitlist';
export { isTestSignup } from '@/lib/db/waitlist';
