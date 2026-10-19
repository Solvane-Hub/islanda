import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { parseDateRange, percentChange, rangeQuery, rate } from '@/lib/admin/date-range';
import { FUNNEL_STEP_LABELS } from '@/lib/admin/labels';
import { webAnalytics, withComparison, type WebAnalytics } from '@/services/admin/reports';
import {
  BarList,
  DataTable,
  Funnel,
  NoData,
  Panel,
  StatCard,
  TrendChart,
  formatNumber,
  formatPercent,
} from '../../_components/charts';
import { PageHeading } from '../../_components/page-heading';
import { RangePicker } from '../../_components/range-picker';
import { requireAdminPage } from '../../_lib/guard';

export const metadata: Metadata = { title: 'Website analytics' };

type SearchParams = Record<string, string | string[] | undefined>;

export default async function WebsiteAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdminPage('/admin/analytics');
  const range = parseDateRange(await searchParams);
  const db = await createClient();

  let report: { current: WebAnalytics; previous: WebAnalytics | null } | null = null;
  try {
    report = await withComparison(range, (f, t) => webAnalytics(db, f, t));
  } catch (error) {
    logger.error('admin.web_analytics_failed', {
      code: error instanceof Error ? error.name : 'unknown',
    });
  }

  const exportQuery = rangeQuery(range);

  return (
    <>
      <PageHeading
        title="Website Analytics"
        description="Visits to the public Islanda website and how they convert into waitlist signups. Collected first-party, without advertising trackers. Page views, sessions and unique visitors are different measures — a unique-visitor count is an estimate, not a count of people."
      >
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/admin/exports/traffic-daily?${exportQuery}`}
            className={buttonVariants({ variant: 'secondary', size: 'sm' })}
            prefetch={false}
          >
            Export daily CSV
          </Link>
          <Link
            href={`/admin/exports/funnel?${exportQuery}`}
            className={buttonVariants({ variant: 'secondary', size: 'sm' })}
            prefetch={false}
          >
            Export funnel CSV
          </Link>
        </div>
      </PageHeading>
      <RangePicker action="/admin/analytics" range={range} />

      {!report ? (
        <Alert tone="error">
          <p>Website analytics could not be loaded just now. Refresh the page to try again.</p>
        </Alert>
      ) : (
        <Body report={report.current} previous={report.previous} />
      )}

      <Panel
        title="How these numbers are measured"
        description="Definitions used throughout this page."
      >
        <ul className="text-foreground-muted flex list-disc flex-col gap-1.5 pl-5 text-xs text-pretty">
          <li>
            <strong className="text-foreground">Page view</strong> — one public page shown. Client
            navigations count once per distinct page; admin, API and sign-in pages are never
            tracked.
          </li>
          <li>
            <strong className="text-foreground">Unique visitor (estimate)</strong> — distinct
            pseudonymous visitor keys. A visitor who allowed analytics has a random first-party id;
            everyone else is counted by a keyed hash that rotates daily, so the same person on two
            days counts twice and returning visits cannot be recognised.
          </li>
          <li>
            <strong className="text-foreground">Session</strong> — a visitor&apos;s activity with no
            gap longer than 30 minutes. Source and landing page come from a session&apos;s first
            page.
          </li>
          <li>
            <strong className="text-foreground">Signups</strong> — rows saved in the waitlist in the
            range (authoritative), excluding automated test records. Visitor → signup uses the same
            range for both.
          </li>
          <li>
            Bots and automated clients (crawlers, uptime monitors, link previews, scripts) are
            filtered by user agent before anything is stored. Country is the hosting platform&apos;s
            country code; no IP address, precise location or fingerprint is stored.
          </li>
        </ul>
      </Panel>
    </>
  );
}

function Body({ report, previous }: { report: WebAnalytics; previous: WebAnalytics | null }) {
  const t = report.totals;
  const p = previous?.totals;

  if (!report.tracking_started_at) {
    return (
      <Alert tone="info">
        <p>
          No website visits have been recorded yet. Analytics collection begins when this release is
          deployed, and earlier traffic history is not available. Signups in this range:{' '}
          {formatNumber(t.signups)}.
        </p>
      </Alert>
    );
  }

  return (
    <>
      <p className="text-foreground-muted text-xs">
        Analytics collection began {report.tracking_started_at.slice(0, 16).replace('T', ' ')} UTC.
        Earlier traffic history is not available in this dashboard.
        {t.test_signups_excluded > 0
          ? ` ${t.test_signups_excluded} automated test signup${t.test_signups_excluded === 1 ? '' : 's'} excluded.`
          : ''}
      </p>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Page views"
          value={formatNumber(t.page_views)}
          delta={percentChange(t.page_views, p?.page_views)}
        />
        <StatCard
          label="Unique visitors (estimate)"
          value={formatNumber(t.visitors)}
          delta={percentChange(t.visitors, p?.visitors)}
        />
        <StatCard
          label="Sessions"
          value={formatNumber(t.sessions)}
          delta={percentChange(t.sessions, p?.sessions)}
        />
        <StatCard
          label="Waitlist signups"
          value={formatNumber(t.signups)}
          delta={percentChange(t.signups, p?.signups)}
        />
        <StatCard
          label="Visitor → signup"
          value={formatPercent(rate(t.signups, t.visitors))}
          hint="Signups ÷ unique visitors"
        />
        <StatCard
          label="Questionnaire completion"
          value={formatPercent(rate(t.survey_completed, t.signups))}
          hint={`${t.survey_completed} of ${t.signups} signups · ${t.survey_skipped_events} skips recorded`}
        />
        <StatCard
          label="New / returning"
          value={`${formatNumber(t.new_visitors)} / ${formatNumber(t.returning_visitors)}`}
          hint={`${formatNumber(t.unidentified_visitors)} not identifiable (no analytics consent)`}
        />
        <StatCard
          label="Signup errors"
          value={formatNumber(t.signup_failures)}
          hint="Failed signup attempts (validation, rate limit, server)"
        />
      </div>

      <Panel title="Traffic and signups by day" description="UTC days.">
        <TrendChart
          title="Traffic and signups by day"
          days={report.daily.map((d) => ({
            day: d.day,
            values: { page_views: d.page_views, visitors: d.visitors, signups: d.signups },
          }))}
          series={[
            { key: 'page_views', label: 'Page views' },
            { key: 'visitors', label: 'Unique visitors (estimate)' },
            { key: 'signups', label: 'Signups' },
          ]}
        />
      </Panel>

      <Panel
        title="Signup funnel"
        description="Steps 1–2 come from website analytics; steps 3–8 are the waitlist signups created in this range. Percentages use the previous step and step 1 as denominators."
      >
        <Funnel
          steps={report.funnel.map((s) => ({
            label: FUNNEL_STEP_LABELS[s.step] ?? s.step,
            value: s.value,
          }))}
        />
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel
          title="Traffic sources"
          description="By session; UTM source when present, otherwise the referring site."
        >
          <BarList
            unit="sessions"
            items={report.sources.map((s) => ({
              label: s.label,
              value: s.sessions,
              secondary: `${s.signups} signup${s.signups === 1 ? '' : 's'}`,
            }))}
          />
        </Panel>
        <Panel title="Top landing pages" description="First page of each session.">
          <BarList
            unit="sessions"
            items={report.landing_pages.map((s) => ({
              label: s.label,
              value: s.sessions,
              secondary: `${s.signups} signup${s.signups === 1 ? '' : 's'}`,
            }))}
          />
        </Panel>
        <Panel title="Devices" description="By session.">
          <BarList
            unit="sessions"
            items={report.devices.map((d) => ({ label: d.label, value: d.sessions }))}
          />
        </Panel>
        <Panel
          title="Countries"
          description="Country code from the hosting platform, by session. — means unknown."
        >
          <BarList
            unit="sessions"
            items={report.countries.map((d) => ({ label: d.label, value: d.sessions }))}
          />
        </Panel>
        <Panel title="Browsers" description="Browser family only.">
          <BarList
            unit="sessions"
            items={report.browsers.map((d) => ({ label: d.label, value: d.sessions }))}
          />
        </Panel>
        <Panel title="Most viewed pages">
          <BarList
            unit="views"
            items={report.top_pages.map((d) => ({ label: d.label, value: d.views }))}
          />
        </Panel>
      </div>

      <Panel
        title="Campaigns"
        description="Sessions that arrived with utm_campaign set. Add utm_source, utm_medium and utm_campaign to links you share to see them here."
      >
        {report.campaigns.length === 0 ? (
          <NoData>No tagged campaign traffic in this range.</NoData>
        ) : (
          <DataTable
            caption="Campaign performance"
            headers={['Source', 'Medium', 'Campaign', 'Sessions', 'Signups', 'Conversion']}
            rows={report.campaigns.map((c) => [
              c.source,
              c.medium,
              c.campaign,
              formatNumber(c.sessions),
              formatNumber(c.signups),
              formatPercent(rate(c.signups, c.sessions)),
            ])}
          />
        )}
      </Panel>
    </>
  );
}
