import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { AppError, newCorrelationId } from '@/lib/errors';
import { exportFilename, toCsv, type Cell } from '@/lib/admin/csv';
import type { DateRange } from '@/lib/admin/date-range';
import { FUNNEL_STEP_LABELS, featureLabel, selectionText } from '@/lib/admin/labels';
import type { WaitlistFilters } from '@/lib/validation/waitlist';
import {
  businessJourneyLabel,
  businessStageLabel,
  challengeLabel,
  industryLabel,
  primaryGoalLabel,
  recruitmentStatusLabel,
  testingInterestLabel,
} from '@/lib/waitlist/options';
import { recordAuditEvent } from '@/services/audit';
import type { RequestContext } from '@/services/auth';
import { listWaitlist } from '@/services/waitlist/recruitment';
import { requireAdmin } from './access';
import { productUsage, userList, waitlistInsights, webAnalytics } from './reports';

/**
 * Admin CSV exports. Every export:
 *   - re-checks the administrator on the server (and Postgres checks again);
 *   - is generated on request and streamed back — never stored, so there is
 *     no URL that could be shared or guessed;
 *   - states its filters and coverage in a preamble;
 *   - is audited (report name, row count, filters — never the content);
 *   - never contains passwords, tokens, recruitment-token hashes or secrets.
 */

type Db = SupabaseClient<Database>;

export const EXPORT_REPORTS = [
  'waitlist',
  'recruitment',
  'questionnaire',
  'traffic-daily',
  'traffic-sources',
  'funnel',
  'product-features',
  'users',
] as const;
export type ExportReport = (typeof EXPORT_REPORTS)[number];

const MAX_ROWS = 5000;

export interface ExportFile {
  filename: string;
  body: string;
  rows: number;
}

interface ExportRequest {
  report: ExportReport;
  range: DateRange;
  waitlistFilters: WaitlistFilters;
  /** Include name, email and phone. Off unless explicitly chosen. */
  includeContact: boolean;
}

async function allWaitlistRows(db: Db, filters: WaitlistFilters) {
  const rows = [];
  for (let page = 1; rows.length < MAX_ROWS; page += 1) {
    const result = await listWaitlist(db, { ...filters, page }, 500);
    rows.push(...result.entries);
    if (page >= result.pageCount) break;
  }
  return rows.slice(0, MAX_ROWS);
}

