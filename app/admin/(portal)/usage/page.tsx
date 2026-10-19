import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { parseDateRange, percentChange, rangeQuery, rate } from '@/lib/admin/date-range';
import { featureLabel } from '@/lib/admin/labels';
import { productUsage, withComparison, type ProductUsage } from '@/services/admin/reports';
import {
  BarList,
  DataTable,
  Funnel,
  Panel,
  StatCard,
  TrendChart,
  formatNumber,
  formatPercent,
} from '../../_components/charts';
import { PageHeading } from '../../_components/page-heading';
import { RangePicker } from '../../_components/range-picker';
import { requireAdminPage } from '../../_lib/guard';

export const metadata: Metadata = { title: 'Product usage' };

type SearchParams = Record<string, string | string[] | undefined>;

export default async function ProductUsagePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdminPage('/admin/usage');
  const range = parseDateRange(await searchParams);
  const db = await createClient();

  let report: { current: ProductUsage; previous: ProductUsage | null } | null = null;
  try {
    report = await withComparison(range, (f, t) => productUsage(db, f, t));
  } catch (error) {
    logger.error('admin.usage_failed', { code: error instanceof Error ? error.name : 'unknown' });
  }

  return (
    <>
      <PageHeading
        title="Product Usage"
        description="What signed-in people do inside Islanda. Workflow events (business created, intake saved, Nova answered, documents attached…) come from the application's own audit log; app page views come from first-party analytics. Test accounts and the administrators are excluded. Nova questions, document contents and financial figures are never collected."
      >
        <Link
          href={`/admin/exports/product-features?${rangeQuery(range)}`}
          prefetch={false}
          className={buttonVariants({ variant: 'secondary', size: 'sm' })}
        >
          Export features CSV
        </Link>
      </PageHeading>
      <RangePicker action="/admin/usage" range={range} />

      {!report ? (
        <Alert tone="error">
          <p>Product usage could not be loaded just now. Refresh the page to try again.</p>
        </Alert>
      ) : (
        <Body r={report.current} p={report.previous} />
      )}
    </>
  );
}

