import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { AppError, newCorrelationId } from '@/lib/errors';
import {
  hasWaitlistAdminRole,
  listWaitlistEntries,
  updateRecruitmentFields,
  type WaitlistEntryRow,
} from '@/lib/db/waitlist';
import type { SignInInput } from '@/lib/validation/auth';
import type { RecruitmentUpdateInput, WaitlistFilters } from '@/lib/validation/waitlist';
import type { RecruitmentStatus } from '@/lib/waitlist/options';
import { recordAuditEvent } from '@/services/audit';
import * as authService from '@/services/auth';
import type { RequestContext } from '@/services/auth';

/**
 * Waitlist & Pilot Recruitment — the team-only side of the waitlist.
 *
 * Authorization is layered, and every layer must agree:
 *   1. a real Supabase session (`getUser()`, never `getSession()`);
 *   2. a `waitlist_admin` row in `staff_members` for that user;
 *   3. RLS on `waitlist_signups`, which admits only `app.is_waitlist_admin()`.
 * Layers 1–2 decide what the page renders; layer 3 is what actually protects
 * the data, so a bug in 1–2 still returns nothing to a non-admin.
 *
 * ⚠ Deliberately does NOT use `getCurrentUser()` from services/auth: that
 *   returns null whenever WAITLIST_ONLY_MODE is on (the production default),
 *   which is exactly when the team needs this page. Founder sign-in stays
 *   closed; only staff with the role get past `signInWaitlistAdmin`.
 */

type Db = SupabaseClient<Database>;

export type WaitlistAdminAccess =
  { kind: 'signed_out' } | { kind: 'not_admin' } | { kind: 'admin'; userId: string };

/** Fails closed: any error while checking the role is treated as "not an admin". */
export async function getWaitlistAdminAccess(db: Db): Promise<WaitlistAdminAccess> {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { kind: 'signed_out' };

  try {
    return (await hasWaitlistAdminRole(db, user.id))
      ? { kind: 'admin', userId: user.id }
      : { kind: 'not_admin' };
  } catch {
    return { kind: 'not_admin' };
  }
}

const NOT_STAFF_MESSAGE = 'We could not sign you in to the team area with those details.';

/**
 * Staff sign-in. Uses the normal password sign-in, then immediately signs the
 * session out again unless the user holds the waitlist_admin role — so this
 * entrance can never be used as a back door into the founder product while it
 * is waitlist-only. The message is the same either way.
 */
export async function signInWaitlistAdmin(
  db: Db,
  input: SignInInput,
  ctx: RequestContext = {},
): Promise<void> {
  const correlationId = ctx.correlationId ?? newCorrelationId();

  try {
    await authService.signIn(db, input, { ...ctx, correlationId });
  } catch (error) {
    if (error instanceof AppError && error.code === 'AUTH_RATE_LIMITED') throw error;
    throw new AppError({ code: 'FORBIDDEN', humanMessage: NOT_STAFF_MESSAGE, correlationId });
  }

  const access = await getWaitlistAdminAccess(db);
  if (access.kind !== 'admin') {
    await authService.signOut(db, { ...ctx, correlationId });
    throw new AppError({ code: 'FORBIDDEN', humanMessage: NOT_STAFF_MESSAGE, correlationId });
  }
}

/* ── Listing ──────────────────────────────────────────────────────────── */

export const WAITLIST_PAGE_SIZE = 50;

export interface WaitlistEntry {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  signedUpAt: string;
  country: string | null;
  cityIsland: string | null;
  businessStage: WaitlistEntryRow['business_stage'];
  biggestChallenge: WaitlistEntryRow['biggest_challenge'];
  challengeOther: string | null;
  testingInterest: WaitlistEntryRow['testing_interest'];
  surveyCompletedAt: string | null;
  recruitmentStatus: RecruitmentStatus;
  recruitmentNotes: string | null;
  recruitmentUpdatedAt: string | null;
}

