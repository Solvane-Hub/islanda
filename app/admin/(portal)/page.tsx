import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert } from '@/components/ui/alert';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { parseDateRange, percentChange, rangeQuery, rate } from '@/lib/admin/date-range';
import { recruitmentStatusLabel } from '@/lib/waitlist/options';
import {
  productUsage,
  userOverview,
  waitlistInsights,
  webAnalytics,
  withComparison,
  type ProductUsage,
  type UserOverview,
  type WaitlistInsights,
  type WebAnalytics,
} from '@/services/admin/reports';
import { Panel, StatCard, TrendChart, formatNumber, formatPercent } from '../_components/charts';
import { PageHeading } from '../_components/page-heading';
import { RangePicker } from '../_components/range-picker';
import { requireAdminPage } from '../_lib/guard';

export const metadata: Metadata = { title: 'Admin overview' };

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdminPage('/admin');
  const range = parseDateRange(await searchParams);
  const db = await createClient();

  let data:
    | {
        web: Awaited<ReturnType<typeof withComparison<WebAnalytics>>>;
        waitlist: WaitlistInsights;
        users: UserOverview;
        usage: ProductUsage;
      }
    | undefined;
  try {
    const [web, waitlist, users, usage] = await Promise.all([
      withComparison(range, (f, t) => webAnalytics(db, f, t)),
      waitlistInsights(db, range.from, range.to),
      userOverview(db, range.from, range.to),
      productUsage(db, range.from, range.to),
    ]);
    data = { web, waitlist, users, usage };
  } catch (error) {
    logger.error('admin.overview_failed', {
      code: error instanceof Error ? error.name : 'unknown',
    });
  }

  const q = rangeQuery(range);

  return (
    <>
      <PageHeading
        title="Overview"
        description="Traffic, waitlist, questionnaire, users and pilot recruitment at a glance. Every figure is computed from stored records; automated test records are excluded."
      />
      <RangePicker action="/admin" range={range} />

      {!data ? (
        <Alert tone="error">
          <p>The overview could not be loaded just now. Refresh the page to try again.</p>
        </Alert>
      ) : (
        <>
          {!data.web.current.tracking_started_at ? (
            <Alert tone="info">
              <p>
                Website analytics have not recorded any visits yet. Collection starts when this
                release is deployed; earlier traffic history is not available. Waitlist, user and
                product figures below come from records that already existed.
              </p>
            </Alert>
          ) : (
            <p className="text-foreground-muted text-xs">
              Website analytics collection began{' '}
              {data.web.current.tracking_started_at.slice(0, 16).replace('T', ' ')} UTC. Earlier
              traffic history is not available in this dashboard.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Unique visitors (estimate)"
              value={formatNumber(data.web.current.totals.visitors)}
              delta={percentChange(
                data.web.current.totals.visitors,
                data.web.previous?.totals.visitors,
              )}
            />
            <StatCard
              label="Waitlist signups"
              value={formatNumber(data.web.current.totals.signups)}
              delta={percentChange(
                data.web.current.totals.signups,
                data.web.previous?.totals.signups,
              )}
              hint={`${formatNumber(data.waitlist.totals.all_time_signups)} all time`}
            />
            <StatCard
              label="Visitor → signup"
              value={formatPercent(
                rate(data.web.current.totals.signups, data.web.current.totals.visitors),
              )}
              hint="Signups ÷ unique visitors in the range"
            />
            <StatCard
              label="Questionnaire completed"
              value={formatPercent(
                rate(data.waitlist.totals.survey_completed, data.waitlist.totals.signups),
              )}
              hint={`${data.waitlist.totals.survey_completed} of ${data.waitlist.totals.signups} signups`}
            />
            <StatCard
              label="Registered users"
              value={formatNumber(data.users.totals.users)}
              hint={`${data.users.totals.new_users} new in range`}
            />
            <StatCard
              label="Active users"
              value={formatNumber(data.usage.totals.active_users)}
              hint="Did at least one recorded action or app page view"
            />
            <StatCard
              label="Business profiles"
              value={formatNumber(data.users.totals.businesses)}
              hint={`${data.users.totals.onboarding_completed} with onboarding completed`}
            />
            <StatCard
              label="Nova requests"
              value={formatNumber(data.usage.nova.requests)}
              hint={`${data.usage.nova.answered_with_evidence} answered with quoted evidence`}
            />
          </div>

          <Panel title="Visitors and signups by day" description="UTC days in the selected range.">
            <TrendChart
              title="Visitors and signups by day"
              days={data.web.current.daily.map((d) => ({
                day: d.day,
                values: { visitors: d.visitors, signups: d.signups },
              }))}
              series={[
                { key: 'visitors', label: 'Unique visitors (estimate)' },
                { key: 'signups', label: 'Waitlist signups' },
              ]}
            />
          </Panel>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel
              title="Pilot recruitment pipeline"
              description="Signups in the selected range, by what the team has done."
            >
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(['not_contacted', 'contacted', 'confirmed', 'tested'] as const).map((status) => (
                  <li key={status} className="rounded-xl border border-white/10 p-3">
                    <p className="text-foreground-muted text-xs">
                      {recruitmentStatusLabel(status)}
                    </p>
                    <p className="text-on-ink text-xl font-semibold tabular-nums">
                      {formatNumber(
                        data.waitlist.recruitment.find((r) => r.value === status)?.count ?? 0,
                      )}
                    </p>
                  </li>
                ))}
              </ul>
              <Link
                href="/admin/recruitment"
                className="text-foreground text-xs underline underline-offset-2"
              >
                Open pilot recruitment
              </Link>
            </Panel>
            <Panel
              title="Where to next"
              description="Each section has its own filters and exports."
            >
              <ul className="text-foreground grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                <li>
                  <Link href={`/admin/analytics?${q}`} className="underline underline-offset-2">
                    Website traffic and funnel
                  </Link>
                </li>
                <li>
                  <Link href={`/admin/questionnaire?${q}`} className="underline underline-offset-2">
                    Questionnaire responses
                  </Link>
                </li>
                <li>
                  <Link href={`/admin/usage?${q}`} className="underline underline-offset-2">
                    Product usage
                  </Link>
                </li>
                <li>
                  <Link href={`/admin/users?${q}`} className="underline underline-offset-2">
                    Users and businesses
                  </Link>
                </li>
              </ul>
            </Panel>
          </div>
        </>
      )}
    </>
  );
}