function Body({ r, p }: { r: ProductUsage; p: ProductUsage | null }) {
  return (
    <>
      <Alert tone="info">
        <p>
          Recorded workflow actions are available from{' '}
          {r.action_history_started_at ? r.action_history_started_at.slice(0, 10) : 'n/a'}. App page
          views are{' '}
          {r.page_view_tracking_started_at
            ? `available from ${r.page_view_tracking_started_at.slice(0, 10)}`
            : 'not collected yet — collection begins when this release is deployed'}
          . While Islanda is waitlist-only, founders cannot sign in, so most activity here is from
          the team and invited testers.
        </p>
      </Alert>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Active users"
          value={formatNumber(r.totals.active_users)}
          delta={percentChange(r.totals.active_users, p?.totals.active_users)}
          hint="At least one recorded action or app page view"
        />
        <StatCard
          label="DAU / WAU / MAU"
          value={`${r.totals.dau} / ${r.totals.wau} / ${r.totals.mau}`}
          hint="Ending at the end of the range"
        />
        <StatCard
          label="New / returning active"
          value={`${r.totals.new_active_users} / ${r.totals.returning_active_users}`}
          hint="New = first ever activity in this range"
        />
        <StatCard
          label="Recorded actions"
          value={formatNumber(r.totals.actions)}
          delta={percentChange(r.totals.actions, p?.totals.actions)}
        />
        <StatCard
          label="Onboarding completion"
          value={formatPercent(rate(r.onboarding.completed_users, r.onboarding.started_users))}
          hint={`${r.onboarding.completed_users} of ${r.onboarding.started_users} users who started intake`}
        />
        <StatCard
          label="Businesses created"
          value={formatNumber(r.business.created)}
          hint={`${r.business.built} new (build) · ${r.business.imported} existing (manage)`}
        />
        <StatCard
          label="Documents & evidence"
          value={formatNumber(r.documents.added + r.documents.evidence_attached)}
          hint={`${r.documents.users} users`}
        />
        <StatCard
          label="Nova answered with evidence"
          value={formatPercent(rate(r.nova.answered_with_evidence, r.nova.requests))}
          hint={`${r.nova.answered_with_evidence} of ${r.nova.requests} requests · ${r.nova.failed} failed`}
        />
      </div>

      <Panel title="Active users and actions by day" description="UTC days.">
        <TrendChart
          title="Active users and actions by day"
          days={r.daily.map((d) => ({
            day: d.day,
            values: { active_users: d.active_users, actions: d.actions },
          }))}
          series={[
            { key: 'active_users', label: 'Active users' },
            { key: 'actions', label: 'Recorded actions' },
          ]}
        />
      </Panel>

      <Panel
        title="Feature adoption"
        description="Users who used each feature in the range, and how often."
      >
        {r.features.length === 0 ? (
          <p className="text-foreground-muted text-sm">No feature use recorded in this range.</p>
        ) : (
          <DataTable
            caption="Feature adoption"
            headers={['Feature', 'Users', 'Recorded actions', 'Page views']}
            rows={r.features.map((f) => [
              featureLabel(f.feature),
              formatNumber(f.users),
              formatNumber(f.actions),
              formatNumber(f.views),
            ])}
          />
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Onboarding" description="Users in the range.">
          <Funnel
            steps={[
              { label: 'Started intake', value: r.onboarding.started_users },
              { label: 'Completed intake', value: r.onboarding.completed_users },
            ]}
          />
          <p className="text-foreground-muted text-xs">
            {formatNumber(r.onboarding.steps_saved)} intake steps saved.
          </p>
        </Panel>
        <Panel
          title="Nova"
          description="Operational outcomes only — questions are never stored in analytics."
        >
          <BarList
            unit="requests"
            items={[
              { label: 'Answered with quoted evidence', value: r.nova.answered_with_evidence },
              {
                label: 'No matching evidence / refused (by design)',
                value: r.nova.refused_or_no_evidence,
              },
              { label: 'Failed', value: r.nova.failed },
              { label: 'Rate limited', value: r.nova.rate_limited },
            ]}
          />
          <p className="text-foreground-muted text-xs">
            {formatNumber(r.nova.users)} users · a refusal is a designed outcome, not an error.
          </p>
        </Panel>
        <Panel
          title="Errors"
          description="Failed saves and failed Nova requests, by safe category."
        >
          <BarList
            unit="errors"
            items={r.errors.map((e) => ({ label: e.label, value: e.count }))}
            emptyText="No errors recorded in this range."
          />
        </Panel>
        <Panel title="Business profiles" description="Recorded business actions.">
          <BarList
            unit="actions"
            items={[
              { label: 'Created', value: r.business.created },
              { label: 'New business (build)', value: r.business.built },
              { label: 'Existing business (manage)', value: r.business.imported },
              { label: 'Updated', value: r.business.updated },
              { label: 'Archived', value: r.business.archived },
            ]}
          />
        </Panel>
      </div>

      <Panel
        title="Weekly retention cohorts"
        description="Users grouped by the week of their first recorded activity; each column is how many were active again 1–4 weeks later. Small numbers — read with care."
      >
        {r.cohorts.length === 0 ? (
          <p className="text-foreground-muted text-sm">
            Not enough history in this range for cohorts.
          </p>
        ) : (
          <DataTable
            caption="Weekly retention cohorts"
            headers={['First week', 'Users', 'Week +1', 'Week +2', 'Week +3', 'Week +4']}
            rows={r.cohorts.map((c) => [
              c.week,
              formatNumber(c.size),
              ...[c.w1, c.w2, c.w3, c.w4].map((w) => `${w} (${formatPercent(rate(w, c.size), 0)})`),
            ])}
          />
        )}
      </Panel>
    </>
  );
}