export interface WaitlistPage {
  entries: WaitlistEntry[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
}

/**
 * Strips everything but letters, digits and the characters that occur in
 * names and email addresses. This is what makes it safe to place a term
 * inside a PostgREST `or=(…)` filter: commas, parentheses, quotes and
 * wildcards are all removed, so a search can only ever be a search.
 */
export function sanitiseSearchTerm(term: string): string {
  return term.replace(/[^\p{L}\p{N}@._+'-]/gu, '').slice(0, 100);
}

function startOfUtcDay(isoDate: string): string | undefined {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function startOfNextUtcDay(isoDate: string): string | undefined {
  const start = startOfUtcDay(isoDate);
  if (!start) return undefined;
  const next = new Date(start);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString();
}

function toEntry(row: WaitlistEntryRow): WaitlistEntry {
  return {
    id: row.id,
    name: [row.first_name, row.last_name].filter(Boolean).join(' '),
    email: row.email,
    phone: row.phone,
    signedUpAt: row.created_at,
    country: row.survey_country,
    cityIsland: row.survey_city_island,
    businessStage: row.business_stage,
    biggestChallenge: row.biggest_challenge,
    challengeOther: row.challenge_other,
    testingInterest: row.testing_interest,
    surveyCompletedAt: row.survey_completed_at,
    recruitmentStatus: row.recruitment_status,
    recruitmentNotes: row.recruitment_notes,
    recruitmentUpdatedAt: row.recruitment_updated_at,
  };
}

export async function listWaitlist(db: Db, filters: WaitlistFilters): Promise<WaitlistPage> {
  const searchTerms = (filters.q ?? '')
    .split(/\s+/)
    .map(sanitiseSearchTerm)
    .filter(Boolean)
    .slice(0, 5);
  const country = filters.country ? sanitiseSearchTerm(filters.country) : '';
  const cityIsland = filters.cityIsland
    ? filters.cityIsland.split(/\s+/).map(sanitiseSearchTerm).filter(Boolean).join(' ')
    : '';
  const page = filters.page;

  const createdFrom = filters.from ? startOfUtcDay(filters.from) : undefined;
  const createdBefore = filters.to ? startOfNextUtcDay(filters.to) : undefined;

  const { rows, total } = await listWaitlistEntries(db, {
    searchTerms,
    ...(country ? { country } : {}),
    ...(cityIsland ? { cityIsland } : {}),
    ...(filters.businessStage ? { businessStage: filters.businessStage } : {}),
    ...(filters.biggestChallenge ? { biggestChallenge: filters.biggestChallenge } : {}),
    ...(filters.testingInterest ? { testingInterest: filters.testingInterest } : {}),
    ...(filters.recruitmentStatus ? { recruitmentStatus: filters.recruitmentStatus } : {}),
    ...(filters.completed ? { completed: filters.completed === 'yes' } : {}),
    ...(createdFrom ? { createdFrom } : {}),
    ...(createdBefore ? { createdBefore } : {}),
    offset: (page - 1) * WAITLIST_PAGE_SIZE,
    limit: WAITLIST_PAGE_SIZE,
  });

  return {
    entries: rows.map(toEntry),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / WAITLIST_PAGE_SIZE)),
    pageSize: WAITLIST_PAGE_SIZE,
  };
}

/* ── Recruitment updates ──────────────────────────────────────────────── */

export interface RecruitmentUpdateResult {
  recruitmentStatus: RecruitmentStatus;
  recruitmentUpdatedAt: string | null;
}

/**
 * Changes a signup's recruitment status and/or internal notes. RLS is what
 * enforces the admin requirement; the explicit check first only makes a
 * non-admin's failure a clear FORBIDDEN rather than a puzzling NOT_FOUND.
 * Audit metadata carries shape only — never the notes, name or email.
 */
export async function updateRecruitment(
  db: Db,
  input: RecruitmentUpdateInput,
  ctx: RequestContext = {},
): Promise<RecruitmentUpdateResult> {
  const correlationId = ctx.correlationId ?? newCorrelationId();

  const access = await getWaitlistAdminAccess(db);
  if (access.kind !== 'admin') {
    throw new AppError({
      code: 'FORBIDDEN',
      humanMessage: 'You do not have permission to change recruitment details.',
      correlationId,
    });
  }

  const updated = await updateRecruitmentFields(db, input.signupId, {
    recruitmentStatus: input.recruitmentStatus,
    recruitmentNotes: input.recruitmentNotes ?? null,
  });
  if (!updated) {
    throw new AppError({
      code: 'NOT_FOUND',
      humanMessage: 'That waitlist entry could not be found. Refresh the page and try again.',
      correlationId,
    });
  }

  await recordAuditEvent({
    event: 'waitlist.recruitment_updated',
    actorId: access.userId,
    correlationId,
    ipAddress: ctx.ipAddress ?? null,
    userAgent: ctx.userAgent ?? null,
    metadata: {
      signupId: input.signupId,
      recruitmentStatus: updated.recruitment_status,
      hasNotes: Boolean(input.recruitmentNotes),
    },
  });

  return {
    recruitmentStatus: updated.recruitment_status,
    recruitmentUpdatedAt: updated.recruitment_updated_at,
  };
}
