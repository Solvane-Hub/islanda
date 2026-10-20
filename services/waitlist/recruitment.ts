import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { AppError, newCorrelationId } from '@/lib/errors';
import {
  challengesOf,
  getWaitlistEntry,
  goalsOf,
  isTestSignup,
  listWaitlistEntries,
  updateRecruitmentFields,
  type WaitlistEntryRow,
  type WaitlistSort,
} from '@/lib/db/waitlist';
import type { RecruitmentUpdateInput, WaitlistFilters } from '@/lib/validation/waitlist';
import type { RecruitmentStatus } from '@/lib/waitlist/options';
import { recordAuditEvent } from '@/services/audit';
import { requireAdmin } from '@/services/admin/access';
import type { RequestContext } from '@/services/auth';

/**
 * Waitlist & Pilot Recruitment — the administrators' side of the waitlist.
 *
 * Authorization is layered, and every layer must agree:
 *   1. a real Supabase session (`getUser()`, never `getSession()`);
 *   2. an owner-only platform administrator on an MFA session
 *      (services/admin/access);
 *   3. RLS on `waitlist_signups`, which admits only `app.is_platform_admin()`.
 * Layers 1–2 decide what the page renders; layer 3 is what actually protects
 * the data, so a bug in 1–2 still returns nothing to anyone else.
 */

type Db = SupabaseClient<Database>;

export const WAITLIST_PAGE_SIZE = 50;

export type WaitlistEntry = ReturnType<typeof toEntry>;

export interface WaitlistPage {
  entries: WaitlistEntry[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
}

/**
 * Strips everything but letters, digits and the characters that occur in
 * names, emails and phone numbers. This is what makes it safe to place a term
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

function toEntry(row: WaitlistEntryRow) {
  return {
    id: row.id,
    name: [row.first_name, row.last_name].filter(Boolean).join(' '),
    email: row.email,
    phone: row.phone,
    businessName: row.business_name,
    isTest: isTestSignup(row.email, row.source),
    signedUpAt: row.created_at,
    country: row.survey_country,
    cityIsland: row.survey_city_island,
    businessJourney: row.business_journey,
    industry: row.industry,
    industryOther: row.industry_other,
    /** Every selected goal; a pre-multi-select answer reads as a one-item list. */
    primaryGoals: goalsOf(row),
    goalOther: row.goal_other,
    businessStage: row.business_stage,
    /** Every selected challenge; a pre-multi-select answer reads as a one-item list. */
    challenges: challengesOf(row),
    challengeOther: row.challenge_other,
    testingInterest: row.testing_interest,
    feedbackInterest: row.feedback_interest,
    additionalInfo: row.additional_info,
    surveyStartedAt: row.survey_started_at,
    surveyCompletedAt: row.survey_completed_at,
    surveyUpdatedAt: row.survey_updated_at,
    recruitmentStatus: row.recruitment_status,
    recruitmentNotes: row.recruitment_notes,
    recruitmentUpdatedAt: row.recruitment_updated_at,
    contactedOn: row.recruitment_contacted_on,
    confirmedOn: row.recruitment_confirmed_on,
    testedOn: row.recruitment_tested_on,
    feedbackSummary: row.feedback_summary,
    feedbackLink: row.feedback_link,
  };
}

export async function listWaitlist(
  db: Db,
  filters: WaitlistFilters,
  pageSize: number = WAITLIST_PAGE_SIZE,
): Promise<WaitlistPage> {
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
    ...(filters.businessJourney ? { businessJourney: filters.businessJourney } : {}),
    ...(filters.industry ? { industry: filters.industry } : {}),
    ...(filters.primaryGoal ? { primaryGoal: filters.primaryGoal } : {}),
    ...(filters.biggestChallenge ? { biggestChallenge: filters.biggestChallenge } : {}),
    ...(filters.testingInterest ? { testingInterest: filters.testingInterest } : {}),
    ...(filters.feedbackInterest ? { feedbackInterest: filters.feedbackInterest } : {}),
    ...(filters.recruitmentStatus ? { recruitmentStatus: filters.recruitmentStatus } : {}),
    ...(filters.completed ? { completed: filters.completed === 'yes' } : {}),
    ...(filters.pool ? { pool: filters.pool } : {}),
    includeTests: filters.tests === 'show',
    ...(createdFrom ? { createdFrom } : {}),
    ...(createdBefore ? { createdBefore } : {}),
    sort: (filters.sort ?? 'newest') as WaitlistSort,
    offset: (page - 1) * pageSize,
    limit: pageSize,
  });

  return {
    entries: rows.map(toEntry),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    pageSize,
  };
}

export async function getWaitlistDetail(db: Db, id: string): Promise<WaitlistEntry | null> {
  const row = await getWaitlistEntry(db, id);
  return row ? toEntry(row) : null;
}

/* ── Recruitment updates ──────────────────────────────────────────────── */

export interface RecruitmentUpdateResult {
  recruitmentStatus: RecruitmentStatus;
  recruitmentUpdatedAt: string | null;
}

/**
 * Changes a signup's recruitment status, notes, dates and feedback summary.
 * RLS is what enforces the administrator requirement; the explicit check
 * first only makes anyone else's failure a clear FORBIDDEN rather than a
 * puzzling NOT_FOUND. Audit metadata carries shape only — never the notes,
 * feedback text, name, email or phone.
 */
export async function updateRecruitment(
  db: Db,
  input: RecruitmentUpdateInput,
  ctx: RequestContext = {},
): Promise<RecruitmentUpdateResult> {
  const correlationId = ctx.correlationId ?? newCorrelationId();
  const admin = await requireAdmin(db, { ...ctx, correlationId });

  const updated = await updateRecruitmentFields(db, input.signupId, {
    recruitmentStatus: input.recruitmentStatus,
    recruitmentNotes: input.recruitmentNotes ?? null,
    ...(input.contactedOn !== undefined ? { contactedOn: input.contactedOn } : {}),
    ...(input.confirmedOn !== undefined ? { confirmedOn: input.confirmedOn } : {}),
    ...(input.testedOn !== undefined ? { testedOn: input.testedOn } : {}),
    ...(input.feedbackSummary !== undefined ? { feedbackSummary: input.feedbackSummary } : {}),
    ...(input.feedbackLink !== undefined ? { feedbackLink: input.feedbackLink } : {}),
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
    actorId: admin.userId,
    correlationId,
    ipAddress: ctx.ipAddress ?? null,
    userAgent: ctx.userAgent ?? null,
    metadata: {
      signupId: input.signupId,
      recruitmentStatus: updated.recruitment_status,
      hasNotes: Boolean(input.recruitmentNotes),
      datesChanged: ['contactedOn', 'confirmedOn', 'testedOn'].filter(
        (k) => input[k as 'contactedOn'] !== undefined,
      ),
      hasFeedback: Boolean(input.feedbackSummary || input.feedbackLink),
    },
  });

  return {
    recruitmentStatus: updated.recruitment_status,
    recruitmentUpdatedAt: updated.recruitment_updated_at,
  };
}