export async function buildExport(
  db: Db,
  request: ExportRequest,
  ctx: RequestContext = {},
): Promise<ExportFile> {
  const correlationId = ctx.correlationId ?? newCorrelationId();
  const admin = await requireAdmin(db, { ...ctx, correlationId });
  const { range } = request;
  const coverage = `Range ${range.label}. Generated ${new Date().toISOString()} by ${admin.email}.`;

  let header: string[];
  let rows: Cell[][];
  let preamble: string[] = [`Islanda — ${request.report}`, coverage];

  switch (request.report) {
    case 'waitlist':
    case 'recruitment': {
      const filters: WaitlistFilters =
        request.report === 'recruitment'
          ? { ...request.waitlistFilters, pool: request.waitlistFilters.pool ?? 'early_access' }
          : request.waitlistFilters;
      const entries = await allWaitlistRows(db, filters);
      const contact = request.includeContact || request.report === 'recruitment';
      header = [
        ...(contact ? ['Name', 'Email', 'Phone'] : []),
        'Business name',
        'Country',
        'City / island / community',
        'Business journey',
        'Industry',
        'Industry (other)',
        'Wants help with (all selected)',
        'Goal (other)',
        'Challenges (all selected)',
        'Challenge (other)',
        'Business stage',
        'Early access interest',
        'Feedback interest',
        'Signed up (UTC)',
        'Questionnaire completed (UTC)',
        'Recruitment status',
        'Contacted on',
        'Confirmed on',
        'Tested on',
        'Feedback summary',
        'Test record',
      ];
      rows = entries.map((e) => [
        ...(contact ? [e.name, e.email, e.phone] : []),
        e.businessName,
        e.country,
        e.cityIsland,
        businessJourneyLabel(e.businessJourney),
        industryLabel(e.industry),
        e.industryOther,
        selectionText(e.primaryGoals, primaryGoalLabel),
        e.goalOther,
        selectionText(e.challenges, challengeLabel),
        e.challengeOther,
        businessStageLabel(e.businessStage),
        testingInterestLabel(e.testingInterest),
        testingInterestLabel(e.feedbackInterest),
        e.signedUpAt,
        e.surveyCompletedAt ?? '',
        recruitmentStatusLabel(e.recruitmentStatus),
        e.contactedOn,
        e.confirmedOn,
        e.testedOn,
        e.feedbackSummary,
        e.isTest ? 'yes' : 'no',
      ]);
      const applied = Object.entries(filters)
        .filter(([k, v]) => v && k !== 'page')
        .map(([k, v]) => `${k}=${String(v)}`);
      preamble = [
        `Islanda — ${request.report}`,
        `Generated ${new Date().toISOString()} by ${admin.email}. Filters: ${applied.join('; ') || 'none'}.`,
        'Internal notes are never exported. Contact details are personal data: store and share this file accordingly.',
      ];
      if (entries.length >= MAX_ROWS) preamble.push(`Truncated at ${MAX_ROWS} rows.`);
      break;
    }

    case 'questionnaire': {
      const r = await waitlistInsights(db, range.from, range.to);
      header = ['Question', 'Answer', 'Count'];
      const block = (
        q: string,
        items: { value: string; count: number }[],
        label: (v: never) => string,
      ) => items.map((i) => [q, label(i.value as never), i.count] as Cell[]);
      rows = [
        ...r.countries.map((c) => ['Country', c.label, c.count] as Cell[]),
        ...block('Business journey', r.journey, businessJourneyLabel),
        ...block('Industry', r.industry, industryLabel),
        ...block('Wants help with (selections)', r.goal, primaryGoalLabel),
        ...block('Challenges (selections)', r.challenge, challengeLabel),
        ...block('Business stage', r.stage, businessStageLabel),
        ...block('Early access interest', r.testing_interest, testingInterestLabel),
        ...block('Feedback interest', r.feedback_interest, testingInterestLabel),
        ...block('Recruitment status', r.recruitment, recruitmentStatusLabel),
      ];
      preamble.push(
        `Signups in range: ${r.totals.signups}; questionnaire completed: ${r.totals.survey_completed}. Test records excluded: ${r.totals.test_records_excluded}.`,
        `Goals and challenges are select-all-that-apply: ${r.totals.goal_respondents ?? 0} respondents made ${r.totals.goal_selections ?? 0} goal selections; ${r.totals.challenge_respondents ?? 0} made ${r.totals.challenge_selections ?? 0} challenge selections.`,
      );
      break;
    }

    case 'traffic-daily': {
      const r = await webAnalytics(db, range.from, range.to);
      header = ['Day (UTC)', 'Page views', 'Unique visitors (estimate)', 'Waitlist signups'];
      rows = r.daily.map((d) => [d.day, d.page_views, d.visitors, d.signups]);
      preamble.push(
        r.tracking_started_at
          ? `Website analytics collection began ${r.tracking_started_at}. Earlier days show 0 page views because nothing was collected, not because there was no traffic.`
          : 'No website analytics have been collected yet.',
      );
      break;
    }

    case 'traffic-sources': {
      const r = await webAnalytics(db, range.from, range.to);
      header = ['Kind', 'Source / page', 'Sessions', 'Signups'];
      rows = [
        ...r.sources.map((s) => ['Source', s.label, s.sessions, s.signups] as Cell[]),
        ...r.landing_pages.map((s) => ['Landing page', s.label, s.sessions, s.signups] as Cell[]),
        ...r.campaigns.map(
          (c) =>
            [
              'Campaign',
              `${c.source} / ${c.medium} / ${c.campaign}`,
              c.sessions,
              c.signups,
            ] as Cell[],
        ),
      ];
      break;
    }

    case 'funnel': {
      const r = await webAnalytics(db, range.from, range.to);
      header = ['Step', 'Count', '% of previous step', '% of visitors'];
      const visitors = r.funnel[0]?.value ?? 0;
      rows = r.funnel.map((s, i) => {
        const prev = i > 0 ? r.funnel[i - 1]!.value : null;
        return [
          FUNNEL_STEP_LABELS[s.step] ?? s.step,
          s.value,
          prev ? ((s.value / prev) * 100).toFixed(1) : '',
          visitors ? ((s.value / visitors) * 100).toFixed(1) : '',
        ];
      });
      preamble.push(
        'Steps 1–2 come from website analytics; steps 3–8 are the waitlist signups created in the range (test records excluded).',
      );
      break;
    }

    case 'product-features': {
      const r = await productUsage(db, range.from, range.to);
      header = ['Feature', 'Users', 'Recorded actions', 'Page views'];
      rows = r.features.map((f) => [featureLabel(f.feature), f.users, f.actions, f.views]);
      preamble.push(
        `Actions come from the application audit log (history from ${r.action_history_started_at ?? 'n/a'}); page views from analytics (from ${r.page_view_tracking_started_at ?? 'not yet collected'}). Test accounts and administrators are excluded.`,
      );
      break;
    }

    case 'users': {
      const all = [];
      for (let page = 1; all.length < MAX_ROWS; page += 1) {
        const r = await userList(db, { search: null, includeTest: false, page });
        all.push(...r.rows);
        if (page >= r.pageCount) break;
      }
      header = [
        ...(request.includeContact ? ['Email', 'Name'] : []),
        'Account created (UTC)',
        'Last sign-in (UTC)',
        'Email confirmed',
        'Businesses',
        'Onboarding completed',
        'Documents',
        'Last activity (UTC)',
      ];
      rows = all.map((u) => [
        ...(request.includeContact ? [u.email, u.full_name] : []),
        u.created_at,
        u.last_sign_in_at,
        u.confirmed ? 'yes' : 'no',
        u.businesses,
        u.onboarding_completed,
        u.documents,
        u.last_activity_at,
      ]);
      preamble.push('Test accounts excluded.');
      break;
    }

    default:
      throw new AppError({ code: 'NOT_FOUND', humanMessage: 'Unknown report.', correlationId });
  }

  await recordAuditEvent({
    event: 'admin.export',
    actorId: admin.userId,
    correlationId,
    ipAddress: ctx.ipAddress ?? null,
    userAgent: ctx.userAgent ?? null,
    metadata: {
      report: request.report,
      rows: rows.length,
      range: `${range.fromDay}..${range.toDay}`,
      includeContact: request.includeContact || request.report === 'recruitment',
    },
  });

  return {
    filename: exportFilename(request.report),
    body: toCsv(header, rows, preamble),
    rows: rows.length,
  };
}
