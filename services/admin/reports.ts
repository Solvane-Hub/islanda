import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/database';
import type { DateRange } from '@/lib/admin/date-range';
import {
  listUsers,
  runRangeReport,
  userDetail,
  listAuditEvents,
  type AuditRow,
} from '@/lib/db/admin';

/**
 * Admin reports. Every number here is computed in Postgres from stored rows
 * by the admin-only SQL functions — nothing is estimated, sampled or filled
 * in. The functions refuse anyone who is not a platform administrator on an
 * MFA session, so callers need no extra privilege and get none.
 *
 * Shapes mirror the SQL in 20261018000000_admin_portal_and_analytics.sql.
 */

type Db = SupabaseClient<Database>;

export interface LabelCount {
  label: string;
  count: number;
}
export interface ValueCount {
  value: string;
  count: number;
}

export interface WebAnalytics {
  tracking_started_at: string | null;
  totals: {
    page_views: number;
    visitors: number;
    sessions: number;
    new_visitors: number;
    returning_visitors: number;
    unidentified_visitors: number;
    form_started: number;
    signup_events: number;
    signups: number;
    survey_started: number;
    survey_completed: number;
    survey_skipped_events: number;
    signup_failures: number;
    test_signups_excluded: number;
  };
  funnel: { step: string; value: number }[];
  daily: { day: string; page_views: number; visitors: number; signups: number }[];
  sources: { label: string; sessions: number; signups: number }[];
  landing_pages: { label: string; sessions: number; signups: number }[];
  top_pages: { label: string; views: number }[];
  devices: { label: string; sessions: number }[];
  browsers: { label: string; sessions: number }[];
  countries: { label: string; sessions: number }[];
  campaigns: {
    source: string;
    medium: string;
    campaign: string;
    sessions: number;
    signups: number;
  }[];
}

export interface WaitlistInsights {
  totals: {
    signups: number;
    all_time_signups: number;
    survey_started: number;
    survey_completed: number;
    with_phone: number;
    test_records_excluded: number;
  };
  daily: { day: string; signups: number }[];
  countries: LabelCount[];
  cities: LabelCount[];
  journey: ValueCount[];
  industry: ValueCount[];
  goal: ValueCount[];
  challenge: ValueCount[];
  stage: ValueCount[];
  testing_interest: ValueCount[];
  feedback_interest: ValueCount[];
  recruitment: ValueCount[];
}

export interface UserOverview {
  totals: {
    users: number;
    new_users: number;
    active_users: number;
    dau: number;
    wau: number;
    mau: number;
    businesses: number;
    businesses_archived: number;
    businesses_created: number;
    onboarding_started: number;
    onboarding_completed: number;
    documents: number;
    documents_created: number;
    goals: number;
    test_accounts_excluded: number;
  };
  businesses_per_user: LabelCount[];
  daily: { day: string; new_users: number; active_users: number }[];
  countries: LabelCount[];
  industries: LabelCount[];
}

export interface ProductUsage {
  page_view_tracking_started_at: string | null;
  action_history_started_at: string | null;
  totals: {
    active_users: number;
    actions: number;
    page_views: number;
    dau: number;
    wau: number;
    mau: number;
    new_active_users: number;
    returning_active_users: number;
  };
  features: { feature: string; actions: number; views: number; users: number }[];
  daily: { day: string; active_users: number; actions: number }[];
  onboarding: { started_users: number; completed_users: number; steps_saved: number };
  business: { created: number; built: number; imported: number; updated: number; archived: number };
  documents: { added: number; evidence_attached: number; users: number };
  nova: {
    requests: number;
    answered_with_evidence: number;
    refused_or_no_evidence: number;
    failed: number;
    rate_limited: number;
    users: number;
  };
  errors: LabelCount[];
  cohorts: { week: string; size: number; w1: number; w2: number; w3: number; w4: number }[];
}

export interface UserRow {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  confirmed: boolean;
  banned: boolean;
  is_test: boolean;
  is_admin: boolean;
  businesses: number;
  onboarding_completed: number;
  documents: number;
  last_activity_at: string | null;
}

export interface UserDetail {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  confirmed: boolean;
  banned: boolean;
  is_test: boolean;
  is_admin: boolean;
  mfa_factors: number;
  businesses: {
    id: string;
    name: string;
    industry: string | null;
    country_code: string | null;
    status: string;
    mode: string | null;
    archived: boolean;
    created_at: string;
    onboarding_step: number | null;
    onboarding_completed_at: string | null;
    documents: number;
    goals: number;
  }[];
  features: { feature: string; actions: number; last_at: string }[];
  recent_activity: { at: string; event: string; feature: string | null }[];
}

function asReport<T>(data: Json): T {
  return data as unknown as T;
}

export async function webAnalytics(db: Db, from: Date, to: Date): Promise<WebAnalytics> {
  return asReport(
    await runRangeReport(db, 'admin_web_analytics', from.toISOString(), to.toISOString()),
  );
}

export async function waitlistInsights(db: Db, from: Date, to: Date): Promise<WaitlistInsights> {
  return asReport(
    await runRangeReport(db, 'admin_waitlist_insights', from.toISOString(), to.toISOString()),
  );
}

export async function userOverview(db: Db, from: Date, to: Date): Promise<UserOverview> {
  return asReport(
    await runRangeReport(db, 'admin_user_overview', from.toISOString(), to.toISOString()),
  );
}

export async function productUsage(db: Db, from: Date, to: Date): Promise<ProductUsage> {
  return asReport(
    await runRangeReport(db, 'admin_product_usage', from.toISOString(), to.toISOString()),
  );
}

/** A report for the selected range and, when asked for and available, the previous period. */
export async function withComparison<T>(
  range: DateRange,
  load: (from: Date, to: Date) => Promise<T>,
): Promise<{ current: T; previous: T | null }> {
  const [current, previous] = await Promise.all([
    load(range.from, range.to),
    range.compare && range.previous
      ? load(range.previous.from, range.previous.to)
      : Promise.resolve(null),
  ]);
  return { current, previous };
}

export const USERS_PAGE_SIZE = 25;

export async function userList(
  db: Db,
  args: { search: string | null; includeTest: boolean; page: number },
): Promise<{ total: number; rows: UserRow[]; page: number; pageCount: number }> {
  const search = args.search?.trim().slice(0, 100) || null;
  const data = asReport<{ total: number; rows: UserRow[] }>(
    await listUsers(db, {
      search,
      includeTest: args.includeTest,
      offset: (args.page - 1) * USERS_PAGE_SIZE,
      limit: USERS_PAGE_SIZE,
    }),
  );
  return {
    total: data.total,
    rows: data.rows,
    page: args.page,
    pageCount: Math.max(1, Math.ceil(data.total / USERS_PAGE_SIZE)),
  };
}

export async function userDetailFor(db: Db, userId: string): Promise<UserDetail | null> {
  const data = await userDetail(db, userId);
  return data ? asReport<UserDetail>(data) : null;
}

export const AUDIT_PAGE_SIZE = 50;

export async function auditLog(
  db: Db,
  args: { from: Date; to: Date; prefix: string | null; page: number },
): Promise<{ rows: AuditRow[]; total: number; page: number; pageCount: number }> {
  const { rows, total } = await listAuditEvents(db, {
    from: args.from.toISOString(),
    to: args.to.toISOString(),
    prefix: args.prefix,
    offset: (args.page - 1) * AUDIT_PAGE_SIZE,
    limit: AUDIT_PAGE_SIZE,
  });
  return {
    rows,
    total,
    page: args.page,
    pageCount: Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE)),
  };
}

export type { AuditRow };
