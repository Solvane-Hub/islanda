import { createHash, randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { consumeRateLimit, type RateLimitDecision } from '@/lib/db/rate-limit';
import { submitSurveyAnswers } from '@/lib/db/waitlist';
import type { WaitlistSurveyInput } from '@/lib/validation/waitlist';

/**
 * Public waitlist — the one write path into `waitlist_signups`.
 *
 * The public surface is this function's INSERT plus the token-gated survey
 * write below; a visitor can never SELECT, UPDATE or DELETE a row. Reading and
 * recruitment updates belong to `waitlist_admin` staff only — see
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
   * `saved`      — answers written to the visitor's existing signup.
   * `empty`      — nothing was answered; treated exactly like skipping.
   * `not_found`  — the token matched no signup (expired page, tampering).
   */
  status: 'saved' | 'empty' | 'not_found';
}

/**
 * Writes the visitor's answers onto their EXISTING waitlist row via the
 * token-gated `submit_waitlist_survey` function. There is no insert path here,
 * so no answer can ever create a second signup; submitting again overwrites
 * the same row. Recruitment status and contact details are never touched.
 */
export async function submitWaitlistSurvey(
  db: SupabaseClient<Database>,
  input: WaitlistSurveyInput,
): Promise<SubmitWaitlistSurveyResult> {
  const answers = {
    country: input.country ?? null,
    cityIsland: input.cityIsland ?? null,
    businessStage: input.businessStage ?? null,
    biggestChallenge: input.biggestChallenge ?? null,
    challengeOther: input.biggestChallenge === 'other' ? (input.challengeOther ?? null) : null,
    testingInterest: input.testingInterest ?? null,
  };

  if (Object.values(answers).every((value) => value === null)) {
    return { status: 'empty' };
  }

  const matched = await submitSurveyAnswers(db, input.token, answers);
  return { status: matched ? 'saved' : 'not_found' };
}
